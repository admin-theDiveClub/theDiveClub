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
		jumbo: el('jumbo'), pic: el('l-pic'), statusBadge: el('l-status'),
		name: el('l-name'), meta: el('l-meta'), facts: el('l-facts'),
		whereLine: el('where-line'), whereDetail: el('where-detail'),
		interestBtn: el('interest-btn'), seasonLink: el('season-link'), share: el('share-btn'),
		numbers: el('l-numbers'), notesBox: el('notes-box'), notes: el('l-notes'),
		rules: el('l-rules'), nights: el('l-nights'), nightCount: el('night-count'),
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
	const ENTRY = {
		ld_only: 'Added by whoever runs it',
		interested: 'Put your name down',
		self_confirm: 'Join straight away'
	};

	function renderBanner() {
		const rules = (season && season.rules) || {};
		const status = seasonRow && seasonRow.status;
		els.jumbo.className = 'jumbo lj-hero' + (status ? ' league-status-' + status : '');
		els.statusBadge.hidden = !status;
		els.statusBadge.textContent = status ? (D.LEAGUE_STATUS[status] || status) : '';

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
		facts.push(['Entries', ENTRY[info.entry_mode] || info.entry_mode]);

		els.facts.replaceChildren(...facts.map(([k, v]) => {
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
	function render() {
		els.interestBtn.hidden = true;
		els.seasonLink.hidden = true;
		els.seasonLink.href = '/leagues/season/?s=' + encodeURIComponent(seasonId);

		// Where this person already stands comes first: somebody who is in
		// does not want to be asked to join.
		if (info.my_status === 'active') {
			els.whereLine.textContent = 'You are in this league.';
			els.whereDetail.textContent = info.i_confirmed
				? ''
				: 'You still have to confirm that you are playing.';
			els.seasonLink.hidden = false;
			return;
		}
		if (info.my_status === 'interested') {
			els.whereLine.textContent = 'Your name is down.';
			els.whereDetail.textContent = 'Whoever runs the league will confirm it. There is nothing else for you to do.';
			return;
		}
		if (info.my_status === 'suspended') {
			els.whereLine.textContent = 'Your place here has been suspended.';
			els.whereDetail.textContent = 'Speak to whoever runs the league.';
			return;
		}
		if (info.my_status === 'withdrawn') {
			els.whereLine.textContent = 'You withdrew from this league.';
			els.whereDetail.textContent = 'You can put your name down again.';
		} else if (info.my_status === 'inactive') {
			els.whereLine.textContent = 'You are marked inactive in this league.';
			els.whereDetail.textContent = 'Speak to whoever runs it.';
			return;
		} else if (info.entry_mode === 'ld_only') {
			els.whereLine.textContent = 'This league is not taking names.';
			els.whereDetail.textContent = 'Whoever runs it adds the players themselves.';
			return;
		} else {
			els.whereLine.textContent = 'Fancy a game?';
			els.whereDetail.textContent = info.entry_mode === 'self_confirm'
				? 'Put your name down and you are in.'
				: 'Put your name down and whoever runs the league will confirm it.';
		}

		els.interestBtn.hidden = false;
		els.interestBtn.textContent = info.my_status === 'withdrawn'
			? 'Put my name down again'
			: 'Put my name down';
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

	// ─── How it is played ───
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
	// Every night with a fixture, in order: its date and time, how many
	// matches and how many are played. The next one is marked.
	function renderNights() {
		const games = fixtures.filter((f) => !f.is_bye);
		const byDay = new Map();
		let undated = 0;
		for (const f of games) {
			if (!f.scheduled_at) { undated++; continue; }
			const d = new Date(f.scheduled_at);
			const key = d.toDateString();
			if (!byDay.has(key)) byDay.set(key, { at: d, total: 0, played: 0, live: 0 });
			const n = byDay.get(key);
			if (d < n.at) n.at = d;
			n.total++;
			if (f.match_status === 'complete' || f.match_status === 'reopened') n.played++;
			if (f.match_status === 'in_progress') n.live++;
		}
		const list = [...byDay.values()].sort((a, b) => a.at - b.at);
		const next = nextNight();
		const nextKey = next && next.toDateString();

		els.nightCount.hidden = !list.length;
		els.nightCount.textContent = String(list.length);

		const rows = list.map((n, i) => {
			const row = node('div', 'lj-night');
			const done = n.played === n.total;
			if (n.at.toDateString() === nextKey) row.classList.add('is-next');
			else if (n.live) row.classList.add('is-live');
			else if (done) row.classList.add('is-done');
			row.append(node('span', 'lj-night-n', String(i + 1)));
			const main = node('span', 'lj-night-main');
			main.append(
				node('span', 'lj-night-day', n.at.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })),
				node('span', 'lj-night-sub', time(n.at) + ' · ' + plural(n.total, 'match', 'matches')));
			row.append(main);
			const state = n.at.toDateString() === nextKey ? 'Next'
				: n.live ? 'Playing'
				: done ? 'Played'
				: n.played ? n.played + ' of ' + n.total + ' played'
				: '';
			if (state) row.append(node('span', 'lj-night-state', state));
			return row;
		});
		if (undated) rows.push(node('p', 'muted', plural(undated, 'match', 'matches') + ' not dated yet.'));
		if (!rows.length) rows.push(node('div', 'empty', 'No nights scheduled yet. Whoever runs the league makes the fixtures.'));
		els.nights.replaceChildren(...rows);
	}

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
		}), (data) => data === 'active' ? 'You are in.' : 'Your name is down.', { single: true });
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
