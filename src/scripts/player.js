// A player's profile (/players/?p=<player id>, UV's combined design, 5 Nov).
//
// The hero (picture left of the centre line, names right; a tap on a photo
// shows it large; Challenge, Follow, Share and More as ring icons), then a
// toggle between three tabs:
//   • Profile: teams with each team's place, form (the last 10 frames),
//     stats over a period, the frame difference per night, competitions
//     (league and tournament matches) and recent matches a page at a time,
//     about.
//   • Head to head: your meetings. Only frames the two of you played against
//     each other count (tdc_head_to_head).
//   • Compare: both profiles side by side, you on the left, either side of a
//     centre line, each half headed by its player's picture and names, which
//     stay at the top as the page scrolls (UV, 5 Nov).
// Your own profile has no toggle and no buttons for others.
//
// Each Profile section is drawn by one function for a "view": a player and
// the boxes to draw into (data-part). The Profile tab is one view, the
// player shown; Compare is two, you and them, so both sides are the Profile
// tab's own drawing, laid down the page where Compare asks (vertical).
//
// Every number is counted here from what tdc_player_profile returns (frames
// are the only record): only finished matches and their finished frames. The
// match lists show every match in any state, with its state strip (UV, 5 Nov;
// migration 20261105064410). A team night is the player's match too, won if
// their side won it (UV, 5 Nov). "Lags" is frames broken, as the standings
// count it.
//
// Challenge, Follow, the rematch, Home venue and More have nothing behind
// them yet (UV, 5 Nov: shown, a tap says so). Honours are off the page until
// they are built (UV, 5 Nov).
//
// Needs: tdc.js, match-settings.js (TDCMatchDef), league-standings-def.js
// (TDCStandings, for a team's place).

