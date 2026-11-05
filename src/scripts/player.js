// A player's profile (/players/?p=<player id>, UV's combined design, 5 Nov).
//
// The hero (picture, names, chips, Challenge, Follow, Compare with me), then a
// toggle between two tabs:
//   • Profile: form, stats over a period, frames won per night, on the break,
//     leagues and teams with the team's place, recent matches and the last
//     match's frames, honours, about.
//   • Head to head: you against them. Only frames the two of you played
//     against each other count (tdc_head_to_head); side by side compares
//     both players' all-time stats.
// Your own profile has no toggle and no buttons for others.
//
// Every number is counted here from what tdc_player_profile returns (frames
// are the only record): only finished matches and their finished frames. A
// team night is the player's match too, won if their side won it (UV, 5 Nov).
// "Lags won" is frames broken, as the standings count it.
//
// Challenge, Follow, the rematch, Home venue, More and trophies have nothing
// behind them yet (UV, 5 Nov: shown, a tap says so).
//
// Needs: tdc.js, match-settings.js (TDCMatchDef), league-standings-def.js
// (TDCStandings, for a team's place).

(() => {
	const AREA = 'Player';
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('pp-status'), body: el('pp-body'),
		pic: el('pp-pic'), verified: el('pp-verified'), name: el('pp-name'), full: el('pp-full'), chips: el('pp-chips'),
		others: el('pp-others'), compare: el('pp-compare'), views: el('pp-views'),
		profile: el('pp-tab-profile'), h2h: el('pp-tab-h2h'),
		form: el('pp-form'), period: el('pp-period'), grid: el('pp-grid'),
		bars: el('pp-bars'), barLabels: el('pp-bar-labels'), brk: el('pp-break'),
		teams: el('pp-teams'), recent: el('pp-recent'), last: el('pp-last'),
		honours: el('pp-honours'), aboutTitle: el('pp-about-title'), about: el('pp-about'),
		vs: el('pp-vs'), split: el('pp-split'), vsLine: el('pp-vs-line'),
		meeting: el('pp-meeting'), cmp: el('pp-cmp'), meetings: el('pp-meetings')
	};

	const params = new URLSearchParams(location.search);
	const playerId = params.get('p');
	let them = null;     // tdc_player_profile of the player shown
	let mine = null;     // and of the person looking, for side by side
	let h2h = null;      // tdc_head_to_head
	let days = 0;        // the period: 0 all time, else the last n days
	let recentAll = false;
	let meetingsAll = false;

	// ─── Small helpers ───
	function node(tag, cls, text) {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined && text !== null) n.textContent = text;
		return n;
	}
	const NS = 'http://www.w3.org/2000/svg';
	function svg(d, filled) {
		const s = document.createElementNS(NS, 'svg');
		s.setAttribute('viewBox', '0 0 24 24');
		s.setAttribute('aria-hidden', 'true');
		const p = document.createElementNS(NS, 'path');
		p.setAttribute('d', d);
		if (filled) p.setAttribute('fill', 'currentColor');
		s.append(p);
		return s;
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
	// The player's matches and frames inside the period.
	function inPeriod(p) {
		const since = days ? Date.now() - days * 86400000 : 0;
		const matches = p.matches.filter((m) => !since || new Date(m.played_at).getTime() >= since);
		const ids = new Set(matches.map((m) => m.match_id));
		return { matches, frames: p.frames.filter((f) => ids.has(f.match_id)) };
	}

	function count(p, all) {
		const { matches, frames } = all ? { matches: p.matches, frames: p.frames } : inPeriod(p);
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
			gb: gb.length,
			gbLast: gb.length ? gb.map((f) => f.at).sort().pop() : null,
			broke: broke.length,
			breakKnown: broke.length + offBreak.length,
			wonOnBreak: broke.filter((f) => f.won).length,
			wonOffBreak: offBreak.filter((f) => f.won).length,
			offBreak: offBreak.length,
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
		els.full.textContent = p.full_name || '';
		els.full.hidden = !p.full_name;
		document.title = p.display_name + ' — The Dive Club';

		const chips = [];
		if (p.verified) chips.push(node('span', 'pp-chip pp-chip-on', 'Verified'));
		const venue = node('button', 'pp-chip', 'Home venue');
		venue.type = 'button';
		venue.dataset.unbuilt = 'Home venue';
		chips.push(venue);
		const d = discipline();
		if (d) chips.push(node('span', 'pp-chip', d));
		chips.push(node('span', 'pp-chip', 'Since ' + monthYear(p.since)));
		els.chips.replaceChildren(...chips);

		const other = !p.is_me;
		els.others.hidden = !other;
		els.views.hidden = !other;
		els.aboutTitle.textContent = 'About ' + p.display_name;
	}

	// The discipline they play most, from their matches, else their leagues.
	function discipline() {
		const n = {};
		for (const m of them.matches) if (m.discipline) n[m.discipline] = (n[m.discipline] || 0) + 1;
		for (const t of them.teams) if (t.discipline && !them.matches.length) n[t.discipline] = (n[t.discipline] || 0) + 1;
		const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
		return top ? (TDCMatchDef.DISCIPLINE[top] || top) : null;
	}

	// ─── Profile ───
	function renderForm() {
		const last = them.matches.slice(0, 10).reverse();
		if (!last.length) { els.form.replaceChildren(node('span', 'muted', 'No finished matches yet.')); return; }
		els.form.replaceChildren(...last.map((m) => resultDot(result(m), result(m) + ' ' + m.mine + '–' + m.theirs + ' v ' + m.opponent + ', ' + day(m.played_at))));
	}

	function cell(label, big, sub, tone, wide) {
		const c = node('div', 'pp-cell' + (wide ? ' pp-cell-wide' : ''));
		c.append(node('span', 'pp-lbl', label), node('span', 'pp-big' + (tone ? ' pp-' + tone : ''), big), node('span', 'muted pp-cell-sub', sub));
		return c;
	}

	function renderStats() {
		const s = count(them);
		els.grid.replaceChildren(
			cell('Matches', String(s.matches), s.mw + ' W · ' + s.ml + ' L' + (s.md ? ' · ' + s.md + ' D' : '')),
			cell('Frames played', String(s.frames), s.fw + ' W · ' + (s.frames - s.fw) + ' L'),
			cell('Frame win', pct(s.fw, s.frames), s.fw + ' of ' + s.frames, 'primary'),
			cell('Break & finish', String(s.bf), s.bf && s.broke ? '1 in ' + Math.round(s.broke / s.bf) + ' breaks' : s.broke + ' breaks', 'warning'),
			cell('Golden breaks', String(s.gb), s.gbLast ? 'Last: ' + day(s.gbLast) : 'None yet'),
			cell('Lags won', pct(s.broke, s.breakKnown), s.broke + ' of ' + s.breakKnown + ' frames'),
			cell('Best streak', String(s.best), 'Current: ' + s.current, null, true)
		);
	}

	function renderBars() {
		const { frames } = inPeriod(them);
		const nights = new Map();
		for (const f of frames.slice().reverse()) {
			const k = dayKey(f.at);
			if (!nights.has(k)) nights.set(k, { at: f.at, won: 0, played: 0 });
			const n = nights.get(k);
			n.played++;
			if (f.won) n.won++;
		}
		const list = [...nights.values()].slice(-12);
		if (!list.length) {
			els.bars.replaceChildren(node('span', 'muted pp-empty', 'No frames in this period.'));
			els.barLabels.replaceChildren();
			return;
		}
		const max = Math.max(1, ...list.map((n) => n.won));
		let month = '';
		const labels = [];
		els.bars.replaceChildren(...list.map((n) => {
			const b = node('span', 'pp-bar' + (n.won < n.played - n.won ? ' pp-bar-lost' : ''));
			b.style.height = Math.max(4, (n.won / max) * 100) + '%';
			b.title = day(n.at) + ': ' + n.won + ' of ' + n.played + ' frames won';
			const m = new Date(n.at).toLocaleDateString('en-ZA', { month: 'short' });
			labels.push(node('span', null, m !== month ? m : ''));
			month = m;
			return b;
		}));
		els.barLabels.replaceChildren(...labels);
	}

	function meter(label, value, ofWhat, tone) {
		const row = node('div', 'pp-meter');
		const top = node('div', 'pp-meter-top');
		top.append(node('span', null, label), node('span', 'pp-meter-val' + (tone ? ' pp-' + tone : ''), pct(value, ofWhat)));
		const track = node('div', 'pp-track');
		const fill = node('div', 'pp-fill' + (tone ? ' pp-fill-' + tone : ''));
		fill.style.width = (ofWhat ? (value / ofWhat) * 100 : 0) + '%';
		track.append(fill);
		row.append(top, track);
		return row;
	}

	function renderBreak() {
		const s = count(them);
		if (!s.breakKnown) {
			els.brk.replaceChildren(node('p', 'muted pp-empty', 'No frames with the break recorded in this period.'));
			return;
		}
		els.brk.replaceChildren(
			meter('Frames won on own break', s.wonOnBreak, s.broke, 'primary'),
			meter('Frames won off opponent\'s break', s.wonOffBreak, s.offBreak),
			meter('Break & finish rate', s.bf, s.broke, 'warning')
		);
	}

	// Each team's place in its season, by the league's own ranking columns
	// (TDCStandings, as the Standings tab ranks them). null where it cannot
	// be ranked; '' where it could not be read (said on the status line).
	async function teamPlaces() {
		const seasons = [...new Set(them.teams.filter((t) => t.team_id).map((t) => t.league_season_id))];
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

	function renderTeams(places) {
		if (!them.teams.length) { els.teams.replaceChildren(node('p', 'muted pp-empty', 'Not in a league yet.')); return; }
		els.teams.replaceChildren(...them.teams.map((t) => {
			const a = node('a', 'pp-team');
			a.href = '/leagues/season/?s=' + encodeURIComponent(t.league_season_id) + (t.team_id ? '&team=' + encodeURIComponent(t.team_id) : '');
			const pic = node('span', 'team-pic pp-team-pic');
			pic.append(TDC.teamPic(t.team_picture));
			const names = node('span', 'pp-team-names');
			names.append(node('span', 'pp-team-name', t.team_name || 'No team yet'),
				node('span', 'muted pp-team-sub', t.league_name + ' · ' + t.season_name));
			const right = node('span', 'pp-team-right');
			const place = places && t.team_id ? places[t.team_id] : null;
			right.append(node('span', 'pp-team-place' + (place === 1 || place === 2 ? ' pp-primary' : ''), place ? ordinal(place) : '–'),
				node('span', 'muted pp-team-role', t.is_captain ? 'Captain' : 'Player'));
			a.append(pic, names, right);
			return a;
		}));
	}

	function matchRow(m) {
		const row = node('a', 'pp-row');
		row.href = matchHref(m);
		const pic = m.team_match ? node('span', 'team-pic pp-row-pic') : avatar(m.opponent_avatar, m.opponent);
		if (m.team_match) pic.append(TDC.teamPic(m.opponent_team_picture));
		const names = node('span', 'pp-row-names');
		names.append(node('span', 'pp-row-name', 'vs ' + m.opponent), node('span', 'muted pp-row-sub', kindLabel(m) + ' · ' + day(m.played_at)));
		const score = node('span', 'pp-score');
		const a = node('span', m.mine > m.theirs ? 'pp-primary' : null, String(m.mine));
		const b = node('span', m.theirs > m.mine ? null : 'muted', String(m.theirs));
		score.append(a, document.createTextNode('–'), b);
		row.append(pic, names, score, resultDot(result(m)));
		return row;
	}

	function renderRecent() {
		const list = them.matches;
		if (!list.length) {
			els.recent.replaceChildren(node('p', 'muted pp-empty', 'No finished matches yet.'));
			els.last.replaceChildren();
			return;
		}
		const shown = recentAll ? list : list.slice(0, 3);
		const rows = shown.map(matchRow);
		if (list.length > 3) {
			const more = node('button', 'pp-link', recentAll ? 'Show fewer' : 'See all ' + list.length);
			more.type = 'button';
			more.addEventListener('click', () => { recentAll = !recentAll; renderRecent(); });
			rows.push(more);
		}
		els.recent.replaceChildren(...rows);

		// The last match, frame by frame: their own frames in it.
		const m = list[0];
		const frames = them.frames.filter((f) => f.match_id === m.match_id).sort((x, y) => x.frame_no - y.frame_no);
		const head = node('p', 'muted pp-sub', 'vs ' + m.opponent + ' · ' + kindLabel(m) + ' · ' + day(m.played_at) + ' · ' + { W: 'won', L: 'lost', D: 'drawn' }[result(m)] + ' ' + m.mine + '–' + m.theirs);
		const grid = node('div', 'pp-frames');
		for (const f of frames) {
			const c = node('span', 'pp-frame');
			const d = node('span', 'pp-mark' + (f.won ? ' pp-mark-won' : '') + (f.broke ? ' pp-mark-broke' : ''));
			d.title = 'Frame ' + f.frame_no + ': ' + (f.won ? 'won' : 'lost') + (f.broke ? ', broke' : '') +
				(f.won && f.result_event && f.result_event !== 'win' ? ' (' + (TDCMatchDef.RESULT_EVENT[f.result_event] || f.result_event) + ')' : '');
			c.append(node('span', 'muted pp-frame-no', String(f.frame_no)), d);
			grid.append(c);
		}
		const key = node('p', 'muted pp-key');
		key.append(node('span', null, '● green: frame won'), node('span', 'pp-warning', '○ yellow ring: broke'));
		const open = node('a', 'pp-link', 'Open match');
		open.href = matchHref(m);
		els.last.replaceChildren(head, grid, key, open);
	}

	function honour(icon, title, sub, unbuilt) {
		const t = node(unbuilt ? 'button' : 'div', 'pp-honour');
		if (unbuilt) { t.type = 'button'; t.dataset.unbuilt = unbuilt; }
		const ic = node('span', 'pp-honour-icon');
		ic.append(icon);
		t.append(ic, node('span', 'pp-honour-title', title), node('span', 'muted pp-honour-sub', sub));
		return t;
	}

	function renderHonours() {
		const s = count(them, true);
		const tiles = [honour(svg('M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8'), 'Trophies', 'Not built yet', 'Trophies')];
		if (s.gb) tiles.push(honour(svg('M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z'), 'Golden break', '×' + s.gb));
		if (s.bf) tiles.push(honour(svg('M4 18l5-6 4 3 7-9'), 'Break & finish', '×' + s.bf));
		if (s.best) tiles.push(honour(svg('M13 3L5 14h6l-1 7 8-11h-6z'), 'Win streak', 'Best ' + s.best));
		els.honours.replaceChildren(...tiles);
	}

	function renderAbout() {
		const p = them.player;
		const rows = [];
		const add = (label, value) => { rows.push(node('dt', 'muted', label)); const dd = node('dd'); dd.append(value); rows.push(dd); };
		add('Full name', document.createTextNode(p.full_name || 'Not given'));
		const venue = node('button', 'pp-link', 'Not built yet');
		venue.type = 'button';
		venue.dataset.unbuilt = 'Home venue';
		add('Home venue', venue);
		const teams = them.teams.filter((t) => t.team_id);
		const tl = node('span');
		if (!teams.length) tl.textContent = 'None';
		teams.forEach((t, i) => {
			if (i) tl.append(document.createTextNode(', '));
			const a = node('a', null, t.team_name + (t.is_captain ? ' (C)' : ''));
			a.href = '/leagues/season/?s=' + encodeURIComponent(t.league_season_id) + '&team=' + encodeURIComponent(t.team_id);
			tl.append(a);
		});
		add('Teams', tl);
		add('Status', node('span', p.verified ? 'pp-primary' : 'muted', p.verified ? 'ID verified' : 'Not verified'));
		add('Member since', document.createTextNode(monthYear(p.since)));
		els.about.replaceChildren(...rows);
	}

	function renderProfile() {
		renderForm();
		renderStats();
		renderBars();
		renderBreak();
		renderRecent();
		renderHonours();
		renderAbout();
	}

	// ─── Head to head ───
	function versusSide(p, label, me) {
		const s = node('div', 'pp-vs-side');
		s.append(avatar(p.avatar_path, p.display_name, 'pp-vs-pic' + (me ? ' pp-vs-pic-me' : '')), node('span', 'pp-vs-name', label));
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

		// Side by side, all time.
		const x = count(mine, true), y = count(them, true);
		const rows = [
			['Frame win', x.frames ? x.fw / x.frames : 0, y.frames ? y.fw / y.frames : 0, pct(x.fw, x.frames), pct(y.fw, y.frames)],
			['Break & finish', x.bf, y.bf],
			['Lags won', x.breakKnown ? x.broke / x.breakKnown : 0, y.breakKnown ? y.broke / y.breakKnown : 0, pct(x.broke, x.breakKnown), pct(y.broke, y.breakKnown)],
			['Best streak', x.best, y.best],
			['Matches', x.matches, y.matches]
		];
		els.cmp.replaceChildren(...rows.map(([label, a1, b1, as, bs]) => {
			const top = Math.max(a1, b1) || 1;
			const r = node('div', 'pp-cmp-row');
			const lt = node('span', 'pp-cmp-bar pp-cmp-left'), rt = node('span', 'pp-cmp-bar pp-cmp-right');
			const lw = node('span', 'pp-cmp-fill'), rw = node('span', 'pp-cmp-fill');
			lw.style.width = (a1 / top) * 100 + '%';
			rw.style.width = (b1 / top) * 100 + '%';
			lt.append(lw);
			rt.append(rw);
			r.append(node('b', 'pp-primary', as || String(a1)), lt, node('span', 'muted pp-cmp-label', label), rt, node('b', 'pp-cmp-them', bs || String(b1)));
			return r;
		}));

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
	function showTab(tab, btn) {
		const h = tab === 'h2h' && them && !them.player.is_me;
		for (const b of els.views.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String((b.dataset.tab === 'h2h') === h));
		els.profile.hidden = h;
		els.h2h.hidden = !h;
		const url = new URL(location.href);
		if (h) url.searchParams.set('tab', 'h2h'); else url.searchParams.delete('tab');
		history.replaceState(null, '', url);
		if (btn) TDC.busy(btn, pause(), els.status);
	}
	els.views.addEventListener('click', (e) => {
		const b = e.target.closest('[data-tab]');
		if (b) showTab(b.dataset.tab, b);
	});
	els.compare.addEventListener('click', () => {
		showTab('h2h', els.compare);
		els.views.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});
	els.period.addEventListener('click', (e) => {
		const b = e.target.closest('[data-days]');
		if (!b) return;
		days = Number(b.dataset.days);
		for (const x of els.period.querySelectorAll('[data-days]')) x.setAttribute('aria-pressed', String(x === b));
		renderStats();
		renderBars();
		renderBreak();
		TDC.busy(b, pause(), els.status);
	});

	// ─── Not built yet, and the bar ───
	// A tap on anything with nothing behind it says so, on the note line of
	// its section (the page's own line otherwise).
	document.addEventListener('click', (e) => {
		const b = e.target.closest('[data-unbuilt]');
		if (!b) return;
		const box = b.closest('.pp-section, .pp-hero');
		const note = (box && box.querySelector('[data-note]')) || els.status;
		TDC.status(note, b.dataset.unbuilt + ' is not built yet.', '');
	});
	el('pp-back').addEventListener('click', () => {
		if (history.length > 1) history.back(); else location.href = '/leagues/';
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
		return true;
	}

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		if (!playerId) {
			TDC.error(AREA, 'no player in the address. Open this page from a player\'s name.', null, els.status);
			return;
		}

		const theirs = await supabaseClient.rpc('tdc_player_profile', { p_player_id: playerId });
		if (!check(theirs, 'profile')) return;
		them = theirs.data;

		if (!them.player.is_me) {
			const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
			if (!me) return;
			const [mp, hh] = await Promise.all([
				supabaseClient.rpc('tdc_player_profile', { p_player_id: me.id }),
				supabaseClient.rpc('tdc_head_to_head', { p_player_id: playerId })
			]);
			if (!check(mp, 'profile') || !check(hh, 'head to head')) return;
			mine = mp.data;
			h2h = hh.data;
		}

		renderHero();
		renderProfile();
		renderH2H();
		renderTeams(null);
		showTab(params.get('tab') === 'h2h' ? 'h2h' : 'profile');
		els.body.hidden = false;
		renderTeams(await teamPlaces());
	})(), 'The player');
})();
