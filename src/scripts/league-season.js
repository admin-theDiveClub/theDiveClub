// A league season, as a player sees it (/leagues/season/?s=<league season id>),
// in the league or not: the one page for a league, and the one a director
// shares. The join page was folded into it (UV, 9-10 Nov).
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
//   • Asked to join (UV, 5 Nov), if you captain a team: players who asked,
//     with the ring on its card, to join it. Take is the same claim as below;
//     Decline.
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
		meRow: el('me-row'), meTeam: el('me-team'), meCaptain: el('me-captain'),
		meSeason: el('me-season'), meStats: el('me-stats'), meTeamBox: el('me-team-box'), meTeamName: el('me-team-name'),
		meTeamPlace: el('me-team-place'), meResults: el('me-results'), meResultsEmpty: el('me-results-empty'),
		views: el('ls-views'), teamsView: el('ls-teams'), playersView: el('ls-players'),
		poolPlaces: el('pool-places'),
		jumbo: el('jumbo'), jumboPic: el('jumbo-pic'), jumboFacts: el('jumbo-facts'),
		share: el('share-btn'), interestBtn: el('interest-btn'),
		stats: el('stats'), notesBox: el('notes-box'), notes: el('l-notes'),
		nights: el('l-nights'), nightCount: el('night-count'), nightKey: el('night-key'), nightPicked: el('night-picked'), nightNote: el('night-note'),
		teamsHead: el('teams-head'), teamsHeadCount: el('teams-head-count'),
		poolPanel: el('pool-panel'), poolHint: el('pool-hint'), poolList: el('pool-list'),
		askPanel: el('ask-panel'), askCount: el('ask-count'), askHint: el('ask-hint'), askList: el('ask-list'),
		teamCount: el('team-count'), teamList: el('team-list'), teamEmpty: el('team-empty'), teamsHint: el('teams-hint'),
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
	let joinInfo = null;        // tdc_league_join_info: where I stand, for anybody signed in
	let myPlayerId = null;      // tdc_my_leagues does not carry it; marking myself away needs it
	let teams = [];
	let rosters = new Map();    // team id -> roster rows
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
	let seasonSoFar = null;     // { data: tdc_league_standings, columns: the season's own }
	let signedOut = false;      // not signed in: one read fills all of the above (loadPublic)
	let showsPlayers = true;    // the league's names and faces switch, for somebody signed out
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
	// (still to be built: /players/ says so). Glows like a row. A signed-out
	// visitor is given no ids: the same row, not a link (UV, 10 Nov).
	function personLink(playerId, name, path, sub) {
		const a = node(playerId ? 'a' : 'span', 'person');
		if (playerId) a.href = '/players/?p=' + encodeURIComponent(playerId);
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name));
		if (sub) names.append(node('span', 'person-sub', sub));
		a.append(avatar(path, name), names);
		return a;
	}

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
		els.jumboPic.replaceChildren(TDC.leaguePic(null));

		return true;
	}

	// ─── Somebody not signed in ───
	// tdc_public_league_season carries what this tab draws (UV, 10 Nov), put
	// into the same state the reads below fill, so every drawing function is
	// the one a member gets. It answers nothing for a league not Visible to
	// public or no such season: the visitor signs in and comes back here.
	async function loadPublic() {
		const { data, error } = await supabaseClient.rpc('tdc_public_league_season', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) { await TDC.requireSession(AREA); return false; }

		info = data;
		els.name.textContent = info.league_name;
		els.meta.textContent = info.name;
		seasonRow = {
			status: data.status, max_reserves: data.max_reserves, entry_mode: data.entry_mode,
			tbl_leagues: { picture_path: data.picture_path }
		};
		joinInfo = { entry_mode: data.entry_mode, players: data.players, interested: data.interested };
		// One count of a night's frames: nobody's score, as the tab only adds them up.
		fixtures = data.fixtures.map((f) => Object.assign({ home_frames: f.frames, away_frames: 0 }, f));
		teams = data.teams;
		rosters = new Map(teams.map((t) => [t.team_id, (t.roster || []).map((r) => Object.assign({ status: 'active' }, r))]));
		teamPictures = new Map(teams.map((t) => [t.team_id, t.picture_path]));
		officials = data.officials;
		showsPlayers = data.shows_players;
		renderTeams();
		return true;
	}

	// ─── Your place ───
	async function loadMine() {
		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 200 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		mine = (data || []).find((l) => l.league_season_id === seasonId) || null;
		return true;
	}

	// Where I stand and how somebody gets in: it answers
	// any signed-in player, in the league or not, and decides the plus.
	async function loadJoinInfo() {
		const { data, error } = await supabaseClient.rpc('tdc_league_join_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		joinInfo = (data || [])[0] || null;
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
		els.meConfirm.hidden = true;
		els.meWithdraw.hidden = true;
		els.meAway.hidden = true;
		if (!plays) return;

		// The compact row, once they are on a team.
		els.meRow.hidden = !mine.my_team_id;
		if (mine.my_team_id) {
			els.mePic.replaceChildren(TDC.teamPic(teamPictures.get(mine.my_team_id)));
			els.meTeam.textContent = mine.my_team_name;
			els.meCaptain.hidden = !controlsTeam();
		}

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
			// The row says it all.
			els.meLine.textContent = '';
			els.meDetail.textContent = '';
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

	// ─── My season so far ───
	// The Standings tab's reads and its ranking (TDCStandings) with Live off,
	// so the two can never disagree: signed nights only. A re-opened night is
	// still a complete match, and Standings counts it, so it is a result here.
	async function loadMySeason() {
		seasonSoFar = null;
		if (mine && mine.my_status) {
			const [st, cols] = await Promise.all([
				supabaseClient.rpc('tdc_league_standings', { p_league_season_id: seasonId }),
				supabaseClient.from('tbl_league_standing_columns')
					.select('id, scope, position, name, equation, decimals, rank_priority, higher_first')
					.eq('league_season_id', seasonId).order('position')
			]);
			for (const r of [st, cols]) {
				if (r.error) { TDC.showSupabaseError(AREA, r.error, els.status); renderMySeason(); return false; }
			}
			if (!st.data || !Array.isArray(st.data.players) || !Array.isArray(st.data.teams)) {
				TDC.error(AREA, 'the standings came back in a shape this page does not know.', st.data, els.status);
				renderMySeason();
				return false;
			}
			seasonSoFar = { data: st.data, columns: cols.data || [] };
		}
		renderMySeason();
		return true;
	}

	function ordinal(n) {
		const teen = n % 100 >= 11 && n % 100 <= 13;
		return n + (teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
	}

	function renderMySeason() {
		const data = seasonSoFar && seasonSoFar.data;
		const colsFor = (scope) => seasonSoFar.columns.filter((c) => c.scope === scope);
		const me = data && TDCStandings.rank(data.players.map((p) => Object.assign({ name: p.display_name }, p)), colsFor('player'))
			.find((p) => p.player_id === myPlayerId);
		const s = (me && me.stats) || {};
		const played = s.frames_played || 0;
		// Name down, or gone without playing: no season to speak of yet.
		const has = me && (played > 0 || mine.my_status === 'active' || mine.my_status === 'inactive');
		els.meSeason.hidden = !has;
		if (!has) return;
		els.meStats.replaceChildren(...[
			[me.rank === null ? '–' : ordinal(me.rank), 'of ' + plural(data.players.length, 'player')],
			[played, 'Frames played'],
			[s.frames_won || 0, 'Frames won'],
			[s.frames_lost || 0, 'Frames lost'],
			[played ? Math.round((s.frames_won || 0) / played * 100) + '%' : '–', 'Win %'],
			[s.lags_won || 0, 'Lags won']
		].map(([value, label]) => {
			const tile = node('div', 'lj-num');
			const shown = node('span', 'lj-num-value', String(value));
			if (String(value).length > 4) shown.classList.add('lj-num-long');
			tile.append(shown, node('span', 'lj-num-label', label));
			return tile;
		}));

		els.meTeamBox.hidden = !mine.my_team_id;
		if (!mine.my_team_id) return;
		els.meTeamName.textContent = mine.my_team_name;
		const team = TDCStandings.rank(data.teams.map((t) => Object.assign({}, t)), colsFor('team'))
			.find((t) => t.team_id === mine.my_team_id);
		els.meTeamPlace.hidden = !team || team.rank === null;
		if (team && team.rank !== null) els.meTeamPlace.textContent = ordinal(team.rank) + ' of ' + data.teams.length;

		const at = (f) => (f.scheduled_at ? new Date(f.scheduled_at).getTime() : 0);
		const results = fixtures
			.filter((f) => !f.is_bye && f.match_id && (f.match_status === 'complete' || f.match_status === 'reopened')
				&& (f.home_team_id === mine.my_team_id || f.away_team_id === mine.my_team_id))
			.sort((a, b) => at(b) - at(a) || b.round - a.round || b.position - a.position);
		els.meResultsEmpty.hidden = results.length > 0;
		els.meResults.replaceChildren(...results.map((f) => {
			const home = f.home_team_id === mine.my_team_id;
			const us = (home ? f.home_frames : f.away_frames) || 0;
			const them = (home ? f.away_frames : f.home_frames) || 0;
			const row = node('a', 'ls-wait ms-result');
			row.href = '/leagues/card/?m=' + encodeURIComponent(f.match_id);
			row.append(
				node('span', 'ms-result-when', f.scheduled_at ? new Date(f.scheduled_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''),
				node('span', 'ms-result-who', 'v ' + (home ? f.away_name : f.home_name)),
				node('span', 'ms-result-score', us + '–' + them),
				node('span', us > them ? 'badge live' : 'badge', us > them ? 'Won' : us < them ? 'Lost' : 'Drawn'));
			return row;
		}));
	}

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
	// The name with Share and the way in at its corner, then the badges and
	// the details under the status strip (UV, 9 Nov: the join page's). The
	// rest of how it is played is under Rules.
	function renderBanner() {
		if (!info) return;
		const rules = info.rules || {};
		const status = seasonRow && seasonRow.status;
		els.jumbo.className = 'jumbo lj-hero' + (status ? ' league-status-' + status : '');

		// The league's own picture, or the trophy it had until it had one.
		els.jumboPic.replaceChildren(TDC.leaguePic(seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path));

		const facts = [];
		facts.push(['Game', D.DISCIPLINE[rules.discipline] || rules.discipline || 'Not set']);
		const when = [info.starts_on ? day(info.starts_on) : null, info.ends_on ? day(info.ends_on) : null].filter(Boolean);
		facts.push(['Dates', when.length ? when.join(' to ') : 'Not set yet']);
		const next = nextNight();
		facts.push(['Next night', next
			? next.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
				+ ' · ' + next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
			: 'Not scheduled yet']);

		els.jumboFacts.replaceChildren(badges(), ...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));

		const venues = TDC.venueFact(info.venues);
		if (venues) els.jumboFacts.append(venues);

		// Who runs it: each one's picture, with their name over their role (UV, 10 Nov).
		const people = node('div', 'jumbo-fact lj-people');
		const list = node('dd');
		if (officials.length) list.append(...officials.map((o) => personLink(o.player_id, o.display_name, o.avatar_path, o.role_name)));
		else list.textContent = 'Nobody is listed.';
		people.append(node('dt', null, 'Who runs it'), list);
		els.jumboFacts.append(people);
		renderCorner();
	}

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
		if (joinInfo) {
			if (joinInfo.my_status === 'active') {
				list.append(node('span', 'badge team-name', 'You are in this league'));
				if (!joinInfo.i_confirmed) list.append(node('span', 'badge needs-you', 'Confirm your place'));
			} else if (joinInfo.my_status) {
				list.append(node('span', 'badge pending', STANDING[joinInfo.my_status] || joinInfo.my_status));
			} else if (joinInfo.entry_mode === 'ld_only') {
				list.append(node('span', 'badge', 'Added by whoever runs it'));
			} else if (joinInfo.entry_mode === 'self_confirm') {
				list.append(node('span', 'badge needs-you', 'Join straight away'));
			} else {
				list.append(node('span', 'badge', 'Taking names'));
			}
		}
		const row = node('div', 'jumbo-fact lj-badges');
		row.append(node('dt', 'lj-sr', 'Status'), list);
		return row;
	}

	// The banner's corner: Share is always there, and the plus for somebody
	// who may put their name down (tdc_league_show_interest decides what that
	// does, as the season was set up).
	function renderCorner() {
		els.interestBtn.hidden = true;
		if (!joinInfo) return;
		const again = joinInfo.my_status === 'withdrawn';
		if (!again && (joinInfo.my_status || joinInfo.entry_mode === 'ld_only')) return;

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

	els.interestBtn.addEventListener('click', () => {
		// Signed out: to sign-in and back here, where they tap it themselves (UV, 10 Nov).
		if (signedOut) { TDC.requireSession(AREA); return; }
		write('Putting your name down', () => supabaseClient.rpc('tdc_league_show_interest', {
			p_league_season_id: seasonId
		}), (data) => data === 'active' ? 'You are in.' : 'Your name is down.', { single: true, dots: els.interestBtn, leaves: true });
	});

	// The first night from now that has a fixture.
	function nextNight() {
		const now = Date.now();
		const times = fixtures.map((f) => f.scheduled_at && new Date(f.scheduled_at)).filter((d) => d && d.getTime() >= now);
		times.sort((a, b) => a - b);
		return times[0] || null;
	}

	// ─── The league so far ───
	// Counted from the fixtures and the teams, never stored; the join page's
	// seven, with Confirmed for those who could see it already (UV, 9 Nov).
	let statsDrawn = false;
	function renderStats() {
		const games = fixtures.filter((f) => !f.is_bye);
		// A re-opened night (signed, then changed; 29 Oct) was still played.
		const played = games.filter((f) => f.match_status === 'complete' || f.match_status === 'reopened').length;
		const frames = games.reduce((n, f) => n + (f.home_frames || 0) + (f.away_frames || 0), 0);
		const nights = new Set(fixtures.filter((f) => f.scheduled_at).map((f) => new Date(f.scheduled_at).toDateString())).size;

		const tiles = [
			['Teams', teams.length],
			['Players', (joinInfo && joinInfo.players) || 0],
			['Names down', (joinInfo && joinInfo.interested) || 0],
			['Nights', nights],
			['Matches', games.length],
			['Played', played],
			['Frames', frames]
		];
		if (readiness && readiness.active_players) {
			tiles.push(['Confirmed', readiness.confirmed + '/' + readiness.active_players]);
		}
		// A number a re-read changed (the tab shown again, a save) fades out
		// and in (TDC.liveFade, UV 29 Oct); the first draw fades nothing.
		const snap = statsDrawn ? TDC.liveSnapshot(els.stats) : null;
		els.stats.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'lj-num');
			const shown = node('span', 'lj-num-value', String(value));
			if (String(value).length > 4) shown.classList.add('lj-num-long');   // 12/20 keeps its tile the size of the rest
			shown.dataset.live = 'stat|' + label;
			tile.append(shown, node('span', 'lj-num-label', label));
			return tile;
		}));
		TDC.liveFade(els.stats, snap);
		statsDrawn = true;
	}

	function renderNotes() {
		const text = info && info.notes && info.notes.trim();
		els.notesBox.hidden = !text;
		els.notes.textContent = text || '';
	}

	const time = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

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
			['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((d) => {
				head.append(node('th', null, d));
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
	// Players who asked, with the ring on its card, to join my team. The function gives
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

		// Every team's roster, again after every write, so a card opens at once.
		const read = await Promise.all(teams.map((t) => supabaseClient.rpc('tdc_team_roster', { p_team_id: t.team_id })));
		const failed = read.find((r) => r.error);
		if (failed) { TDC.showSupabaseError(AREA, failed.error, els.status); return false; }
		rosters = new Map(teams.map((t, i) => [t.team_id, read[i].data || []]));
		renderTeams();
		return true;
	}

	function rosterRow(t, r) {
		const row = node('div', 'list-row');
		const main = node('div', 'list-row-main');

		// No confirmation here (UV, 29 Oct): who has confirmed is the
		// director's business, on the manage page. A badge for the captain
		// and no word for everybody else (UV, 10 Nov).
		const sub = r.status === 'active' ? '' : (r.status === 'withdrawn' ? 'Withdrawn' : 'Away');
		main.append(personLink(r.player_id, r.display_name, r.avatar_path, sub));
		if (r.is_captain) main.append(node('span', 'badge live', 'Captain'));
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

	// A team's name stays on one line so every card is the same size; one too
	// long runs sideways and back (UV, 10 Nov). Measured whenever its room
	// changes, which covers a tab first shown and a card opened or closed.
	function fitName(name) {
		if (!name.clientWidth) return;
		const over = name.firstChild.offsetWidth - name.clientWidth;
		name.classList.toggle('is-long', over > 1);
		name.style.setProperty('--run', -Math.max(over, 0) + 'px');
		name.style.setProperty('--run-time', (3 + Math.max(over, 0) / 25).toFixed(1) + 's');
	}
	const nameRoom = new ResizeObserver((seen) => seen.forEach((e) => fitName(e.target)));
	document.fonts.ready.then(() => els.teamList.querySelectorAll('.team-box-name').forEach(fitName));   // the display face changes the widths

	function teamCard(t) {
		const box = document.createElement('details');
		box.className = 'team-box';
		box.id = 'team-' + t.team_id;
		box.dataset.team = t.team_id;
		box.open = openTeams.has(t.team_id);
		if (mine && mine.my_team_id === t.team_id) box.classList.add('is-mine');
		if (asked.has(t.team_id)) box.classList.add('is-asked');

		// Closed, the team's picture and name and nothing else (UV, 10 Nov).
		// Open, the places taken and the ring to ask share the arrow's line
		// (the stylesheet hides them on a closed card), the players below.
		const head = document.createElement('summary');
		const top = node('span', 'lj-team-head');
		const pic = node('span', 'team-pic');
		pic.append(TDC.teamPic(teamPictures.get(t.team_id)));
		const name = node('span', 'team-box-name');
		name.append(node('span', 'lj-run', t.name));
		nameRoom.observe(name);
		top.append(pic, name);
		const line = node('span', 'lj-team-line');
		const places = node('span', 'lj-team-places');
		places.append(node('span', 'lj-team-places-n', String(t.active_players || 0)),
			node('span', 'lj-team-places-of', 'of ' + (t.team_limit || 0)));
		places.title = (t.active_players || 0) + ' of ' + (t.team_limit || 0) + ' places taken';
		line.append(places);
		// The ring to ask to join, for a player on no team (UV, 5 Nov).
		if (requestsRead && mayAsk()) line.append(TDCTeamAsk.ring(t, asked.has(t.team_id), AREA, els.status));
		line.append(node('span', 'lj-team-arrow'));
		head.append(top, line);
		box.append(head);

		const roster = rosters.get(t.team_id) || [];

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

		if (signedOut && !showsPlayers) {
			const ask = node('p', 'muted');
			const signIn = node('a', null, 'Sign in');
			signIn.href = '/accounts/?next=' + encodeURIComponent(location.pathname + location.search);
			ask.append(signIn, ' to see the players.');
			box.append(ask);
		} else if (!roster.length) box.append(node('p', 'muted', 'Nobody is on this team yet.'));
		else box.append(...roster.map((r) => rosterRow(t, r)));

		box.addEventListener('toggle', () => {
			if (box.open) openTeams.add(t.team_id);
			else openTeams.delete(t.team_id);
		});
		return box;
	}

	function renderTeams() {
		els.teamCount.hidden = !teams.length;
		els.teamCount.textContent = String(teams.length);
		els.teamsHeadCount.hidden = !teams.length;
		els.teamsHeadCount.textContent = String(teams.length);
		els.teamEmpty.hidden = !!teams.length;
		els.teamsHint.hidden = !(requestsRead && mayAsk()) || !teams.length;
		els.teamsHint.textContent = asked.size
			? 'The captain of a team you asked decides. Open it and tap its ring to take it back.'
			: 'You are on no team yet. Open a team and tap its ring to ask to join it; its captain decides.';
		nameRoom.disconnect();
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
		els.teamsHead.hidden = players;   // nothing to switch to: just the heading
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
		if (signedOut) {
			if (!await loadPublic()) return false;
		} else {
			results.push(await loadMine());
			results.push(await loadJoinInfo());
			results.push(await loadSeasonRow());
			results.push(await loadFixtures());
			results.push(await loadTeams());
		}
		renderMine();
		results.push(await loadPool());
		results.push(await loadRequests());
		renderViews();
		if (!signedOut) {
			results.push(await loadReadiness());
			results.push(await loadOfficials());
		}
		results.push(await loadMyNext());
		results.push(await loadMySeason());
		renderBanner();
		renderStats();
		renderNotes();
		renderNights();
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
		// getSession, not requireSession: somebody signed out may read this tab
		// when the league is Visible to public (UV, 10 Nov).
		const session = await TDC.getSession(AREA);
		signedOut = !session;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}

		const startShare = () => {
			wakeIcon(els.share);
			TDC.shareButton(els.share, 'season', seasonId, {
				area: AREA, status: els.status, title: () => els.name.textContent
			});
		};

		if (signedOut) {
			await loadAll();
			if (info) startShare();
			return;
		}

		const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!me) return;
		myPlayerId = me.id;

		if (!await loadInfo()) return;
		startShare();
		await loadAll();
	})(), 'League season');

	// Shown again as a tab (league-nav.js): read again in place.
	return { refresh: () => loadAll() };
});