(() => {
	const AREA = 'Player';
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('pp-status'), body: el('pp-body'),
		pic: el('pp-pic'), verified: el('pp-verified'), name: el('pp-name'), full: el('pp-full'),
		actions: el('pp-actions'), views: el('pp-views'),
		profile: el('pp-tab-profile'), h2h: el('pp-tab-h2h'), cmpTab: el('pp-tab-cmp'),
		aboutTitle: el('pp-about-title'), about: el('pp-about'), cAbout: el('pp-c-about'),
		vs: el('pp-vs'), split: el('pp-split'), vsLine: el('pp-vs-line'),
		meeting: el('pp-meeting'), meetings: el('pp-meetings'),
		follow: el('pp-follow'), find: el('pp-find'), findInput: el('pp-find-input'),
		findNote: el('pp-find-note'), findResults: el('pp-find-results'),
		following: el('pp-following'), followingNote: el('pp-following-note')
	};

	const params = new URLSearchParams(location.search);
	const playerId = params.get('p');
	let them = null;     // tdc_player_profile of the player shown
	let mine = null;     // and of the person looking, for side by side
	let h2h = null;      // tdc_head_to_head
	let days = 0;        // the period: 0 all time, else the last n days
	let meetingsAll = false;
	let iFollow = false; // tdc_i_follow: private to the person looking (UV, 5 Nov)

	// ─── Small helpers ───
	function node(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined && text !== null) n.textContent = text;
		return n;
	}
	const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	// A player's picture (player-avatars) or their initials.
	function avatar(path, name, cls) {
		const box = node('span', cls || 'pp-person-pic');
		const url = TDC.pictureUrl('player-avatars', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = initials(name);
		}
		return box;
	}
	const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '–');
	const day = (iso) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
	const monthYear = (iso) => new Date(iso).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
	const dayKey = (iso) => { const d = new Date(iso); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
	const result = (m) => (m.mine > m.theirs ? 'W' : m.mine < m.theirs ? 'L' : 'D');
	const ordinal = (n) => {
		const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	};
	const kindLabel = (m) => (m.kind === 'social' ? 'Social' : m.competition || (m.kind === 'league' ? 'League' : 'Tournament'));
	const matchHref = (m) => (m.team_match ? '/leagues/card/?m=' : '/match/?id=') + encodeURIComponent(m.match_id);
	const playerHref = (id) => '/players/?p=' + encodeURIComponent(id);
	const themName = () => (them ? them.player.display_name : 'them');

	// A win or a loss as a dot: green and glowing, an empty ring, or half for a draw.
	function resultDot(r, title) {
		const d = node('span', 'pp-dot pp-dot-' + r.toLowerCase());
		d.title = title || { W: 'Won', L: 'Lost', D: 'Drawn' }[r];
		return d;
	}

	// ─── Counting ───
	// The player's finished matches and their frames inside the period: the
	// lists show every state, but only a finished match is counted.
	function inPeriod(p) {
		const since = days ? Date.now() - days * 86400000 : 0;
		const matches = p.matches.filter((m) => m.status === 'complete' && (!since || new Date(m.played_at).getTime() >= since));
		const ids = new Set(matches.map((m) => m.match_id));
		return { matches, frames: p.frames.filter((f) => ids.has(f.match_id)) };
	}

	function count(p) {
		const { matches, frames } = inPeriod(p);
		const won = frames.filter((f) => f.won);
		const broke = frames.filter((f) => f.broke === true);
		const offBreak = frames.filter((f) => f.broke === false);
		const gb = won.filter((f) => f.result_event === 'golden_break');
		// Streaks of matches won, oldest first; a loss or a draw ends one.
		let best = 0, run = 0;
		for (const m of matches.slice().reverse()) {
			run = result(m) === 'W' ? run + 1 : 0;
			best = Math.max(best, run);
		}
		return {
			matches: matches.length,
			mw: matches.filter((m) => result(m) === 'W').length,
			ml: matches.filter((m) => result(m) === 'L').length,
			md: matches.filter((m) => result(m) === 'D').length,
			frames: frames.length,
			fw: won.length,
			bf: won.filter((f) => f.result_event === 'break_and_finish').length,
			rbf: won.filter((f) => f.result_event === 'reverse_break_and_finish').length,
			gb: gb.length,
			broke: broke.length,
			breakKnown: broke.length + offBreak.length,
			wonOnBreak: broke.filter((f) => f.won).length,
			best,
			current: run
		};
	}

	// ─── The hero ───
	function renderHero() {
		const p = them.player;
		els.pic.replaceChildren(avatar(p.avatar_path, p.display_name, 'pp-pic-inner'));
		els.verified.hidden = !p.verified;
		els.name.textContent = p.display_name;
		fitName();
		els.full.textContent = p.full_name || '';
		els.full.hidden = !p.full_name;
		document.title = p.display_name + ' — The Dive Club';

		// Only a photo can be shown large: initials help nobody recognise anyone.
		const photo = !!TDC.pictureUrl('player-avatars', p.avatar_path);
		els.pic.classList.toggle('pp-pic-zoomable', photo);
		if (photo) {
			els.pic.setAttribute('role', 'button');
			els.pic.tabIndex = 0;
			els.pic.setAttribute('aria-label', 'Show ' + p.display_name + '\'s picture large');
		}

		const other = !p.is_me;
		for (const b of els.actions.querySelectorAll('[data-others]')) b.hidden = !other;
		els.views.hidden = !other;
		els.aboutTitle.textContent = 'About ' + p.display_name;
	}

	// The display name in its half of the hero: wrapped between words, never
	// inside one, so its size comes down only as far as the longest word needs.
	function fitName() {
		const h = els.name;
		h.style.fontSize = '';
		const room = h.clientWidth;
		if (room && h.scrollWidth > room) {
			const size = parseFloat(getComputedStyle(h).fontSize);
			h.style.fontSize = Math.floor(size * room / h.scrollWidth) + 'px';
		}
	}
	document.fonts.ready.then(() => { if (them) fitName(); });
	addEventListener('resize', () => { if (them) fitName(); });

	// The discipline they play most, from their matches, else their leagues.
	function discipline(p) {
		const n = {};
		for (const m of p.matches) if (m.discipline) n[m.discipline] = (n[m.discipline] || 0) + 1;
		for (const t of p.teams) if (t.discipline && !p.matches.length) n[t.discipline] = (n[t.discipline] || 0) + 1;
		const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
		return top ? (TDCMatchDef.DISCIPLINE[top] || top) : null;
	}

	// ─── The views ───
	// A view: the player (p), their boxes by data-part, and whether Compare
	// lays it down the page (vertical). side picks one half of Compare.
	function view(root, p, side) {
		const part = side
			? (name) => root.querySelector(`[data-side="${side}"][data-part="${name}"], [data-side="${side}"] [data-part="${name}"]`)
			: (name) => root.querySelector(`[data-part="${name}"]`);
		return { p, part, side, vertical: !!side };
	}
	let views = [];   // the Profile tab's, then Compare's two once there is a "you"

	// ─── Profile ───
	// Form: their last 10 frames across every finished match, newest right
	// (UV, 5 Nov), each won or lost, with a yellow ring where they broke. On
	// Compare the dots run down the page, newest at the foot (UV, 5 Nov).
	function renderForm(v) {
		const box = v.part('form');
		const byMatch = new Map(v.p.matches.map((m) => [m.match_id, m]));
		const last = v.p.frames.slice()
			.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.frame_no - b.frame_no))
			.slice(-10);
		if (!last.length) { box.replaceChildren(node('span', 'muted', 'No finished frames yet.')); return; }
		box.replaceChildren(...last.map((f) => {
			const m = byMatch.get(f.match_id);
			const d = resultDot(f.won ? 'W' : 'L');
			if (f.broke) d.classList.add('pp-dot-broke');
			d.title = (f.won ? 'Won' : 'Lost') + (f.broke ? ', broke' : '') + (m ? ' · v ' + m.opponent + ', ' + day(m.played_at) : '');
			return d;
		}));
	}

	function cell(label, big, sub, tone) {
		const c = node('div', 'pp-cell');
		c.append(node('span', 'pp-lbl', label), node('span', 'pp-big' + (tone ? ' pp-' + tone : ''), big), node('span', 'muted pp-cell-sub', sub));
		return c;
	}

	// Four boxes (UV, 5 Nov). Conversion: frames won on their own break, of
	// the frames they broke ("Lags", as the standings count lags won).
	function renderStats(v) {
		const s = count(v.p);
		v.part('grid').replaceChildren(
			cell('Frames', pct(s.fw, s.frames), 'P ' + s.frames + ' · W ' + s.fw + ' · L ' + (s.frames - s.fw), 'primary'),
			cell('Matches', pct(s.mw, s.matches), 'P ' + s.matches + ' · W ' + s.mw + ' · L ' + s.ml + (s.md ? ' · D ' + s.md : ''), 'primary'),
			cell('B&F', String(s.bf), 'GB ' + s.gb + ' · rB&F ' + s.rbf, 'warning'),
			cell('Conversion', pct(s.wonOnBreak, s.broke), 'Lags ' + s.broke + ' · FW ' + s.wonOnBreak)
		);
	}

	// Frames won minus frames lost on each of the last 15 nights in the
	// period (UV, 5 Nov): green above the line, grey below it, a stub on it
	// for a night that came out even. On Compare the graph runs down the page
	// (UV, 5 Nov): a night a row, newest at the foot, the line upright, green
	// to its right and grey to its left.
	function renderBars(v) {
		const bars = v.part('bars'), barLabels = v.part('barLabels');
		bars.classList.toggle('is-down', v.vertical);
		const { frames } = inPeriod(v.p);
		const nights = new Map();
		for (const f of frames.slice().reverse()) {
			const k = dayKey(f.at);
			if (!nights.has(k)) nights.set(k, { at: f.at, won: 0, lost: 0 });
			const n = nights.get(k);
			if (f.won) n.won++; else n.lost++;
		}
		const list = [...nights.values()].slice(-15);
		if (!list.length) {
			bars.replaceChildren(node('span', 'muted pp-empty', 'No frames in this period.'));
			barLabels.replaceChildren();
			return;
		}
		const up = Math.max(0, ...list.map((n) => n.won - n.lost));
		const down = Math.max(0, ...list.map((n) => n.lost - n.won));
		const upShare = up + down ? (up / (up + down)) * 100 : 50;   // where the base line sits
		// Along the night's own length: height in the graph, width down the page.
		const size = v.vertical ? 'width' : 'height';
		let month = '';
		const labels = [];
		const line = node('span', 'pp-baseline');
		if (v.vertical) line.style.left = (100 - upShare) + '%'; else line.style.top = upShare + '%';
		bars.replaceChildren(line, ...list.map((n) => {
			const diff = n.won - n.lost;
			const col = node('span', 'pp-night');
			col.title = day(n.at) + ': won ' + n.won + ', lost ' + n.lost + ' (' + (diff > 0 ? '+' : '') + diff + ')';
			const top = node('span', 'pp-night-up'), bottom = node('span', 'pp-night-down');
			top.style[size] = upShare + '%';
			bottom.style[size] = (100 - upShare) + '%';
			const b = node('span', 'pp-bar' + (diff < 0 ? ' pp-bar-lost' : diff === 0 ? ' pp-bar-even' : ''));
			if (diff) b.style[size] = (Math.abs(diff) / (diff > 0 ? up : down)) * 100 + '%';
			(diff < 0 ? bottom : top).append(b);
			// Down the page the lost side is on the left.
			if (v.vertical) col.append(bottom, top); else col.append(top, bottom);
			const m = new Date(n.at).toLocaleDateString('en-ZA', { month: 'short' });
			labels.push(node('span', null, m !== month ? m : ''));
			month = m;
			return col;
		}));
		barLabels.replaceChildren(...labels);
	}

	// Each team's place in its season, by the league's own ranking columns
	// (TDCStandings, as the Standings tab ranks them). null where it cannot
	// be ranked; '' where it could not be read (said on the status line).
	async function teamPlaces() {
		const teams = them.teams.concat(mine ? mine.teams : []);   // both sides of Compare
		const seasons = [...new Set(teams.filter((t) => t.team_id).map((t) => t.league_season_id))];
		const places = {};
		await Promise.all(seasons.map(async (sid) => {
			const [st, cols] = await Promise.all([
				supabaseClient.rpc('tdc_league_standings', { p_league_season_id: sid }),
				supabaseClient.from('tbl_league_standing_columns')
					.select('id, scope, position, name, equation, decimals, rank_priority, higher_first')
					.eq('league_season_id', sid).eq('scope', 'team').order('position')
			]);
			if (st.error || cols.error) {
				TDC.error(AREA, 'a team\'s place in its league could not be read.', st.error || cols.error, els.status);
				return;
			}
			const ranked = TDCStandings.rank((st.data.teams || []).map((t) => Object.assign({}, t)), cols.data || []);
			for (const r of ranked) places[r.team_id] = r.rank;
		}));
		return places;
	}

	function renderTeams(v, places) {
		const box = v.part('teams');
		if (!v.p.teams.length) { box.replaceChildren(node('p', 'muted pp-empty', 'Not in a league yet.')); return; }
		box.replaceChildren(...v.p.teams.map((t) => {
			const a = node('a', 'pp-team');
			a.href = '/leagues/season/?s=' + encodeURIComponent(t.league_season_id) + (t.team_id ? '&team=' + encodeURIComponent(t.team_id) : '');
			const pic = node('span', 'team-pic pp-team-pic');
			pic.append(TDC.teamPic(t.team_picture));
			const names = node('span', 'pp-team-names');
			names.append(node('span', 'pp-team-name', t.team_name || 'No team yet'),
				node('span', 'muted pp-team-sub', [t.league_name, t.season_name, TDC.venueNames(t.venues)].filter(Boolean).join(' · ')));
			const right = node('span', 'pp-team-right');
			const place = places && t.team_id ? places[t.team_id] : null;
			right.append(node('span', 'pp-team-place' + (place === 1 || place === 2 ? ' pp-primary' : ''), place ? ordinal(place) : '–'),
				node('span', 'muted pp-team-role', t.is_captain ? 'Captain' : 'Player'));
			a.append(pic, names, right);
			return a;
		}));
	}

	// A match's state, as the league fixtures' strip names it (UV, 5 Nov):
	// colours from league.css (.fx-state-*).
	const STATE = { scheduled: 'Not started', in_progress: 'Playing', complete: 'Finished', abandoned: 'Abandoned' };

	function matchRow(m) {
		const row = node('a', 'pp-row');
		row.href = matchHref(m);
		const strip = node('span', 'pp-state fx-state-' + m.status);
		strip.title = STATE[m.status] || m.status;
		strip.append(node('span', 'pp-sr', strip.title));
		// The opponent's picture opens their profile, the row their match (UV, 5 Nov).
		const pic = m.team_match ? node('span', 'team-pic pp-row-pic') : TDC.profilePic(avatar(m.opponent_avatar, m.opponent), m.opponent_player_id);
		if (m.team_match) pic.append(TDC.teamPic(m.opponent_team_picture));
		const names = node('span', 'pp-row-names');
		names.append(node('span', 'pp-row-name', 'vs ' + m.opponent), node('span', 'muted pp-row-sub', [kindLabel(m), day(m.played_at), TDC.venueNames(m.venues)].filter(Boolean).join(' · ')));
		// The score once a frame is in; the win or loss only once finished.
		const score = node('span', 'pp-score');
		if (m.status !== 'complete' && !m.mine && !m.theirs) score.append(node('span', 'muted', '–'));
		else {
			const a = node('span', m.mine > m.theirs ? 'pp-primary' : null, String(m.mine));
			const b = node('span', m.theirs > m.mine ? null : 'muted', String(m.theirs));
			score.append(a, document.createTextNode('–'), b);
		}
		const end = m.status === 'complete' ? resultDot(result(m)) : node('span', 'pp-dot');
		row.append(strip, pic, names, score, end);
		return row;
	}

	// A list a page at a time, its page number the stepper on its side in the
	// heading (UV, 5 Nov): leagues and tournaments 4 a page, recent matches 5.
	const LISTS = {
		league: { per: 4, of: (ms) => ms.filter((m) => m.kind === 'league'), none: 'No league matches yet.' },
		tournament: { per: 4, of: (ms) => ms.filter((m) => m.kind === 'tournament'), none: 'No tournament matches yet.' },
		recent: { per: 5, of: (ms) => ms, none: 'No matches yet.' }
	};
	function renderList(v, key) {
		const l = LISTS[key], page = v.part('page-' + key), box = v.part(key);
		const list = l.of(v.p.matches);
		const pages = Math.max(1, Math.ceil(list.length / l.per));
		page.max = String(pages);
		page.disabled = pages < 2;
		const at = Math.min(pages, Math.max(1, Math.round(page.valueAsNumber) || 1));
		if (page.valueAsNumber !== at) page.value = String(at);
		const shown = list.slice((at - 1) * l.per, at * l.per);
		box.replaceChildren(...(shown.length ? shown.map(matchRow) : [node('p', 'muted pp-empty', l.none)]));
	}
	// Each view's page numbers turn their own list's pages.
	function listenPages(v) {
		for (const key of Object.keys(LISTS)) v.part('page-' + key).addEventListener('change', () => renderList(v, key));
	}

	// About as label and value pairs: a list on the Profile tab, one table
	// on Compare (UV, 5 Nov).
	function aboutRows(p) {
		const rows = [];
		const add = (label, value) => rows.push([label, value]);
		add('Full name', document.createTextNode(p.player.full_name || 'Not given'));
		const d = discipline(p);
		add('Plays', document.createTextNode(d || '–'));
		const venue = node('button', 'pp-link', 'Not built yet');
		venue.type = 'button';
		venue.dataset.unbuilt = 'Home venue';
		add('Home venue', venue);
		const teams = p.teams.filter((t) => t.team_id);
		const tl = node('span');
		if (!teams.length) tl.textContent = 'None';
		teams.forEach((t, i) => {
			if (i) tl.append(document.createTextNode(', '));
			const a = node('a', null, t.team_name + (t.is_captain ? ' (C)' : ''));
			a.href = '/leagues/season/?s=' + encodeURIComponent(t.league_season_id) + '&team=' + encodeURIComponent(t.team_id);
			tl.append(a);
		});
		add('Teams', tl);
		add('Status', node('span', p.player.verified ? 'pp-primary' : 'muted', p.player.verified ? 'ID verified' : 'Not verified'));
		add('Member since', document.createTextNode(monthYear(p.player.since)));
		return rows;
	}

	function renderAbout() {
		const rows = [];
		for (const [label, value] of aboutRows(them)) {
			// The Profile tab leaves out Plays when nothing says what they play, as before.
			if (label === 'Plays' && !discipline(them)) continue;
			rows.push(node('dt', 'muted', label));
			const dd = node('dd');
			dd.append(value);
			rows.push(dd);
		}
		els.about.replaceChildren(...rows);
	}

	// Compare's About: one table, yours on the left, theirs on the right, the
	// headings in the middle, every cell centred (UV, 5 Nov).
	function renderCompareAbout() {
		const a = aboutRows(mine), b = aboutRows(them);
		els.cAbout.replaceChildren(...a.map(([label, value], i) => {
			const tr = node('tr');
			const left = node('td'), mid = node('th', 'muted'), right = node('td');
			left.append(value);
			mid.textContent = label;
			mid.scope = 'row';
			right.append(b[i][1]);
			tr.append(left, mid, right);
			return tr;
		}));
	}

	// Compare's heads: each half's picture and names, the match stage's way
	// (match.css .mv-person): yours mirrored, so both pictures face the line.
	function renderCompareHeads() {
		for (const [side, p] of [['mine', mine], ['them', them]]) {
			const who = document.querySelector(`.pp-c-who[data-side="${side}"]`);
			const person = node('div', 'pp-c-person');
			const names = node('div', 'pp-c-names');
			names.append(node('span', 'pp-c-name', p.player.display_name));
			if (p.player.full_name) names.append(node('span', 'pp-c-full', p.player.full_name));
			person.append(TDC.profilePic(avatar(p.player.avatar_path, p.player.display_name, 'pp-c-pic'), p.player.player_id), names);
			who.replaceChildren(person);
		}
	}

	// Everything that hangs on the period, in every view.
	function renderPeriod() {
		for (const v of views) { renderStats(v); renderBars(v); }
	}

	function renderProfile() {
		for (const v of views) {
			renderForm(v);
			for (const key of Object.keys(LISTS)) renderList(v, key);
		}
		renderPeriod();
		renderAbout();
		if (mine) { renderCompareHeads(); renderCompareAbout(); }
	}

	// ─── Head to head ───
	function versusSide(p, label, me) {
		const s = node('div', 'pp-vs-side');
		s.append(TDC.profilePic(avatar(p.avatar_path, p.display_name, 'pp-vs-pic' + (me ? ' pp-vs-pic-me' : '')), p.player_id), node('span', 'pp-vs-name', label));
		return s;
	}

	function renderH2H() {
		if (!h2h || !mine) return;
		const ms = h2h.meetings;
		const won = ms.filter((m) => m.mine > m.theirs).length;
		const lost = ms.filter((m) => m.mine < m.theirs).length;
		const fMine = ms.reduce((a, m) => a + m.mine, 0);
		const fTheirs = ms.reduce((a, m) => a + m.theirs, 0);
		const name = themName();

		const mid = node('div', 'pp-vs-mid');
		const score = node('div', 'pp-vs-score');
		score.append(node('span', 'pp-primary', String(won)), node('span', 'muted pp-vs-colon', ' : '), node('span', null, String(lost)));
		mid.append(node('span', 'muted pp-vs-kicker', 'Head to head'), score, node('span', 'muted pp-sub', ms.length === 1 ? 'meeting' : 'meetings'));
		els.vs.replaceChildren(versusSide(mine.player, 'You', true), mid, versusSide(them.player, name));

		const a = node('span', 'pp-split-me'), b = node('span', 'pp-split-them');
		a.style.flexGrow = won || (lost ? 0 : 1);
		b.style.flexGrow = lost || (won ? 0 : 1);
		els.split.replaceChildren(a, b);

		// The current run of meetings won, newest first.
		let streak = 0, by = null;
		for (const m of ms) {
			const r = m.mine > m.theirs ? 'You' : m.mine < m.theirs ? name : null;
			if (!r || (by && r !== by)) break;
			by = r;
			streak++;
		}
		els.vsLine.replaceChildren();
		const f = node('span');
		f.append(document.createTextNode('Frames '), node('b', 'pp-primary', String(fMine)), document.createTextNode(' – '), node('b', null, String(fTheirs)));
		els.vsLine.append(f, node('span', 'muted', '|'), node('span', null, 'Streak ' + (by ? by + ' ' + streak : '–')));

		// The last meeting, frame by frame.
		if (!ms.length) {
			els.meeting.replaceChildren(node('p', 'muted pp-empty', h2h.same ? 'This is you.' : 'You have not played each other in a finished match yet.'));
		} else {
			const m = ms[0];
			const head = node('div', 'pp-panel-head');
			head.append(node('span', 'pp-panel-title', 'Last meeting'), node('span', 'muted pp-sub', day(m.played_at) + ' · ' + kindLabel(m)));
			const line = node('div', 'pp-panel-score');
			line.append(node('b', null, 'You'), node('span', 'pp-score pp-score-big', m.mine + ' – ' + m.theirs), node('b', null, name));
			const strip = node('div', 'pp-strip');
			for (const fr of m.frames) {
				const s = node('span', 'pp-strip-frame' + (fr.won ? ' pp-strip-mine' : ''));
				s.title = 'Frame ' + fr.frame_no + ': ' + (fr.won ? 'you' : name);
				strip.append(s);
			}
			const open = node('a', 'pp-link', 'Open match');
			open.href = matchHref(m);
			els.meeting.replaceChildren(head, line, strip, node('p', 'muted pp-key', 'Frame by frame · green is yours'), open);
		}

		// Every meeting.
		const list = meetingsAll ? ms : ms.slice(0, 3);
		const rowsM = list.map((m) => {
			const a2 = node('a', 'pp-meet');
			a2.href = matchHref(m);
			const names = node('span', 'pp-row-names');
			const what = m.team_match && m.home_team ? kindLabel(m) + ' · ' + m.home_team + ' v ' + m.away_team : kindLabel(m);
			names.append(node('span', 'pp-row-name', what), node('span', 'muted pp-row-sub', day(m.played_at)));
			a2.append(resultDot(result(m)), names, node('span', 'pp-score', m.mine + '–' + m.theirs));
			return a2;
		});
		if (ms.length > 3) {
			const more = node('button', 'pp-link', meetingsAll ? 'Show fewer' : 'All ' + ms.length);
			more.type = 'button';
			more.addEventListener('click', () => { meetingsAll = !meetingsAll; renderH2H(); });
			rowsM.push(more);
		}
		if (!rowsM.length) rowsM.push(node('p', 'muted pp-empty', 'No meetings yet.'));
		els.meetings.replaceChildren(...rowsM);
	}

	// ─── The tabs and the period ───
	const pause = () => new Promise((r) => setTimeout(r, 200));
	// profile, h2h or cmp; only profile on your own page. &tab= keeps it on reload.
	function showTab(tab, btn) {
		const other = them && !them.player.is_me;
		const t = other && (tab === 'h2h' || tab === 'cmp') ? tab : 'profile';
		for (const b of els.views.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === t));
		els.profile.hidden = t !== 'profile';
		els.h2h.hidden = t !== 'h2h';
		els.cmpTab.hidden = t !== 'cmp';
		const url = new URL(location.href);
		if (t === 'profile') url.searchParams.delete('tab'); else url.searchParams.set('tab', t);
		history.replaceState(null, '', url);
		if (btn) TDC.busy(btn, pause(), els.status);
	}
	els.views.addEventListener('click', (e) => {
		const b = e.target.closest('[data-tab]');
		if (b) showTab(b.dataset.tab, b);
	});
	// One period for the whole page: the Profile tab's switch and Compare's
	// (one for both sides, UV 5 Nov) stay in step.
	document.addEventListener('click', (e) => {
		const b = e.target.closest('.pp-period [data-days]');
		if (!b || !them) return;
		days = Number(b.dataset.days);
		for (const x of document.querySelectorAll('.pp-period [data-days]')) x.setAttribute('aria-pressed', String(x.dataset.days === b.dataset.days));
		renderPeriod();
		TDC.busy(b, pause(), els.status);
	});

	// ─── The large picture ───
	// Players use it to recognise each other (UV, 5 Nov). A tap on the hero's
	// photo grows it into the middle of the screen in its green ring and glow;
	// any tap, key, scroll or swipe shrinks it back into the hero. With less
	// motion it fades in and out instead (data-motion, as dots.js reads it).
	const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
	function reduced() {
		const m = document.documentElement.dataset.motion;
		return m === 'reduce' ? true : m === 'full' ? false : lessMotion.matches;
	}
	const ZOOM_MS = 350;
	const ZOOM_CLOSERS = ['pointerdown', 'wheel', 'touchmove', 'keydown', 'scroll'];
	let zoom = null;

	// The hero picture's place as a transform on the large one.
	function fromHero(ring) {
		const a = els.pic.getBoundingClientRect(), b = ring.getBoundingClientRect();
		const dx = (a.left + a.width / 2) - (b.left + b.width / 2);
		const dy = (a.top + a.height / 2) - (b.top + b.height / 2);
		return 'translate(' + dx + 'px, ' + dy + 'px) scale(' + (a.width / b.width) + ')';
	}

	function openZoom() {
		const url = them && TDC.pictureUrl('player-avatars', them.player.avatar_path);
		if (!url || zoom) return;
		const box = node('div', 'pp-zoom');
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-label', them.player.display_name + '\'s picture');
		const shade = node('div', 'pp-zoom-shade');
		const ring = node('div', 'pp-zoom-pic');
		const inner = node('div', 'pp-zoom-inner');
		const img = document.createElement('img');
		img.src = url;
		img.alt = them.player.display_name;
		inner.append(img);
		ring.append(inner);
		box.append(shade, ring);
		document.body.append(box);

		const opts = { duration: ZOOM_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
		shade.animate([{ opacity: 0 }, { opacity: 1 }], opts);
		if (reduced()) ring.animate([{ opacity: 0 }, { opacity: 1 }], opts);
		else ring.animate([{ transform: fromHero(ring) }, { transform: 'none' }], opts);
		els.pic.classList.add('pp-pic-away');
		zoom = { box, shade, ring };
		// After this event has finished, so the tap or key that opened it does not close it.
		setTimeout(() => { if (zoom) for (const t of ZOOM_CLOSERS) window.addEventListener(t, closeZoom, { capture: true, passive: true }); }, 0);
	}

	function closeZoom() {
		if (!zoom || zoom.closing) return;
		zoom.closing = true;
		for (const t of ZOOM_CLOSERS) window.removeEventListener(t, closeZoom, { capture: true });
		const { box, shade, ring } = zoom;
		const opts = { duration: ZOOM_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' };
		shade.animate([{ opacity: 1 }, { opacity: 0 }], opts);
		const done = reduced()
			? ring.animate([{ opacity: 1 }, { opacity: 0 }], opts)
			: ring.animate([{ transform: 'none' }, { transform: fromHero(ring) }], opts);
		done.finished.then(() => {
			box.remove();
			els.pic.classList.remove('pp-pic-away');
			zoom = null;
		});
	}

	els.pic.addEventListener('click', openZoom);
	els.pic.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		openZoom();
	});

	// ─── Not built yet, and the bar ───
	// A tap on anything with nothing behind it says so, on the note line of
	// its section (the page's own line otherwise).
	document.addEventListener('click', (e) => {
		const b = e.target.closest('[data-unbuilt]');
		if (!b) return;
		const box = b.closest('.pp-section, .pp-hero, .pp-c-body');
		const note = (box && box.querySelector('[data-note]')) || els.status;
		TDC.status(note, b.dataset.unbuilt + ' is not built yet.', '');
	});
	// The hero's buttons: each a ring icon (ring-status.js) that draws itself
	// in once the page is shown, as the fixtures page's buttons do.
	function wakeIcons() {
		for (const b of els.actions.querySelectorAll('.pp-icon:not([hidden])')) {
			if (b.tdcRing) continue;
			const icon = b.dataset.icon;
			const face = node('span', 'tdc-ring');
			face.innerHTML = TDCRing.svg();
			b.append(face);
			try {
				b.tdcRing = new TDCRing.RingStatus(face, {
					icons: [icon],
					labels: { [icon]: b.getAttribute('aria-label'), empty: b.getAttribute('aria-label') },
					initial: 'empty'
				});
			} catch (err) {
				TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
				continue;
			}
			b.tdcRing.drawTo(icon);
		}
	}

	// ─── Follow (UV, 5 Nov) ───
	// One-way and private: a tap does it, the ring shows a tick in green once
	// you follow, and nobody else can see it (migration player_follows). The
	// page re-reads after every write; the icon redraws only if it changed.
	function drawFollow() {
		const name = them.player.display_name;
		const label = iFollow ? 'Following ' + name + '. Tap to stop' : 'Follow ' + name;
		const b = els.follow;
		b.title = label;
		b.setAttribute('aria-label', label);
		b.setAttribute('aria-pressed', String(iFollow));
		b.classList.toggle('pp-icon-primary', iFollow);
		b.dataset.icon = iFollow ? 'tick' : 'follow';
		b.replaceChildren();
		b.tdcRing = null;
		wakeIcons();
	}

	async function readFollow() {
		const { data, error } = await supabaseClient.rpc('tdc_i_follow', { p_player_id: playerId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (data !== iFollow) {
			iFollow = data;
			drawFollow();
		}
		return true;
	}

	const followWriter = TDC.writer({ area: AREA, status: els.status, reload: readFollow });
	els.follow.addEventListener('click', () => {
		const follow = !iFollow;
		followWriter.write(follow ? 'Following' : 'Stopping', () => supabaseClient.rpc('tdc_set_follow', {
			p_player_id: playerId,
			p_follow: follow
		}), () => '', { single: 'follow', dots: els.follow });
	});

	// ─── Finding a player (UV, 5 Nov) ───
	// /players/ with nobody in the address. Each result only links to the
	// profile. tdc_search_opponents already answers this: everyone with an
	// account but you, at least two letters typed.
	let findRun = 0;
	async function findPlayers(term) {
		const run = ++findRun;
		TDC.status(els.findNote, '', '');
		if (term.trim().length < 2) { els.findResults.replaceChildren(); return; }

		const { data, error } = await TDC.busy(el('pp-find-dots'), supabaseClient.rpc('tdc_search_opponents', { p_query: term, p_limit: 20 }));
		if (run !== findRun) return;   // a later keystroke has overtaken this one
		if (error) { TDC.showSupabaseError(AREA, error, els.findNote); return; }

		if (!data.length) TDC.status(els.findNote, 'Nobody by that name. Only players with an account can be found.', '');
		els.findResults.replaceChildren(...data.map((p) => {
			const row = node('a', 'pp-row');
			row.href = '/players/?p=' + encodeURIComponent(p.id);
			const names = node('span', 'pp-row-names');
			names.append(node('span', 'pp-row-name', p.display_name));
			if (p.full_name) names.append(node('span', 'muted pp-row-sub', p.full_name));
			row.append(avatar(p.avatar_path, p.display_name, 'pp-row-pic'), names);
			return row;
		}));
	}

	// ─── The feed (UV, 5 Nov) ───
	// Matches being played and results from the players you follow, from
	// tdc_my_feed. Every row opens its match to watch, or a league night's card.
	// Live while the page is open: each match being played is watched as the
	// fixtures page watches its night, and any change reads the feed again, with
	// the score fading (TDC.liveFade). A match that starts meanwhile is not
	// heard, so it appears on coming back to the page.
	const FEED_STEP = 10;
	let feedLimit = FEED_STEP;
	let feedChannel = null;
	let feedKey = '';
	let feedSet = new Set();
	let feedTimer = null;

	function feedRow(m) {
		const row = node('a', 'pp-row');
		row.href = matchHref({ team_match: m.team_match, match_id: m.id });
		const state = m.finished ? 'complete' : 'in_progress';
		const strip = node('span', 'pp-state fx-state-' + state);
		strip.title = STATE[state];
		strip.append(node('span', 'pp-sr', strip.title));
		let pic;
		if (m.team_match) {
			pic = node('span', 'team-pic pp-row-pic');
			pic.append(TDC.teamPic(m.team_picture));
		} else {
			pic = avatar(m.avatar_path, (m.players || [])[0], 'pp-row-pic');
		}
		const names = node('span', 'pp-row-names');
		const race = !m.finished && !m.team_match && m.win_condition === 'free_play' ? TDCMatchDef.WIN_CONDITION.free_play
			: !m.finished && !m.team_match && m.target ? (TDCMatchDef.WIN_CONDITION[m.win_condition] || m.win_condition) + ' ' + m.target
			: null;
		const line = [STATE[state], m.finished ? day(m.played_at) : null, race, m.competition].filter(Boolean).join(' · ');
		names.append(node('span', 'pp-row-name', m.home + ' v ' + m.away), node('span', 'muted pp-row-sub', line));
		if (m.team_match) {
			names.append(node('span', 'muted pp-row-sub', (m.players || []).join(', ') + (m.finished ? ' played' : ' playing')));
		}
		const score = node('span', 'pp-score', m.home_frames + '–' + m.away_frames);
		score.dataset.live = 'feed-' + m.id;
		row.append(strip, pic, names, score);
		return row;
	}

	async function loadFeed() {
		const { data, error } = await supabaseClient.rpc('tdc_my_feed', { p_limit: feedLimit });
		if (error) {
			el('pp-feed-section').hidden = false;
			TDC.showSupabaseError(AREA, error, el('pp-feed-note'));
			return false;
		}
		const section = el('pp-feed-section');
		section.hidden = !data.follows;
		const list = el('pp-feed');
		const snap = TDC.liveSnapshot(list);
		TDC.status(el('pp-feed-note'), data.follows && !data.rows.length ? 'Nothing from the players you follow yet.' : '', '');
		list.replaceChildren(...data.rows.map(feedRow));
		TDC.liveFade(list, snap);
		el('pp-feed-more').hidden = !data.more;
		watchFeed(data.rows.filter((m) => !m.finished).map((m) => m.id));
		return true;
	}

	function onFeedLive() {
		clearTimeout(feedTimer);
		feedTimer = setTimeout(loadFeed, 400);
	}

	function watchFeed(ids) {
		const key = ids.slice().sort().join(',');
		if (key === feedKey) return;
		stopFeed();
		feedKey = key;
		feedSet = new Set(ids);
		if (!ids.length) return;
		// As the fixtures page: a long filter may pass its length limit, so a
		// big list drops it and sorts on arrival.
		const filter = ids.length <= 20 ? { filter: 'id=in.(' + ids.join(',') + ')' } : {};
		feedChannel = supabaseClient
			.channel('feed')
			.on('postgres_changes', Object.assign({ event: 'UPDATE', schema: 'public', table: 'tbl_matches' }, filter), (payload) => {
				if (payload && payload.new && !feedSet.has(payload.new.id)) return;
				onFeedLive();
			})
			.subscribe((status) => {
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.error('[' + AREA + '] live scores in the feed are not running (' + status + ').');
				}
			});
	}

	function stopFeed() {
		clearTimeout(feedTimer);
		feedKey = '';
		if (!feedChannel) return;
		supabaseClient.removeChannel(feedChannel);
		feedChannel = null;
	}

	el('pp-feed-more').addEventListener('click', (e) => {
		feedLimit += FEED_STEP;
		TDC.busy(e.currentTarget, loadFeed());
	});

	// Hidden, the socket is let go (ui.md: battery) and taken up again when
	// shown; the read covers the gap, and finds a match started meanwhile.
	document.addEventListener('visibilitychange', () => {
		if (playerId) return;
		if (document.visibilityState !== 'visible') { stopFeed(); return; }
		loadFeed();
	});
	window.addEventListener('online', () => { if (!playerId) loadFeed(); });

	// ─── Whom you follow (UV, 5 Nov) ───
	// Under the search: each player links to their profile, and the green tick
	// stops following them. The list is read again after each stop.
	function followingRow(p) {
		const row = node('div', 'pp-following-row');
		const link = node('a', 'pp-row');
		link.href = '/players/?p=' + encodeURIComponent(p.player_id);
		const names = node('span', 'pp-row-names');
		names.append(node('span', 'pp-row-name', p.display_name));
		if (p.full_name) names.append(node('span', 'muted pp-row-sub', p.full_name));
		link.append(avatar(p.avatar_path, p.display_name, 'pp-row-pic'), names);

		const label = 'Following ' + p.display_name + '. Tap to stop';
		const stop = node('button', 'pp-icon pp-icon-primary');
		stop.type = 'button';
		stop.dataset.stop = p.player_id;
		stop.dataset.name = p.display_name;
		stop.title = label;
		stop.setAttribute('aria-label', label);
		const face = node('span', 'tdc-ring');
		face.innerHTML = TDCRing.svg();
		stop.append(face);
		try {
			new TDCRing.RingStatus(face, { icons: ['tick'], labels: { tick: label, empty: label }, initial: 'tick' });
		} catch (err) {
			TDC.error(AREA, 'an icon could not be drawn: tick', err, els.followingNote);
		}
		row.append(link, stop);
		return row;
	}

	async function loadFollowing() {
		const { data, error } = await supabaseClient.rpc('tdc_my_follows');
		if (error) { TDC.showSupabaseError(AREA, error, els.followingNote); return false; }
		els.following.replaceChildren(...(data.length
			? data.map(followingRow)
			: [node('p', 'muted pp-following-empty', 'You are not following anybody yet. Find a player above, then tap Follow on their profile.')]));
		return true;
	}

	const stopWriter = TDC.writer({
		area: AREA,
		status: els.followingNote,
		reload: async () => (await Promise.all([loadFollowing(), loadFeed()])).every(Boolean)
	});
	els.following.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-stop]');
		if (!b) return;
		const name = b.dataset.name;
		stopWriter.write('Stopping', () => supabaseClient.rpc('tdc_set_follow', {
			p_player_id: b.dataset.stop,
			p_follow: false
		}), () => 'You no longer follow ' + name + '.', { single: 'stop|' + b.dataset.stop, dots: b, leaves: true });
	});

	let findTimer = null;
	els.findInput.addEventListener('input', () => {
		clearTimeout(findTimer);
		const term = els.findInput.value;
		findTimer = setTimeout(() => findPlayers(term), 250);
	});

	el('pp-share').addEventListener('click', async () => {
		const url = location.origin + '/players/?p=' + encodeURIComponent(playerId);
		const title = (them ? them.player.display_name : 'A player') + ' — The Dive Club';
		try {
			if (navigator.share) { await navigator.share({ title, url }); return; }
			await navigator.clipboard.writeText(url);
			TDC.status(els.status, 'Link copied.', 'success');
		} catch (err) {
			if (err && err.name === 'AbortError') return;   // the share sheet closed
			TDC.error(AREA, 'the link could not be shared or copied.', err, els.status);
		}
	});

	// ─── Start ───
	function check(r, what) {
		if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); return false; }
		if (!r.data || (what === 'profile' && (!r.data.player || !Array.isArray(r.data.matches)))) {
			TDC.error(AREA, 'the ' + what + ' came back in a shape this page does not know.', r.data, els.status);
			return false;
		}
		// Each match's state arrives with migration 20261105064410; without it
		// every list and count would be empty, so say so.
		if (what === 'profile' && r.data.matches.some((m) => !m.status)) {
			TDC.error(AREA, 'the matches came without their state. Push migration 20261105064410.', null, els.status);
			return false;
		}
		return true;
	}

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		if (!playerId) {
			document.title = 'Players — The Dive Club';
			els.find.hidden = false;
			await Promise.all([loadFollowing(), loadFeed()]);
			return;
		}

		const theirs = await supabaseClient.rpc('tdc_player_profile', { p_player_id: playerId });
		if (!check(theirs, 'profile')) return;
		them = theirs.data;

		if (!them.player.is_me) {
			const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
			if (!me) return;
			const [mp, hh, fw] = await Promise.all([
				supabaseClient.rpc('tdc_player_profile', { p_player_id: me.id }),
				supabaseClient.rpc('tdc_head_to_head', { p_player_id: playerId }),
				supabaseClient.rpc('tdc_i_follow', { p_player_id: playerId })
			]);
			if (!check(mp, 'profile') || !check(hh, 'head to head')) return;
			mine = mp.data;
			h2h = hh.data;
			// Not through check(): false is a good answer here.
			if (fw.error) { TDC.showSupabaseError(AREA, fw.error, els.status); return; }
			iFollow = fw.data;
		}

		views = [view(els.profile, them)];
		if (mine) views.push(view(els.cmpTab, mine, 'mine'), view(els.cmpTab, them, 'them'));
		views.forEach(listenPages);

		renderHero();
		renderProfile();
		renderH2H();
		for (const v of views) renderTeams(v, null);
		showTab(params.get('tab'));
		els.body.hidden = false;
		fitName();   // measured once it is shown
		if (them.player.is_me) wakeIcons(); else drawFollow();
		const places = await teamPlaces();
		for (const v of views) renderTeams(v, places);
	})(), 'The player');
})();
