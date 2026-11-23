// A player's profile (/players/?p=<player id>, UV's combined design, 5 Nov).
//
// The hero (picture left of the centre line, names right; a tap on a photo
// shows it large; Challenge, Follow, Share and More as ring icons), then a
// toggle between three tabs:
//   • Profile: teams, form (the last 10 frames),
//     competitions (league and tournament matches) and recent matches a page
//     at a time, about. (The frame difference per night, on Compare only
//     since 17 Nov, was removed on 20 Nov, UV.)
//   • (Head to head was removed on 20 Nov, UV; tdc_head_to_head is still in
//     the database, unused.)
//   • Compare (the tab that opens first for another player, UV 20 Nov): both profiles side by side, you on the left, each half headed
//     by its player's picture and names, which stay at the top as the page
//     scrolls (UV, 5 Nov); no sunken halves (UV, 17 Nov).
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
// Challenge, Follow and More have nothing behind
// them yet (UV, 5 Nov: shown, a tap says so). Honours are off the page until
// they are built (UV, 5 Nov).
//
// Needs: tdc.js, match-settings.js (TDCMatchDef), player-star.js. (A team's
// place in its league was removed from the league cards on 20 Nov, UV.)

(() => {
	const AREA = 'Player';
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('pp-status'), body: el('pp-body'),
		pic: el('pp-pic'), verified: el('pp-verified'), name: el('pp-name'), full: el('pp-full'),
		actions: el('pp-actions'), views: el('pp-views'),
		profile: el('pp-tab-profile'), cmpTab: el('pp-tab-cmp'),
		aboutTitle: el('pp-about-title'), about: el('pp-about'), cAbout: el('pp-c-about'),
		follow: el('pp-follow'), find: el('pp-find'), findInput: el('pp-find-input'),
		findNote: el('pp-find-note'), findResults: el('pp-find-results'),
		following: el('pp-following'), followingNote: el('pp-following-note')
	};

	const params = new URLSearchParams(location.search);
	const playerId = params.get('p');
	let them = null;     // tdc_player_profile of the player shown
	let mine = null;     // and of the person looking, for side by side
	const days = 0;      // the period: all time (the period switch went with the Stats section, 20 Nov, UV)
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
	const day = (iso) => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
	const monthYear = (iso) => new Date(iso).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
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
		// Doubles is listed, never counted in the singles numbers (UV, 19 Nov;
		// migration 20261119124608, which also leaves its frames out).
		const matches = p.matches.filter((m) => m.status === 'complete' && !m.doubles && (!since || new Date(m.played_at).getTime() >= since));
		const ids = new Set(matches.map((m) => m.match_id));
		return { matches, frames: p.frames.filter((f) => ids.has(f.match_id)) };
	}

	// ─── The hero ───
	function renderHero() {
		const p = them.player;
		els.pic.replaceChildren(avatar(p.avatar_path, p.display_name, 'pp-pic-inner'));
		els.verified.hidden = !p.verified;
		els.name.textContent = p.display_name;
		fitName();
		els.full.replaceChildren(TDC.fullName(p.full_name, p.surname));
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
		// One line's height for the picture while the name is measured, so the picture
		// takes no more of the row than it will end up with.
		els.pic.style.setProperty('--pp-pic-size', Math.round(parseFloat(getComputedStyle(h).lineHeight) || 0) + 'px');
		const room = h.clientWidth;
		if (room && h.scrollWidth > room) {
			const size = parseFloat(getComputedStyle(h).fontSize);
			h.style.fontSize = Math.floor(size * room / h.scrollWidth) + 'px';
		}
		sizePic();
	}

	// The picture as tall as one line of the display name beside it (UV, 17 Nov; the
	// full name moved below, 19 Nov). One line, not the name's whole height: a name
	// that wrapped would grow the picture and push its own words out of the row.
	// 21 Nov (UV): the one picture fills both rows, as tall as the display name and
	// the full name together (never over half the row). A bigger picture narrows the
	// names and may wrap them, so it is measured again until it stops changing.
	function sizePic() {
		const names = els.name.parentElement, row = names.parentElement;
		const cap = row.clientWidth / 2;
		let size = 0;
		for (let i = 0; i < 4; i++) {
			const next = Math.round(Math.min(names.getBoundingClientRect().height, cap));
			if (!(next > 0) || next === size) break;
			size = next;
			els.pic.style.setProperty('--pp-pic-size', size + 'px');
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
		const all = v.p.frames.slice()
			.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.frame_no - b.frame_no));
		const last = all.slice(-10);
		// The streak (UV, 20 Nov): frames won since the last one lost, over every
		// finished frame, not only the ten shown; 0 when the latest was lost.
		const streak = v.part('streak');
		let run = 0;
		for (let i = all.length - 1; i >= 0 && all[i].won; i--) run++;
		if (streak) {
			streak.replaceChildren(...(all.length ? [node('span', 'muted', 'Streak: '), node('b', run ? 'pp-primary' : null, String(run))] : []));
		}
		if (!last.length) { box.replaceChildren(node('span', 'muted', 'No finished frames yet.')); return; }
		if (last.some((f) => f.opponent === undefined)) {
			TDC.error(AREA, "The profile does not name each frame's opponent yet. Push migration 20261120130000.", null, els.status);
		}
		// A row a frame (UV, 20 Nov): the dot in the middle, the match's opponent
		// beside it, a grey line between rows. The opponent is the player in that
		// frame, also on a team night.
		box.replaceChildren(...last.map((f) => {
			const m = byMatch.get(f.match_id);
			const d = resultDot(f.won ? 'W' : 'L');
			if (f.broke) d.classList.add('pp-dot-broke');
			d.title = (f.won ? 'Won' : 'Lost') + (f.broke ? ', broke' : '') + (m ? ' · v ' + m.opponent + ', ' + day(m.played_at) : '');
			// On Compare each half reads toward the line down the middle: yours
			// Opp | Result, theirs Result | Opp (UV, 20 Nov), so the two dots sit
			// side by side at the centre. On the Profile tab the dot is in the middle.
			// The player across the table (UV, 20 Nov), not the match's team: the
			// frame's own opponent, from migration 20261120130000.
			const opp = node('span', 'muted pp-form-opp', f.opponent || '');
			const row = node('div', 'pp-form-row' + (v.side ? ' is-' + v.side : ''));
			if (v.side === 'mine') row.append(opp, d);
			else if (v.side === 'them') row.append(d, opp);
			else row.append(node('span'), d, opp);
			return row;
		}));
	}

	// Each league's star (UV, 19 Nov): its starting frames come from the league's
	// own schedule, so they are read once per team and season, for both sides of
	// Compare. Keyed season + team; a team with none read has no entry.
	async function leagueSets() {
		const teams = them.teams.concat(mine ? mine.teams : []).filter((t) => t.team_id);
		const sets = {};
		await Promise.all(teams.map(async (t) => {
			const key = t.league_season_id + t.team_id;
			if (sets[key]) return;
			const got = await TDCStar.leagueSettings(supabaseClient, t.league_season_id, t.team_id, !isSingles(t));
			if (got.error) { TDC.showSupabaseError(AREA, got.error, els.status); return; }
			sets[key] = { set: got.set, scheduled: got.scheduled, avg: got.avg };
		}));
		return sets;
	}

	// The key under each Leagues heading (UV, 21 Nov): the grey standard and the
	// yellow league average, once for every league star below it, in the size the
	// star's own labels are drawn at (11 in the picture, scaled with it). Shown only
	// when a labelled star is on screen there; measured again on a resize and a tab.
	function sizeKeys() {
		for (const key of document.querySelectorAll('.star-key')) {
			const tab = key.closest('#pp-tab-profile, #pp-tab-cmp');
			const svg = tab && !tab.hidden ? tab.querySelector('.pp-team-star .star-svg:not(.star-bare)') : null;
			const scale = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 0;
			key.hidden = !(scale > 0);
			if (scale > 0) key.style.fontSize = (11 * scale).toFixed(2) + 'px';
		}
	}
	addEventListener('resize', sizeKeys);

	// A singles league (team size 1): its players are each captain of a team of
	// one, so the role is left off (UV, 20 Nov). The season's rules come with the team.
	const isSingles = (t) => !!(t.rules && t.rules.team_size === 1);
	// A card shows no team name or role (UV, 21 Nov) in a singles league, or where the
	// team is just the player under their own name (a league whose rules do not say
	// team size 1, e.g. a team called "Julie" for Julie). *Claude's reading, for UV to
	// judge:* a team named as the player's display or full name.
	const teamOfOne = (t, p) => isSingles(t) || [p && p.display_name, p && p.full_name]
		.some((n) => n && t.team_name && n.trim().toLowerCase() === t.team_name.trim().toLowerCase());

	// The leagues both players are in (UV, 20 Nov): on Compare each is one
	// combined card with one star for both, so it leaves the two halves' lists.
	// Both need a team, as the star is read by team. Empty on the Profile tab.
	let shared = new Set();
	function sharedSeasons() {
		if (!mine) return new Set();
		const ids = new Set(mine.teams.filter((t) => t.team_id).map((t) => t.league_season_id));
		return new Set(them.teams.filter((t) => t.team_id && ids.has(t.league_season_id)).map((t) => t.league_season_id));
	}

	// A league's or a team's name with its picture beside it (UV, 21 Nov), in its own
	// frame: the league's shield, the team's hexagon (TDC.leaguePic, TDC.teamPic).
	// The picture comes first in the markup; CSS puts it on the name's inside.
	function named(kind, path, nameNode) {
		const box = node('span', 'pp-nm pp-nm-' + kind);
		const pic = node('span', kind === 'league' ? 'pp-lg-pic' : 'team-pic pp-nm-pic');
		pic.append(kind === 'league' ? TDC.leaguePic(path) : TDC.teamPic(path));
		box.append(pic, nameNode);
		return box;
	}

	function renderTeams(v, sets) {
		const box = v.part('teams');
		if (!v.p.teams.length) { box.replaceChildren(node('p', 'muted pp-empty', 'Not in a league yet.')); return; }
		const list = v.side ? v.p.teams.filter((t) => !shared.has(t.league_season_id)) : v.p.teams;
		box.replaceChildren(...list.map((t) => {
			const a = node('a', 'pp-team' + (v.side ? ' is-' + v.side : ''));
			// A league card opens the league's first page, Standings (UV, 20 Nov); the
			// old &team= opened the Season tab on the team.
			a.href = '/leagues/season/?s=' + encodeURIComponent(t.league_season_id);
			const names = node('span', 'pp-team-names');
			// The league's name heads the card in the display face (UV, 20 Nov), then the
			// team's, then the season and venue. Each name has its picture beside it (UV,
			// 21 Nov), on the inside on Compare (toward the middle line).
			// No team line in a singles league (UV, 21 Nov): a team of one has no name of
			// its own, and the player is already named at the top of the page.
			names.append(...[named('league', t.league_picture, node('span', 'pp-league-name', t.league_name)),
				teamOfOne(t, v.p.player) ? null : t.team_id ? named('team', t.team_picture, node('span', 'pp-team-name', t.team_name || 'No team yet'))
					: node('span', 'pp-team-name', 'No team yet'),
				// The role (Player, Captain) directly under the team name (UV, 21 Nov); none
				// for a team of one.
				teamOfOne(t, v.p.player) ? null : node('span', 'muted pp-team-role', t.is_captain ? 'Captain' : 'Player'),
				node('span', 'muted pp-team-sub', [t.season_name, TDC.venueNames(t.venues)].filter(Boolean).join(' · '))].filter(Boolean));
			a.append(names);
			const got = sets && t.team_id ? sets[t.league_season_id + t.team_id] : null;
			if (got) {
				const set = got.set;
				const certain = TDCStar.leagueSolid(v.p, t.league_season_id, got.scheduled);
				const counts = TDCStar.count(TDCStar.leagueFrames(v.p, t.league_season_id), set.walkovers);
				const { svg } = TDCStar.draw('Star for ' + v.p.player.display_name + ' in ' + t.league_name, [{ counts, certain, avg: got.avg, cls: v.p.player.is_me ? '' : 'star-cream' }], set, TDCStar.LEAGUE_SPOKES, { bare: !!v.side });
				const star = node('span', 'pp-team-star');
				star.append(svg);
				a.append(star);
			}
			return a;
		}));
	}

	// One card for a league both players are in, with one star: yours the green
	// shape, theirs the solid cream line (UV, 20 Nov), the league's average yellow
	// and UV's standards the grey pentagon. Under each label: yours | theirs | the
	// league's (Claude's addition, for UV to judge).
	function renderShared(sets) {
		const box = el('pp-cmp-shared');
		box.replaceChildren(...[...shared].map((sid) => {
			const m = mine.teams.find((t) => t.league_season_id === sid);
			const t = them.teams.find((x) => x.league_season_id === sid);
			const a = node('a', 'pp-team pp-team-shared');
			a.href = '/leagues/season/?s=' + encodeURIComponent(sid);
			const head = node('span', 'pp-shared-head');
			head.append(named('league', t.league_picture, node('span', 'pp-league-name', t.league_name)),
				node('span', 'muted pp-team-sub', [t.season_name, TDC.venueNames(t.venues)].filter(Boolean).join(' · ')));
			const sides = node('span', 'pp-shared-sides');
			// No player names (the heads above are pinned to the page) and no team
			// place (UV, 20 Nov): the colours say whose team is whose.
			for (const [x, cls, who] of [[m, 'pp-shared-me', mine.player], [t, 'pp-shared-them', them.player]]) {
				if (teamOfOne(x, who)) continue;   // no team line in a singles league (UV, 21 Nov)
				const side = node('span', 'pp-shared-side ' + cls + ' ' + (cls === 'pp-shared-me' ? 'is-mine' : 'is-them'));
				// The hexagon on the inside, toward the middle (yours right of its name, theirs left).
				side.append(x.team_id ? named('team', x.team_picture, node('span', 'pp-team-name', x.team_name || 'No team yet'))
					: node('span', 'pp-team-name', 'No team yet'));
				if (!teamOfOne(x, who)) side.append(node('span', 'muted pp-team-role', x.is_captain ? 'Captain' : 'Player'));
				sides.append(side);
			}
			a.append(head);
			if (sides.children.length) a.append(sides);
			const gm = sets && sets[sid + m.team_id];
			const gt = sets && sets[sid + t.team_id];
			if (gm && gt) {
				const count = (p) => TDCStar.count(TDCStar.leagueFrames(p, sid), gm.set.walkovers);
				const { svg } = TDCStar.draw('Star comparing you and ' + themName() + ' in ' + t.league_name, [
					{ counts: count(mine), certain: TDCStar.leagueSolid(mine, sid, gm.scheduled), avg: gm.avg },
					{ counts: count(them), dashed: true }
				], gt.set, TDCStar.LEAGUE_SPOKES);
				const star = node('span', 'pp-team-star');
				star.append(svg);
				a.append(star);
			}
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
		// Doubles (20261119124608): "with Bob vs Carol & Dan".
		row.append(strip, pic, rowNames((m.doubles && m.partner ? 'with ' + m.partner + ' ' : '') + 'vs ' + m.opponent, m),
			// The score once a frame is in.
			m.status !== 'complete' && !m.mine && !m.theirs ? node('span', 'pp-score muted', '–') : scoreNode('pp-score', m.mine, m.theirs));
		return row;
	}

	// A match row's words, a line each (UV, 17 Nov): who, the league or
	// tournament, the date (put back 20 Nov, UV), the venue.
	function rowNames(who, m) {
		const names = node('span', 'pp-row-names');
		// The year only when it is not this one.
		const when = new Date(m.played_at);
		const date = when.toLocaleDateString('en-ZA', when.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
		names.append(node('span', 'pp-row-name', who), node('span', 'muted pp-row-sub', kindLabel(m)), node('span', 'muted pp-row-sub', date));
		const venue = TDC.venueNames(m.venues);
		if (venue) names.append(node('span', 'muted pp-row-sub', venue));
		return names;
	}

	// A score as "9 : 16" (UV, 17 Nov), no win or loss dot: won, yours green
	// and theirs grey; lost, both grey; drawn, both cream.
	function scoreNode(cls, mine, theirs) {
		const s = node('span', cls);
		const won = mine > theirs, lost = mine < theirs;
		s.append(node('span', won ? 'pp-primary' : lost ? 'muted' : null, String(mine)),
			node('span', 'muted pp-colon', ':'),
			node('span', won || lost ? 'muted' : null, String(theirs)));
		return s;
	}

	// Matches, one list a page at a time (UV, 20 Nov), 3 a page, its page number
	// the stepper above it, and a tab for each kind: All Matches, Leagues,
	// Tournaments and Singles. *Claude's reading, for UV to judge:* Singles is the
	// social matches between two people (not a doubles match, which only All lists).
	// One choice of tab for every view, so Compare's two halves follow one row.
	const MATCH_FILTERS = {
		all: { of: (ms) => ms, none: 'No matches yet.' },
		league: { of: (ms) => ms.filter((m) => m.kind === 'league'), none: 'No league matches yet.' },
		tournament: { of: (ms) => ms.filter((m) => m.kind === 'tournament'), none: 'No tournament matches yet.' },
		singles: { of: (ms) => ms.filter((m) => m.kind === 'social' && !m.doubles), none: 'No singles matches yet.' }
	};
	const PER_PAGE = 3;   // 5 until 20 Nov (UV: only 3 a page)
	let matchFilter = 'all';
	function renderMatches(v) {
		const f = MATCH_FILTERS[matchFilter], page = v.part('page-matches'), box = v.part('matches');
		const list = f.of(v.p.matches);
		const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
		page.max = String(pages);
		page.disabled = pages < 2;
		const at = Math.min(pages, Math.max(1, Math.round(page.valueAsNumber) || 1));
		if (page.valueAsNumber !== at) page.value = String(at);
		const shown = list.slice((at - 1) * PER_PAGE, at * PER_PAGE);
		box.replaceChildren(...(shown.length ? shown.map(matchRow) : [node('p', 'muted pp-empty', f.none)]));
	}
	// Each view's page number turns its own list's pages.
	function listenPages(v) {
		v.part('page-matches').addEventListener('change', () => renderMatches(v));
	}

	// About as label and value pairs: a list on the Profile tab, one table
	// on Compare (UV, 5 Nov).
	function aboutRows(p) {
		const rows = [];
		const add = (label, value) => rows.push([label, value]);
		add('Full name', p.player.full_name ? TDC.fullName(p.player.full_name, p.player.surname) : document.createTextNode('Not given'));
		const d = discipline(p);
		add('Plays', document.createTextNode(d || '–'));
		const teams = p.teams.filter((t) => t.team_id);
		const tl = node('span');
		if (!teams.length) tl.textContent = 'None';
		teams.forEach((t, i) => {
			if (i) tl.append(document.createTextNode(', '));
			const a = node('a', 'team-name', t.team_name + (t.is_captain && !isSingles(t) ? ' (C)' : ''));
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
			if (p.player.full_name) {
				const full = node('span', 'pp-c-full');
				full.append(TDC.fullName(p.player.full_name, p.player.surname));
				names.append(full);
			}
			person.append(TDC.profilePic(avatar(p.player.avatar_path, p.player.display_name, 'pp-c-pic'), p.player.player_id), names);
			who.replaceChildren(person);
		}
	}

	// The player star (UV, 19 Nov; docs/design/player-star.md), drawn by
	// player-star.js from the frames in the period. The Profile tab shows the
	// raw star too, dashed (every Profile tab, UV); Compare is one star across
	// both halves, you green and them blue, without it (UV).
	// From 20 Nov it follows the sandbox's star (UV): the same five spokes and
	// labels (Win %, Lags Won, W | Own Brk, W | Opp Brk, B&F | Own Brk) and the
	// same standards and starting frames, TDCStar's defaults.
	const STAR = TDCStar.defaults();
	const SPOKES = TDCStar.LEAGUE_SPOKES;
	const starCounts = (p) => TDCStar.count(inPeriod(p).frames, STAR.walkovers);

	// Somebody else's star is cream, not green (UV, 20 Nov), as on Compare: the
	// green shape is yours alone (your own profile, and your half of Compare).
	function renderStar(v) {
		const box = v.part('star');
		const { svg } = TDCStar.draw('Star for ' + v.p.player.display_name, [{ counts: starCounts(v.p), adjusted: true, cls: v.p.player.is_me ? '' : 'star-cream' }], STAR, SPOKES, { stats: true });
		box.replaceChildren(svg);
	}

	function renderCompareStar() {
		const box = el('pp-cmp-star');
		// You green, the other player always cream, as on the league cards, each with
		// their adjusted star dotted in their own colour (UV, 20 Nov; actual and adjusted swapped 21 Nov).
		const { svg } = TDCStar.draw('Star comparing you and ' + themName(), [
			{ counts: starCounts(mine), cls: 'star-a', adjusted: true },
			{ counts: starCounts(them), dashed: true, adjusted: true }
		], STAR, SPOKES, { stats: true });
		box.replaceChildren(svg);   // no names or caption above it (UV, 20 Nov)
	}

	// Everything that is drawn from the frames, in every view.
	function renderPeriod() {
		for (const v of views) {
			if (!v.vertical) renderStar(v);   // the star on the Profile tab; Compare has one across both halves
		}
		if (mine) renderCompareStar();
	}

	function renderProfile() {
		for (const v of views) {
			renderForm(v);
			renderMatches(v);
		}
		renderPeriod();
		renderAbout();
		if (mine) { renderCompareHeads(); renderCompareAbout(); }
	}

	// ─── The tabs and the period ───
	const pause = () => new Promise((r) => setTimeout(r, 200));
	// Compare or Profile; only Profile on your own page. Compare opens by default
	// for somebody else's (UV, 20 Nov); &tab=profile keeps Profile on reload.
	function showTab(tab, btn) {
		const other = them && !them.player.is_me;
		const t = other && tab !== 'profile' ? 'cmp' : 'profile';
		for (const b of els.views.querySelectorAll('[data-tab]')) b.setAttribute('aria-pressed', String(b.dataset.tab === t));
		els.profile.hidden = t !== 'profile';
		els.cmpTab.hidden = t !== 'cmp';
		const url = new URL(location.href);
		if (!other || t === 'cmp') url.searchParams.delete('tab'); else url.searchParams.set('tab', 'profile');
		history.replaceState(null, '', url);
		sizeKeys();
		if (btn) TDC.busy(btn, pause(), els.status);
	}
	els.views.addEventListener('click', (e) => {
		const b = e.target.closest('[data-tab]');
		if (b) showTab(b.dataset.tab, b);
	});
	// The match tabs (UV, 20 Nov): one choice for the Profile tab and both halves of
	// Compare; a new tab starts every list on its first page.
	document.addEventListener('click', (e) => {
		const b = e.target.closest('.pp-mtabs [data-mfilter]');
		if (!b || !them || !MATCH_FILTERS[b.dataset.mfilter]) return;
		matchFilter = b.dataset.mfilter;
		for (const x of document.querySelectorAll('.pp-mtabs [data-mfilter]')) x.setAttribute('aria-pressed', String(x.dataset.mfilter === matchFilter));
		for (const v of views) { v.part('page-matches').value = '1'; renderMatches(v); }
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
	// The hero's buttons: each a ring icon (ring-status.js), shown already
	// drawn: a page load draws nothing in (UV, 16 Nov).
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
					initial: icon
				});
			} catch (err) {
				TDC.error(AREA, 'an icon could not be drawn: ' + icon, err, els.status);
			}
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
			if (p.full_name) {
				const full = node('span', 'muted pp-row-sub');
				full.append(TDC.fullName(p.full_name, p.surname));
				names.append(full);
			}
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
		if (p.full_name) {
			const full = node('span', 'muted pp-row-sub');
			full.append(TDC.fullName(p.full_name, p.surname));
			names.append(full);
		}
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

	// The short link once they have a first name and surname, else the long one
	// (UV, 10 Nov). Your own page says why yours is long.
	function wireShare() {
		TDC.shareButton(el('pp-share'), 'player', playerId, {
			area: AREA,
			status: els.status,
			title: () => them.player.display_name + ' — The Dive Club',
			longUrl: location.origin + '/players/?p=' + encodeURIComponent(playerId)
		}).then((link) => {
			if (link && !link.code && them.player.is_me) el('pp-link-note').hidden = false;
		});
	}

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
			const [mp, fw] = await Promise.all([
				supabaseClient.rpc('tdc_player_profile', { p_player_id: me.id }),
				supabaseClient.rpc('tdc_i_follow', { p_player_id: playerId })
			]);
			if (!check(mp, 'profile')) return;
			mine = mp.data;
			// Not through check(): false is a good answer here.
			if (fw.error) { TDC.showSupabaseError(AREA, fw.error, els.status); return; }
			iFollow = fw.data;
		}

		views = [view(els.profile, them)];
		if (mine) views.push(view(els.cmpTab, mine, 'mine'), view(els.cmpTab, them, 'them'));
		views.forEach(listenPages);

		renderHero();
		wireShare();
		renderProfile();
		shared = sharedSeasons();
		for (const v of views) renderTeams(v, null);
		if (mine) renderShared(null);
		showTab(params.get('tab'));
		els.body.hidden = false;
		fitName();   // measured once it is shown
		if (them.player.is_me) wakeIcons(); else drawFollow();
		const sets = await leagueSets();
		for (const v of views) renderTeams(v, sets);
		if (mine) renderShared(sets);
		sizeKeys();
	})(), 'The player');
})();
