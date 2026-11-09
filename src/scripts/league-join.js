// The page a league director shares (/leagues/join/?s=<league season id>).
//
// tdc_league_join_info answers for any signed-in player whether or not the
// season is listed — an unlisted league is simply one you have to be given
// the link to, exactly like a tournament poster. It says where this person
// stands, and so which button they get.
//
// Everything else is the league itself, as much of it as there is (UV, 5 Nov),
// read with the calls the season page makes, every one of them open to any
// signed-in player: the season's info and rules, its own row (status,
// reserves, picture), the fixtures, the teams with their players, and who
// runs it. The rules are drawn from TDCMatchDef's settings, so a new setting
// appears here without this page knowing it exists.
//
// One write, tdc_league_show_interest. What it does depends on how the
// director set the season up: on "interested" it puts the player on the list
// for the director to confirm, and on "self_confirm" they are in straight
// away. The function decides and says which, so this page never has to.
//
// And asking to join a team (UV, 5 Nov; 20261105153021): a player in the
// league and on no team gets a ring on each team card, tdc_request_team to
// ask, tdc_cancel_team_request to take it back. The team's captain takes
// them, or declines, on the season page's Players tab.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'Join a league';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		jumbo: el('jumbo'), pic: el('l-pic'),
		name: el('l-name'), meta: el('l-meta'), facts: el('l-facts'),
		interestBtn: el('interest-btn'), seasonLink: el('season-link'), share: el('share-btn'),
		numbers: el('l-numbers'), notesBox: el('notes-box'), notes: el('l-notes'),
		rules: el('l-rules'), nights: el('l-nights'), nightCount: el('night-count'),
		nightKey: el('night-key'), nightPicked: el('night-picked'), nightNote: el('night-note'),
		teams: el('l-teams'), teamCount: el('team-count'), teamsHint: el('teams-hint'),
		officials: el('l-officials'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the join page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');
	let info = null;        // tdc_league_join_info: where I stand
	let season = null;      // tdc_league_season_info: rules, notes, venue
	let seasonRow = null;   // status, reserves, entries, the league's picture
	let fixtures = [];
	let teams = [];
	let teamPictures = new Map();
	let rosters = new Map();
	let officials = [];
	let myPlayerId = null;
	let asked = new Set();      // the teams I have asked to join (tdc_team_join_requests)

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}
	const time = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

	// A player's picture, or their initials; a tap opens their profile.
	function face(playerId, name, path) {
		const box = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		box.title = name || '';
		return TDC.profilePic(box, playerId);
	}

	function personLink(playerId, name, path, sub) {
		const a = node('a', 'person');
		a.href = '/players/?p=' + encodeURIComponent(playerId);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name));
		if (sub) names.append(node('span', 'person-sub', sub));
		const pic = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			pic.append(img);
		} else {
			pic.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		a.append(pic, names);
		return a;
	}

	// ─── Reading ───
	// Where I stand first: without it there is no page. The rest together.
	async function load() {
		const { data, error } = await supabaseClient.rpc('tdc_league_join_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league with that link. Check it with whoever sent it.', { seasonId }, els.status);
			return false;
		}

		const [si, row, fx, tm, pics, off, req] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId }),
			supabaseClient.from('tbl_league_seasons').select('status, max_reserves, entry_mode, tbl_leagues(picture_path)').eq('id', seasonId).maybeSingle(),
			supabaseClient.rpc('tdc_league_fixtures', { p_league_season_id: seasonId }),
			supabaseClient.rpc('tdc_league_season_teams', { p_league_season_id: seasonId }),
			supabaseClient.from('tbl_teams').select('id, picture_path').eq('league_season_id', seasonId),
			supabaseClient.rpc('tdc_league_officials', { p_league_season_id: seasonId }),
			supabaseClient.rpc('tdc_team_join_requests', { p_league_season_id: seasonId })
		]);
		for (const r of [si, row, fx, tm, pics, off, req]) {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); return false; }
		}
		season = (si.data || [])[0] || null;
		seasonRow = row.data;
		fixtures = fx.data || [];
		teams = tm.data || [];
		teamPictures = new Map((pics.data || []).map((p) => [p.id, p.picture_path]));
		officials = off.data || [];
		asked = new Set((req.data || []).filter((r) => r.is_mine).map((r) => r.team_id));

		// Every team's players, so a newcomer sees who they would be playing.
		const lists = await Promise.all(teams.map((t) =>
			supabaseClient.rpc('tdc_team_roster', { p_team_id: t.team_id })));
		const fresh = new Map();
		for (let i = 0; i < teams.length; i++) {
			if (lists[i].error) { TDC.showSupabaseError(AREA, lists[i].error, els.status); return false; }
			fresh.set(teams[i].team_id, lists[i].data || []);
		}
		rosters = fresh;

		renderBanner();
		render();
		renderNumbers();
		renderNotes();
		renderRules();
		renderNights();
		renderTeams();
		renderOfficials();
		return true;
	}

	// ─── The banner ───
	function renderBanner() {
		const rules = (season && season.rules) || {};
		const status = seasonRow && seasonRow.status;
		els.jumbo.className = 'jumbo lj-hero' + (status ? ' league-status-' + status : '');

		els.pic.replaceChildren(TDC.leaguePic(seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path));

		els.name.textContent = info.league_name;
		els.meta.textContent = info.name;

		const facts = [];
		facts.push(['Game', D.DISCIPLINE[rules.discipline] || rules.discipline || 'Not set']);
		const when = [info.starts_on ? day(info.starts_on) : null, info.ends_on ? day(info.ends_on) : null].filter(Boolean);
		facts.push(['Dates', when.length ? when.join(' to ') : 'Not set yet']);
		const next = nextNight();
		facts.push(['Next night', next
			? next.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + time(next)
			: 'Not scheduled yet']);

		els.facts.replaceChildren(badges(), ...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));

		const venues = TDC.venueFact(season && season.venues);
		if (venues) els.facts.append(venues);
	}

	function nextNight() {
		const now = Date.now();
		const times = fixtures.map((f) => f.scheduled_at && new Date(f.scheduled_at)).filter((d) => d && d.getTime() >= now);
		times.sort((a, b) => a - b);
		return times[0] || null;
	}

	// ─── Where I stand ───
	// The first row of the details (UV, 9 Nov): the season's status in yellow,
	// then how this person stands with it or how they would get in, in the
	// league search's words.
	const STANDING = {
		interested: 'Your name is down',
		withdrawn: 'You withdrew',
		inactive: 'Inactive',
		suspended: 'Suspended'
	};

	function badges() {
		const status = seasonRow && seasonRow.status;
		const list = node('dd');
		if (status) list.append(node('span', 'badge warn', D.LEAGUE_STATUS[status] || status));
		if (info.my_status === 'active') {
			list.append(node('span', 'badge team-name', 'You are in this league'));
			if (!info.i_confirmed) list.append(node('span', 'badge needs-you', 'Confirm your place'));
		} else if (info.my_status) {
			list.append(node('span', 'badge pending', STANDING[info.my_status] || info.my_status));
		} else if (info.entry_mode === 'ld_only') {
			list.append(node('span', 'badge', 'Added by whoever runs it'));
		} else if (info.entry_mode === 'self_confirm') {
			list.append(node('span', 'badge needs-you', 'Join straight away'));
		} else {
			list.append(node('span', 'badge', 'Taking names'));
		}
		const row = node('div', 'jumbo-fact lj-badges');
		row.append(node('dt', 'lj-sr', 'Status'), list);
		return row;
	}

	// The banner's corner: Share is always there; somebody who is in gets the
	// arrow to the league, somebody who may put their name down the plus.
	function render() {
		els.interestBtn.hidden = true;
		els.seasonLink.hidden = true;
		els.seasonLink.href = '/leagues/season/?s=' + encodeURIComponent(seasonId);

		if (info.my_status === 'active') {
			els.seasonLink.hidden = false;
			wakeIcon(els.seasonLink);
			return;
		}
		const again = info.my_status === 'withdrawn';
		if (!again && (info.my_status || info.entry_mode === 'ld_only')) return;

		const label = again ? 'Put my name down again' : 'Put my name down';
		els.interestBtn.title = label;
		els.interestBtn.setAttribute('aria-label', label);
		els.interestBtn.hidden = false;
		wakeIcon(els.interestBtn);
	}

	// An icon draws itself in the first time its button shows.
	function wakeIcon(b) {
		if (b.tdcRing) return;
		const icon = b.dataset.icon;
		const label = b.getAttribute('aria-label');
		try {
			const face = b.querySelector('.tdc-ring');
			face.innerHTML = TDCRing.svg();
			b.tdcRing = new TDCRing.RingStatus(face, {
				icons: [icon],
				labels: { [icon]: label, empty: label, loading: 'Working' },
				initial: 'empty'
			});
			b.tdcRing.drawTo(icon);
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
		}
	}

	// ─── The numbers ───
	// Counted from the fixtures and the teams, never stored; as the season
	// page's, plus the names waiting to be let in.
	function renderNumbers() {
		const games = fixtures.filter((f) => !f.is_bye);
		const played = games.filter((f) => f.match_status === 'complete' || f.match_status === 'reopened').length;
		const frames = games.reduce((n, f) => n + (f.home_frames || 0) + (f.away_frames || 0), 0);
		const nights = new Set(fixtures.filter((f) => f.scheduled_at).map((f) => new Date(f.scheduled_at).toDateString())).size;

		const tiles = [
			['Teams', teams.length],
			['Players', info.players || 0],
			['Names down', info.interested || 0],
			['Nights', nights],
			['Matches', games.length],
			['Played', played],
			['Frames', frames]
		];
		els.numbers.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'lj-num');
			tile.append(node('span', 'lj-num-value', String(value)), node('span', 'lj-num-label', label));
			return tile;
		}));
	}

	function renderNotes() {
		const text = season && season.notes && season.notes.trim();
		els.notesBox.hidden = !text;
		els.notes.textContent = text || '';
	}

	// ─── The rules ───
	// Every rule the season plays to, in the settings page's groups, worded
	// from TDCMatchDef. A setting its switch makes irrelevant is left out, as
	// the settings page hides it.
	function ruleValue(def, rules) {
		const v = rules[def.key];
		if (def.key === 'win_condition_type') {
			const name = D.WIN_CONDITION[v] || v;
			return v === 'free_play' || !rules.win_condition_target ? name : name + ' ' + rules.win_condition_target;
		}
		if (def.key === 'team_size') {
			const reserves = seasonRow && seasonRow.max_reserves;
			return v + ' a side' + (reserves ? ', up to ' + plural(reserves, 'reserve') : '');
		}
		if (def.type === 'rotation') return v ? 'The league’s own order' : 'The standard rotation';
		if (def.type === 'bool') return v ? 'Yes' : 'No';
		if (def.type === 'select') {
			const options = typeof def.options === 'function' ? def.options() : def.options;
			return (options && options[v]) || String(v);
		}
		if (def.type === 'int') {
			if (/_seconds$/.test(def.key)) return v + ' s';
			const unit = /\((\w+)\)$/.exec(def.label);
			if (unit) return v ? v + ' ' + (v === 1 ? unit[1].replace(/s$/, '') : unit[1]) : 'None';
			return String(v);
		}
		return v == null ? '' : String(v);
	}

	function renderRules() {
		const rules = (season && season.rules) || {};
		const boxes = [];
		for (const group of D.GROUPS.concat(D.LEAGUE_GROUPS)) {
			const rows = [];
			for (const def of D.SETTINGS) {
				if (def.group !== group || def.scope !== 'rules') continue;
				if (def.key === 'win_condition_target') continue;   // said with the win condition
				if (def.when && !def.when(rules)) continue;
				if (rules[def.key] === undefined) continue;
				rows.push([def.label.replace(/\s*\(\w+\)$/, ''), ruleValue(def, rules)]);
				// A night's length follows from the team size.
				if (def.key === 'team_size' && rules.team_size) {
					rows.push(['A night', rules.team_size + ' sessions, ' + rules.team_size * rules.team_size + ' frames']);
				}
			}
			if (!rows.length) continue;
			const box = node('section', 'lj-rule-box');
			box.append(node('h3', 'lj-rule-title', group));
			const dl = node('dl', 'lj-rule-list');
			for (const [k, v] of rows) {
				const row = node('div', 'lj-rule');
				row.append(node('dt', null, k), node('dd', null, v));
				dl.append(row);
			}
			box.append(dl);
			boxes.push(box);
		}
		if (!boxes.length) boxes.push(node('p', 'muted', 'No rules set yet.'));
		els.rules.replaceChildren(...boxes);
	}

	// ─── The nights ───
	// A calendar of the months from the first night to the last (UV, 9 Nov),
	// drawn as the fixtures planner's, a night in its state's colour. A tap
	// says its time and matches under the calendar; a tap again takes that away.
	const pad = (n) => String(n).padStart(2, '0');
	const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
	const dayOfKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
	let nights = new Map();     // day key -> what is known of that night
	let pickedNight = null;     // the day key tapped
	let calCentred = false;     // the calendar starts on the next night's month, once

	function renderNights() {
		const games = fixtures.filter((f) => !f.is_bye);
		const byDay = new Map();
		let undated = 0;
		for (const f of games) {
			if (!f.scheduled_at) { undated++; continue; }
			const d = new Date(f.scheduled_at);
			const key = keyOf(d);
			if (!byDay.has(key)) byDay.set(key, { at: d, total: 0, played: 0, live: 0 });
			const n = byDay.get(key);
			if (d < n.at) n.at = d;
			n.total++;
			if (f.match_status === 'complete' || f.match_status === 'reopened') n.played++;
			if (f.match_status === 'in_progress') n.live++;
		}
		const next = nextNight();
		const nextKey = next && keyOf(next);
		for (const [key, n] of byDay) {
			n.state = n.live ? 'live' : key === nextKey ? 'next' : n.played === n.total ? 'done' : 'later';
			n.said = n.live ? 'Playing'
				: key === nextKey ? 'Next'
				: n.played === n.total ? 'Played'
				: n.played ? n.played + ' of ' + n.total + ' played'
				: '';
		}
		nights = byDay;
		if (!byDay.has(pickedNight)) pickedNight = null;

		els.nightCount.hidden = !byDay.size;
		els.nightCount.textContent = String(byDay.size);
		els.nightKey.hidden = !byDay.size;
		els.nightNote.hidden = !undated;
		els.nightNote.textContent = undated ? plural(undated, 'match', 'matches') + ' not dated yet.' : '';

		if (!byDay.size) {
			els.nights.replaceChildren(node('div', 'empty', 'No nights scheduled yet. Whoever runs the league makes the fixtures.'));
		} else {
			drawCalendar(nextKey);
		}
		markPicked();
		sayPicked();
	}

	function drawCalendar(nextKey) {
		const keys = [...nights.keys()].sort();
		const first = dayOfKey(keys[0]);
		const last = dayOfKey(keys[keys.length - 1]);
		const today = keyOf(new Date());
		const months = [];
		for (let m = new Date(first.getFullYear(), first.getMonth(), 1);
			m <= last; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
			months.push(m);
		}

		let nextMonth = null;
		els.nights.replaceChildren(...months.map((m) => {
			const box = node('div', 'cal-month');
			box.append(node('div', 'cal-month-name', m.toLocaleDateString([], { month: 'long', year: 'numeric' })));

			const table = node('table', 'cal');
			const head = table.createTHead().insertRow();
			['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((d, i) => {
				const th = node('th');
				if (i >= 5) th.append(node('span', 'badge', d)); else th.textContent = d;
				head.append(th);
			});

			const body = table.createTBody();
			const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
			const lead = (m.getDay() + 6) % 7;
			let tr = body.insertRow();
			for (let i = 0; i < lead; i++) tr.insertCell();
			for (let d = 1; d <= days; d++) {
				if (tr.cells.length === 7) tr = body.insertRow();
				const key = keyOf(new Date(m.getFullYear(), m.getMonth(), d));
				const td = tr.insertCell();
				const n = nights.get(key);
				if (n) {
					const b = node('button', 'cal-day is-' + n.state, String(d));
					b.type = 'button';
					b.dataset.night = key;
					b.setAttribute('aria-label', n.at.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
						+ ', ' + nightLine(n));
					td.append(b);
					if (key === nextKey) nextMonth = box;
				} else {
					td.append(node('span', 'cal-num', String(d)));
				}
				if (key === today) td.classList.add('cal-today');
			}
			while (tr.cells.length < 7) tr.insertCell();
			box.append(table);
			return box;
		}));

		if (!calCentred && nextMonth) {
			els.nights.scrollLeft = nextMonth.offsetLeft - (els.nights.clientWidth - nextMonth.offsetWidth) / 2;
		}
		calCentred = true;
	}

	const nightLine = (n) => [time(n.at), plural(n.total, 'match', 'matches'), n.said].filter(Boolean).join(' · ');

	function markPicked() {
		for (const b of els.nights.querySelectorAll('button[data-night]')) {
			const on = b.dataset.night === pickedNight;
			b.classList.toggle('is-picked', on);
			b.setAttribute('aria-pressed', on ? 'true' : 'false');
		}
	}

	function sayPicked() {
		const n = pickedNight && nights.get(pickedNight);
		els.nightPicked.hidden = !n;
		if (!n) { els.nightPicked.replaceChildren(); return; }
		els.nightPicked.replaceChildren(
			node('span', 'lj-picked-day', n.at.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })),
			node('span', 'lj-picked-sub', nightLine(n)));
	}

	// What changes fades out and the new fades in (UV, 24 Oct), at once for
	// somebody who asked for less motion. The last of several quick taps wins.
	let fadeRun = 0;
	function revealMs() {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce') return 0;
		const v = getComputedStyle(document.documentElement).getPropertyValue('--control-reveal').trim();
		const n = parseFloat(v);
		if (isNaN(n)) return 0;
		return v.endsWith('ms') ? n : n * 1000;
	}
	function fadePicked() {
		const ms = revealMs() / 2;
		const run = ++fadeRun;
		const box = els.nightPicked;
		if (!ms) { sayPicked(); return; }
		box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
		setTimeout(() => {
			if (run !== fadeRun) return;
			sayPicked();
			box.getAnimations().forEach((a) => a.cancel());
			box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms });
		}, ms);
	}

	els.nights.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-night]');
		if (!b) return;
		pickedNight = pickedNight === b.dataset.night ? null : b.dataset.night;
		markPicked();       // the mark moves at once; the words underneath fade
		fadePicked();
	});

	// ─── The teams ───
	// Each with its picture, captain, places taken and every player's face.
	// The card opens the team on the season page (its name is the link,
	// stretched over the card); the faces and the ring sit above that link.

	// Whether I may ask to join a team (UV, 5 Nov): in the league, active,
	// and on no team. The database says the same (tdc_request_team).
	function onATeam() {
		for (const roster of rosters.values()) {
			if (roster.some((r) => r.player_id === myPlayerId && r.status !== 'withdrawn')) return true;
		}
		return false;
	}
	const mayAsk = () => !!myPlayerId && info.my_status === 'active' && !onATeam();

	function renderTeams() {
		els.teamCount.hidden = !teams.length;
		els.teamCount.textContent = String(teams.length);
		const ask = mayAsk();
		els.teamsHint.hidden = !ask || !teams.length;
		els.teamsHint.textContent = asked.size
			? 'The captain of a team you asked decides. Tap its ring again to take it back.'
			: 'You are on no team yet. Tap a team’s ring to ask to join it; its captain decides.';

		if (!teams.length) {
			els.teams.replaceChildren(node('div', 'empty', 'No teams yet. Whoever runs the league makes them.'));
			return;
		}
		els.teams.replaceChildren(...teams.map((t) => {
			const card = node('div', 'lj-team');
			if (asked.has(t.team_id)) card.classList.add('is-asked');
			const head = node('span', 'lj-team-head');
			const pic = node('span', 'team-pic');
			pic.append(TDC.teamPic(teamPictures.get(t.team_id)));
			const names = node('span', 'lj-team-names');
			const link = node('a', 'lj-team-name', t.name);
			link.href = '/leagues/season/?s=' + encodeURIComponent(seasonId) + '&team=' + encodeURIComponent(t.team_id);
			names.append(link);
			if ((t.captains || []).length) names.append(node('span', 'lj-team-sub', 'Captain: ' + t.captains.join(', ')));
			head.append(pic, names);
			const places = node('span', 'lj-team-places');
			places.append(node('span', 'lj-team-places-n', String(t.active_players || 0)),
				node('span', 'lj-team-places-of', 'of ' + (t.team_limit || 0)));
			places.title = (t.active_players || 0) + ' of ' + (t.team_limit || 0) + ' places taken';
			head.append(places);
			if (ask) head.append(TDCTeamAsk.ring(t, asked.has(t.team_id), AREA, els.status));
			card.append(head);

			const roster = (rosters.get(t.team_id) || []).filter((r) => r.status !== 'withdrawn');
			const faces = node('span', 'lj-team-faces');
			if (roster.length) faces.append(...roster.map((r) => face(r.player_id, r.display_name, r.avatar_path)));
			else faces.append(node('span', 'lj-team-sub', 'Nobody on it yet'));
			card.append(faces);
			return card;
		}));
	}

	function renderOfficials() {
		if (!officials.length) {
			els.officials.replaceChildren(node('p', 'muted', 'Nobody is listed.'));
			return;
		}
		els.officials.replaceChildren(...officials.map((o) =>
			personLink(o.player_id, o.display_name, o.avatar_path, o.role_name)));
	}

	// Queued, never refused (TDC.writer); a second press joins the first.
	const joinWriter = TDC.writer({
		area: AREA, status: els.status,
		reload: async () => { await load(); return true; },
		after: () => TDC.flushPushes()
	});
	els.interestBtn.addEventListener('click', () => {
		joinWriter.write('Putting your name down', () => supabaseClient.rpc('tdc_league_show_interest', {
			p_league_season_id: seasonId
		}), (data) => data === 'active' ? 'You are in.' : 'Your name is down.', { single: true, dots: els.interestBtn, leaves: true });
	});

	// Asking to join a team, or taking it back: the dots on the ring, which
	// they follow through the re-read to the ring drawn in its place.
	els.teams.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-ask]');
		if (!b || b.disabled) return;
		const teamId = b.dataset.ask;
		const name = b.dataset.name;
		const ring = () => els.teams.querySelector('button[data-ask="' + teamId + '"]');
		if (b.dataset.asked === '1') {
			joinWriter.write('Taking back the request to ' + name, () => supabaseClient.rpc('tdc_cancel_team_request', {
				p_team_id: teamId
			}), () => 'Request to join ' + name + ' taken back.', { single: 'ask|' + teamId, dots: b, follow: ring });
		} else {
			joinWriter.write('Asking to join ' + name, () => supabaseClient.rpc('tdc_request_team', {
				p_team_id: teamId
			}), () => 'Asked to join ' + name + '. Its captain decides.', { single: 'ask|' + teamId, dots: b, follow: ring });
		}
	});

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league in the address. Check the link you were sent.', null, els.status);
			return;
		}
		wakeIcon(els.share);
		TDC.shareButton(els.share, 'season', seasonId, {
			area: AREA, status: els.status, title: () => els.name.textContent
		});
		// Which faces on the teams are mine, so the rings show only to a
		// player on no team.
		const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;
		myPlayerId = me.id;
		await load();
	})(), 'Join a league');
})();
