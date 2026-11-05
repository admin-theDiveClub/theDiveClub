// A league season, as a player sees it (/leagues/season/?s=<league season id>).
//
// At the top, the league (UV, 24 Oct): a banner with its picture, name,
// status and how it is played, read from the season info, the season's own
// row and its rules; then its numbers so far, counted from the fixtures and
// teams.
//
// Then two tabs (UV, 5 Nov): Teams, and Players (your place and, for a
// captain, who is waiting for a team); Who runs it below both. Three jobs:
//   • Your place. Somebody who has been added to a league has to confirm that
//     they are playing; nobody can do it for them and the league cannot begin
//     until every active player has. This is where they do it, and where they
//     can say they are not playing after all.
//   • The league. Teams with their rosters (each player's picture, name and
//     a link to their profile, still to be built), and who runs it.
//   • Asked to join (UV, 5 Nov), if you captain a team: players who asked on
//     the join page to join it. Take is the same claim as below; Decline.
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
		meConfirm: el('me-confirm'), meWithdraw: el('me-withdraw'), meAway: el('me-away'), mePic: el('me-pic'),
		views: el('ls-views'), teamsView: el('ls-teams'), playersView: el('ls-players'),
		poolPlaces: el('pool-places'),
		jumbo: el('jumbo'), jumboPic: el('jumbo-pic'), jumboStatus: el('jumbo-status'), jumboFacts: el('jumbo-facts'),
		stats: el('stats'),
		poolPanel: el('pool-panel'), poolHint: el('pool-hint'), poolList: el('pool-list'),
		askPanel: el('ask-panel'), askCount: el('ask-count'), askHint: el('ask-hint'), askList: el('ask-list'),
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
	let teamPictures = new Map(); // team id -> picture_path, or null
	const openTeams = new Set();
	let officials = [];
	let pool = [];
	let requests = [];          // players asking to join a team I captain (tdc_team_join_requests)
	let asked = new Set();      // the teams I have asked to join, when I am on none
	let requestsRead = false;   // the rings wait for the requests, so they never draw empty then ticked
	let fixtures = [];
	let seasonRow = null;       // status, reserves, entries: the season's own row
	let readiness = null;       // only for the people running it and its captains
	// A team named in the address (&team=, from the fixtures page) is opened
	// and brought into view once, on the first draw.
	let focusTeam = new URLSearchParams(location.search).get('team');
	if (focusTeam) openTeams.add(focusTeam);
	const cameForTeam = !!focusTeam;   // the Teams tab first, whatever else
	// The same from the Fixtures tab once this tab has started (29 Oct): the
	// team is opened and brought into view in place. Not drawn yet, the
	// address carries it to the first draw.
	document.addEventListener('tdc:league-team', (e) => {
		const box = e.detail && document.getElementById('team-' + e.detail);
		if (!box) return;
		focusTeam = null;
		showView('teams', true);
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
	// list: a trophy. A team's is TDC.teamPic.
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
			path.style.strokeWidth = 'var(--icon-line)';   // as a ring's line, at any size (UV, 5 Nov)
			path.setAttribute('vector-effect', 'non-scaling-stroke');
			path.setAttribute('stroke-linejoin', 'round');
		}
		svg.append(path);
		return svg;
	}
	const TROPHY = 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';

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
		return true;
	}

	// The next match this person's team is in, so a captain lands on the card
	// rather than hunting through the fixture list for it.
	//
	// For a captain (UV, 5 Nov): the earliest match that has been opened (a
	// match made on the fixture, not finished or abandoned) where our side's
	// lineup is not locked yet, "Set my lineup"; with none, "Go to last
	// result", the latest finished one; with neither, no button. Locks are in
	// tbl_league_match_sides, which any signed-in player may read. Under the
	// words, which match it is (UV): the other team and the date, and the
	// score on a result.
	async function loadMyNext() {
		els.meCard.hidden = true;
		if (!mine || !mine.my_team_id) return true;

		const ours = fixtures.filter((f) =>
			f.match_id && (f.home_team_id === mine.my_team_id || f.away_team_id === mine.my_team_id));
		if (!ours.length) return true;

		const at = (f) => (f.scheduled_at ? new Date(f.scheduled_at).getTime() : Infinity);
		const inOrder = [...ours].sort((a, b) => at(a) - at(b) || a.round - b.round || a.position - b.position);
		const finished = (f) => f.match_status === 'complete' || f.match_status === 'reopened';
		const opened = (f) => f.match_status === 'scheduled' || f.match_status === 'in_progress';
		const side = (f) => (f.home_team_id === mine.my_team_id ? 'home' : 'away');

		if (!mine.i_captain) {
			// A player: the first one not yet finished, or the most recent if
			// they all are (as before).
			showMyCard(ours.find((f) => !finished(f)) || ours[ours.length - 1], 'My next match', false);
			return true;
		}

		const open = inOrder.filter(opened);
		let locked = new Set();
		if (open.length) {
			const { data, error } = await supabaseClient.from('tbl_league_match_sides')
				.select('match_id, side').in('match_id', open.map((f) => f.match_id)).not('locked_at', 'is', null);
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			locked = new Set((data || []).map((r) => r.match_id + '|' + r.side));
		}
		const next = open.find((f) => !locked.has(f.match_id + '|' + side(f)));
		if (next) { showMyCard(next, 'Set my lineup', false); return true; }

		const last = inOrder.filter(finished).pop();
		if (last) showMyCard(last, 'Go to last result', true);
		return true;
	}

	function showMyCard(f, label, score) {
		const home = f.home_team_id === mine.my_team_id;
		const bits = ['v ' + (home ? f.away_name : f.home_name)];
		if (f.scheduled_at) bits.push(new Date(f.scheduled_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }));
		if (score) {
			const us = (home ? f.home_frames : f.away_frames) || 0;
			const them = (home ? f.away_frames : f.home_frames) || 0;
			bits.push(us + '–' + them);
		}
		els.meCard.href = '/leagues/card/?m=' + encodeURIComponent(f.match_id);
		els.meCard.replaceChildren(node('span', 'ls-btn-main', label), node('span', 'ls-btn-sub', bits.join(' · ')));
		els.meCard.classList.add('ls-btn-two');
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

		// The stage's green line, greyed for someone not playing just now
		// (withdrawn, inactive or away); their team's picture above the line
		// once they are on one.
		els.mePanel.dataset.tone = mine.my_status === 'withdrawn' || mine.my_status === 'inactive' ? 'off' : '';
		els.mePic.hidden = !mine.my_team_id;
		if (mine.my_team_id) els.mePic.replaceChildren(TDC.teamPic(teamPictures.get(mine.my_team_id)));

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
			els.meLine.textContent = 'You are playing for ' + mine.my_team_name + '.';
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
	let statsDrawn = false;
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
		// A number a re-read changed (the tab shown again, a save) fades out
		// and in (TDC.liveFade, UV 29 Oct); the first draw fades nothing.
		const snap = statsDrawn ? TDC.liveSnapshot(els.stats) : null;
		els.stats.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'league-stat');
			const shown = node('span', 'league-stat-value', String(value));
			shown.dataset.live = 'stat|' + label;
			tile.append(shown, node('span', 'league-stat-label', label));
			return tile;
		}));
		TDC.liveFade(els.stats, snap);
		statsDrawn = true;
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

		// Said before they try, not only after the database refuses. The
		// places taken as a badge by the heading, yellow once full.
		const t = myTeam();
		const full = isFull(t);
		els.poolPlaces.hidden = !t;
		if (t) {
			els.poolPlaces.textContent = t.active_players + ' of ' + t.team_limit + ' places';
			els.poolPlaces.className = 'badge ls-places ' + (full ? 'warn' : 'live');
		}
		els.poolHint.classList.toggle('is-full', full);
		els.poolHint.textContent = full
			? mine.my_team_name + ' is full. Mark somebody away to claim another.'
			: pool.length
				? 'In the league and on no team. Claiming one puts them on ' + mine.my_team_name + '.'
				: 'Nobody is waiting. A player appears here once they are in the league and on no team.';

		// A card each, set into the page: their picture (or initials) and name,
		// linked to their profile, and Claim.
		els.poolList.replaceChildren(...pool.map((p) => {
			const card = node('div', 'ls-wait');
			const claim = node('button', 'ls-btn ls-btn-go ls-btn-sm', 'Claim');
			claim.type = 'button';
			claim.dataset.player = p.player_id;
			claim.dataset.action = 'claim';
			claim.dataset.name = p.display_name;
			claim.disabled = full;
			card.append(personLink(p.player_id, p.display_name, p.avatar_path), claim);
			return card;
		}));
	}

	els.poolList.addEventListener('click', (e) => {
		const button = e.target.closest('[data-action="claim"]');
		if (!button) return;
		write('Claiming ' + button.dataset.name, () => supabaseClient.rpc('tdc_team_claim_player', {
			p_team_id: mine.my_team_id, p_player_id: button.dataset.player
		}));
	});

	// ─── Asked to join (UV, 5 Nov) ───
	// Players who asked on the join page to join my team. The function gives
	// a captain only their own team's (the director every team's, but they
	// have Run it). Take is the claim above; Decline turns them down.
	// The same read gives a player on no team their own requests, for the
	// rings on the Teams tab (UV, 5 Nov).
	async function loadRequests() {
		if (!controlsTeam() && !mayAsk()) {
			requests = [];
			asked = new Set();
			requestsRead = true;
			renderRequests();
			return true;
		}
		const { data, error } = await supabaseClient.rpc('tdc_team_join_requests', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		requests = controlsTeam() ? (data || []).filter((r) => r.team_id === mine.my_team_id) : [];
		asked = new Set((data || []).filter((r) => r.is_mine).map((r) => r.team_id));
		renderRequests();
		// The teams are drawn before the requests are in (loadAll): draw them
		// again with their rings as the requests now stand.
		requestsRead = true;
		if (mayAsk()) renderTeams();
		return true;
	}

	// Whether I may ask to join a team: in the league, active, on no team.
	// The database says the same (tdc_request_team).
	const mayAsk = () => !!(mine && mine.my_status === 'active' && !mine.my_team_id);

	// How long ago, in words a card can hold.
	function ago(ts) {
		const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
		if (mins < 1) return 'just now';
		if (mins < 60) return mins + ' min ago';
		const hours = Math.round(mins / 60);
		if (hours < 24) return plural(hours, 'hour') + ' ago';
		return plural(Math.round(hours / 24), 'day') + ' ago';
	}

	function renderRequests() {
		els.askPanel.hidden = !controlsTeam() || !requests.length;
		if (els.askPanel.hidden) return;

		const full = isFull(myTeam());
		els.askCount.hidden = false;
		els.askCount.textContent = String(requests.length);
		els.askHint.classList.toggle('is-full', full);
		els.askHint.textContent = full
			? mine.my_team_name + ' is full. Mark somebody away to take another.'
			: 'They asked to join ' + mine.my_team_name + '. Taking one puts them on it.';

		els.askList.replaceChildren(...requests.map((r) => {
			const card = node('div', 'ls-wait ls-ask');
			const actions = node('div', 'ls-ask-actions');
			const take = node('button', 'ls-btn ls-btn-go ls-btn-sm', 'Take');
			take.type = 'button';
			take.dataset.action = 'take';
			take.dataset.player = r.player_id;
			take.dataset.name = r.display_name;
			take.disabled = full;
			const decline = node('button', 'ls-btn ls-btn-sm', 'Decline');
			decline.type = 'button';
			decline.dataset.action = 'decline';
			decline.dataset.player = r.player_id;
			decline.dataset.name = r.display_name;
			actions.append(take, decline);
			card.append(personLink(r.player_id, r.display_name, r.avatar_path, 'Asked ' + ago(r.created_at)), actions);
			return card;
		}));
	}

	els.askList.addEventListener('click', (e) => {
		const button = e.target.closest('button[data-action]');
		if (!button || !mine || !mine.my_team_id) return;
		const name = button.dataset.name;
		if (button.dataset.action === 'take') {
			write('Taking ' + name, () => supabaseClient.rpc('tdc_team_claim_player', {
				p_team_id: mine.my_team_id, p_player_id: button.dataset.player
			}), () => name + ' is on ' + mine.my_team_name + '.');
		} else if (button.dataset.action === 'decline') {
			if (!confirm('Turn down ' + name + '?\n\nTheir request to join ' + mine.my_team_name + ' goes. They can ask again.')) return;
			write('Declining ' + name, () => supabaseClient.rpc('tdc_decline_team_request', {
				p_team_id: mine.my_team_id, p_player_id: button.dataset.player
			}), () => 'Request from ' + name + ' declined.');
		}
	});

	// ─── Teams ───
	async function loadTeams() {
		const { data, error } = await supabaseClient.rpc('tdc_league_season_teams', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		teams = data || [];

		// Each team's own picture (29 Oct), straight from tbl_teams, which every
		// signed-in user may read; the teams function does not carry it.
		const pics = await supabaseClient.from('tbl_teams').select('id, picture_path').eq('league_season_id', seasonId);
		if (pics.error) { TDC.showSupabaseError(AREA, pics.error, els.status); return false; }
		teamPictures = new Map((pics.data || []).map((p) => [p.id, p.picture_path]));

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

		// No confirmation here (UV, 29 Oct): who has confirmed is the
		// director's business, on the manage page.
		const sub = [r.is_captain ? 'Captain' : 'Player'];
		if (r.status !== 'active') sub.push(r.status === 'withdrawn' ? 'Withdrawn' : 'Away');
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
		pic.append(TDC.teamPic(teamPictures.get(t.team_id)));
		const names = node('span', 'team-box-names');
		names.append(node('span', 'team-box-name', t.name));
		// The captain and nothing else (UV, 29 Oct). The count against the
		// limit is on the manage page and in the claim list's hint.
		if ((t.captains || []).length) names.append(node('span', 'team-box-sub', 'Captain: ' + t.captains.join(', ')));
		head.append(pic, names);
		if (mine && mine.my_team_id === t.team_id) head.append(node('span', 'badge live', 'Your team'));
		// The ring to ask to join, for a player on no team (UV, 5 Nov).
		if (requestsRead && mayAsk()) head.append(TDCTeamAsk.ring(t, asked.has(t.team_id), AREA, els.status));
		box.append(head);

		// Not read yet: nothing in it; opening it reads, with the dots (below).
		const roster = rosters.get(t.team_id);
		if (roster) {
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

				// The team's picture (29 Oct), as the league's is on its
				// settings: saved at once, shown in the heading above.
				const picField = node('div', 'field');
				picField.append(node('label', null, 'Team picture'));
				const has = !!teamPictures.get(t.team_id);
				const choose = node('button', 'btn btn-secondary btn-sm', has ? 'Change the picture' : 'Choose a picture');
				choose.type = 'button';
				choose.dataset.action = 'pic-choose';
				const remove = node('button', 'btn btn-secondary btn-sm', 'Remove');
				remove.type = 'button';
				remove.dataset.action = 'pic-remove';
				remove.hidden = !has;
				const file = document.createElement('input');
				file.type = 'file';
				file.accept = 'image/*';
				file.id = 'team-pic-file';
				file.hidden = true;
				picField.append(choose, remove, file);
				box.append(picField);
			}

			if (!roster.length) box.append(node('p', 'muted', 'Nobody is on this team yet.'));
			else box.append(...roster.map((r) => rosterRow(t, r)));
		}

		box.addEventListener('toggle', async () => {
			if (box.open) {
				openTeams.add(t.team_id);
				// First time opened: fetch the players, then draw, the dots on
				// the team until they are in (UV, 29 Oct: every section that
				// loads shows the dots). The draw makes a new box: the dots
				// follow it by its id.
				// The dots sit at the right of the team's heading, in green.
				const spot = (b) => b && TDC.groupDots(b.querySelector(':scope > summary'));
				if (!rosters.has(t.team_id) && !spot(box).dataset.dots) {
					const read = (async () => {
						const { data, error } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: t.team_id });
						if (error) { TDC.showSupabaseError(AREA, error, els.status); throw error; }
						rosters.set(t.team_id, data || []);
						renderTeams();
					})();
					if (typeof TDCDots !== 'undefined') {
						TDCDots.serve(spot(box), read, { status: els.status, trace: 'none', follow: () => spot(document.getElementById('team-' + t.team_id)) });
					}
					read.catch(() => {});
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

	// Asking to join a team, or taking it back: the ring sits in the team's
	// heading, so its tap must not also open or close the team.
	els.teamList.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-ask]');
		if (!b) return;
		e.preventDefault();
		if (b.disabled) return;
		const teamId = b.dataset.ask;
		const name = b.dataset.name;
		const ring = () => els.teamList.querySelector('button[data-ask="' + teamId + '"]');
		if (b.dataset.asked === '1') {
			write('Taking back the request to ' + name, () => supabaseClient.rpc('tdc_cancel_team_request', {
				p_team_id: teamId
			}), () => 'Request to join ' + name + ' taken back.', { single: 'ask|' + teamId, dots: b, follow: ring });
		} else {
			write('Asking to join ' + name, () => supabaseClient.rpc('tdc_request_team', {
				p_team_id: teamId
			}), () => 'Asked to join ' + name + '. Its captain decides.', { single: 'ask|' + teamId, dots: b, follow: ring });
		}
	});

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
		} else if (button.dataset.action === 'pic-choose') {
			els.teamList.querySelector('#team-pic-file').click();
		} else if (button.dataset.action === 'pic-remove') {
			if (!confirm('Remove the team’s picture?\n\nIts pages show the shield again.')) return;
			write('Team picture', async () => {
				// Cleared on the team first: if the file delete fails, the picture
				// is already gone from every page.
				const { data: old, error } = await supabaseClient.rpc('tdc_set_team_picture', { p_team_id: teamId, p_path: null });
				if (error) return { error };
				if (old) {
					const { error: delErr } = await supabaseClient.storage.from(TEAM_PICTURES).remove([old]);
					if (delErr) console.error('[' + AREA + '] could not delete the picture file', delErr);
				}
				return {};
			}, () => 'Picture removed.');
		}
	});

	// ─── The team's picture ───
	// As the league's is (league-settings.js): prepared in the browser (square,
	// 512px, re-encoded, EXIF gone), uploaded under a new random name into the
	// team's folder of team-pictures, then named on the team through
	// tdc_set_team_picture, which hands back the old one to delete.
	const TEAM_PICTURES = 'team-pictures';
	els.teamList.addEventListener('change', (e) => {
		const input = e.target.closest('#team-pic-file');
		if (!input || !mine || !mine.my_team_id) return;
		const file = input.files && input.files[0];
		input.value = '';
		if (!file) return;
		const teamId = mine.my_team_id;
		const chooser = () => els.teamList.querySelector('[data-action="pic-choose"]');

		write('Team picture', async () => {
			const blob = await TDC.preparePicture(file, 512, AREA, els.status);
			if (!blob) return { error: { message: 'That picture could not be used. Try a JPEG or PNG.' } };

			// A new name every time, so no cached copy of the old picture is
			// served in its place.
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
			const { error: upErr } = await supabaseClient.storage
				.from(TEAM_PICTURES).upload(path, blob, { contentType: blob.type, upsert: false });
			if (upErr) return { error: upErr };

			const { data: old, error } = await supabaseClient.rpc('tdc_set_team_picture', { p_team_id: teamId, p_path: path });
			if (error) {
				// Not named on the team, so the file just uploaded is an orphan.
				await supabaseClient.storage.from(TEAM_PICTURES).remove([path]);
				return { error };
			}
			if (old) {
				const { error: delErr } = await supabaseClient.storage.from(TEAM_PICTURES).remove([old]);
				// The new picture is already the team's; the old file only takes up room.
				if (delErr) console.error('[' + AREA + '] could not delete the old picture', delErr);
			}
			return {};
		}, () => 'Picture saved.', { dots: chooser(), follow: chooser });
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

	// ─── Teams · Players ───
	// Two tabs under the numbers (UV, 5 Nov), the standings' pill. Players
	// holds your place and, for a captain, who is waiting for a team; with
	// neither (somebody who only runs it) there is no pill, only the teams.
	// The choice is kept per device. Somebody who still has to say they are
	// playing lands on Players, where the button is: the notification that
	// they were added sends them here for it.
	const VIEW_KEY = 'tdc.league-season.view';
	let view = 'teams';
	try { if (localStorage.getItem(VIEW_KEY) === 'players') view = 'players'; } catch (err) { /* private window: the default */ }
	let viewsDrawn = false;

	function fadeIn(box) {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--control-reveal')) || 0.35;
		box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: s * 1000, easing: 'ease-out' });
	}

	function showView(next, fade) {
		if (next === 'players' && els.views.hidden) next = 'teams';
		const changed = next !== view;
		view = next;
		for (const b of els.views.querySelectorAll('[data-ls-view]')) {
			b.setAttribute('aria-pressed', b.dataset.lsView === view ? 'true' : 'false');
		}
		els.teamsView.hidden = view !== 'teams';
		els.playersView.hidden = view !== 'players';
		if (fade && changed) fadeIn(view === 'teams' ? els.teamsView : els.playersView);
	}

	function renderViews() {
		const players = !els.mePanel.hidden || !els.poolPanel.hidden || !els.askPanel.hidden;
		els.views.hidden = !players;
		if (!viewsDrawn) {
			viewsDrawn = true;
			const mustConfirm = mine && mine.my_status === 'active' && !mine.confirmed_at;
			// A captain's "asked to join" notice links here with &view=players.
			const askedFor = new URLSearchParams(location.search).get('view') === 'players';
			if (cameForTeam) view = 'teams';
			else if (mustConfirm || askedFor) view = 'players';
		}
		showView(view, false);
	}

	els.views.addEventListener('click', (e) => {
		const b = e.target.closest('[data-ls-view]');
		if (!b || b.dataset.lsView === view) return;
		showView(b.dataset.lsView, true);
		try { localStorage.setItem(VIEW_KEY, view); } catch (err) { /* kept for this visit only */ }
	});

	// ─── Reading everything ───
	// My row first: what the rest shows depends on whether I captain a team.
	// The tabs are settled before the teams are drawn, so a team named in the
	// address is opened on the tab it is on.
	async function loadAll() {
		const results = [];
		results.push(await loadMine());
		results.push(await loadSeasonRow());
		results.push(await loadFixtures());
		results.push(await loadTeams());
		renderMine();
		results.push(await loadPool());
		results.push(await loadRequests());
		renderViews();
		results.push(await loadReadiness());
		results.push(await loadOfficials());
		results.push(await loadMyNext());
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
