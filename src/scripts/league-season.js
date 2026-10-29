// A league season, as a player sees it (/leagues/season/?s=<league season id>).
//
// At the top, the league (UV, 24 Oct): a banner with its picture, name,
// status and how it is played, read from the season info, the season's own
// row and its rules; then its numbers so far, counted from the fixtures and
// teams.
//
// Then three jobs:
//   • Your place. Somebody who has been added to a league has to confirm that
//     they are playing; nobody can do it for them and the league cannot begin
//     until every active player has. This is where they do it, and where they
//     can say they are not playing after all.
//   • The league. Teams with their rosters (each player's picture, name and
//     a link to their profile, still to be built), and who runs it.
//   • Your team, if you captain one. Claim a player who has confirmed and is on
//     no team, release one, name another captain, rename the team.
//
// A captain only ever controls the team they captain. Whether you may is not
// worked out here: the buttons are shown from what tdc_my_leagues says, and the
// database refuses the rest through private.tdc_can_control_team, the one place
// that question is answered. The director runs everything from the manage page.
//
// Everything is read with one call each and read again after every write.
//
// Needs: tdc.js.

TDCLeagueNav.panel('season', () => {
	const AREA = 'League season';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		mePanel: el('me-panel'), meLine: el('me-line'), meDetail: el('me-detail'),
		meConfirm: el('me-confirm'), meWithdraw: el('me-withdraw'), meAway: el('me-away'),
		jumbo: el('jumbo'), jumboPic: el('jumbo-pic'), jumboStatus: el('jumbo-status'), jumboFacts: el('jumbo-facts'),
		stats: el('stats'),
		poolPanel: el('pool-panel'), poolHint: el('pool-hint'), poolList: el('pool-list'),
		teamCount: el('team-count'), teamList: el('team-list'), teamEmpty: el('team-empty'),
		officialList: el('official-list'),
		status: el('page-status'),
		meCard: el('me-card')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the season page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let info = null;
	let mine = null;            // my row from tdc_my_leagues, or null
	let myPlayerId = null;      // tdc_my_leagues does not carry it; marking myself away needs it
	let teams = [];
	let rosters = new Map();    // team id -> roster rows, loaded when a team is opened
	const openTeams = new Set();
	let officials = [];
	let pool = [];
	let fixtures = [];
	let seasonRow = null;       // status, reserves, entries: the season's own row
	let readiness = null;       // only for the people running it and its captains
	// A team named in the address (&team=, from the fixtures page) is opened
	// and brought into view once, on the first draw.
	let focusTeam = new URLSearchParams(location.search).get('team');
	if (focusTeam) openTeams.add(focusTeam);
	// The same from the Fixtures tab once this tab has started (29 Oct): the
	// team is opened and brought into view in place. Not drawn yet, the
	// address carries it to the first draw.
	document.addEventListener('tdc:league-team', (e) => {
		const box = e.detail && document.getElementById('team-' + e.detail);
		if (!box) return;
		focusTeam = null;
		box.open = true;
		box.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	const D = TDCMatchDef;

	// A player's picture, from the public player-avatars bucket, or their
	// initials in a circle when they have none.
	function avatar(path, name) {
		const box = node('span', 'person-pic');
		if (path) {
			const { data } = supabaseClient.storage.from('player-avatars').getPublicUrl(path);
			const img = document.createElement('img');
			img.src = data.publicUrl;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return box;
	}

	// A person: picture, name and what they are, as one link to their profile
	// (still to be built: /players/ says so). Glows like a row.
	function personLink(playerId, name, path, sub) {
		const a = node('a', 'person');
		a.href = '/players/?p=' + encodeURIComponent(playerId);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name));
		if (sub) names.append(node('span', 'person-sub', sub));
		a.append(avatar(path, name), names);
		return a;
	}

	// The league's picture until leagues have their own, as on the leagues
	// list: a trophy. A team's: a shield, as on the fixtures page.
	function svgIcon(d, filled) {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('d', d);
		if (filled) path.setAttribute('fill', 'currentColor');
		else {
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'currentColor');
			path.setAttribute('stroke-width', '2');
			path.setAttribute('stroke-linejoin', 'round');
		}
		svg.append(path);
		return svg;
	}
	const TROPHY = 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';
	const SHIELD = 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z';

	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a season: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Whether this person may control their own team. Mirrors the database's
	// own rule (an active captain) only so the right buttons are shown; it is
	// not what protects anything. Confirmation stopped being part of that rule
	// on 23 Oct (20261023120000), and this had not followed.
	const controlsTeam = () => !!(mine && mine.i_captain && mine.my_team_id
		&& mine.my_status === 'active');

	// My team's row from tdc_league_season_teams, for its count and limit.
	const myTeam = () => (mine && mine.my_team_id && teams.find((t) => t.team_id === mine.my_team_id)) || null;
	const isFull = (t) => !!t && t.active_players >= t.team_limit;

	// ─── The season ───
	async function loadInfo() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}

		els.name.textContent = info.league_name;
		els.meta.textContent = info.name;
		els.jumboPic.replaceChildren(svgIcon(TROPHY, true));

		return true;
	}

	// ─── Your place ───
	async function loadMine() {
		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		mine = (data || []).find((l) => l.league_season_id === seasonId) || null;
		renderMine();
		return true;
	}

	// The next match this person's team is in, so a captain lands on the card
	// rather than hunting through the fixture list for it.
	function loadMyNext() {
		els.meCard.hidden = true;
		if (!mine || !mine.my_team_id) return;

		const ours = fixtures.filter((f) =>
			f.match_id && (f.home_team_id === mine.my_team_id || f.away_team_id === mine.my_team_id));
		if (!ours.length) return;

		// The first one not yet finished, or the most recent if they all are.
		const next = ours.find((f) => f.match_status !== 'complete' && f.match_status !== 'reopened') || ours[ours.length - 1];
		els.meCard.href = '/leagues/card/?m=' + encodeURIComponent(next.match_id);
		els.meCard.textContent = mine.i_captain ? 'Set my lineup' : 'My next match';
		els.meCard.hidden = false;
	}

	function renderMine() {
		// Somebody who only runs the season, and plays nowhere in it, has no
		// place to show. They have the manage page.
		const plays = mine && mine.my_status;
		els.mePanel.hidden = !plays;
		if (!plays) return;

		els.meConfirm.hidden = true;
		els.meWithdraw.hidden = true;
		els.meAway.hidden = true;

		if (mine.my_status === 'withdrawn') {
			els.meLine.textContent = 'You withdrew from this league.';
			els.meDetail.textContent = 'Whoever runs the league can add you back if you change your mind.';
		} else if (mine.my_status === 'inactive' && mine.my_team_id) {
			// Away: still on the team, not pickable, not taking up a place.
			els.meLine.textContent = 'You are marked away from ' + mine.my_team_name + '.';
			els.meDetail.textContent = 'You keep your place on the team, but you cannot be picked for a match until you are back.';
			els.meAway.textContent = 'I am back';
			els.meAway.dataset.active = '1';
			els.meAway.hidden = false;
		} else if (mine.my_status === 'inactive') {
			els.meLine.textContent = 'You are marked inactive in this league.';
			els.meDetail.textContent = 'Ask whoever runs the league to make you active again.';
		} else if (mine.my_status === 'interested') {
			// Name down, not let in yet. Nothing to confirm until they are.
			els.meLine.textContent = 'Your name is down.';
			els.meDetail.textContent = 'Whoever runs the league will let you in. There is nothing else for you to do yet.';
		} else if (!mine.confirmed_at) {
			els.meLine.textContent = 'You are in this league. Are you playing?';
			els.meDetail.textContent = 'Confirming tells your captain and whoever runs the league that you are playing.';
			els.meConfirm.hidden = false;
			els.meWithdraw.hidden = false;
		} else if (!mine.my_team_name) {
			els.meLine.textContent = 'You are confirmed.';
			els.meDetail.textContent = 'You are not on a team yet. A captain can claim you, or whoever runs the league can place you.';
			els.meWithdraw.hidden = false;
		} else {
			els.meLine.textContent = 'You are playing for ' + mine.my_team_name
				+ (mine.confirmed_at ? ', and you have confirmed.' : '. You have not confirmed yet.');
			els.meDetail.textContent = controlsTeam() ? 'You are a captain of this team.' : '';
			els.meWithdraw.hidden = false;
			els.meAway.textContent = 'I am away for a while';
			els.meAway.dataset.active = '0';
			els.meAway.hidden = false;
		}
	}

	// Away and back, for yourself. Coming back is refused while the team is
	// full; the database says so in words the player can act on.
	els.meAway.addEventListener('click', () => {
		const back = els.meAway.dataset.active === '1';
		if (!back && !confirm('Mark yourself away?\n\nYou keep your place on ' + mine.my_team_name
			+ ', but you cannot be picked for a match, and your place on the team is free for someone else until you are back.')) return;
		write('Saving', () => supabaseClient.rpc('tdc_set_team_player_active', {
			p_team_id: mine.my_team_id, p_player_id: myPlayerId, p_active: back
		}));
	});

	els.meConfirm.addEventListener('click', () =>
		write('Confirming', () => supabaseClient.rpc('tdc_confirm_league_entry', {
			p_league_season_id: seasonId
		})));

	// Taking your confirmation back, not leaving the league. It clears the
	// confirmation and nothing else — the place, the team, the captaincy and
	// the payment all stay, and payment was never a player's to change.
	// Leaving the league altogether is the director's to do.
	els.meWithdraw.addEventListener('click', () => {
		if (!confirm('Say you are not playing?\n\nYour place and your team stay as they are — you just have not confirmed. You can confirm again whenever you like.')) return;
		write('Saving', () => supabaseClient.rpc('tdc_unconfirm_league_entry', {
			p_league_season_id: seasonId
		}));
	});

	// ─── Readiness ───
	// The function answers only the people running the league and its
	// captains; for them, how many have confirmed is one of the league's
	// numbers (UV, 24 Oct: the banner replaces "Ready to begin?").
	async function loadReadiness() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_readiness', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		readiness = (data || [])[0] || null;
		return true;
	}

	// ─── The season's own row, and its fixtures ───
	// Status, reserves and how players get in are on the season, which anyone
	// signed in may read; the rest of the banner is in the season info.
	async function loadSeasonRow() {
		const { data, error } = await supabaseClient
			.from('tbl_league_seasons').select('status, max_reserves, entry_mode, tbl_leagues(picture_path)').eq('id', seasonId).maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		seasonRow = data;
		return true;
	}

	async function loadFixtures() {
		const { data, error } = await supabaseClient.rpc('tdc_league_fixtures', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		fixtures = data || [];
		return true;
	}

	// ─── The banner ───
	// Everything about how the league is played, neatly: label and value
	// pairs under the name, wrapping into columns on a PC.
	const ENTRY = {
		ld_only: 'Added by whoever runs it',
		interested: 'Put your name down',
		self_confirm: 'Join straight away'
	};

	function renderBanner() {
		if (!info) return;
		const rules = info.rules || {};
		const status = seasonRow && seasonRow.status;
		els.jumbo.className = 'jumbo' + (status ? ' league-status-' + status : '');
		els.jumboStatus.hidden = !status;
		els.jumboStatus.textContent = status ? (D.LEAGUE_STATUS[status] || status) : '';

		// The league's own picture, or the trophy it had until it had one.
		const picture = TDC.pictureUrl('league-pictures', seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path);
		if (picture) {
			const img = document.createElement('img');
			img.src = picture;
			img.alt = '';
			els.jumboPic.replaceChildren(img);
		} else {
			els.jumboPic.replaceChildren(svgIcon(TROPHY, true));
		}

		const facts = [];
		facts.push(['Game', D.DISCIPLINE[rules.discipline] || rules.discipline || 'Not set']);
		if (rules.team_size) {
			const reserves = seasonRow && seasonRow.max_reserves;
			facts.push(['Teams', rules.team_size + ' a side'
				+ (reserves ? ', up to ' + plural(reserves, 'reserve') : '')]);
			facts.push(['A night', rules.team_size + ' sessions, ' + rules.team_size * rules.team_size + ' frames']);
		}
		if (rules.win_condition_type && rules.win_condition_type !== 'free_play') {
			facts.push(['Each match', (D.WIN_CONDITION[rules.win_condition_type] || rules.win_condition_type)
				+ (rules.win_condition_target ? ' ' + rules.win_condition_target : '')]);
		}
		const when = [info.starts_on ? day(info.starts_on) : null, info.ends_on ? day(info.ends_on) : null].filter(Boolean);
		facts.push(['Dates', when.length ? when.join(' to ') : 'Not set yet']);
		const next = nextNight();
		if (next) {
			facts.push(['Next night', next.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
				+ ' · ' + next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })]);
		}
		if (seasonRow && seasonRow.entry_mode) facts.push(['Entries', ENTRY[seasonRow.entry_mode] || seasonRow.entry_mode]);
		if (rules.lineup_cutoff_hours) facts.push(['Lineups', plural(rules.lineup_cutoff_hours, 'hour') + ' before a match']);

		els.jumboFacts.replaceChildren(...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));

		// The venue, linked to its page (still to be built: /venues/ says so).
		const row = node('div', 'jumbo-fact');
		row.append(node('dt', null, 'Venue'));
		const dd = node('dd');
		if (info.venue_id) {
			const a = node('a', null, info.venue_name || 'The venue');
			a.href = '/venues/?v=' + encodeURIComponent(info.venue_id);
			dd.append(a);
		} else {
			dd.textContent = 'Not tied to a venue';
		}
		row.append(dd);
		els.jumboFacts.append(row);
	}

	// The first night from now that has a fixture.
	function nextNight() {
		const now = Date.now();
		const times = fixtures.map((f) => f.scheduled_at && new Date(f.scheduled_at)).filter((d) => d && d.getTime() >= now);
		times.sort((a, b) => a - b);
		return times[0] || null;
	}

	// ─── The league so far ───
	// Counted from the fixtures and the teams, never stored.
	function renderStats() {
		const games = fixtures.filter((f) => !f.is_bye);
		// A re-opened night (signed, then changed; 29 Oct) was still played.
		const played = games.filter((f) => f.match_status === 'complete' || f.match_status === 'reopened').length;
		const live = games.filter((f) => f.match_status === 'in_progress').length;
		const frames = games.reduce((n, f) => n + (f.home_frames || 0) + (f.away_frames || 0), 0);
		const nights = new Set(fixtures.filter((f) => f.scheduled_at).map((f) => new Date(f.scheduled_at).toDateString())).size;
		const players = teams.reduce((n, t) => n + (t.active_players || 0), 0);

		const tiles = [
			['Teams', teams.length],
			['Players', players],
			['Matches scheduled', games.length],
			['Matches played', played],
			['Playing now', live],
			['Frames played', frames],
			['Nights', nights]
		];
		if (readiness && readiness.active_players) {
			tiles.push(['Confirmed', readiness.confirmed + ' of ' + readiness.active_players]);
		}
		els.stats.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'league-stat');
			tile.append(node('span', 'league-stat-value', String(value)), node('span', 'league-stat-label', label));
			return tile;
		}));
	}

	// ─── Waiting for a team ───
	async function loadPool() {
		// Only a captain can claim, so only a captain asks. The function would
		// also answer the director, but they have the manage page.
		if (!controlsTeam()) {
			pool = [];
			renderPool();
			return true;
		}
		const { data, error } = await supabaseClient.rpc('tdc_league_unplaced', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		pool = data || [];
		renderPool();
		return true;
	}

	function renderPool() {
		els.poolPanel.hidden = !controlsTeam();
		if (els.poolPanel.hidden) return;

		// Said before they try, not only after the database refuses.
		const t = myTeam();
		const full = isFull(t);
		els.poolHint.textContent = full
			? mine.my_team_name + ' is full: ' + t.active_players + ' of ' + t.team_limit
				+ ' active players. Mark somebody away to claim another.'
			: pool.length
				? 'These players are in the league and on no team. Claiming one puts them on ' + mine.my_team_name
					+ (t ? ' (' + t.active_players + ' of ' + t.team_limit + ' places taken).' : '.')
				: 'Nobody is waiting. A player appears here once they are in the league and on no team.';

		els.poolList.replaceChildren(...pool.map((p) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, p.display_name));

			const actions = node('div', 'list-row-actions');
			const claim = node('button', 'btn btn-primary btn-sm', 'Claim');
			claim.type = 'button';
			claim.dataset.player = p.player_id;
			claim.dataset.action = 'claim';
			claim.dataset.name = p.display_name;
			claim.disabled = full;
			actions.append(claim);

			row.append(main, actions);
			return row;
		}));
	}

	els.poolList.addEventListener('click', (e) => {
		const button = e.target.closest('[data-action="claim"]');
		if (!button) return;
		write('Claiming ' + button.dataset.name, () => supabaseClient.rpc('tdc_team_claim_player', {
			p_team_id: mine.my_team_id, p_player_id: button.dataset.player
		}));
	});

	// ─── Teams ───
	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];

		// My own team is open from the start; it is the one they came for.
		if (mine && mine.my_team_id) openTeams.add(mine.my_team_id);
		// A team that has gone (deleted while this page was open) is not open.
		for (const id of [...openTeams]) {
			if (!teams.some((t) => t.team_id === id)) openTeams.delete(id);
		}

		// Rosters are read for every open team, again, after every write.
		const fresh = new Map();
		for (const id of openTeams) {
			const { data: roster, error: rosterError } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: id });
			if (rosterError) { TDC.showSupabaseError(AREA, rosterError, els.status); return false; }
			fresh.set(id, roster || []);
		}
		rosters = fresh;
		renderTeams();
		return true;
	}

	function rosterRow(t, r) {
		const row = node('div', 'list-row');
		const main = node('div', 'list-row-main');

		const sub = [r.is_captain ? 'Captain' : 'Player'];
		if (r.status !== 'active') sub.push(r.status === 'withdrawn' ? 'Withdrawn' : 'Away');
		else if (!r.confirmed) sub.push('Has not confirmed');
		main.append(personLink(r.player_id, r.display_name, r.avatar_path, sub.join(' · ')));
		row.append(main);

		// Captain controls, on my own team only.
		if (controlsTeam() && t.team_id === mine.my_team_id) {
			const actions = node('div', 'list-row-actions');

			// Away frees a place; back takes one, so it waits for room.
			if (r.status === 'active' || r.status === 'inactive') {
				const back = r.status === 'inactive';
				const away = node('button', 'btn btn-secondary btn-sm', back ? 'Back' : 'Away');
				away.type = 'button';
				away.dataset.action = 'away';
				away.dataset.player = r.player_id;
				away.dataset.name = r.display_name;
				away.dataset.active = back ? '1' : '0';
				away.disabled = back && isFull(t);
				actions.append(away);
			}

			const cap = node('button', 'btn btn-secondary btn-sm', r.is_captain ? 'Not captain' : 'Make captain');
			cap.type = 'button';
			cap.dataset.action = 'captain';
			cap.dataset.player = r.player_id;
			cap.dataset.captain = r.is_captain ? '0' : '1';
			// Naming a captain needs someone active who has confirmed; the
			// database says so too, this only spares a pointless click.
			cap.disabled = !r.is_captain && (r.status !== 'active' || !r.confirmed);

			const rel = node('button', 'btn btn-danger btn-sm', 'Release');
			rel.type = 'button';
			rel.dataset.action = 'release';
			rel.dataset.player = r.player_id;
			rel.dataset.name = r.display_name;

			actions.append(cap, rel);
			row.append(actions);
		}
		return row;
	}

	function teamCard(t) {
		const box = document.createElement('details');
		box.className = 'team-box';
		box.id = 'team-' + t.team_id;
		box.dataset.team = t.team_id;
		box.open = openTeams.has(t.team_id);
		if (mine && mine.my_team_id === t.team_id) box.classList.add('is-mine');

		const head = document.createElement('summary');
		const pic = node('span', 'team-pic');
		pic.append(svgIcon(SHIELD, false));
		const names = node('span', 'team-box-names');
		names.append(node('span', 'team-box-name', t.name));
		// Active against the limit; away players are on the team but take no place.
		const away = t.players - t.active_players;
		const line = [t.active_players + ' of ' + t.team_limit + ' active'];
		if (away > 0) line.push(away + ' away');
		if (t.active_players > t.team_limit) line.push('over the limit');
		if ((t.captains || []).length) line.push('Captain ' + t.captains.join(', '));
		names.append(node('span', 'team-box-sub', line.join(' · ')));
		head.append(pic, names);
		if (mine && mine.my_team_id === t.team_id) head.append(node('span', 'badge live', 'Your team'));
		box.append(head);

		const roster = rosters.get(t.team_id);
		if (!roster) {
			box.append(node('p', 'muted', 'Open to see the players.'));
		} else {
			if (controlsTeam() && t.team_id === mine.my_team_id) {
				const field = node('div', 'field');
				const label = node('label', null, 'Team name');
				label.htmlFor = 'rename-input';
				const input = document.createElement('input');
				input.type = 'text';
				input.id = 'rename-input';
				input.maxLength = 120;
				input.value = t.name;
				const save = node('button', 'btn btn-secondary btn-sm', 'Rename');
				save.type = 'button';
				save.dataset.action = 'rename';
				field.append(label, input, save);
				box.append(field);
			}

			if (!roster.length) box.append(node('p', 'muted', 'Nobody is on this team yet.'));
			else box.append(...roster.map((r) => rosterRow(t, r)));
		}

		box.addEventListener('toggle', async () => {
			if (box.open) {
				openTeams.add(t.team_id);
				// First time opened: fetch the players, then draw.
				if (!rosters.has(t.team_id)) {
					const { data, error } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: t.team_id });
					if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
					rosters.set(t.team_id, data || []);
					renderTeams();
				}
			} else {
				openTeams.delete(t.team_id);
			}
		});
		return box;
	}

	function renderTeams() {
		els.teamCount.hidden = !teams.length;
		els.teamCount.textContent = String(teams.length);
		els.teamEmpty.hidden = !!teams.length;
		els.teamList.replaceChildren(...teams.map(teamCard));

		// The team named in the address, once: into view, open.
		if (focusTeam) {
			const box = document.getElementById('team-' + focusTeam);
			focusTeam = null;
			if (box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	els.teamList.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-action]');
		if (!button || !mine || !mine.my_team_id) return;
		const teamId = mine.my_team_id;

		if (button.dataset.action === 'captain') {
			write('Saving', () => supabaseClient.rpc('tdc_team_set_captain', {
				p_team_id: teamId,
				p_player_id: button.dataset.player,
				p_is_captain: button.dataset.captain === '1'
			}));
		} else if (button.dataset.action === 'away') {
			const back = button.dataset.active === '1';
			if (!back && !confirm(`Mark ${button.dataset.name} away?\n\nThey stay on your team but cannot be picked for a match, and their place is free until they are back.`)) return;
			write('Saving', () => supabaseClient.rpc('tdc_set_team_player_active', {
				p_team_id: teamId, p_player_id: button.dataset.player, p_active: back
			}));
		} else if (button.dataset.action === 'release') {
			if (!confirm(`Take ${button.dataset.name} off your team?\n\nThey go back to waiting for a team, and any captain can claim them.`)) return;
			write('Releasing', () => supabaseClient.rpc('tdc_team_release_player', {
				p_team_id: teamId, p_player_id: button.dataset.player
			}));
		} else if (button.dataset.action === 'rename') {
			const input = els.teamList.querySelector('#rename-input');
			const name = (input.value || '').trim();
			if (name.length < 2) { TDC.status(els.status, 'A team needs a name.', ''); return; }
			write('Saving', () => supabaseClient.rpc('tdc_update_team', { p_team_id: teamId, p_name: name }));
		}
	});

	// ─── Who runs it ───
	async function loadOfficials() {
		const { data, error } = await supabaseClient.rpc('tdc_league_officials', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		officials = data || [];

		els.officialList.replaceChildren(...officials.map((o) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(personLink(o.player_id, o.display_name, o.avatar_path, o.role_name));
			row.append(main);
			return row;
		}));
		if (!officials.length) els.officialList.replaceChildren(node('p', 'muted', 'Nobody is listed.'));
		return true;
	}

	// ─── Reading everything ───
	// My row first: what the rest shows depends on whether I captain a team.
	async function loadAll() {
		const results = [];
		results.push(await loadMine());
		results.push(await loadSeasonRow());
		results.push(await loadFixtures());
		results.push(await loadTeams());
		results.push(await loadPool());
		results.push(await loadReadiness());
		results.push(await loadOfficials());
		loadMyNext();
		renderBanner();
		renderStats();
		return results.every(Boolean);
	}

	// ─── Writing ───
	// Queued, never refused (TDC.writer). Read again once a burst has saved;
	// a failed save puts the screen back to what the server holds, then says
	// why.
	const { write } = TDC.writer({
		area: AREA, status: els.status, reload: loadAll, after: () => TDC.flushPushes()
	});

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}


		const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;
		myPlayerId = me.id;

		if (!await loadInfo()) return;
		await loadAll();
	})(), 'League season');

	// Shown again as a tab (league-nav.js): read again in place.
	return { refresh: () => loadAll() };
});
