// The captain's scorecard (/leagues/card/?m=<match id>).
//
// A full recording surface in its own right: a captain runs the whole night
// from this grid. It is not management around the match page — there is one
// frame set, and this page and /match/ both read and write it.
//
// Reads, one call each and all of them again after every write:
//   tdc_lineup_state   — my side, whether I run the league, the locks, the cutoff
//   tdc_match_lineup   — every position of both sides, the opponent's names
//                        withheld until both have locked. The blind exchange is
//                        enforced there, not here, so this page cannot leak it.
//   tdc_match_card    — every frame with its two players, its session and
//                        the two positions it seats
//   tdc_card_state     — the two signatures and whether each still matches
//   tdc_card_signatures — every signature, who and as what; from the first
//   tdc_frame_history  — every change since, by anybody (UV, 28 Oct)
// Read once, for the banner and the signatures: the league season's info, its
// reserves, the fixture's round and tables, and the two rosters (names,
// captains and pictures).
//
// A night is sessions (20261023221049). A captain names one player per
// position — five in a five-man league — and the database builds the night
// from the two orders and the LD's rotation table when the second side locks.
// A seat left empty stays open until a captain signs: a reserve or a
// latecomer can go into it, and whatever is still empty becomes a walkover at
// signing. Reserves go into one frame at a time; the three rules (one frame a
// session, regulars keep their position, no opponent twice) are the
// database's, and its refusals say which rule.
//
// The layout is UV's (24 Oct): a banner with both teams and the card's state;
// each session as rows of home player, an L and a W three-way switch (who won
// the lag, who won the frame: home, nobody, away), away player, with the
// session's totals; a tap on a player's name opens the reserve picker; then
// one section in the banner's style (UV, 29 Oct) holding the result, every
// player's frames, head to head (a table per team, UV 28 Oct) or by session,
// and the signatures. On a PC the sessions sit two to a row.
//
// Writes: tdc_submit_lineup (who is here, the order and the lock, in one call
// when Lock is pressed; UV, 12 Nov), tdc_swap_frame_player, tdc_record_frame,
// tdc_submit_card, tdc_answer_card.
//
// Needs: tdc.js, match-settings.js, league-nav.js.

(() => {
	const AREA = 'Team card';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('m-title'),
		jumbo: el('jumbo'), jumboStatus: el('jumbo-status'), stateDetail: el('state-detail'), facts: el('jumbo-facts'),
		jumboMore: el('jumbo-more'), moreBtn: el('jumbo-more-btn'), cardLine: el('card-line'), jumboV: el('jumbo-v'),
		homePic: el('home-pic'), homeName: el('home-name'), awayPic: el('away-pic'), awayName: el('away-name'),
		sideSwitch: el('side-switch'), sidePick: el('side-pick'),
		lineups: el('lineups'), compare: el('team-compare'), teamTables: el('team-tables'),
		squadHint: el('squad-hint'), lockRow: el('lock-row'), lockBtn: el('lock-btn'),
		// The managing team's table body: made once and moved into whichever
		// table is being set up, so its listener and steppers persist.
		quick: el('quick'), quickList: el('quick-list'),
		grid: el('grid'), sessions: el('session-list'), gridHint: el('grid-hint'),
		mine: el('mine'), mineFrames: el('mine-frames'), mineSessions: el('mine-sessions'),
		playerTable: el('player-table'),
		playerViews: el('player-views'), h2hView: el('h2h-view'), h2hTables: el('h2h-tables'), sessionView: el('session-view'),
		sumDetail: el('sum-detail'),
		sumHomePic: el('sum-home-pic'), sumHomeName: el('sum-home-name'), sumHomeScore: el('sum-home-score'),
		sumAwayPic: el('sum-away-pic'), sumAwayName: el('sum-away-name'), sumAwayScore: el('sum-away-score'),
		resHomePic: el('res-home-pic'), resHomeName: el('res-home-name'), resAwayPic: el('res-away-pic'), resAwayName: el('res-away-name'),
		signPanel: el('sign-panel'), sfLeague: el('sf-league'), sfDate: el('sf-date'),
		sfPic: el('sf-pic'), sfSeason: el('sf-season'), sfVenue: el('sf-venue'), sfRound: el('sf-round'),
		sfHomeSig: el('sf-home-sig'), sfHomeCap: el('sf-home-cap'),
		sfAwaySig: el('sf-away-sig'), sfAwayCap: el('sf-away-cap'),
		sfDispute: el('sf-dispute'),
		changedSince: el('changed-since'), changedCount: el('changed-count'), changedList: el('changed-list'),
		signHome: el('sign-home'), signAway: el('sign-away'), disputeBtn: el('dispute-btn'),
		share: el('share-btn'), sheet: el('sheet-btn'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the team card page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const matchId = new URLSearchParams(location.search).get('m');
	// The scores that fade when a re-read changes them (TDC.liveFade).
	els.sumHomeScore.dataset.live = 'sum|home';
	els.sumAwayScore.dataset.live = 'sum|away';

	// ─── State ───
	let match = null;          // the row, plus the two team names
	let info = null;           // the league season: league name, season name, rules
	let seasonRow = null;      // the season's reserves
	let fixture = null;        // the fixture this match is on: round, tables
	let venues = [];           // where it is played: the fixture's own, or the season's
	let standings = null;      // the season so far (signed nights): { players, teams, playerCols, teamCols } (UV, 12 Nov)
	let lineupState = null;
	let lineup = [];
	let rosters = new Map();   // team id -> its players, for the lineup and reserve pickers
	let pictures = new Map();  // player id -> avatar path, from the two rosters
	let card = [];
	let cardState = null;
	let signatures = [];       // every signature, newest first: side, by_name, signed_as, at
	let changes = [];          // every change since the first signature
	let discrepancies = [];    // tdc_card_discrepancies: entries overruled by somebody else, not yet accepted (UV, 17 Nov)
	let edited = new Map();    // frame no -> { lag, win }: an open discrepancy, the blue glow in the tables for everybody
	let toAccept = new Set();  // 'frame|lag' / 'frame|win': one this reader may accept, the blue tick on the switch
	const unsaved = new Map(); // frame no -> { fields, saves, failed }: L and W chosen, not yet read back
	let drawnOnce = false;              // a re-read after the first draw fades what changed
	const foldedSessions = new Set();   // the player's view: closed by the reader
	const sessionChoice = new Map();    // the captains' sessions: heading -> open, where the reader went against the usual
	const clOpen = new Map();           // changelog group (side|time) -> open, as the reader left it   // session headings a reader has closed, kept across redraws
	let working = null;       // the side being set up: mine, or the director's choice
	let myPlayerId = null;    // the reader's own player, for the player's view

	// How every player's frames are shown: 'h2h' (the default, UV 28 Oct) or
	// 'session'. Remembered on this device only; without storage it is the
	// default each visit.
	const VIEW_KEY = 'tdc.card.playerView';
	let playerView = 'h2h';
	try { if (localStorage.getItem(VIEW_KEY) === 'session') playerView = 'session'; } catch { /* the default */ }

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	const teamName = (side) => side === 'home' ? match.home_name : match.away_name;
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	function when(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable time: ' + iso); return ''; }
		return d.toLocaleString([], {
			weekday: 'short', day: 'numeric', month: 'short',
			hour: '2-digit', minute: '2-digit'
		});
	}

	// A player's picture, or their initials in a circle when they have none.
	function avatar(playerId, name) {
		const box = node('span', 'person-pic');
		const url = TDC.pictureUrl('player-avatars', pictures.get(playerId));
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			box.append(img);
		} else {
			box.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
		}
		return TDC.profilePic(box, playerId);   // opens their profile (UV, 5 Nov)
	}

	// A name with its picture beside it, everywhere a player is named.
	function person(playerId, name, cls) {
		const span = node('span', 'card-person' + (cls ? ' ' + cls : ''));
		span.append(avatar(playerId, name), node('span', 'card-person-name', name));
		return span;
	}

	// ─── The match itself ───
	async function loadMatch() {
		const { data, error } = await supabaseClient
			.from('tbl_matches')
			.select('id, home_team_id, away_team_id, home_side_kind, away_side_kind, scheduled_at, status, rules, card_version')
			.eq('id', matchId)
			.maybeSingle();

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) {
			TDC.error(AREA, 'no match with that id. Check the link.', { matchId }, els.status);
			return false;
		}
		if (data.home_side_kind !== 'team' || data.away_side_kind !== 'team') {
			TDC.error(AREA, 'this is not a team match. A singles match is scored on the match page.', null, els.status);
			return false;
		}

		const { data: teams, error: teamError } = await supabaseClient
			.from('tbl_teams')
			.select('id, name, league_season_id, picture_path')
			.in('id', [data.home_team_id, data.away_team_id]);

		if (teamError) { TDC.showSupabaseError(AREA, teamError, els.status); return false; }

		const byId = new Map((teams || []).map((t) => [t.id, t]));
		match = Object.assign({}, data, {
			home_name: (byId.get(data.home_team_id) || {}).name || 'Home',
			away_name: (byId.get(data.away_team_id) || {}).name || 'Away',
			league_season_id: (byId.get(data.home_team_id) || {}).league_season_id,
			home_picture: (byId.get(data.home_team_id) || {}).picture_path || null,
			away_picture: (byId.get(data.away_team_id) || {}).picture_path || null
		});

		els.title.replaceChildren(node('span', 'team-name', match.home_name), ' : ', node('span', 'team-name', match.away_name));
		document.title = match.home_name + ' : ' + match.away_name + ' · The Dive Club';
		for (const [pic, name, side] of [
			[els.homePic, els.homeName, 'home'], [els.awayPic, els.awayName, 'away'],
			[els.sumHomePic, els.sumHomeName, 'home'], [els.sumAwayPic, els.sumAwayName, 'away'],
			[els.resHomePic, els.resHomeName, 'home'], [els.resAwayPic, els.resAwayName, 'away']]) {
			// The team's own picture, or the shield (TDC.teamPic, 29 Oct).
			const team = byId.get(side === 'home' ? data.home_team_id : data.away_team_id) || {};
			pic.replaceChildren(TDC.teamPic(team.picture_path));
			TDC.runWords(name, teamName(side));   // wrapping between words, a word too long running (UV, 16 Nov)
		}

		// The league's pages, once the match has said which season it is in.
		TDCLeagueNav.show(match.league_season_id);
		return true;
	}

	// ─── The league around it ───
	// For the banner and the signature form only: a failure here is reported
	// and the card still loads, because none of it is needed to score.
	async function loadContext() {
		const [season, row, fx, places, st, cols] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: match.league_season_id }),
			supabaseClient.from('tbl_league_seasons').select('max_reserves, tbl_leagues(picture_path)').eq('id', match.league_season_id).maybeSingle(),
			supabaseClient.from('tbl_league_fixtures').select('round, table_numbers').eq('match_id', matchId).maybeSingle(),
			supabaseClient.rpc('tdc_match_venue_list', { p_match_id: matchId }),
			// The lineup page's numbers (UV, 12 Nov): the Standings tab's reads
			// and ranking (TDCStandings) with Live off, so the two never
			// disagree. Read once: they move only when a night is signed.
			supabaseClient.rpc('tdc_league_standings', { p_league_season_id: match.league_season_id }),
			supabaseClient.from('tbl_league_standing_columns')
				.select('id, scope, position, name, equation, decimals, rank_priority, higher_first')
				.eq('league_season_id', match.league_season_id).order('position')
		]);
		if (st.error) TDC.showSupabaseError(AREA, st.error, els.status);
		else if (cols.error) TDC.showSupabaseError(AREA, cols.error, els.status);
		else if (!st.data || !Array.isArray(st.data.players) || !Array.isArray(st.data.teams)) {
			TDC.error(AREA, 'the standings came back in a shape this page does not know.', st.data, els.status);
		} else {
			const colsFor = (scope) => (cols.data || []).filter((c) => c.scope === scope);
			const playerCols = colsFor('player'), teamCols = colsFor('team');
			const ranked = (rows, c) => TDCStandings.rank(rows.map((r) => Object.assign({ name: r.display_name || r.team_name || r.name }, r)), c);
			standings = {
				playerCols, teamCols, teamCount: st.data.teams.length,
				players: new Map(ranked(st.data.players, playerCols).map((r) => [r.player_id, r])),
				teams: new Map(ranked(st.data.teams, teamCols).map((r) => [r.team_id, r]))
			};
		}
		if (season.error) TDC.showSupabaseError(AREA, season.error, els.status);
		else info = (season.data || [])[0] || null;
		if (row.error) TDC.showSupabaseError(AREA, row.error, els.status);
		else seasonRow = row.data;
		if (fx.error) TDC.showSupabaseError(AREA, fx.error, els.status);
		else fixture = fx.data;
		if (places.error) TDC.showSupabaseError(AREA, places.error, els.status);
		else venues = places.data || [];
	}

	// ─── The rosters behind the lineup ───
	// Read once: a roster does not change during a night, and this is two
	// requests rather than two on every redraw. They carry each player's
	// picture too.
	async function loadRosters() {
		// Both asked at once (UV, 16 Nov: as fast as it can load), kept home
		// first as before.
		const ids = [match.home_team_id, match.away_team_id].filter((id) => !rosters.has(id));
		const read = await Promise.all(ids.map((id) => supabaseClient.rpc('tdc_team_roster', { p_team_id: id })));
		for (let i = 0; i < ids.length; i++) {
			const { data, error } = read[i];
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			rosters.set(ids[i], data || []);
			for (const r of data || []) if (r.avatar_path) pictures.set(r.player_id, r.avatar_path);
		}
		return true;
	}

	// ─── Everything that moves ───
	async function loadAll() {
		const calls = [
			['tdc_lineup_state', { p_match_id: matchId }, (d) => { lineupState = (d || [])[0] || null; }],
			['tdc_match_lineup', { p_match_id: matchId }, (d) => { lineup = d || []; }],
			['tdc_match_card', { p_match_id: matchId }, (d) => { card = d || []; }],
			['tdc_card_state', { p_match_id: matchId }, (d) => { cardState = d || null; }],
			['tdc_card_discrepancies', { p_match_id: matchId }, (d) => { discrepancies = d || []; }]
		];

		// All asked at once, with the signatures below (UV, 16 Nov: as fast as it
		// can load), and kept in this order: the first failure is the one said.
		const sigsRead = Promise.resolve(supabaseClient.rpc('tdc_card_signatures', { p_match_id: matchId }));   // sent now, not when awaited
		const read = await Promise.all(calls.map(([fn, args]) => supabaseClient.rpc(fn, args)));
		for (let i = 0; i < calls.length; i++) {
			const { data, error } = read[i];
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			calls[i][2](data);
		}

		// A re-read can land while L and W changes are still queued behind it
		// (the queue reads the page again after each burst, and a tap during
		// that read starts the next). It shows the frame from before them, so
		// what is still waiting is laid over it: otherwise the switch jumps
		// back, and the next tap on that frame sends the old value and undoes
		// the change (UV, 29 Oct: the middle "stuck on the previous icon").
		for (const f of card) {
			const u = unsaved.get(f.frame_no);
			if (u) Object.assign(f, u.fields);
		}

		// Which side this person is setting up. A captain has one; the
		// director picks. Kept across redraws so a choice is not undone.
		const mine = lineupState && lineupState.my_side;
		if (!working || (!lineupState.i_run_it && working !== mine)) {
			working = mine || (lineupState && lineupState.i_run_it ? 'home' : null);
		}
		// A director with no side of their own goes to the side still to lock:
		// once one is in, the other is the only one with anything to do.
		if (lineupState && lineupState.i_run_it && !mine) {
			const lockedNow = { home: lineupState.home_locked, away: lineupState.away_locked };
			const other = working === 'home' ? 'away' : 'home';
			if (lockedNow[working] && !lockedNow[other]) working = other;
		}

		// Discrepancies (UV, 17 Nov): somebody's lag or result changed by
		// somebody else, a captain's signature counting as their entry, so a
		// change after signing is one too. The database works them out
		// (tdc_card_discrepancies). One blue for all of it: the cells glow for
		// everybody; the switch's blue tick only for whoever may accept it,
		// the person overruled, their captain and the league director.
		edited = new Map();
		toAccept = new Set();
		for (const d of discrepancies) {
			const key = d.thing === 'lag' ? 'lag' : 'win';
			const e = edited.get(d.frame_no) || { lag: false, win: false };
			e[key] = true;
			edited.set(d.frame_no, e);
			if (lineupState.i_run_it
				|| (myPlayerId && d.owner_player_id === myPlayerId)
				|| (lineupState.my_side && d.owner_side === lineupState.my_side)) toAccept.add(d.frame_no + '|' + key);
		}

		// Every change made after either captain first signed (UV, 28 Oct),
		// listed under the signatures. A signature is an append-only event, so
		// the first one is still there after a side signs again. An edit is
		// stamped with the version it changed, hence one below the signed
		// version. The signatures themselves, with who signed and as what
		// (captain or league director, UV 29 Oct), join that list and the
		// signature lines.
		changes = [];
		const sigs = await sigsRead;
		if (sigs.error) { TDC.showSupabaseError(AREA, sigs.error, els.status); return false; }
		signatures = sigs.data || [];
		if (signatures.length) {
			const firstVersion = Math.min(...signatures.map((g) => g.card_version));
			const { data, error } = await supabaseClient.rpc('tdc_frame_history', {
				p_match_id: matchId, p_since_version: firstVersion - 1
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			changes = (data || []).filter((c) => c.changed);
		}

		// Text a re-read changed fades out and in (UV, 29 Oct); not on the
		// first draw, which changes everything.
		const snap = drawnOnce ? TDC.liveSnapshot(document) : null;
		render();
		TDC.liveFade(document, snap);
		drawnOnce = true;
		return true;
	}

	// ─── Drawing ───
	function render() {
		if (!lineupState) return;
		const locked = { home: lineupState.home_locked, away: lineupState.away_locked };
		const both = locked.home && locked.away;
		const canSet = working && (lineupState.i_run_it || lineupState.my_side === working);

		// The room W takes fully open, kept on every frame (UV, 19 Nov), so
		// nothing moves when it opens: the most stops it can gain on one side
		// (league.css, --cs-specials).
		document.body.style.setProperty('--cs-specials', mostSpecialsOneSide());
		renderBanner(locked, both);
		renderSwitch(both);
		renderLineups(locked, both, canSet);
		renderQuick(both);
		// A player sees their own frames in place of every session; once the
		// card is completed, their table above the sessions, which everybody
		// sees then as plain tables (UV, 17 Nov).
		const player = asPlayer();
		if (player) renderMine(both); else els.mine.hidden = true;
		if (!player || cardDone()) renderSessions(both); else els.grid.hidden = true;
		renderSummary(both);
		renderPlayers(both);
		renderSignatures(both);
	}

	const score = (side) => card.filter((f) => f.winner_side === side).length;
	// A completed card (UV, 17 Nov): signed by both, or published. Every
	// switch greys then, so the sessions are drawn as plain tables and a
	// player sees only their own table.
	const cardDone = () => !!cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
	const teamSize = () => (match.rules && match.rules.team_size) || 0;

	// The card's state, as the banner's badge. Each key has a colour in
	// league.css (.card-state-<key>).
	function stateOf(both) {
		const state = cardState && cardState.state;
		if (!both) return ['lineups', 'Lineups not in'];
		if (state === 'approved') return ['approved', 'Published'];
		if (state === 'agreed') return ['agreed', 'Signed by both'];
		if (state === 'disputed') return ['disputed', 'Disputed'];
		// Signed by both, then changed (UV, 29 Oct: "Re-opened", not "Playing").
		if (state === 'awaiting' && cardState.reopened) return ['reopened', 'Re-opened'];
		if (state === 'awaiting') return ['awaiting', 'Waiting on a signature'];
		return ['playing', 'Playing'];
	}

	// ─── The banner ───
	// Both teams, the state as a badge, a line on what happens next, and the
	// fixture's details as label and value pairs. The details start folded
	// (UV, 18 Nov; the markup has no open) and the page never opens or closes
	// them, so the reader's choice survives every redraw.
	function renderBanner(locked, both) {
		const [key, label] = stateOf(both);
		els.jumbo.className = 'jumbo card-jumbo card-state-' + key;
		// The page speaks a fixture's colours (UV, 11 Nov): the state on the
		// body colours every score; a banner name turns yellow once its side
		// has locked and is underlined for the viewer's own team.
		document.body.dataset.cardState = key;
		const mine = myTeamSide();
		for (const [name, side] of [[els.homeName, 'home'], [els.awayName, 'away'], [els.sumHomeName, 'home'], [els.sumAwayName, 'away'],
			[els.resHomeName, 'home'], [els.resAwayName, 'away']]) {
			name.classList.toggle('is-locked', !!locked[side]);
			name.classList.toggle('is-mine', mine === side);
		}
		els.jumboStatus.hidden = false;
		els.jumboStatus.textContent = label;

		// Once the match is complete (signed by both, or published), its score
		// either side of the ":" (UV, 16 Nov), in the result's colours: the
		// winner's green and lit, the loser's grey (data-lead, as the result's).
		const complete = key === 'agreed' || key === 'approved';
		const h = score('home'), a = score('away');
		els.jumbo.dataset.lead = complete ? (h > a ? 'home' : a > h ? 'away' : '') : '';
		els.jumboV.classList.toggle('cj-score', complete);
		els.jumboV.replaceChildren(...(complete
			? [node('span', 'cj-num cj-num-home', String(h)), node('span', 'cj-dash', ':'), node('span', 'cj-num cj-num-away', String(a))]
			: [':']));
		els.stateDetail.textContent = stateDetail(locked, both);

		const facts = [];
		if (info) facts.push(['League', info.league_name + (info.name ? ' · ' + info.name : '')]);
		// The discipline, worded as the Season tab's (UV, 16 Nov).
		if (match.rules && match.rules.discipline) facts.push(['Game', D.DISCIPLINE[match.rules.discipline] || match.rules.discipline]);
		if (match.scheduled_at) {
			const d = new Date(match.scheduled_at);
			facts.push(['Date', d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })]);
			facts.push(['Time', d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })]);
		} else {
			facts.push(['Date', 'Not set']);
		}
		if (fixture && fixture.round) facts.push(['Round', String(fixture.round)]);
		if (fixture && fixture.table_numbers && fixture.table_numbers.length) {
			facts.push([fixture.table_numbers.length === 1 ? 'Table' : 'Tables', fixture.table_numbers.join(', ')]);
		}
		const venuesAt = facts.length;
		const size = teamSize();
		if (size) facts.push(['Players', size + ' a side']);
		if (seasonRow) facts.push(['Reserves', seasonRow.max_reserves ? 'Up to ' + seasonRow.max_reserves + ' a team' : 'None']);
		if (size) facts.push(['Sessions', String(size)]);
		const frames = card.length || (size ? size * size : 0);
		if (frames) {
			const played = card.filter((f) => f.status === 'complete').length;
			facts.push(['Frames', card.length ? played + ' of ' + frames + ' played' : String(frames)]);
		}
		if (!both && lineupState.cutoff_at) facts.push(['Lineups by', when(lineupState.cutoff_at)]);

		els.facts.replaceChildren(...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));
		const place = TDC.venueFact(venues);
		if (place) els.facts.insertBefore(place, els.facts.children[venuesAt] || null);

		// Above the banner, the Standings and Fixtures tabs' heading (UV, 18 Nov):
		// the league's shield, the league · the season · the venue. The folded
		// banner's venue and discipline badges went with it.
		if (info) {
			TDC.leagueLine(els.cardLine, {
				picture: seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path,
				league: info.league_name, season: info.name, venues,
			});
		}
	}

	function stateDetail(locked, both) {
		const state = cardState && cardState.state;
		let text;

		if (!both) {
			const waiting = [];
			if (!locked.home) waiting.push(match.home_name);
			if (!locked.away) waiting.push(match.away_name);
			text = 'Waiting on ' + waiting.join(' and ')
				+ '. The frames are made when the second lineup is locked.'
				+ (lineupState.cutoff_at
					? ' A side with nothing in by ' + when(lineupState.cutoff_at) + ' concedes.'
					: '');
		} else if (state === 'agreed') {
			text = 'The card is agreed. Only the league director can change it now.';
		} else if (state === 'approved') {
			text = 'The league director has approved this result.';
		} else if (state === 'disputed') {
			text = (cardState.note || '') + ' The card is open again.';
		} else if (state === 'awaiting') {
			const out = cardState.waiting_on;
			text = out === 'both'
				? 'The card changed, so neither signature stands any more.'
				: 'Waiting on ' + teamName(out) + ' to sign.';
		} else {
			text = 'Record each frame as it finishes. Both captains sign at the end.';
		}

		// A lineup locked by the clock rather than by a person is worth saying
		// plainly, because somebody will otherwise wonder who did it.
		const byCutoff = [];
		if (lineupState.home_by_cutoff) byCutoff.push(match.home_name);
		if (lineupState.away_by_cutoff) byCutoff.push(match.away_name);
		if (byCutoff.length) {
			text += ' ' + byCutoff.join(' and ')
				+ (byCutoff.length === 1 ? ' did not put a lineup in before the cutoff.' : ' did not put lineups in before the cutoff.');
		}
		return text.trim();
	}

	// The director's switch between the two sides, for as long as either has
	// a lineup to set. Each option says whether that side is in yet.
	function renderSwitch(both) {
		els.sideSwitch.hidden = both || !lineupState.i_run_it || !!lineupState.my_side;
		if (els.sideSwitch.hidden) return;
		const label = (side) => teamName(side)
			+ (lineupState[side + '_locked'] ? ' (locked)' : '');
		els.sidePick.replaceChildren(
			new Option(label('home'), 'home'),
			new Option(label('away'), 'away'));
		els.sidePick.value = working;
	}

	// ─── The lineup's choices, kept on the page (UV, 12 Nov) ───
	// Nothing is sent while a captain goes down the list: each position is
	// kept here, laid over what the database holds (anything saved by the
	// page before 12 Nov), and the lot goes in one call when Lock the lineup
	// is pressed (tdc_submit_lineup). A redraw in between, a live update from
	// the other side, shows what they chose. A reload loses it (accepted by
	// UV, 12 Nov).
	//
	// No "here tonight" (UV, 18 Nov): every active player is available every
	// night, so a captain only gives positions; everybody else on the team is
	// a reserve. The database's squad is sent as the players given a position.
	//
	// The lineup is one ordered list (UV, 18 Nov, later): the first n players
	// (n = the night's positions) are positions 1 to n, everybody below them a
	// reserve. A captain moves a player up or down with the arrows, or drags
	// them. A position is null only when the team has fewer active players
	// than positions; away and withdrawn players are never in the list.
	const pendingOrder = new Map();   // side -> [player id or null], kept until the lock

	const positionsOf = (side) => lineup.filter((l) => l.side === side).length;
	const statOf = (id) => (standings && standings.players.get(id)) || null;

	// A team's players in league order (the Standings ranks, as the league's
	// rules rank them), then name order for anybody not ranked yet.
	function byRank(roster) {
		return roster.slice().sort((a, b) => {
			const x = statOf(a.player_id), y = statOf(b.player_id);
			const rx = x && x.rank !== null ? x.rank : Infinity, ry = y && y.rank !== null ? y.rank : Infinity;
			return rx - ry || String(a.display_name).localeCompare(String(b.display_name));
		});
	}

	// The first n entries padded to n, nobody past them but players.
	function normalised(list, n) {
		const head = list.slice(0, n);
		while (head.length < n) head.push(null);
		return head.concat(list.slice(n).filter(Boolean));
	}

	// The order a captain starts from (UV, 18 Nov): the players as they stand
	// in the league, the strongest in the night's last frame (the decider),
	// the next strongest in the frame before it, and so on back through the
	// last session, read from this match's own frozen scorecard (8-Ball
	// Mainstream's paper order included). Anybody beyond the positions is a
	// reserve, in league order. A lineup the database already holds for this
	// side (saved before 12 Nov) is kept instead.
	function suggestedOrder(side) {
		const n = positionsOf(side);
		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		const active = byRank(rosters.get(teamId) || []).filter((r) => r.status === 'active').map((r) => r.player_id);
		const order = Array(n).fill(null);
		const saved = lineup.filter((l) => l.side === side && l.player_id && active.includes(l.player_id));
		if (saved.length) {
			for (const l of saved) if (l.lineup_slot >= 1 && l.lineup_slot <= n) order[l.lineup_slot - 1] = l.player_id;
		} else {
			const rows = TDCMatchDef.rotationFrames(match.rules) || [];
			const last = rows.length ? rows[rows.length - 1] : [];
			const key = side === 'home' ? 'h' : 'a';
			const strongestFirst = last.slice().reverse().map((f) => f[key]);
			active.slice(0, n).forEach((id, k) => {
				let p = strongestFirst[k];
				if (!(p >= 1 && p <= n) || order[p - 1] !== null) p = order.lastIndexOf(null) + 1;   // no scorecard: from the bottom
				order[p - 1] = id;
			});
		}
		return normalised(order.concat(active.filter((id) => !order.includes(id))), n);
	}

	function orderFor(side) {
		if (!pendingOrder.has(side)) pendingOrder.set(side, suggestedOrder(side));
		return pendingOrder.get(side);
	}

	// Who is in which position, as this page shows it.
	function lineupShown() {
		const n = positionsOf(working);
		const list = orderFor(working);
		const pos = (id) => { const i = list.indexOf(id); return i >= 0 && i < n ? i + 1 : null; };
		return { pos };
	}

	// ─── The lineup page (UV, 12 Nov) ───
	// Until both lineups are in: the two teams' season so far as a football
	// head-to-head, then each team in a table of its own with the league's
	// Standings columns. The team being set up (a captain's own, or the side
	// the director chose) has the position steppers in its table, the
	// hint above it and Lock the lineup under it; everybody else sees the
	// tables read-only. Players never see this page once the lineups are in.
	//
	// Every team table has Scorecard · Stats (UV, 18 Nov; Scorecard first and
	// chosen on opening): Scorecard is the night's grid with this team down
	// the side, Stats the Standings table. The choice is kept per side across
	// redraws; switching shows the other view in place, so the thumb slides.
	const luView = new Map();   // side -> 'scorecard' | 'stats'

	function renderLineups(locked, both, canSet) {
		els.lineups.hidden = both;
		if (els.lineups.hidden) return;
		const managing = canSet && working && !locked[working] ? working : null;

		renderCompare();
		// Your own team first, at every width (UV, 18 Nov): the one being set
		// up, else the reader's team, else home; the other team next, and This
		// season under both (the markup's order).
		const first = managing || myTeamSide() || 'home';
		const sides = first === 'home' ? ['home', 'away'] : ['away', 'home'];
		// Whose side the reader is on, for which view each table opens on. A
		// player on either team's roster counts (UV, 18 Nov), not only a
		// captain: before the frames exist myTeamSide() knows captains alone.
		const onRoster = (s) => !!myPlayerId
			&& (rosters.get(s === 'home' ? match.home_team_id : match.away_team_id) || []).some((r) => r.player_id === myPlayerId);
		const own = managing || myTeamSide() || (onRoster('home') ? 'home' : onRoster('away') ? 'away' : null);
		els.teamTables.replaceChildren(...sides.map((side) => teamTable(side, locked, side === managing, own)));

		// The lock button goes with the table being set up; parked out of
		// sight in the section otherwise. No hint any more (UV, 18 Nov: the
		// grey words under the team's name gave way to Scorecard · Stats).
		els.squadHint.hidden = true;
		els.lockRow.hidden = !managing;
		if (managing) {
			els.teamTables.querySelector('.lu-team[data-side="' + managing + '"]').append(els.lockRow);
			showLockCount();
		} else {
			els.lineups.append(els.lockRow);
		}
	}

	// Scorecard · Stats (UV, 18 Nov; it replaced the scorecard at the foot of
	// the page): one table, the position, picture and name always, and to
	// their right either the Standings columns (Stats) or the other team's
	// positions (Scorecard), each cell the frame in which this row's position
	// meets that one, in the same table and the same look. Read from this
	// match's own frozen rules, so a league with its own order (8-Ball
	// Mainstream's paper scoresheet) shows that order; a table that repeats a
	// pairing shows both frames. The team box's data-view says which columns
	// show (league.css), so switching moves nothing else.
	function framesFor(side) {
		const n = teamSize();
		const meets = new Map();   // 'h-a' → [frame numbers]
		if (n > 0) {
			TDCMatchDef.rotationFrames(match.rules).forEach((row, s) => row.forEach((f, j) => {
				const key = f.h + '-' + f.a;
				if (!meets.has(key)) meets.set(key, []);
				meets.get(key).push(s * n + j + 1);
			}));
		}
		return (p, q) => (side === 'home' ? meets.get(p + '-' + q) : meets.get(q + '-' + p)) || [];
	}

	// The Scorecard columns for one row: the frame against each of the other
	// team's positions where this row has a position, blanks where it does not.
	function scCells(side, position) {
		const n = teamSize();
		const frames = framesFor(side);
		const cells = [];
		// Written F1, F6 …, grey; the last session's frames green (UV, 18 Nov).
		for (let q = 1; q <= n; q++) {
			const td = node('td', 'num lu-col-sc');
			if (position) {
				frames(position, q).forEach((f, k) => {
					if (k) td.append(', ');
					td.append(node('span', f > (n - 1) * n ? 'lu-f-last' : null, 'F' + f));
				});
			}
			cells.push(td);
		}
		return cells;
	}

	// Their headings: the other team's positions.
	function scHeads(side) {
		const theirs = side === 'home' ? 'A' : 'H';
		const heads = [];
		for (let q = 1; q <= teamSize(); q++) heads.push(node('th', 'num lu-col-sc', theirs + q));
		return heads;
	}

	// A table this reader cannot change, on Scorecard: one row per position
	// (its players' positions are not known to the reader). Its picture and
	// Player columns are hidden on Scorecard (UV, 18 Nov: the positions only),
	// except on your own team once it has locked (shows-names), where the
	// names filled in here, from what tdc_match_lineup reveals, show.
	function positionRows(side, roster, posFor) {
		const mine = side === 'home' ? 'H' : 'A';
		const byId = new Map(roster.map((r) => [r.player_id, r]));
		const idAt = new Map([...posFor].map(([id, p]) => [p, id]));
		const rows = [];
		for (let p = 1; p <= teamSize(); p++) {
			const r = byId.get(idAt.get(p));
			const tr = node('tr', 'lu-row-sc');
			const pic = node('td', 'sd-pic');
			if (r) pic.append(avatar(r.player_id, r.display_name));
			tr.append(node('td', 'sd-rank lu-ctl lu-pos', mine + p), pic,
				node('td', 'sd-name' + (r ? '' : ' lu-empty-name'), r ? r.display_name : '–'), ...scCells(side, p));
			rows.push(tr);
		}
		return rows;
	}

	function ordinal(n) {
		const teen = n % 100 >= 11 && n % 100 <= 13;
		return n + (teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
	}

	// The football head-to-head: the home team's number, the stat, the away
	// team's, a row each, the league position first and then the league's
	// team columns. The better of the two is green and lit, the other grey,
	// as a finished fixture's scores (level: both green). Only where better
	// is known: the position, and the columns that rank the table (their
	// own direction); every other column is cream on both sides.
	function renderCompare() {
		els.compare.hidden = !standings;
		if (!standings) return;   // the read failed and has said so
		const team = (side) => standings.teams.get(side === 'home' ? match.home_team_id : match.away_team_id) || null;
		const home = team('home'), away = team('away');

		const head = node('div', 'lu-cmp-row lu-cmp-head');
		head.append(TDC.runName(node('span', 'lu-cmp-v lu-cmp-home lu-cmp-team'), match.home_name), node('span', 'lu-cmp-k'),
			TDC.runName(node('span', 'lu-cmp-v lu-cmp-away lu-cmp-team'), match.away_name));
		const rows = [head];

		const row = (label, h, a, shown, better) => {
			const r = node('div', 'lu-cmp-row');
			const hv = node('span', 'lu-cmp-v lu-cmp-home', shown(h));
			const av = node('span', 'lu-cmp-v lu-cmp-away', shown(a));
			if (better && h !== null && a !== null) {
				const b = better(h, a);   // 'home', 'away' or 'level'
				hv.classList.add(b === 'away' ? 'is-behind' : 'is-best');
				av.classList.add(b === 'home' ? 'is-behind' : 'is-best');
			}
			r.append(hv, node('span', 'lu-cmp-k', label), av);
			rows.push(r);
		};
		const rankOf = (t) => (t && t.rank !== null && t.rank !== undefined ? t.rank : null);
		row('League position', rankOf(home), rankOf(away),
			(v) => (v === null ? '–' : ordinal(v)),
			(h, a) => (h === a ? 'level' : h < a ? 'home' : 'away'));
		for (const c of standings.teamCols) {
			const h = home ? home.values[c.id] : null, a = away ? away.values[c.id] : null;
			row(c.name, h === undefined ? null : h, a === undefined ? null : a,
				(v) => TDCStandings.shown(v, c.decimals),
				c.rank_priority ? (x, y) => (x === y ? 'level' : (c.higher_first ? x > y : x < y) ? 'home' : 'away') : null);
		}
		els.compare.replaceChildren(...rows);
	}

	// One team's table: its players in league order (the Standings ranks),
	// then name order for anybody not ranked yet. The table being set up is
	// in lineup order instead (lineupRows). The rank sits after the name and
	// the position first (UV, 18 Nov).
	function teamTable(side, locked, manage, own) {
		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		const roster = byRank(rosters.get(teamId) || []);
		const cols = standings ? standings.playerCols : [];
		const theirs = lineup.filter((l) => l.side === side);
		// The order, where this reader may see it (tdc_match_lineup decides).
		const posFor = new Map(theirs.filter((l) => l.player_id).map((l) => [l.player_id, l.lineup_slot]));
		const showPos = !manage && posFor.size > 0;

		const box = node('section', 'lu-team' + (manage ? ' is-managing' : ''));
		box.dataset.side = side;
		const head = node('div', 'lu-head');
		const name = node('h3', 'lu-name', teamName(side));
		name.classList.toggle('is-locked', !!locked[side]);
		name.classList.toggle('is-mine', myTeamSide() === side);
		const pic = node('span', 'team-pic lu-pic');
		pic.append(TDC.teamPic(side === 'home' ? match.home_picture : match.away_picture));
		// The table being set up says so in words, above everything in it (UV,
		// 18 Nov: a captain may never see the read-only look, so its green frame
		// alone would not tell them): a captain's own team, or the side the
		// league director chose.
		if (manage) {
			box.append(node('p', 'lu-yours', side === lineupState.my_side ? 'Your lineup · set it here' : 'You are setting this lineup'));
		}
		// Home or away above each team (UV, 16 Nov): your own team comes first,
		// so position alone does not say which is which.
		head.append(node('span', 'badge lu-side', side === 'home' ? 'Home' : 'Away'), pic, name);
		box.append(head);

		// The state line on a table this reader cannot change (UV, 18 Nov: kept
		// there, the only sign the other side has locked; gone from the table
		// being set up, with the hint, for Scorecard · Stats).
		if (!manage) {
			let state;
			if (locked[side]) {
				const filled = theirs.filter((l) => l.player_id || l.hidden).length;
				state = 'Locked: ' + filled + ' of ' + theirs.length + ' positions filled.'
					+ (!posFor.size && theirs.some((l) => l.hidden) ? ' The order is sealed until both lineups are in.' : '');
			} else state = 'Still choosing.';
			box.append(node('p', 'lu-state' + (locked[side] ? ' is-locked' : ''), state));
		}
		if (manage) {
			box.dataset.pull = 'off';      // a drag here must not reload the page
			if (drag) endDrag(false);      // a live update redraws the rows under it
		}

		// Scorecard · Stats (UV, 18 Nov): a player in the match opens their own
		// team's table on Scorecard (a captain's too, once locked) and the
		// opposition's on Stats; anybody not in the match, the league director
		// not setting a side included, opens both on Stats (UV, 18 Nov).
		const shown = luView.get(side) || (side === own ? 'scorecard' : 'stats');
		const views = node('div', 'cp-views lu-views');
		views.setAttribute('role', 'group');
		views.setAttribute('aria-label', 'Scorecard or stats');
		for (const [key, label] of [['scorecard', 'Scorecard'], ['stats', 'Stats']]) {
			const b = node('button', 'cp-view', label);
			b.type = 'button';
			b.dataset.luView = key;
			b.setAttribute('aria-pressed', key === shown ? 'true' : 'false');
			views.append(b);
		}
		box.append(views);
		box.dataset.view = shown;
		// Your own team once locked (UV, 18 Nov): its Scorecard shows the
		// players beside their positions, as Stats does. The opposition's stays
		// positions only; its order is sealed until both lock.
		box.classList.toggle('shows-names', !manage && side === own && posFor.size > 0);

		// The first column, frozen at the left with the picture and name: the
		// position (the pill while it is being set, the letter and number once
		// it can be read). On a table this reader cannot change, Scorecard
		// always shows it (its rows are the positions), Stats only once the
		// order can be read.
		const table = node('table', 'tdc-table sd-table lu-table has-lead' + (manage || showPos ? '' : ' lead-sc-only'));
		const thead = node('thead'), htr = node('tr');
		const picHead = node('th', 'sd-pic');
		picHead.setAttribute('aria-label', 'Picture');
		htr.append(node('th', 'sd-rank lu-ctl lu-lead', 'Position'), picHead, node('th', 'sd-name', 'Player'),
			node('th', 'num lu-rank lu-col-stats', 'Rank'));
		for (const c of cols) htr.append(node('th', 'num lu-col-stats', c.name));
		htr.append(...scHeads(side));
		thead.append(htr);

		const body = node('tbody');
		if (manage) {
			// The same rows on both: Scorecard changes only the columns.
			body.replaceChildren(...lineupRows(side, roster, cols));
		} else {
			const statRows = roster.map((r) => {
				const p = posFor.get(r.player_id);
				const tr = playerRow(r, cols, node('td', 'sd-rank lu-ctl lu-pos lu-lead', p ? (side === 'home' ? 'H' : 'A') + p : ''));
				tr.classList.add('lu-row-stats');
				return tr;
			});
			body.replaceChildren(...statRows);
			stripe({ rows: statRows });
			const scRows = positionRows(side, roster, posFor);
			stripe({ rows: scRows });
			body.append(...scRows);
		}
		if (!roster.length) {
			const tr = node('tr');
			const td = node('td', 'empty', 'Nobody on this team yet.');
			td.colSpan = 4 + cols.length + teamSize();
			tr.append(td);
			body.replaceChildren(tr);
		}
		table.append(thead, body);
		const scroll = node('div', 'table-scroll sd-scroll');
		scroll.append(table);
		box.append(scroll);
		return box;
	}

	// One player's row: the first cell if there is one, the picture, the
	// name, the league rank (after the name, UV 18 Nov), the league's columns
	// (Stats), then any Scorecard cells.
	function playerRow(r, cols, first, scs = []) {
		const id = r.player_id;
		const st = statOf(id);
		const tr = node('tr');
		if (myPlayerId && id === myPlayerId) tr.classList.add('sd-me');
		if (first) tr.append(first);
		const pic = node('td', 'sd-pic');
		pic.append(avatar(id, r.display_name));
		const who = node('td', 'sd-name');
		who.append(node('span', 'lu-player', r.display_name));
		if (r.is_captain) who.append(node('span', 'badge live lu-badge', 'Captain'));
		if (r.status !== 'active') who.append(node('span', 'lu-sub', r.status === 'withdrawn' ? 'Withdrawn' : 'Away'));
		tr.append(pic, who, node('td', 'num lu-rank lu-col-stats', st && st.rank !== null ? String(st.rank) : '–'));
		for (const c of cols) tr.append(node('td', 'num lu-col-stats', TDCStandings.shown(st ? st.values[c.id] : null, c.decimals)));
		tr.append(...scs);
		return tr;
	}

	const stripe = (body) => [...body.rows].forEach((tr, i) => tr.classList.toggle('sd-alt', i % 2 === 1));

	// The table being set up, in lineup order: positions 1 to n (an empty one
	// as a row of its own, only when the team is short), the reserves under
	// them, then anybody away or withdrawn, who cannot be moved.
	function lineupRows(side, roster, cols) {
		const n = positionsOf(side);
		const list = orderFor(side);
		const byId = new Map(roster.map((r) => [r.player_id, r]));
		const rows = list.map((id, i) => {
			const pill = movePill(i, n, list.length, id ? byId.get(id).display_name : null);
			const first = node('td', 'sd-rank lu-ctl lu-move-cell');
			first.append(pill);
			const scs = scCells(side, i < n ? i + 1 : null);   // a reserve has no frames
			if (!id) {
				const tr = node('tr', 'lu-empty-row lu-order-row');
				tr.dataset.key = 'empty-' + i;
				const who = node('td', 'sd-name lu-empty-name', 'Nobody yet');
				tr.append(first, node('td', 'sd-pic'), who, node('td', 'num lu-rank lu-col-stats', ''));
				for (let c = 0; c < cols.length; c++) tr.append(node('td', 'num lu-col-stats', ''));
				tr.append(...scs);
				return tr;
			}
			const tr = playerRow(byId.get(id), cols, first, scs);
			tr.dataset.key = tr.dataset.player = id;
			tr.classList.add('lu-order-row');
			return tr;
		});
		for (const r of roster) {
			if (list.includes(r.player_id)) continue;
			const first = node('td', 'sd-rank lu-ctl lu-move-cell');
			first.append(movePill(-1, n, 0, r.display_name));
			const tr = playerRow(r, cols, first, scCells(side, null));
			tr.dataset.key = r.player_id;
			tr.classList.add('lu-out-row');
			rows.push(tr);
		}
		stripe({ rows });
		// "Reserves" between the last position and the first reserve (UV,
		// 18 Nov), when there are any. Not a place in the order: arrows and
		// drag pass over it.
		if (list.length > n) {
			const label = node('tr', 'lu-reserve-row');
			label.dataset.key = 'reserves';
			const td = node('td', 'lu-reserve-label', 'Reserves');
			td.colSpan = 4 + cols.length + teamSize();
			label.append(td);
			rows.splice(n, 0, label);
		}
		return rows;
	}

	// The position pill (UV, 18 Nov): the stepper's look, an up arrow on the
	// left and a down arrow on the right, each moving the player one place in
	// the order. The number is the position, "–" for a reserve. At = -1:
	// somebody who cannot be moved (away or withdrawn), the pill greyed.
	const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="100" d="M12 20V4"/><path pathLength="100" d="M5 11l7-7 7 7"/></svg>';
	function movePill(at, n, length, name) {
		const pill = node('span', 'tdc-stepper is-across lu-move' + (at < 0 || !name ? ' is-disabled' : ''));
		const btn = (dir, label) => {
			const b = node('button', 'tdc-chevron lu-move-' + dir);
			b.type = 'button';
			b.innerHTML = ARROW;
			b.dataset.action = 'move-' + dir;
			b.setAttribute('aria-label', name ? 'Move ' + name + ' ' + label : label);
			b.addEventListener('pointerdown', (e) => { if (e.button === 0) e.preventDefault(); });   // keep focus, no selection
			return b;
		};
		const up = btn('up', 'up'), down = btn('down', 'down');
		// An arrow with nowhere to go is made invisible and switched off, not
		// hidden: a hidden one took more room than a shown one, so pills with
		// one arrow came out wider (UV, 18 Nov).
		const off = (b, isOff) => { b.disabled = isOff; b.classList.toggle('is-off', isOff); if (isOff) b.setAttribute('aria-hidden', 'true'); };
		off(up, !name || at <= 0);
		off(down, !name || at < 0 || at >= length - 1);
		const view = node('span', 'tdc-stepper-window');
		view.append(node('span', 'lu-move-num' + (at >= 0 && at < n ? '' : ' is-reserve'), at >= 0 && at < n ? String(at + 1) : '–'));
		pill.style.setProperty('--chars', String(Math.max(1, String(n).length)));
		pill.append(up, view, down);
		return pill;
	}

	// A change to the order: drawn again in place, every row that moved
	// sliding from where it was (unless the reader asked for less motion).
	function setOrder(list) {
		const n = positionsOf(working);
		const managedRows = () => [...els.teamTables.querySelectorAll('.lu-team.is-managing tr[data-key]')];
		const before = new Map(managedRows().map((tr) => [tr.dataset.key, tr.getBoundingClientRect().top]));
		pendingOrder.set(working, normalised(list, n));
		render();
		if (lessMotion()) return;
		for (const tr of managedRows()) {
			const was = before.get(tr.dataset.key);
			const dy = was === undefined ? 0 : was - tr.getBoundingClientRect().top;
			if (Math.abs(dy) > 1) tr.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
		}
	}

	// The lineup as it will be sent: who is here, and the player for each
	// position (null for an empty one), from the page's order.
	function lineupToSend() {
		const teamId = working === 'home' ? match.home_team_id : match.away_team_id;
		const active = new Set((rosters.get(teamId) || []).filter((r) => r.status === 'active').map((r) => r.player_id));
		// Only active players: the database refuses anybody away or withdrawn.
		const order = orderFor(working).slice(0, positionsOf(working)).map((id) => (id && active.has(id) ? id : null));
		// The squad the database keeps is the players given a position (UV,
		// 18 Nov): there is no "here tonight" to ask for any more.
		return { here: order.filter(Boolean), order };
	}

	// The button counts the positions filled on the page, so it moves as the
	// captain chooses, with nothing sent.
	function showLockCount() {
		const { order } = lineupToSend();
		const filled = order.filter(Boolean).length;
		els.lockBtn.textContent = filled === order.length
			? 'Lock the lineup'
			: `Lock the lineup (${filled} of ${order.length} filled)`;
	}

	// ─── Now and next (UV, 12 Nov) ───
	// Three groups (UV, 17 Nov; two in rings until then): **Under way**, every
	// frame shown whose lag is in, any outside the night's order first; a
	// yellow line; **Now**, the frames assumed to be playing, filling the
	// tables the frames under way leave (quickFrames); a grey line; **Next**,
	// the rest. A line shows only between two groups that are both there, in
	// the colour of the group above it. What is
	// shown is the next frames without a result in the night's order, twice
	// as many as the fixture has tables, or four with no tables set (UV),
	// and any frame under way beyond them, so a captain who strays from the
	// order still finds every live frame. Each frame is an inset pill with
	// its L and W, live for the captains and the league director only (UV),
	// greyed for everybody else, players included.
	//
	// Motion (UV, 17 Nov; until then every frame that changed group faded out
	// and back in): only a frame that has left the list (its result is in)
	// fades out, where it is. Then every other frame slides from where it was
	// to where it now belongs: one whose lag is in glides up into Under way,
	// the rest close the gaps, and the list's height follows so what is below
	// moves with it. Only then does a new frame fade in. A group left with
	// nothing fades with its last frame (or simply goes, when that frame moved
	// to another group); a line fades in when it starts to show. A redraw
	// during that waits for it and then draws once from the latest card.
	let quickRun = null;
	let quickAgain = false;
	let quickDrawn = false;
	const quickGroups = { live: node('div', 'qv-group qv-live-group'), now: node('div', 'qv-group qv-now'), next: node('div', 'qv-group qv-next') };
	quickGroups.live.setAttribute('aria-label', 'Under way');
	quickGroups.now.setAttribute('aria-label', 'Now');
	quickGroups.next.setAttribute('aria-label', 'Next');
	// Each group's line at its foot, in its colour (UV, 17 Nov; a ring round
	// it before). Always there (UV, 19 Nov: a line coming and going changed
	// the section's height): Under way's yellow line and Now's grey one show
	// whatever the groups hold, so before any frame is started Under way is
	// empty and its line sits above every frame. The groups never hide;
	// Next, always last, has none.
	for (const [key, g] of Object.entries(quickGroups)) {
		g.hidden = false;
		g.dataset.key = key;
		g.qvLine = node('span', 'qv-line');
		g.qvLine.hidden = key === 'next';
		g.append(g.qvLine);
		els.quickList.append(g);
	}

	// Twice the fixture's tables, else four (UV, 12 Nov): the tables, else two.
	const quickTables = () => (fixture && fixture.table_numbers && fixture.table_numbers.length ? fixture.table_numbers.length : 2);
	const quickCount = () => 2 * quickTables();

	// Each frame shown, with its group, in the order drawn. Under way and Now
	// together hold as many frames as there are tables (UV, 17 Nov): every
	// frame under way, then in Now the first in the night's order without a
	// lag, assumed to be on the other tables. A lag on a frame further down
	// moves it to Under way and takes one of those places, so the last
	// assumed frame goes back to Next. More frames under way than tables: all
	// of them, and Now is empty.
	function quickFrames() {
		const open = card.filter((f) => f.status !== 'complete');   // the card is in frame order
		const ahead = open.slice(0, quickCount());
		const inAhead = new Set(ahead.map((f) => f.frame_no));
		const strays = open.filter((f) => f.break_side && !inAhead.has(f.frame_no));
		const live = strays.concat(ahead.filter((f) => f.break_side));
		const waiting = ahead.filter((f) => !f.break_side);
		const assumed = waiting.slice(0, Math.max(0, quickTables() - live.length));
		// The list keeps its length (UV, 19 Nov): a frame out of order coming
		// in pushes the last of Next off, rather than making the list longer.
		// Every frame under way still shows, even beyond it.
		const nextRoom = Math.max(0, quickCount() - live.length - assumed.length);
		return live.map((f) => ({ f, group: 'live' }))
			.concat(assumed.map((f) => ({ f, group: 'now' })))
			.concat(waiting.slice(assumed.length, assumed.length + nextRoom).map((f) => ({ f, group: 'next' })));
	}

	function renderQuick(both) {
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		const list = both && !lockedCard ? quickFrames() : [];
		if (quickRun) { quickAgain = true; return; }
		if (!list.length && !quickDrawn) { els.quick.hidden = true; return; }
		els.quick.hidden = false;
		quickRun = syncQuick(list, quickDrawn)
			.catch((err) => TDC.error(AREA, 'could not draw Now and next.', err, els.status))
			.finally(() => {
				quickRun = null;
				quickDrawn = list.length > 0;
				if (!list.length) els.quick.hidden = true;
				if (quickAgain) { quickAgain = false; renderQuick(lineupState.home_locked && lineupState.away_locked); }
			});
	}

	async function syncQuick(list, animate) {
		const want = new Map(list.map((x) => [String(x.f.frame_no), x]));
		const pills = [...els.quickList.querySelectorAll('.qv-pill')];
		const motion = animate && !lessMotion();
		// Every pill still in the list is drawn again where it is, as every
		// frame row is; it moves below if its group or place changed. One no
		// longer in the list (its result is in) is the only one that fades.
		for (const r of pills) if (want.has(r.dataset.frame)) r.replaceChildren(...quickPill(want.get(r.dataset.frame).f));
		// Their L and W made switches now, not when the controls' own watcher
		// gets to them: everything below is measured, and a card still
		// holding plain selects is another height (UV, 19 Nov: the section
		// grew for a card that then shrank to its real size).
		TDCControls.scan(els.quickList);
		const gone = pills.filter((r) => !want.has(r.dataset.frame));

		// 1. The finished frames fade out in place. The groups and their lines
		// stay (UV, 19 Nov), so a group left empty does not go.
		const fading = gone;
		for (const r of fading) r.style.pointerEvents = 'none';
		if (motion) await Promise.all(fading.map((el) => quickFade(el, 1, 0, 'forwards')));

		// 2. The new layout, laid out at once; where everything was is kept,
		// so it can slide there from it.
		// The lines too, which slide with the cards (they are always there).
		const before = new Map(pills.filter((r) => !gone.includes(r))
			.concat(Object.values(quickGroups).map((g) => g.qvLine).filter((l) => !l.hidden))
			.map((r) => [r, r.getBoundingClientRect()]));
		const fromHeight = els.quickList.offsetHeight;
		for (const r of gone) r.remove();
		const have = new Map(pills.map((r) => [r.dataset.frame, r]));
		const fresh = [];
		for (const { f, group } of list) {
			const box = quickGroups[group];
			let r = have.get(String(f.frame_no));
			if (!r || gone.includes(r)) {
				r = node('div', 'qv-pill');
				r.dataset.frame = String(f.frame_no);
				r.replaceChildren(...quickPill(f));
				fresh.push(r);
			}
			r.dataset.group = group;
			box.insertBefore(r, box.qvLine);   // in the list's order within its group, above its line
		}
		TDCControls.scan(els.quickList);   // the new cards' switches, before their height is taken
		if (!motion) return;

		// 3. Each frame slides from where it was; the new frames wait unseen.
		// The list's height is held where it was until the cards have moved,
		// and changes once (UV, 19 Nov: first it shrank as one card left and
		// grew back when the next came in; then, growing first, it opened
		// before anything moved). Then, growing, it grows and the new frames
		// fade into the room; shrinking, the new frames fade in and it shrinks.
		for (const r of fresh) r.style.opacity = '0';
		const ease = { duration: QUICK_MOVE_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' };
		const toHeight = els.quickList.offsetHeight;
		const resize = () => done(els.quickList.animate([{ height: fromHeight + 'px' }, { height: toHeight + 'px' }], ease));
		const hold = toHeight !== fromHeight ? els.quickList.animate([{ height: fromHeight + 'px' }, { height: fromHeight + 'px' }], { duration: 1e9 }) : null;
		const fadeIn = async () => {
			for (const r of fresh) r.style.opacity = '';
			await Promise.all(fresh.map((r) => quickFade(r, 0, 1, 'backwards')));
		};
		try {
			const moves = [];
			for (const [r, was] of before) {
				const now = r.getBoundingClientRect();
				const dx = was.left - now.left, dy = was.top - now.top;
				if (dx || dy) moves.push(r.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], ease));
			}
			await Promise.all(moves.map(done));
			if (toHeight < fromHeight) await fadeIn();
		} finally {
			if (hold) hold.cancel();
		}
		if (hold) await resize();
		if (toHeight >= fromHeight) await fadeIn();
	}

	// Less motion (the person's choice, else the device's): nothing moves.
	const lessMotion = () => {
		const m = document.documentElement.dataset.motion;
		return m === 'reduce' || (m !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
	};
	const QUICK_FADE_MS = 280, QUICK_MOVE_MS = 380;
	const done = (a) => a.finished.catch(() => { /* cancelled: nothing to wait for */ });
	const quickFade = (el, from, to, fill) =>
		done(el.animate([{ opacity: from }, { opacity: to }], { duration: QUICK_FADE_MS, easing: to ? 'ease-in' : 'ease-out', fill }));

	// One pill: the session, "Under way" once the lag is in, then the frame
	// as a session row draws it (the positions under the names).
	function quickPill(f) {
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		const strict = !!(match.rules && match.rules.strict_frame_order);
		const nextOpen = strict ? (card.find((x) => x.status === 'pending') || {}).frame_no : null;
		// As in the sessions (UV, 17 Nov; was captains and the LD only, 12 Nov):
		// a captain or the director any frame, a player their own.
		const mayEnter = canRecord(f) && f.result_event !== 'default' && !lockedCard
			&& !!f.home_player_id && !!f.away_player_id && (!strict || f.frame_no === nextOpen);

		const top = node('div', 'qv-top');
		// The session and the frame together, "Session 1 · F3" (UV, 17 Nov; the
		// F was under the home player). F1, not Frame 1 (UV, 12 Nov).
		top.append(node('span', 'qv-where', 'Session ' + (f.session || 1) + ' · F' + f.frame_no));
		if (f.break_side) top.append(node('span', 'qv-live', 'Under way'));
		const row = node('div', 'cs-row cs-frame');
		row.append(playerCell(f, 'home', lockedCard), toggles(f, mayEnter, 'home', 'quick'), playerCell(f, 'away', lockedCard));
		return [top, row];
	}

	// ─── The sessions ───
	// A frame's position on each side. Old cards (no team size) have neither,
	// and their slot is the position.
	const posOf = (f, side) => (side === 'home' ? f.home_position : f.away_position) || f.lineup_slot;

	function renderSessions(both) {
		els.grid.hidden = !both || !card.length;
		if (els.grid.hidden) return;

		const strict = !!(match.rules && match.rules.strict_frame_order);
		// Under a strict order only the next unplayed frame may be entered,
		// which is a nationals rule; most league play lets a scorer record
		// whichever table finishes first.
		const nextOpen = strict
			? (card.find((f) => f.status === 'pending') || {}).frame_no
			: null;

		// A note under the sessions, only when there is something to say:
		// the strict order, seats still empty, and a side with no reserve.
		const empty = card.filter((f) => f.status === 'pending' && (!f.home_player_id || !f.away_player_id)).length;
		// Nothing left to enter on a completed card, so no note.
		const hint = cardDone() ? '' : ((strict ? 'Frames must be played in order, so only frame ' + (nextOpen || '—') + ' can be entered.' : '')
			+ (empty
				? ' ' + empty + (empty === 1 ? ' frame has' : ' frames have') + ' an empty seat: put a reserve or a latecomer in, or it is a walkover when the card is signed.'
				: '')
			+ noReserveNote()).trim();
		els.gridHint.hidden = !hint;
		els.gridHint.textContent = hint;

		// One block per session. Frames are numbered session by session, so
		// the card is already in that order.
		const bySession = new Map();
		for (const f of card) {
			const s = f.session || 1;
			if (!bySession.has(s)) bySession.set(s, []);
			bySession.get(s).push(f);
		}
		const blocks = [];
		const done = cardDone();
		for (const [s, frames] of bySession) {
			const heading = bySession.size > 1 ? 'Session ' + s : 'The frames';
			blocks.push(done ? sessionTable(heading, frames) : sessionBlock(heading, frames, strict, nextOpen));
		}
		els.sessions.replaceChildren(...blocks);
		for (const b of blocks) sessionSizes.observe(b);
		placeSessions();
	}

	// On a PC the sessions sit in two columns (UV, 28 Oct), each going into
	// the shorter column (UV, 17 Nov): with one open, the folded ones after it
	// stack in the other column beside it rather than below it. All folded,
	// that is still 1 and 2, then 3 and 4. A last session with both columns
	// level is alone in its row and centred (UV, 17 Nov). The grid's rows are
	// 4px, each session spanning as many as it is tall, and placed again
	// whenever one changes size (a fold, a redraw), so it follows a fold as it
	// grows. A phone keeps one under another, unplaced.
	const SESSION_ROW = 4;
	const twoColumns = matchMedia('(min-width: 992px)');
	let placing = 0;
	const sessionSizes = typeof ResizeObserver !== 'undefined'
		? new ResizeObserver(() => { if (!placing) placing = requestAnimationFrame(() => { placing = 0; placeSessions(); }); })
		: { observe() {} };
	twoColumns.addEventListener('change', () => placeSessions());
	function placeSessions() {
		const blocks = [...els.sessions.children].filter((b) => b.matches('.cs-session, .cs-done'));
		for (const b of blocks) { b.style.gridColumn = b.style.gridRow = ''; b.classList.remove('is-lone'); }
		if (!twoColumns.matches) return;
		const tall = [0, 0];   // each column's height so far, in rows
		blocks.forEach((b, i) => {
			const rows = Math.ceil((b.offsetHeight + parseFloat(getComputedStyle(b).marginBottom || 0)) / SESSION_ROW);
			if (i === blocks.length - 1 && tall[0] === tall[1]) {
				b.classList.add('is-lone');
				b.style.gridColumn = '1 / -1';
				b.style.gridRow = (tall[0] + 1) + ' / span ' + rows;
				return;
			}
			const col = tall[1] < tall[0] ? 1 : 0;
			b.style.gridColumn = String(col + 1);
			b.style.gridRow = (tall[col] + 1) + ' / span ' + rows;
			tall[col] += rows;
		});
	}

	// Three tracks: home player, the frame's L and W in the middle, away
	// player. The totals sit either side of the middle, under each team's end
	// of the toggles.
	//
	// Each session folds (UV, 29 Oct): a folding group (set-group, so it opens
	// and closes as every other on the site, tdc-controls.js). Folded unless it
	// holds an active frame, one in Now and next (under way, or among the next
	// up; UV, 16 Nov), so the captain sees only the sessions being played. A
	// session the reader opened or closed against that stays so through every
	// redraw. Its heading carries the session's score, so a closed one still
	// says how it went.
	// A session with every result in (UV, 19 Nov): its scores in green for the
	// side that won it and grey for the other, a draw both green, as a finished
	// fixture's (.is-winner, .is-loser). Until then, the card's score colour.
	function markSessionScore(value, frames, side) {
		if (!frames.length || frames.some((f) => f.status !== 'complete')) return value;
		const won = (s) => frames.filter((f) => f.winner_side === s).length;
		const mine = won(side), theirs = won(side === 'home' ? 'away' : 'home');
		value.classList.add(mine >= theirs ? 'is-winner' : 'is-loser');
		return value;
	}

	function sessionBlock(heading, frames, strict, nextOpen) {
		const block = node('details', 'cs-session set-group');
		const shown = quickFrames();
		const active = new Set(shown.map((q) => q.f.frame_no));
		const usual = frames.some((f) => active.has(f.frame_no));
		block.open = sessionChoice.has(heading) ? sessionChoice.get(heading) : usual;
		block.addEventListener('toggle', () => {
			if (block.open === usual) sessionChoice.delete(heading); else sessionChoice.set(heading, block.open);
		});
		// A yellow glow inside the pill while it holds a frame in Now, under
		// way or assumed to be (UV, 17 Nov).
		const now = new Set(shown.filter((q) => q.group !== 'next').map((q) => q.f.frame_no));
		block.classList.toggle('is-active', frames.some((f) => now.has(f.frame_no)));
		// The heading centred with its arrow; folded, a second row under it:
		// the teams either side of the session's score, as the session's own
		// head and totals draw them (UV, 17 Nov).
		const won = (side) => frames.filter((f) => f.winner_side === side).length;
		const title = node('summary', 'cs-title');
		title.append(node('span', 'cs-title-text', heading));
		const fold = node('span', 'cs-fold');
		const sesScore = (side) => {
			const value = node('span', 'cs-tot-value', String(won(side)));
			value.dataset.live = 'ses|' + heading + '|' + side;
			return markSessionScore(value, frames, side);
		};
		const mid = node('span', 'cs-fold-score');
		mid.append(sesScore('home'), node('span', 'cs-colon', ':'), sesScore('away'));
		fold.append(TDC.runName(node('span', 'cs-team cs-home'), match.home_name), mid, TDC.runName(node('span', 'cs-team cs-away'), match.away_name));
		title.append(fold);
		block.append(title);

		const grid = node('div', 'cs-grid');
		const head = node('div', 'cs-row cs-head');
		head.append(TDC.runName(node('span', 'cs-team cs-home'), match.home_name), TDC.runName(node('span', 'cs-team cs-away'), match.away_name));
		grid.append(head);

		for (const f of frames) grid.append(frameRow(f, strict, nextOpen));

		const total = node('div', 'cs-row cs-total');
		const both = node('div', 'cs-tots');
		for (const side of ['home', 'away']) {
			const cell = node('span', 'cs-tot cs-' + side);
			const value = node('span', 'cs-tot-value', String(frames.filter((f) => f.winner_side === side).length));
			value.dataset.live = 'tot|' + heading + '|' + side;
			markSessionScore(value, frames, side);
			cell.append(node('span', 'cs-tot-label', 'Total'), value);
			both.append(cell);
		}
		total.append(both);
		grid.append(total);
		block.append(grid);
		return block;
	}

	// A session on a completed card (UV, 17 Nov): a plain table, always open,
	// no pill. Its heading with the session's score; the teams over the name
	// columns; a row per frame, home player · home mark · away mark · away
	// player, the marks as Head to head draws them (frameMark), no pictures.
	// Each name keeps to one line and runs sideways when too long.
	function sessionTable(heading, frames) {
		const block = node('section', 'cs-done');
		const won = (side) => frames.filter((f) => f.winner_side === side).length;
		const title = node('h3', 'cs-done-title lj-heading');
		const sc = node('span', 'cs-done-score');
		for (const side of ['home', 'away']) {
			const value = node('span', 'cs-tot-value', String(won(side)));
			value.dataset.live = 'ses|' + heading + '|' + side;
			sc.append(markSessionScore(value, frames, side));
			if (side === 'home') sc.append(node('span', 'cs-colon', ':'));
		}
		title.append(node('span', 'cs-done-text', heading), sc);
		block.append(title);

		const table = node('table', 'tdc-table card-players cs-done-table');
		const thead = node('thead'), head = node('tr');
		head.append(TDC.runName(node('th', 'cs-done-name cs-done-home cp-team'), match.home_name),
			node('th', 'cs-done-mark'), node('th', 'cs-done-mark'),
			TDC.runName(node('th', 'cs-done-name cs-done-away cp-team'), match.away_name));
		thead.append(head);
		const tbody = node('tbody');
		for (const f of frames) {
			const tr = node('tr');
			const name = (side) => {
				const td = node('td', 'cs-done-name cs-done-' + side);
				return TDC.runName(td, (side === 'home' ? f.home_player : f.away_player) || 'Empty seat');
			};
			const mark = (side) => {
				const td = node('td', 'cp-cell cs-done-mark');
				td.append(frameMark(f, side));
				markEdited(td, [f]);
				return td;
			};
			tr.append(name('home'), mark('home'), mark('away'), name('away'));
			tbody.append(tr);
		}
		table.append(thead, tbody);
		block.append(table);
		return block;
	}

	function frameRow(f, strict, nextOpen) {
		const row = node('div', 'cs-row cs-frame');
		const oneSeat = !f.home_player_id || !f.away_player_id;
		const settled = f.result_event === 'default';
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		// A walkover is settled, so there is nothing to enter; and a frame
		// with an empty seat has nobody to win it until somebody sits down.
		const mayEnter = !settled && !lockedCard && !oneSeat
			&& (!strict || f.frame_no === nextOpen)
			&& canRecord(f);

		row.append(
			playerCell(f, 'home', lockedCard),
			toggles(f, mayEnter),
			playerCell(f, 'away', lockedCard));
		return row;
	}

	// A seat: the player's picture and name, a Reserve badge when somebody
	// other than the position's own player sits in it, and the frame and
	// position under it. Where this person may put a reserve in, the name is
	// the way in (UV, 24 Oct): the reserve picker lies invisibly over it, so a
	// tap on the name opens the phone's own list.
	function playerCell(f, side, lockedCard) {
		const cell = node('div', 'cs-player cs-' + side + (f.winner_side === side ? ' is-won' : ''));
		const id = side === 'home' ? f.home_player_id : f.away_player_id;
		const name = side === 'home' ? f.home_player : f.away_player;
		const pos = posOf(f, side);
		const regular = (lineup.find((l) => l.side === side && l.lineup_slot === pos) || {}).player_id;

		const seat = node('span', 'cs-seat');
		seat.append(id ? person(id, name) : node('span', 'cs-empty', 'Empty seat'));
		if (id && regular && id !== regular) seat.append(node('span', 'badge cs-badge', 'Reserve'));

		const pick = f.status === 'pending' && !lockedCard ? reservePick(f, side) : null;
		if (pick) {
			seat.classList.add('is-pickable');
			seat.title = id ? 'Put a reserve in for ' + name : 'Put somebody in this seat';
			seat.append(pick);
		}
		cell.append(seat);

		// The position alone (UV, 17 Nov): the frame's number left the sessions,
		// and in Now and next it sits beside the session (quickPill). Centred
		// under the name (UV, 17 Nov): the two share a box, the picture beside it.
		const sub = [];
		if (pos) sub.push((side === 'home' ? 'H' : 'A') + pos);
		if (f.result_event === 'default' && f.winner_side === side) sub.push('Walkover');
		const label = seat.querySelector('.card-person-name, .cs-empty');
		const box = node('span', 'cs-namebox');
		label.replaceWith(box);
		box.append(label, node('span', 'cs-sub', sub.join(' · ')));
		return cell;
	}

	// L over W, each a three-way switch (UV, 24 Oct): home at the left,
	// nobody in the middle, away at the right. L is who won the lag (the
	// frame's break_side), W who won the frame. A viewer who may not enter the
	// frame sees them as they stand, greyed.
	//
	// left is the side at the left end: home on the captain's card; on a
	// player's own rows their side, so their end is always the left (UV,
	// 29 Oct). The select's values are sides either way.
	//
	// where is 'quick' for Now and next: the same frame's switches are also
	// in its session, and the controls (tdc-controls.js) carry a switch
	// through a redraw by its action, frame and player, so the quick copy is
	// told apart by its data-player.
	function toggles(f, mayEnter, left = 'home', where = '') {
		const right = left === 'home' ? 'away' : 'home';
		const cell = node('div', 'cs-toggles');
		for (const [action, letter, value, words] of [
			['lag', 'L', f.break_side, 'won the lag'],
			['win', 'W', f.winner_side, 'won the frame']]) {
			// The letter is drawn inside the track at each end, in place of
			// the end's dot (UV, 19 Nov; tdc-controls.js, data-letter).
			const line = node('span', 'cs-tog cs-tog-' + action);
			// An open discrepancy: the track glows blue inside, for everybody,
			// as the frame's cells in the tables do (UV, 17 Nov).
			if ((edited.get(f.frame_no) || {})[action]) line.classList.add('is-edited');
			// A win recorded with nobody on L (UV, 19 Nov): the lag's track
			// glows blue inside as a discrepancy's does, asking for it. Not a
			// walkover, which has no lag.
			if (action === 'lag' && f.status === 'complete' && f.winner_side && !f.break_side
				&& f.result_event !== 'default') line.classList.add('is-no-lag');
			const pick = document.createElement('select');
			pick.dataset.control = 'tri';
			// A discrepancy this reader may accept (UV, 17 Nov): a blue tick
			// where the middle dot is. Tapping it accepts; tapping an end
			// still sets that end (tdc-controls.js, data-accept).
			if (mayEnter && toAccept.has(f.frame_no + '|' + action)) pick.dataset.accept = '';
			// The lag in the warning colour with a spotted cue ball (UV, 24 Oct),
			// so it never reads as the result.
			if (action === 'lag') { pick.dataset.icon = 'cue'; pick.dataset.tone = 'warning'; }
			// W's knob wears a W, not a tick (UV, 19 Nov): a plain win. Tapping
			// W's chosen stop again clears it.
			if (action === 'win') pick.dataset.icon = 'w';
			pick.dataset.letter = letter;
			// The action and frame tell the page's redraw which live control
			// this is, so its animation carries on (tdc-controls.js).
			pick.dataset.action = action;
			pick.dataset.frame = f.frame_no;
			if (where) pick.dataset.player = where;
			pick.append(
				new Option(teamName(left) + ' ' + words, left, false, value === left),
				new Option('Nobody yet', '', false, !value),
				new Option(teamName(right) + ' ' + words, right, false, value === right));
			if (action === 'win') winStops(pick, f, left, right);
			pick.disabled = !mayEnter;
			pick.setAttribute('aria-label', (action === 'lag' ? 'Lag' : 'Winner') + ', frame ' + f.frame_no);
			line.append(pick);
			cell.append(line);
		}
		return cell;
	}

	// ─── Break & finish and golden break (UV, 29 Oct) ───
	// The special wins the league has on, in the order their switches are
	// drawn under W (UV, 19 Nov; until then a repeat tap on W stepped
	// through them).
	const RESULT_ICON = { break_and_finish: 'bf', golden_break: 'gb', reverse_break_and_finish: 'rbf' };
	const RESULT_MARK = { break_and_finish: 'BF', golden_break: 'GB', reverse_break_and_finish: 'rBF' };
	const RESULT_WORDS = { break_and_finish: 'a break and finish', golden_break: 'a golden break', reverse_break_and_finish: 'a reverse break and finish' };
	function specials() {
		const r = match.rules || {};
		const breaks = !!r.track_breaks;
		const bf = breaks && !!r.break_finish_enabled;
		return [bf && 'break_and_finish', bf && r.golden_break_enabled && 'golden_break',
			breaks && r.reverse_break_finish_enabled && 'reverse_break_and_finish'].filter(Boolean);
	}
	// Which of them fit a frame won by side with the lag where it is. BF and
	// GB go to the side that broke, which on the card is L, under the
	// league's "needs the breaker" (on unless it says off), or the database
	// refuses them (UV: skipped otherwise). rBF is won by the side that did
	// not break, so it needs L on the other side. With L on nobody, only the
	// tick, unless the league does not ask for the breaker (then BF and GB).
	const breakerRule = () => !match.rules || match.rules.break_finish_requires_breaker !== false;
	function fits(event, f, side) {
		if (event === 'reverse_break_and_finish') return !!f.break_side && f.break_side !== side;
		return !breakerRule() || f.break_side === side;
	}
	// The most stops W can gain on one side, for the room kept for it. Under
	// "needs the breaker" BF and GB go to one side and rBF to the other, so
	// whichever is more; without it BF and GB fit either side, so the side
	// that did not break can have them and rBF too.
	function mostSpecialsOneSide() {
		const s = specials();
		const breakerOnes = s.filter((e) => e !== 'reverse_break_and_finish').length;
		const reverse = s.includes('reverse_break_and_finish') ? 1 : 0;
		return breakerRule() ? Math.max(breakerOnes, reverse) : breakerOnes + reverse;
	}

	// The special wins on W's own switch (UV, 19 Nov): once the lag is in,
	// a stop beyond W at each end for every special win that fits that side
	// (fits(): BF and GB the breaker's, rBF the other's), outward from W in
	// specials() order, the knob wearing its letters there. No blank stops
	// (UV, 19 Nov): the switch is as long as what fits, the middle wherever
	// "Nobody yet" falls. A special's value is "side:event".
	function winStops(pick, f, left, right) {
		pick.dataset.icons = 'w bf gb rbf';
		if (!f.break_side) return;
		const at = (side) => specials().filter((e) => fits(e, f, side));
		const l = at(left), r = at(right);
		if (!l.length && !r.length) return;
		const chosen = f.status === 'complete' && RESULT_ICON[f.result_event] && specials().includes(f.result_event)
			&& fits(f.result_event, f, f.winner_side) ? f.winner_side + ':' + f.result_event : null;
		const stop = (side, e) => {
			const o = new Option(teamName(side) + ' won with ' + RESULT_WORDS[e], side + ':' + e, false, chosen === side + ':' + e);
			o.dataset.icon = RESULT_ICON[e];
			o.dataset.letter = RESULT_MARK[e];
			return o;
		};
		const keep = pick.value;
		pick.prepend(...l.map((e) => stop(left, e)).reverse());
		pick.append(...r.map((e) => stop(right, e)));
		// A special chosen is the stop shown; otherwise W's own, as drawn.
		pick.value = chosen || keep;
	}

	// Who could come in as a reserve for a side: anybody active on the team
	// who is not in tonight's order (rule 2). The same test reservePick uses.
	function reservesFor(side) {
		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		const inOrder = new Set(lineup.filter((l) => l.side === side && l.player_id).map((l) => l.player_id));
		return (rosters.get(teamId) || []).filter((r) => r.status === 'active' && !inOrder.has(r.player_id));
	}

	// A team with nobody beyond tonight's order has no reserve picker, which
	// on its own reads as a missing feature (UV, 24 Oct). Said once, per side
	// this person controls, with where to get one.
	function noReserveNote() {
		const mine = lineupState.i_run_it ? ['home', 'away'] : (lineupState.my_side ? [lineupState.my_side] : []);
		const without = mine.filter((side) => !reservesFor(side).length).map(teamName);
		if (!without.length) return '';
		return ' ' + without.join(' and ') + (without.length === 1 ? ' has' : ' have')
			+ ' nobody beyond tonight\'s lineup, so there is no reserve to put in. A captain claims one on the season page; the limit is the team size plus the season\'s reserves.';
	}

	// The reserve picker for one seat of one frame: a captain's own side, or
	// either side for the director. It offers the people rule 2 allows — the
	// position's own player (to undo a reserve) and anybody active on the team
	// who is not in tonight's order. Rules 1 and 3 depend on the rest of the
	// night, so they are left to the database, whose refusal names the rule.
	function reservePick(f, side) {
		if (!lineupState.i_run_it && lineupState.my_side !== side) return null;

		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		const position = side === 'home' ? f.home_position : f.away_position;
		const current = side === 'home' ? f.home_player_id : f.away_player_id;
		const regular = (lineup.find((l) => l.side === side && l.lineup_slot === position) || {}).player_id;
		const back = (rosters.get(teamId) || []).filter((r) => r.player_id === regular && r.status === 'active');
		const choices = back.concat(reservesFor(side)).filter((r) => r.player_id !== current);
		if (!choices.length) return null;

		const pick = document.createElement('select');
		pick.className = 'cs-reserve';
		pick.dataset.control = 'none';   // a list of players, inside a frame row
		pick.dataset.action = 'reserve';
		pick.dataset.frame = f.frame_id;
		pick.setAttribute('aria-label', (current ? 'Reserve for ' : 'Player for ') + teamName(side) + ' in frame ' + f.frame_no);
		pick.append(new Option(current ? 'Reserve…' : 'Who sits here?', '', true, true));
		for (const r of choices) {
			pick.append(new Option(r.display_name + (r.player_id === regular ? ' (back in)' : ''), r.player_id));
		}
		return pick;
	}

	// A captain or the director may record any frame; anybody else only their
	// own. The database enforces this — here it only decides what to draw.
	function canRecord(f) {
		if (lineupState.i_run_it || lineupState.my_side) return true;
		return isMine(f);   // a player their own frame (the player's view)
	}

	// ─── The player's view (UV, 29 Oct) ───
	// Somebody who plays tonight (in a frame or in the order) and is neither
	// a captain of either side nor the league director sees their own frames
	// first, then their own tables, then the result and the signatures as
	// everybody does, read-only. A captain and the director keep the whole
	// card; somebody not in the night sees the card read-only, as before.
	const isMine = (f) => !!myPlayerId && (f.home_player_id === myPlayerId || f.away_player_id === myPlayerId);
	function asPlayer() {
		if (!lineupState || !myPlayerId || lineupState.i_run_it || lineupState.my_side) return false;
		return card.some(isMine) || lineup.some((l) => l.player_id === myPlayerId);
	}
	const sideOf = (f) => (f.home_player_id === myPlayerId ? 'home' : 'away');
	// The viewer's own team tonight: a captain's side, else the side of a
	// frame they play in; nobody's for anyone else.
	function myTeamSide() {
		if (lineupState && lineupState.my_side) return lineupState.my_side;
		const f = card.find(isMine);
		return f ? sideOf(f) : null;
	}
	const otherOf = (side) => (side === 'home' ? 'away' : 'home');

	function renderMine(both) {
		const frames = card.filter(isMine);
		els.mine.hidden = !both || !frames.length;
		if (els.mine.hidden) return;
		const strict = !!(match.rules && match.rules.strict_frame_order);
		const nextOpen = strict ? (card.find((f) => f.status === 'pending') || {}).frame_no : null;
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');

		// Live, the frames block alone; completed, the table alone, headed
		// Your Frames (UV, 17 Nov).
		const done = cardDone();
		els.mineFrames.hidden = done;
		els.mineSessions.hidden = !done;
		if (done) { renderMineTables(frames, sideOf(frames[0])); return; }

		// One block, as a session is drawn: a row per frame, the player at
		// the left with the session and frame under their name, their L and
		// W (their end the left), the opponent at the right.
		const block = node('details', 'cs-session set-group cs-mine');
		block.open = !foldedSessions.has('mine');
		block.addEventListener('toggle', () => {
			if (block.open) foldedSessions.delete('mine'); else foldedSessions.add('mine');
		});
		const won = (mineSide) => frames.filter((f) => f.winner_side === (mineSide ? sideOf(f) : otherOf(sideOf(f)))).length;
		const title = node('summary', 'cs-title', 'Your frames');
		const sc = node('span', 'cs-title-score', won(true) + ' : ' + won(false));
		sc.dataset.live = 'mine|score';
		title.append(sc);
		block.append(title);

		const grid = node('div', 'cs-grid');
		const mySide = sideOf(frames[0]);
		const head = node('div', 'cs-row cs-head');
		head.append(TDC.runName(node('span', 'cs-team cs-home'), teamName(mySide)), TDC.runName(node('span', 'cs-team cs-away'), teamName(otherOf(mySide))));
		grid.append(head);
		for (const f of frames) {
			const me = sideOf(f), them = otherOf(me);
			const mayEnter = f.result_event !== 'default' && !lockedCard && f.home_player_id && f.away_player_id
				&& (!strict || f.frame_no === nextOpen);
			const row = node('div', 'cs-row cs-frame');
			row.append(mineCell(f, me, 'cs-home', 'Session ' + (f.session || 1) + ' · F' + f.frame_no),
				toggles(f, mayEnter, me),
				mineCell(f, them, 'cs-away', (them === 'home' ? 'H' : 'A') + (posOf(f, them) || '')));
			grid.append(row);
		}
		block.append(grid);
		els.mineFrames.replaceChildren(block);
	}

	// One seat on a player's row: the picture and name, a line under it.
	function mineCell(f, side, cls, sub) {
		const cell = node('div', 'cs-player ' + cls + (f.winner_side === side ? ' is-won' : ''));
		const id = side === 'home' ? f.home_player_id : f.away_player_id;
		const name = side === 'home' ? f.home_player : f.away_player;
		const seat = node('span', 'cs-seat');
		seat.append(id ? person(id, name) : node('span', 'cs-empty', 'Empty seat'));
		cell.append(seat, node('span', 'cs-sub', sub + (f.result_event === 'default' && f.winner_side === side ? ' · Walkover' : '')));
		return cell;
	}

	// The player's own table (UV, 29 Oct): by session, a row per frame with
	// who they met. Small, as only their frames are in it. Its head-to-head
	// twin was removed (UV, 12 Nov): with one row it said what this says.
	function renderMineTables(frames, mySide) {
		const won = frames.filter((f) => wonBy(f, mySide)).length;

		const bySes = node('table', 'tdc-table card-players mine-table');
		const shead = node('thead'), sh = node('tr');
		sh.append(node('th', 'cp-label', 'Session'), node('th', 'cp-label', 'Against'), node('th', 'cp-label', 'Frame'));
		shead.append(sh);
		const sbody = node('tbody');
		for (const f of frames) {
			const row = node('tr');
			const them = otherOf(sideOf(f));
			const opp = node('td', 'mine-opp');
			const oid = them === 'home' ? f.home_player_id : f.away_player_id;
			const oname = them === 'home' ? f.home_player : f.away_player;
			opp.append(oid ? person(oid, oname, 'card-person-sm') : node('span', 'cs-empty', 'Empty seat'));
			const cell = node('td', 'cp-cell');
			cell.append(frameMark(f, mySide));
			markEdited(cell, [f]);
			row.append(node('td', 'cp-label', String(f.session || 1)), opp, cell);
			sbody.append(row);
		}
		const sfoot = node('tfoot'), fr = node('tr');
		const lab = node('td', 'cp-label', 'Won');
		lab.colSpan = 2;
		fr.append(lab, node('td', 'num cp-cell', String(won)));
		sfoot.append(fr);
		bySes.append(shead, sbody, sfoot);

		const wrap = (title, table) => {
			const box = node('section', 'h2h-team');
			box.append(node('h3', 'h2h-title lj-heading', title));
			const scroll = node('div', 'table-scroll');
			scroll.append(table);
			box.append(scroll);
			return box;
		};
		els.mineSessions.replaceChildren(wrap('Your Frames', bySes));
	}

	// ─── Every player's frames ───
	// One column per position on each side, headed by the player in it
	// tonight, a row per session, each cell the frame that position played in
	// that session, marked as in the head-to-head tables. Wins counted at the
	// foot.
	//
	// Both views are drawn on every render and the toggle only shows one, so
	// switching needs no redraw.
	function renderPlayers(both) {
		if (!both || !card.length) return;
		const positions = teamSize() || Math.max(0, ...card.map((f) => Math.max(posOf(f, 'home') || 0, posOf(f, 'away') || 0)));
		const range = Array.from({ length: positions }, (_, i) => i + 1);
		renderBySession(positions, range);
		renderHeadToHead(range);
		showView();
	}

	function showView() {
		els.h2hView.hidden = playerView !== 'h2h';
		els.sessionView.hidden = playerView !== 'session';
		for (const b of els.playerViews.querySelectorAll('.cp-view')) {
			b.setAttribute('aria-pressed', String(b.dataset.view === playerView));
		}
	}

	// The player in a position tonight, as a column heading: picture, name
	// and position, one above the other.
	function positionHead(side, pos) {
		const th = node('th', 'cp-player');
		const slot = lineup.find((l) => l.side === side && l.lineup_slot === pos) || {};
		if (slot.player_id) {
			th.append(avatar(slot.player_id, slot.display_name), node('span', 'cp-name', slot.display_name));
		} else {
			th.append(node('span', 'cp-name', 'Empty'));
		}
		th.append(node('span', 'cp-pos', (side === 'home' ? 'H' : 'A') + pos));
		return th;
	}

	// One frame, marked for one side (UV, 28 Oct): a green dot if they won it,
	// a grey cross if they lost it (UV, 17 Nov; empty before), a yellow ring
	// if they won the lag (round the dot or the cross), a dash while it is
	// not played. Both tables use it.
	function frameMark(f, side) {
		const done = f.status === 'complete';
		const win = done && f.winner_side === side;
		const lost = done && !win;
		const lag = f.break_side === side;
		// A break & finish, a golden break or a reverse break & finish: its
		// letters in place of the dot (UV, 29 Oct).
		const special = win && RESULT_MARK[f.result_event];
		const mark = node('span', 'h2h-mark' + (win ? ' is-won' : '') + (lost ? ' is-lost' : '') + (special ? ' is-special' : '') + (lag ? ' is-lag' : '') + (done ? '' : ' is-open'), special || undefined);
		const who = (side === 'home' ? f.home_player : f.away_player) || 'Empty seat';
		const words = 'Frame ' + f.frame_no + ': ' + who + ' '
			+ (win ? (f.result_event === 'default' ? 'won (walkover)' : special ? 'won (' + D.RESULT_EVENT[f.result_event].toLowerCase() + ')' : 'won') : done ? 'lost' : 'not played yet')
			+ (lag ? ', won the lag' : '');
		mark.setAttribute('role', 'img');
		mark.setAttribute('aria-label', words);
		mark.title = words;
		return mark;
	}
	const wonBy = (f, side) => f.status === 'complete' && f.winner_side === side;

	// A table cell holding a frame with an open discrepancy glows blue inside,
	// for everybody (UV, 17 Nov; a change after signing is one).
	function markEdited(td, frames) {
		if (!frames.some((f) => edited.has(f.frame_no))) return;
		td.classList.add('is-edited');
	}

	// ─── Head to head (UV, 28 Oct) ───
	// A table per team. Its players run down the side and are the table's
	// reference: across the top are the other team's players, and each cell is
	// the frame where those two meet, marked for the player down the side. A
	// pairing that does not meet tonight is shaded. A custom rotation may have
	// two meet twice: both frames are in the cell.
	//
	// A reserve is a person here, not a position (UV, 12 Nov): each reserve
	// who played has their own row in their team's table and their own column
	// in the other's, after the positions, so a regular's row holds only the
	// frames they played and every Won belongs to one person. Somebody who
	// filled an empty position counts as a reserve too: they were not in the
	// order.
	function renderHeadToHead(range) {
		const seats = { home: seatsOf('home', range), away: seatsOf('away', range) };

		const tables = ['home', 'away'].map((side) => {
			const other = side === 'home' ? 'away' : 'home';
			const block = node('section', 'h2h-team');
			block.append(node('h3', 'h2h-title lj-heading', teamName(side)));

			const table = node('table', 'tdc-table card-players h2h-table');
			const thead = node('thead');
			const head = node('tr');
			head.append(node('th', 'cp-label h2h-when'));   // empty (UV, 17 Nov; the match's date before)
			for (const c of seats[other]) head.append(c.reserve ? reserveHead(c) : positionHead(other, c.pos));
			head.append(node('th', 'cp-sep h2h-won', 'Won'));
			thead.append(head);

			const tbody = node('tbody');
			for (const r of seats[side]) {
				const tr = node('tr');
				const rowHead = node('th', 'h2h-row');
				rowHead.scope = 'row';
				if (r.reserve) {
					rowHead.append(person(r.id, r.name, 'card-person-sm'), node('span', 'cp-pos', 'Reserve'));
				} else {
					const slot = lineup.find((l) => l.side === side && l.lineup_slot === r.pos) || {};
					rowHead.append(slot.player_id ? person(slot.player_id, slot.display_name, 'card-person-sm') : node('span', 'cs-empty', 'Empty'),
						node('span', 'cp-pos', (side === 'home' ? 'H' : 'A') + r.pos));
				}
				tr.append(rowHead);

				let won = 0;
				for (const c of seats[other]) {
					const td = node('td', 'h2h-cell');
					const frames = card.filter((f) => seatKey(f, side) === r.key && seatKey(f, other) === c.key);
					if (!frames.length) {
						td.classList.add('is-none');
						td.title = 'They do not meet tonight';
					}
					for (const f of frames) {
						if (wonBy(f, side)) won++;
						td.append(frameMark(f, side));
					}
					markEdited(td, frames);
					tr.append(td);
				}
				tr.append(node('td', 'cp-sep cp-score h2h-won', String(won)));
				tbody.append(tr);
			}

			table.append(thead, tbody);
			const scroll = node('div', 'table-scroll');
			scroll.append(table);
			block.append(scroll);
			return block;
		});

		// Full size, scrolling sideways when too wide, the players' column
		// frozen at the left (UV, 17 Nov; it was zoomed down to fit on 16 Nov).
		els.h2hTables.replaceChildren(...tables);
	}

	// Who sat in a frame for a side, and whether they were a reserve: anybody
	// who is not the player locked into that position (playerCell's Reserve
	// badge, and a latecomer in an empty position).
	function seatOf(f, side) {
		const id = side === 'home' ? f.home_player_id : f.away_player_id;
		const name = side === 'home' ? f.home_player : f.away_player;
		const pos = posOf(f, side);
		const regular = (lineup.find((l) => l.side === side && l.lineup_slot === pos) || {}).player_id;
		return { id, name, pos, reserve: !!id && id !== regular };
	}

	// The row or column a frame belongs to: the position's, or the reserve's.
	function seatKey(f, side) {
		const s = seatOf(f, side);
		return s.reserve ? 'r' + s.id : 'p' + s.pos;
	}

	// A side's rows (or columns): its positions, then each reserve who
	// played, in the order of their first frame.
	function seatsOf(side, range) {
		const list = range.map((p) => ({ key: 'p' + p, pos: p }));
		const seen = new Set();
		for (const f of [...card].sort((a, b) => a.frame_no - b.frame_no)) {
			const s = seatOf(f, side);
			if (!s.reserve || seen.has(s.id)) continue;
			seen.add(s.id);
			list.push({ key: 'r' + s.id, id: s.id, name: s.name, reserve: true });
		}
		return list;
	}

	// A reserve as a column heading, as positionHead draws a position.
	function reserveHead(c) {
		const th = node('th', 'cp-player');
		th.append(avatar(c.id, c.name), node('span', 'cp-name', c.name), node('span', 'cp-pos', 'Reserve'));
		return th;
	}

	// ─── By session ───
	function renderBySession(positions, range) {
		const sessions = [...new Set(card.map((f) => f.session || 1))];

		const thead = node('thead');
		const top = node('tr', 'cp-teams');
		top.append(node('th'));
		const homeTh = node('th', 'cp-team', match.home_name); homeTh.colSpan = positions;
		const awayTh = node('th', 'cp-team', match.away_name); awayTh.colSpan = positions;
		top.append(homeTh, node('th', 'cp-sep'), awayTh);
		const names = node('tr');
		names.append(node('th', 'cp-label', 'Sessions'));
		for (const p of range) names.append(positionHead('home', p));
		names.append(node('th', 'cp-sep', 'Score'));
		for (const p of range) names.append(positionHead('away', p));
		thead.append(top, names);

		// The column between the teams is the score: the session's, and the
		// night's in the totals (UV, 24 Oct). Counted from the frames.
		const scoreCell = (frames) => {
			const td = node('td', 'cp-sep cp-score');
			td.append(node('span', null, String(frames.filter((f) => f.winner_side === 'home').length)),
				node('span', 'cp-colon', ':'),
				node('span', null, String(frames.filter((f) => f.winner_side === 'away').length)));
			return td;
		};

		const totals = { home: range.map(() => 0), away: range.map(() => 0) };
		const tbody = node('tbody');
		for (const s of sessions) {
			const tr = node('tr');
			tr.append(node('td', 'cp-label', 'Session ' + s));
			for (const side of ['home', 'away']) {
				if (side === 'away') tr.append(scoreCell(card.filter((x) => (x.session || 1) === s)));
				for (const p of range) {
					const f = card.find((x) => (x.session || 1) === s && posOf(x, side) === p);
					const td = node('td', 'cp-cell');
					if (f) {
						if (wonBy(f, side)) totals[side][p - 1]++;
						// A reserve's frame carries their picture beside the
						// mark (UV, 12 Nov): the column is the position, so
						// its total counts the position's wins, theirs too.
						const seat = seatOf(f, side);
						if (seat.reserve) {
							const pic = avatar(seat.id, seat.name);
							pic.classList.add('cp-reserve');
							pic.title = seat.name + ' (reserve)';
							td.append(pic);
						}
						td.append(frameMark(f, side));
						markEdited(td, [f]);
					} else {
						td.classList.add('is-none');
					}
					tr.append(td);
				}
			}
			tbody.append(tr);
		}

		const tfoot = node('tfoot');
		const foot = node('tr');
		foot.append(node('td', 'cp-label', 'Totals'));
		for (const side of ['home', 'away']) {
			if (side === 'away') foot.append(scoreCell(card));
			for (const n of totals[side]) foot.append(node('td', 'num cp-cell', String(n)));
		}
		tfoot.append(foot);

		els.playerTable.replaceChildren(thead, tbody, tfoot);
	}

	// ─── The result ───
	// The head of the signatures section (UV, 29 Oct: one section in the
	// banner's style, where the result was a banner of its own above it).
	function renderSummary(both) {
		els.signPanel.hidden = !both || !card.length;
		if (els.signPanel.hidden) return;
		const [key] = stateOf(both);
		els.signPanel.className = 'jumbo card-jumbo card-summary sign-form card-state-' + key;

		const home = score('home'), away = score('away');
		els.sumHomeScore.textContent = home;
		els.sumAwayScore.textContent = away;
		els.signPanel.dataset.lead =home > away ? 'home' : away > home ? 'away' : '';

		const played = card.filter((f) => f.status === 'complete').length;
		const walkovers = card.filter((f) => f.result_event === 'default').length;
		const parts = [played + ' of ' + plural(card.length, 'frame') + ' played'];
		if (walkovers) parts.push(plural(walkovers, 'walkover'));
		const settled = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		if (settled) parts.push(home === away ? 'A draw' : teamName(home > away ? 'home' : 'away') + ' win');
		els.sumDetail.textContent = parts.join(' · ');
	}

	// tdc_frame_history reports a change as "winner_side home → away", which
	// is the column name and the stored value. A captain reading what moved on
	// their card should see "Winner: Alpha → Bravo".
	const FIELD = {
		break_side: 'Lag', break_outcome: 'Break outcome', winner_side: 'Winner',
		result_event: 'Result', status: 'Status', abandon_reason: 'Abandoned because',
		referee_player_id: 'Referee', break_player_id: 'Broke'
	};

	// A stored value as a person says it: a side as its team, a result as
	// its words, a frame's status as played or not.
	const STATUS_WORDS = { pending: 'Not played', complete: 'Played', abandoned: 'Abandoned' };
	// A side, in a winner or a lag, is its team and that frame's player
	// (UV, 29 Oct): "Team 0 · Home Player 2".
	function valueText(v, key, frameNo) {
		if (v === 'home' || v === 'away') {
			const f = card.find((x) => x.frame_no === frameNo);
			const who = f && (v === 'home' ? f.home_player : f.away_player);
			return teamName(v) + (who ? ' · ' + who : '');
		}
		if (v === '—') return key === 'winner_side' || key === 'break_side' ? 'Nobody' : '—';
		return STATUS_WORDS[v]
			|| (D.RESULT_EVENT && D.RESULT_EVENT[v])
			|| (D.BREAK_OUTCOME && D.BREAK_OUTCOME[v])
			|| v;
	}

	// A was or now cell: the team on its line, that frame's player under it,
	// so neither breaks mid-name on a phone.
	function teamAndPlayer(cls, text) {
		const td = node('td', cls);
		const at = text.indexOf(' · ');
		if (at < 0) { td.textContent = text; return td; }
		td.append(node('span', 'cl-team', text.slice(0, at)), node('span', 'cl-player', text.slice(at + 3)));
		return td;
	}

	// One change as rows of the list's table (UV, 29 Oct: frame, what, was,
	// now): each field that moved, or the action alone for a frame added or
	// removed. The status, and a plain win, follow from the winner, so they
	// are left out when the winner moved with them.
	function fieldsOf(c) {
		if (!c.changed || !c.changed.includes(' → ')) return [{ what: c.changed || c.action, was: '', now: '' }];
		const parts = c.changed.split(', ').map((part) => {
			const key = Object.keys(FIELD).find((k) => part.startsWith(k + ' '));
			if (!key) return { what: part, was: '', now: '' };
			const [was, now] = part.slice(key.length + 1).split(' → ');
			return { key, raw: [was, now], what: FIELD[key], was: valueText(was, key, c.frame_no), now: valueText(now, key, c.frame_no) };
		});
		const winner = parts.some((p) => p.key === 'winner_side');
		const plain = (p) => p.key === 'result_event' && p.raw.every((v) => v === 'win' || v === '—');
		return parts.filter((p) => !(winner && (p.key === 'status' || plain(p))));
	}

	// What a signature was given as, after the name. Signatures from before
	// 29 Oct were filled in by the migration, so none should be missing.
	const signedAs = (g) => (g.signed_as === 'director' ? ' · league director'
		: g.signed_as === 'captain' ? ' · captain' : '');

	// ─── Signatures ───
	// Under the result and the frames, in the same section: the league and
	// the date at its top, a line for each captain's signature under their
	// team, whether anything is disputed, then the buttons.
	function renderSignatures(both) {
		if (els.signPanel.hidden) return;   // renderSummary decides
		sheetReady = null;   // the card was read again: a picture made before is out of date
		preloadSheet();

		// The league's shield, its name, then a line each for the season, the
		// venues (links, as in the banner), the date and the round (UV, 17 Nov;
		// one line joined by dots before).
		els.sfPic.replaceChildren(TDC.leaguePic(seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path, ''));
		els.sfLeague.textContent = info ? info.league_name : '';
		els.sfSeason.textContent = (info && info.name) || '';
		els.sfSeason.hidden = !els.sfSeason.textContent;
		els.sfVenue.replaceChildren();
		venues.forEach((v, i) => { if (i) els.sfVenue.append(', '); els.sfVenue.append(TDC.venueLink(v)); });
		els.sfVenue.hidden = !venues.length;
		els.sfDate.textContent = match.scheduled_at
			? new Date(match.scheduled_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
			: 'No date set';
		els.sfRound.textContent = fixture && fixture.round ? 'Round ' + fixture.round : '';
		els.sfRound.hidden = !els.sfRound.textContent;

		const sides = (cardState && cardState.sides) || {};
		const sigLine = (side, line, cap) => {
			const s = sides[side];
			line.className = 'sf-line' + (!s ? ' is-empty' : s.current ? ' is-signed' : ' is-stale');
			line.replaceChildren();
			if (s) {
				// Who signed and as what: a director's signature never reads as
				// the team's own (UV, 29 Oct). The latest per side is the one
				// the card state reports.
				const g = signatures.find((x) => x.side === side);
				line.append(node('span', 'sf-signed', 'Signed'));
				if (g) line.append(node('span', 'sf-when', g.by_name + signedAs(g)));
				line.append(node('span', 'sf-when', when(s.at) + (s.current ? '' : ' · the card changed since')));
			}
			const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
			const captains = (rosters.get(teamId) || []).filter((r) => r.is_captain);
			cap.replaceChildren();
			if (captains.length) {
				cap.append(node('span', 'sf-cap-label', captains.length === 1 ? 'Captain' : 'Captains'));
				for (const c of captains) cap.append(person(c.player_id, c.display_name, 'card-person-sm'));
			} else {
				cap.append(node('span', 'sf-cap-label', 'Captain'));
			}
		};
		sigLine('home', els.sfHomeSig, els.sfHomeCap);
		sigLine('away', els.sfAwaySig, els.sfAwayCap);

		const state = cardState && cardState.state;
		els.sfDispute.className = 'sf-note' + (state === 'disputed' ? ' is-disputed' : '');
		els.sfDispute.textContent = state === 'disputed'
			? 'Disputed: ' + (cardState.note || 'no reason given') + '. The card is open again.'
			: 'No disputes raised on this card.';

		// Folded until opened (UV, 29 Oct), its count in the heading. Only the
		// list is redrawn, so it stays open or closed as the reader left it.
		// One group per signature, newest first, each holding the changes made
		// after it and before the next (UV, 29 Oct): the top group is what is
		// still to be signed. A change is rows of Frame · Change · Was · Now,
		// with who made it (the league director said so) and when under them.
		// Hidden while it has nothing in it (UV, 11 Nov).
		els.changedSince.hidden = !signatures.length || !changes.length;
		els.changedCount.textContent = changes.length;
		// Each group folds on its own (UV, 29 Oct): the newest open, the rest
		// closed, each as the reader left it through every redraw.
		const groups = signatures.map((g, i) => {
			const from = new Date(g.at), to = i ? new Date(signatures[i - 1].at) : null;
			const mine = changes.filter((c) => new Date(c.at) > from && (!to || new Date(c.at) <= to));
			const box = node('details', 'cl-group set-group');
			const key = g.side + '|' + g.at;
			box.open = clOpen.has(key) ? clOpen.get(key) : i === 0;
			box.addEventListener('toggle', () => clOpen.set(key, box.open));
			const head = node('summary', 'cl-head');
			const who = node('strong');
			who.append(teamName(g.side) + ' signed');
			head.append(who,
				node('span', 'cl-by', g.by_name + signedAs(g) + ' · ' + when(g.at)),
				node('span', 'cl-count', mine.length === 1 ? '1 change' : mine.length + ' changes'));
			box.append(head);
			if (!mine.length) {
				box.append(node('p', 'cl-none', i ? 'Nothing changed before the next signature.' : 'Nothing has changed since.'));
				return box;
			}
			box.append(node('p', 'cl-since', i ? 'Changed before the next signature:' : 'Changed since, still to be signed:'));
			const table = node('table', 'cl-table');
			const hrow = node('tr');
			for (const h of ['Frame', 'Change', 'Was', 'Now']) hrow.append(node('th', null, h));
			table.append(node('thead'));
			table.tHead.append(hrow);
			const body = node('tbody');
			for (const c of mine) {
				for (const [k, f] of fieldsOf(c).entries()) {
					const tr = node('tr', 'cl-change' + (f.key === 'break_side' ? ' is-lag' : f.key === 'winner_side' ? ' is-win' : ''));
					tr.append(node('td', 'num', k ? '' : String(c.frame_no)), node('td', 'cl-what', f.what),
						teamAndPlayer('cl-was', f.was), teamAndPlayer('cl-now', f.now));
					body.append(tr);
				}
				const who = node('tr', 'cl-who');
				const td = node('td', null, (c.by_name || 'somebody') + (c.editor_role === 'director' ? ' · league director' : '') + ' · ' + when(c.at));
				td.colSpan = 4;
				who.append(td);
				body.append(who);
			}
			table.append(body);
			box.append(table);
			return box;
		});
		els.changedList.replaceChildren(...groups);

		// A button for each side this person may sign whose signature does not
		// stand: a captain their own, the league director both (UV, 29 Oct).
		// It used to sign for the side being set up, whose switch hides once
		// both lineups are locked, so a director could only ever sign one.
		const open = state !== 'approved' && state !== 'agreed';
		for (const [btn, side] of [[els.signHome, 'home'], [els.signAway, 'away']]) {
			const s = sides[side];
			btn.hidden = !(open && (lineupState.i_run_it || lineupState.my_side === side) && !(s && s.current));
			btn.textContent = (s && !s.current ? 'Sign again for ' : 'Sign and submit for ') + teamName(side);
		}
		els.disputeBtn.hidden = !working || state === 'approved';
	}

	// ─── The scoresheet as a picture (UV, 19 Nov) ───
	// The picture button in the signatures section's corner saves or shares a
	// picture of the card as it stands, laid out as Billiard Café's paper
	// scoresheet: a row per frame (position, player, B/F, lag, point, the
	// frame, then the same mirrored for away), each session's total, the
	// total points and the two signatures, in the site's colours and fonts.
	// Drawn on a canvas from the card's own data, not a screenshot of the
	// page, which shows head to head and not a sheet. On a phone (a touch
	// screen) the share sheet opens with it (Save to Photos, WhatsApp); with a
	// mouse it downloads. A phone shares only soon after the tap, so the
	// pictures and fonts are fetched while the page draws; a picture made too
	// late to share waits for a second tap.
	const SHEET_W = 1200, SHEET_SCALE = 2;   // 2,400 pixels wide
	const sheetImages = new Map();   // url -> Promise of the loaded image, or null
	let sheetFontsLoad = null;
	let sheetReady = null;           // a picture made but not yet shared: { file, title }

	const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

	function sheetImage(url) {
		if (!url) return Promise.resolve(null);
		if (!sheetImages.has(url)) {
			sheetImages.set(url, new Promise((resolve) => {
				const img = new Image();
				img.crossOrigin = 'anonymous';   // the buckets are public; without it the canvas could not be saved
				img.onload = () => resolve(img);
				img.onerror = () => { sheetImages.delete(url); resolve(null); };   // tried again next time
				img.src = url;
			}));
		}
		return sheetImages.get(url);
	}
	function sheetFonts() {
		if (!sheetFontsLoad) {
			const display = cssVar('--font-display', 'sans-serif'), body = cssVar('--font-body', 'sans-serif');
			sheetFontsLoad = Promise.all([
				document.fonts.load('40px ' + display), document.fonts.load('400 20px ' + body),
				document.fonts.load('600 20px ' + body), document.fonts.load('800 20px ' + body)
			]).catch((err) => {
				sheetFontsLoad = null;
				console.error('[' + AREA + '] the scoresheet picture\'s fonts did not load; it is drawn in the fallback font.', err);
			});
		}
		return sheetFontsLoad;
	}
	const sheetUrls = () => ({
		league: TDC.pictureUrl('league-pictures', seasonRow && seasonRow.tbl_leagues && seasonRow.tbl_leagues.picture_path),
		home: TDC.pictureUrl('team-pictures', match.home_picture),
		away: TDC.pictureUrl('team-pictures', match.away_picture)
	});
	function preloadSheet() {
		const u = sheetUrls();
		sheetFonts();
		sheetImage(u.league); sheetImage(u.home); sheetImage(u.away);
	}

	async function drawSheet() {
		const C = {
			bg: cssVar('--bg-base', '#202020'), text: cssVar('--text-primary', '#f4e8d2'), muted: cssVar('--text-muted', '#808080'),
			primary: cssVar('--color-primary', '#61ffad'), warning: cssVar('--color-warning', '#ffae00'),
			error: cssVar('--color-error', '#ff0000'), line: cssVar('--border-color', '#404040')
		};
		const DISPLAY = cssVar('--font-display', 'sans-serif'), BODY = cssVar('--font-body', 'sans-serif');
		const urls = sheetUrls();
		const [, leagueImg, homeImg, awayImg] = await Promise.all([sheetFonts(), sheetImage(urls.league), sheetImage(urls.home), sheetImage(urls.away)]);
		const lost = [[urls.league, leagueImg], [urls.home, homeImg], [urls.away, awayImg]].filter(([u, i]) => u && !i).map(([u]) => u);
		if (lost.length) TDC.error(AREA, 'a picture could not be drawn into the scoresheet, so its outline is there instead.', { lost }, els.status);

		// The layout, in the picture's own pixels before the scale.
		const PAD = 48, W = SHEET_W, IN = W - PAD * 2;
		const ROW = 46, HEAD = 44, TOTAL = 44, GRAND = 58, PIC = 104, SHIELD = 56, SIG = 120;
		const TEAMW = 340;   // each team's picture and name, out at the sides so the score can be tall
		const COLS = { seq: 64, name: 268, bf: 66, lag: 60, p: 56 };
		const HALF = COLS.seq + COLS.name + COLS.bf + COLS.lag + COLS.p;
		const FR = IN - HALF * 2;
		const sessions = [...new Set(card.map((f) => f.session || 1))].sort((a, b) => a - b);
		const framesOf = (s) => card.filter((f) => (f.session || 1) === s).sort((a, b) => a.frame_no - b.frame_no);
		const dateText = match.scheduled_at
			? new Date(match.scheduled_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
			: 'No date set';
		// The league's shield beside its name, and the round and date on one
		// line (UV, 19 Nov).
		const lines = [
			['league', (info && info.league_name) || ''],
			info && info.name ? ['season', info.name] : null,
			venues.length ? ['venue', venues.map((x) => x.name).join(', ')] : null,
			['when', dateText]
		].filter(Boolean);
		const LINE = {
			league: { h: 72, size: 38, display: true },
			season: { h: 32, size: 22 },
			venue: { h: 32, size: 22, color: C.primary },
			when: { h: 32, size: 20, weight: 400, color: C.muted }
		};
		const disputed = cardState && cardState.state === 'disputed';
		const tableIn = HEAD + sessions.reduce((n, s) => n + framesOf(s).length * ROW + TOTAL, 0) + GRAND;
		const H = PAD
			+ lines.reduce((n, [k]) => n + LINE[k].h, 0) + 30                  // the league
			+ PIC + 14 + 40 + 30 + 34                                          // the teams and the score
			+ tableIn + 40                                                     // the sheet
			+ 30 + SIG + 12                                                    // the signatures
			+ (disputed ? 34 : 0) + 40 + PAD;                                  // a dispute, the foot

		const canvas = document.createElement('canvas');
		canvas.width = W * SHEET_SCALE;
		canvas.height = H * SHEET_SCALE;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('this browser would not give us a canvas to draw the scoresheet on');
		ctx.scale(SHEET_SCALE, SHEET_SCALE);
		ctx.fillStyle = C.bg;
		ctx.fillRect(0, 0, W, H);
		// The site's green glow from above the top (UV, 19 Nov; global.css,
		// body::before): green at a centre --page-glow-rise above the top,
		// fading to the background over --page-glow-size.
		{
			const glowR = parseFloat(cssVar('--page-glow-size', '1000')) || 1000;
			const glowRise = parseFloat(cssVar('--page-glow-rise', '760')) || 760;
			const glow = ctx.createRadialGradient(W / 2, -glowRise, 0, W / 2, -glowRise, glowR);
			glow.addColorStop(0, C.primary);
			glow.addColorStop(1, C.bg);
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, W, H);
		}

		const font = (size, display, weight) => (weight || (display ? 400 : 600)) + ' ' + size + 'px ' + (display ? DISPLAY : BODY);
		function fit(text, max) {
			if (ctx.measureText(text).width <= max) return text;
			let t = text;
			while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
			return t.trimEnd() + '…';
		}
		// Text at (x, y), its middle on y; returns its width. A glow is drawn
		// twice for strength (shadowBlur ignores the scale, hence the factor).
		function say(text, x, y, { size = 20, display = false, weight, color = C.text, align = 'center', max, glow, spacing } = {}) {
			ctx.save();
			ctx.font = font(size, display, weight);
			ctx.fillStyle = color;
			ctx.textAlign = align;
			ctx.textBaseline = 'middle';
			if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
			const t = max ? fit(String(text), max) : String(text);
			if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10 * SHEET_SCALE; ctx.fillText(t, x, y); }
			ctx.fillText(t, x, y);
			const w = ctx.measureText(t).width;
			ctx.restore();
			return w;
		}
		function rrect(x, y, w, h, r) {
			ctx.beginPath();
			ctx.moveTo(x + r, y);
			ctx.arcTo(x + w, y, x + w, y + h, r);
			ctx.arcTo(x + w, y + h, x, y + h, r);
			ctx.arcTo(x, y + h, x, y, r);
			ctx.arcTo(x, y, x + w, y, r);
			ctx.closePath();
		}
		function band(y, h, color, alpha) {
			ctx.save();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = color;
			ctx.fillRect(PAD, y, IN, h);
			ctx.restore();
		}
		// A picture in the site's shield or hexagon (TDC.SHAPES), or the shape's
		// outline alone when there is no picture.
		function shapedPic(img, kind, cx, top, size) {
			const path = new Path2D(TDC.SHAPES[kind]);
			ctx.save();
			ctx.translate(cx - size / 2, top);
			ctx.scale(size / 100, size / 100);
			if (img) {
				ctx.save();
				ctx.clip(path);
				const k = Math.max(100 / img.naturalWidth, 100 / img.naturalHeight);
				const w = img.naturalWidth * k, h = img.naturalHeight * k;
				ctx.drawImage(img, (100 - w) / 2, (100 - h) / 2, w, h);
				ctx.restore();
			}
			ctx.lineWidth = (img ? 2 : 3) * 100 / size;
			ctx.strokeStyle = img ? C.line : C.primary;
			ctx.stroke(path);
			ctx.restore();
		}

		// Several pieces of text, each its own colour, centred together on x.
		function sayParts(parts, x, y, opts) {
			ctx.font = font(opts.size, opts.display, opts.weight);
			const widths = parts.map(([t]) => ctx.measureText(t).width);
			let px = x - widths.reduce((a, b) => a + b, 0) / 2;
			parts.forEach(([t, c], i) => { say(t, px, y, { ...opts, color: c, align: 'left' }); px += widths[i]; });
		}
		// A badge: the site's small sunken pill, its words in its colour.
		function pill(text, x, y, color, glow) {
			ctx.font = font(16, false, 700);
			const w = ctx.measureText(text).width + 36, h = 34;
			rrect(x, y - h / 2, w, h, h / 2);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = C.line;
			ctx.stroke();
			say(text, x + w / 2, y, { size: 16, weight: 700, color, glow: glow ? color : undefined });
			return w;
		}
		const pillWidth = (text) => { ctx.font = font(16, false, 700); return ctx.measureText(text).width + 36; };

		// The league: its shield beside its name, then a line each.
		let y = PAD;
		for (const [k, t] of lines) {
			const s = LINE[k];
			if (k === 'league') {
				ctx.font = font(s.size, true);
				const nameW = Math.min(ctx.measureText(t).width, IN - SHIELD - 16);
				const x0 = W / 2 - (SHIELD + (t ? 16 + nameW : 0)) / 2;
				shapedPic(leagueImg, 'shield', x0 + SHIELD / 2, y + (s.h - SHIELD) / 2, SHIELD);
				if (t) say(t, x0 + SHIELD + 16, y + s.h / 2, { size: s.size, display: true, align: 'left', max: IN - SHIELD - 16 });
			} else if (k === 'when' && fixture && fixture.round) {
				sayParts([['Round ' + fixture.round, C.primary], [' · ', C.muted], [t, C.muted]], W / 2, y + s.h / 2, { size: s.size });
			} else {
				say(t, W / 2, y + s.h / 2, { size: s.size, display: s.display, weight: s.weight, color: s.color || C.text, max: IN });
			}
			y += s.h;
		}
		y += 30;

		// The two teams out at the sides; the score between them as tall as a
		// picture and its name together (UV, 19 Nov), the leader's number green.
		const homeX = PAD + TEAMW / 2, awayX = W - PAD - TEAMW / 2;
		for (const [side, x, img] of [['home', homeX, homeImg], ['away', awayX, awayImg]]) {
			shapedPic(img, 'hexagon', x, y, PIC);
			say(teamName(side), x, y + PIC + 14 + 20, { size: 28, display: true, max: TEAMW - 20 });
		}
		const hs = score('home'), as = score('away');
		{
			const top = y, tall = PIC + 14 + 34;   // the picture's top to the name's foot
			const room = IN - TEAMW * 2 - 40;
			const digits = [String(hs), ':', String(as)];
			ctx.font = font(100, true);
			const m = ctx.measureText('0123456789');
			const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
			const gapOf = (size) => size * 0.12;
			const widthAt = (size) => { ctx.font = font(size, true); return digits.reduce((n, t) => n + ctx.measureText(t).width, 0) + gapOf(size) * 2; };
			let size = 100 * tall / glyphH;
			if (widthAt(size) > room) size *= room / widthAt(size);
			const base = top + (tall + m.actualBoundingBoxAscent * size / 100 - m.actualBoundingBoxDescent * size / 100) / 2;
			const colors = [hs > as ? C.primary : C.text, C.muted, as > hs ? C.primary : C.text];
			ctx.save();
			ctx.font = font(size, true);
			ctx.textAlign = 'left';
			ctx.textBaseline = 'alphabetic';
			let sx = W / 2 - widthAt(size) / 2;
			ctx.font = font(size, true);
			digits.forEach((t, i) => {
				ctx.fillStyle = colors[i];
				ctx.fillText(t, sx, base);
				sx += ctx.measureText(t).width + (i < 2 ? gapOf(size) : 0);
			});
			ctx.restore();
		}
		// Under it, the card's state and its frames as badges (UV, 19 Nov),
		// the state in the banner's colour.
		const [stateKey, stateLabel] = stateOf(true);
		const STATE_COLOR = { approved: C.muted, agreed: C.primary, disputed: C.error };
		const played = card.filter((f) => f.status === 'complete').length;
		const badges = [
			[stateLabel, STATE_COLOR[stateKey] || C.warning, stateKey !== 'approved' && stateKey !== 'disputed'],
			[played + '/' + plural(card.length, 'frame'), played === card.length ? C.primary : C.warning, false]
		];
		const badgeY = y + PIC + 14 + 40 + 15 + 6;
		let bx = W / 2 - (badges.reduce((n, [t]) => n + pillWidth(t), 0) + 12 * (badges.length - 1)) / 2;
		for (const [t, c, g] of badges) bx += pill(t, bx, badgeY, c, g) + 12;
		y += PIC + 14 + 40 + 30 + 34;

		// The sheet: a sunken panel, the columns' heads, a row per frame.
		rrect(PAD - 12, y - 8, IN + 24, tableIn + 16, 18);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = C.line;
		ctx.stroke();

		const col = {};   // 'home.name' -> [x, width]
		let cx = PAD;
		for (const k of ['seq', 'name', 'bf', 'lag', 'p']) { col['home.' + k] = [cx, COLS[k]]; cx += COLS[k]; }
		const frX = cx;
		cx += FR;
		for (const k of ['p', 'lag', 'bf', 'name', 'seq']) { col['away.' + k] = [cx, COLS[k]]; cx += COLS[k]; }
		const mid = (side, k) => col[side + '.' + k][0] + col[side + '.' + k][1] / 2;
		function dot(x, at, color) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(x, at, 8, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.shadowColor = color;
			ctx.shadowBlur = 8 * SHEET_SCALE;
			ctx.fill();
			ctx.restore();
		}
		const hline = (at, color, alpha) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(PAD, at - 0.5, IN, 1); ctx.restore(); };

		const HEADS = { seq: 'SEQ', name: 'PLAYER', bf: 'B/F', lag: 'LAG', p: 'P' };
		for (const side of ['home', 'away']) {
			for (const k of Object.keys(HEADS)) say(HEADS[k], mid(side, k), y + HEAD / 2, { size: 15, weight: 700, color: C.muted, spacing: 1.5 });
		}
		say('FR', frX + FR / 2, y + HEAD / 2, { size: 15, weight: 700, color: C.muted, spacing: 1.5 });
		y += HEAD;
		hline(y, C.line, 1);

		const totals = { home: 0, away: 0 }, lags = { home: 0, away: 0 };
		for (const s of sessions) {
			const frames = framesOf(s);
			for (const f of frames) {
				const done = f.status === 'complete';
				const rowMid = y + ROW / 2;
				for (const side of ['home', 'away']) {
					const seat = seatOf(f, side);
					const won = done && f.winner_side === side;
					if (won) totals[side]++;
					// The position as H1 or A1 (UV, 19 Nov).
					say(seat.pos ? (side === 'home' ? 'H' : 'A') + seat.pos : '', mid(side, 'seq'), rowMid, { size: 18, color: C.muted });
					// The player who played it, a reserve marked as one.
					const [nx, nw] = col[side + '.name'];
					if (seat.name) {
						ctx.font = font(15, false, 400);
						const tag = seat.reserve ? ' · reserve' : '';
						const tagW = tag ? ctx.measureText(tag).width : 0;
						ctx.font = font(19);
						const name = fit(seat.name, nw - 20 - tagW);
						const w1 = ctx.measureText(name).width;
						const x0 = nx + nw / 2 - (w1 + tagW) / 2;
						say(name, x0, rowMid, { size: 19, align: 'left' });
						if (tag) say(tag, x0 + w1, rowMid, { size: 15, weight: 400, color: C.muted, align: 'left' });
					} else {
						say('Empty seat', nx + nw / 2, rowMid, { size: 17, weight: 400, color: C.muted });
					}
					// B/F: the special win's letters, green glowing yellow as on the page.
					if (won && RESULT_MARK[f.result_event]) {
						say(RESULT_MARK[f.result_event], mid(side, 'bf'), rowMid, { size: 20, weight: 800, color: C.primary, glow: C.warning });
					} else if (won && f.result_event === 'default') {
						say('WO', mid(side, 'bf'), rowMid, { size: 15, weight: 700, color: C.muted });
					}
					// LAG: a yellow dot for the side that won it.
					if (f.break_side === side) dot(mid(side, 'lag'), rowMid, C.warning);
					// P: a green dot for the side that won it, nothing for a loss (UV, 19 Nov).
					if (won) dot(mid(side, 'p'), rowMid, C.primary);
					else if (f.status === 'abandoned') say('–', mid(side, 'p'), rowMid, { size: 22, color: C.muted });
				}
				// The frame, green once played.
				rrect(frX + 10, y + 8, FR - 20, ROW - 16, 8);
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = done ? C.primary : C.line;
				ctx.stroke();
				say('F' + f.frame_no, frX + FR / 2, rowMid, { size: 16, weight: 700, color: done ? C.primary : C.muted });
				y += ROW;
				hline(y, C.muted, 0.18);
			}
			// The session's row (UV, 19 Nov): its name in the middle, each side's
			// frames won under P (the winner's green) and lags won under LAG, grey.
			band(y, TOTAL, C.primary, 0.08);
			const won = { home: frames.filter((f) => f.winner_side === 'home').length, away: frames.filter((f) => f.winner_side === 'away').length };
			const lagsWon = (side) => frames.filter((f) => f.break_side === side).length;
			say('SESSION ' + s, frX + FR / 2, y + TOTAL / 2, { size: 14, weight: 700, color: C.muted, spacing: 1 });
			for (const side of ['home', 'away']) {
				const other = side === 'home' ? 'away' : 'home';
				lags[side] += lagsWon(side);
				say(String(lagsWon(side)), mid(side, 'lag'), y + TOTAL / 2, { size: 22, display: true, color: C.muted });
				say(String(won[side]), mid(side, 'p'), y + TOTAL / 2, { size: 26, display: true, color: won[side] > won[other] ? C.primary : C.text });
			}
			y += TOTAL;
			hline(y, C.line, 1);
		}
		// The night's row, laid out as a session's: TOTAL in the middle.
		band(y, GRAND, C.primary, 0.14);
		say('TOTAL', frX + FR / 2, y + GRAND / 2, { size: 17, weight: 800, spacing: 2 });
		for (const side of ['home', 'away']) {
			const other = side === 'home' ? 'away' : 'home';
			say(String(lags[side]), mid(side, 'lag'), y + GRAND / 2, { size: 28, display: true, color: C.muted });
			say(String(totals[side]), mid(side, 'p'), y + GRAND / 2, { size: 34, display: true, color: totals[side] > totals[other] ? C.primary : C.text });
		}
		y += GRAND + 40;

		// The signatures: a box under each team, green while it stands.
		say('SIGNATURES', W / 2, y + 10, { size: 15, weight: 700, color: C.muted, spacing: 2 });
		y += 30;
		const sides = (cardState && cardState.sides) || {};
		for (const [side, x0] of [['home', PAD], ['away', W - PAD - HALF]]) {
			const s = sides[side];
			const g = signatures.find((x) => x.side === side);
			const cxm = x0 + HALF / 2;
			rrect(x0, y, HALF, SIG, 16);
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = s && s.current ? C.primary : C.line;
			ctx.stroke();
			say((side === 'home' ? 'HOME' : 'AWAY') + ' SIGNATURE', cxm, y + 22, { size: 14, weight: 700, color: C.muted, spacing: 1.5 });
			say(teamName(side), cxm, y + 50, { size: 22, display: true, max: HALF - 32 });
			if (s) {
				say('Signed' + (g ? ' by ' + g.by_name + signedAs(g) : ''), cxm, y + 79, { size: 18, color: s.current ? C.primary : C.text, max: HALF - 32 });
				say(when(s.at) + (s.current ? '' : ' · the card changed since'), cxm, y + 102, { size: 16, weight: 400, color: C.muted, max: HALF - 32 });
			} else {
				say('Not signed', cxm, y + 86, { size: 18, weight: 400, color: C.muted });
			}
		}
		y += SIG + 12;

		if (disputed) {
			say('Disputed: ' + (cardState.note || 'no reason given'), W / 2, y + 17, { size: 18, color: C.error, max: IN });
			y += 34;
		}
		// When it was taken: a picture of the card as it stood then.
		say('thediveclub.org · as it stood ' + when(new Date().toISOString()), W / 2, y + 22, { size: 15, weight: 400, color: C.muted });
		return canvas;
	}

	// The file's name: the league, the round and the teams.
	function sheetName() {
		const slug = (t) => String(t || '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
		return [info && info.league_name, fixture && fixture.round ? 'R' + fixture.round : '', match.home_name, 'v', match.away_name]
			.map(slug).filter(Boolean).join('-') + '.png';
	}
	async function makeSheet() {
		const canvas = await drawSheet();
		const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
		if (!blob) throw new Error('the browser would not turn the canvas into a picture');
		return { file: new File([blob], sheetName(), { type: 'image/png' }), title: document.title };
	}
	// A touch screen shares it; a mouse downloads it (a computer's share
	// sheet has no plain "save").
	async function giveSheet(sheet) {
		const touch = matchMedia('(pointer: coarse)').matches;
		if (touch && navigator.canShare && navigator.canShare({ files: [sheet.file] })) {
			await navigator.share({ files: [sheet.file], title: sheet.title });
			return;
		}
		const url = URL.createObjectURL(sheet.file);
		const a = document.createElement('a');
		a.href = url;
		a.download = sheet.file.name;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10000);
		TDC.status(els.status, 'Scoresheet saved: ' + sheet.file.name, 'success');
	}
	async function shareSheet(sheet) {
		try {
			await giveSheet(sheet);
		} catch (err) {
			if (err && err.name === 'AbortError') return;   // the share sheet closed
			if (err && err.name === 'NotAllowedError') {
				// Made too long after the tap for the phone to allow it.
				sheetReady = sheet;
				TDC.status(els.status, 'The scoresheet picture is ready: tap the picture button again to share it.', 'success');
				return;
			}
			TDC.error(AREA, 'the scoresheet picture could not be shared or saved.', err, els.status);
		}
	}
	async function sheetClicked() {
		if (!match || !card.length) return;
		if (sheetReady) {
			const ready = sheetReady;
			sheetReady = null;
			await shareSheet(ready);
			return;
		}
		let sheet;
		try {
			sheet = await TDC.busy(els.sheet, makeSheet(), els.status);
		} catch (err) {
			TDC.error(AREA, 'the scoresheet picture could not be made.', err, els.status);
			return;
		}
		await shareSheet(sheet);
	}

	// ─── Writing ───
	// Queued, never refused (TDC.writer): a captain going down a lineup or
	// recording frame after frame is never told to wait. The card is read
	// again once a burst has saved; a failed save's error is shown after it.
	const cardWriter = TDC.writer({
		area: AREA, status: els.status, reload: loadAll, after: () => TDC.flushPushes()
	});
	const write = (what, fn, done) => cardWriter.write(what, fn, done ? () => done : null);

	// ─── What people press ───
	els.sidePick.addEventListener('change', async () => {
		working = els.sidePick.value;
		await loadAll();
	});

	// The banner's arrow, under the ":" in the teams' row (UV, 18 Nov): it
	// presses the details' own heading, so the site's fold (tdc-controls.js)
	// opens and closes them as before; that heading stays, with no height.
	els.moreBtn.addEventListener('click', () => els.jumboMore.querySelector(':scope > summary').click());
	els.jumboMore.addEventListener('toggle', () => els.moreBtn.setAttribute('aria-expanded', String(els.jumboMore.open)));

	// The arrows (UV, 18 Nov): up swaps a player with the one above, down with
	// the one below, across the line between positions and reserves too.
	// Nothing is sent until the lock (UV, 12 Nov). And Scorecard · Stats (UV,
	// 18 Nov): switched in place, so the thumb slides and nothing is redrawn.
	els.teamTables.addEventListener('click', (e) => {
		const v = e.target.closest('button[data-lu-view]');
		if (v) {
			const box = v.closest('.lu-team');
			if (drag) endDrag(false);
			luView.set(box.dataset.side, v.dataset.luView);
			box.dataset.view = v.dataset.luView;
			for (const b of box.querySelectorAll('button[data-lu-view]')) b.setAttribute('aria-pressed', b === v ? 'true' : 'false');
			return;
		}
		const b = e.target.closest('.lu-team.is-managing button[data-action^="move-"]');
		if (!b) return;
		const id = b.closest('tr').dataset.player;
		const list = orderFor(working).slice();
		const i = list.indexOf(id);
		const j = i + (b.dataset.action === 'move-up' ? -1 : 1);
		if (i < 0 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		setOrder(list);
	});

	// Dragging a player through the order (UV, 18 Nov): a green line shows
	// where they will land. A mouse drags at once; a finger holds still for a
	// moment first (DRAG_HOLD_MS), so a swipe across the table still scrolls
	// the page. Dropped, the player is taken out and put in at the line.
	const DRAG_HOLD_MS = 280;
	const DRAG_SLOP = 8;   // px a finger may wander while holding; a mouse moves this far to start
	let drag = null;       // { id, row, x, y0 (where it started), y (now), pointer, active, timer, gap }

	const movableRows = () => [...els.teamTables.querySelectorAll('.lu-team.is-managing tr.lu-order-row')];

	function endDrag(drop) {
		if (!drag) return;
		const d = drag;
		drag = null;
		clearTimeout(d.timer);
		for (const tr of els.teamTables.querySelectorAll('tr')) tr.classList.remove('is-dragging', 'lu-drop-before', 'lu-drop-after');
		document.documentElement.classList.remove('lu-dragging');
		if (!d.active) return;
		// The click that ends a drag must not open the profile of the picture
		// it started on. Taken off again at once if no click comes, so the
		// next real tap is never eaten.
		const eat = (e) => { e.stopPropagation(); e.preventDefault(); };
		window.addEventListener('click', eat, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 60);
		if (!drop || d.gap === undefined) return;
		const list = orderFor(working).slice();
		const i = list.indexOf(d.id);
		if (i < 0 || d.gap === i || d.gap === i + 1) return;
		list.splice(i, 1);
		list.splice(d.gap > i ? d.gap - 1 : d.gap, 0, d.id);
		setOrder(list);
	}

	// Where the player would land: the gap before the row whose middle is
	// below the pointer (the gap after the last row if none is).
	function showDrop(y) {
		const rows = movableRows();
		let gap = rows.length;
		for (let k = 0; k < rows.length; k++) {
			const r = rows[k].getBoundingClientRect();
			if (y < r.top + r.height / 2) { gap = k; break; }
		}
		const from = rows.findIndex((tr) => tr.dataset.player === drag.id);
		for (const tr of rows) tr.classList.remove('lu-drop-before', 'lu-drop-after');
		drag.gap = gap;
		if (gap === from || gap === from + 1) return;   // where they are already
		// At the Reserves label the line goes where the player will land: from
		// above they become the last position (the line over the label), from
		// below they stay the first reserve (under it).
		const n = positionsOf(working);
		if (gap === n && n < rows.length && from < n) rows[n - 1].classList.add('lu-drop-after');
		else if (gap < rows.length) rows[gap].classList.add('lu-drop-before');
		else rows[rows.length - 1].classList.add('lu-drop-after');
	}

	function startDrag() {
		drag.active = true;
		drag.row.classList.add('is-dragging');
		document.documentElement.classList.add('lu-dragging');
		if (navigator.vibrate && drag.pointer === 'touch') { try { navigator.vibrate(10); } catch { /* not allowed: no matter */ } }
		showDrop(drag.y);
	}

	els.teamTables.addEventListener('pointerdown', (e) => {
		if (e.button !== 0 || drag) return;
		const tr = e.target.closest('.lu-team.is-managing tr.lu-order-row[data-player]');
		if (!tr || tr.classList.contains('lu-out-row') || e.target.closest('.lu-move')) return;
		drag = { id: tr.dataset.player, row: tr, x: e.clientX, y: e.clientY, y0: e.clientY, pointer: e.pointerType, active: false, timer: 0 };
		if (e.pointerType === 'mouse') e.preventDefault();   // no text selection
		else drag.timer = setTimeout(() => { if (drag) startDrag(); }, DRAG_HOLD_MS);
	});
	window.addEventListener('pointermove', (e) => {
		if (!drag) return;
		drag.y = e.clientY;
		const far = Math.abs(e.clientX - drag.x) > DRAG_SLOP || Math.abs(e.clientY - drag.y0) > DRAG_SLOP;
		if (!drag.active) {
			if (!far) return;
			if (drag.pointer === 'mouse') startDrag();
			else { endDrag(false); return; }   // a finger that moves before the hold is scrolling
		}
		showDrop(e.clientY);
	});
	window.addEventListener('pointerup', () => endDrag(true));
	window.addEventListener('pointercancel', () => endDrag(false));
	window.addEventListener('keydown', (e) => { if (e.key === 'Escape') endDrag(false); });
	// While a finger drags, the page must not scroll under it.
	els.teamTables.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
	els.teamTables.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });

	// The lineup goes in here, in one call, with the lock (UV, 12 Nov). A
	// refusal saves nothing, and the choices stay on the page to put right.
	els.lockBtn.addEventListener('click', async () => {
		const side = working;
		const { here, order } = lineupToSend();
		const empty = order.filter((id) => !id).length;
		const warning = empty
			? `\n\n${empty} ${empty === 1 ? 'position has' : 'positions have'} nobody in. You can put a reserve or a latecomer into those frames until the card is signed; any still empty then are walkovers.`
			: '';
		if (!confirm('Lock this lineup?' + warning + '\n\nThe order cannot be changed afterwards — a late change is a reserve in one frame.')) return;

		const ok = await write('Locking', () => supabaseClient.rpc('tdc_submit_lineup', {
			p_match_id: matchId, p_side: side, p_here: here, p_order: order
		}), 'Lineup locked.');
		if (ok) {
			// Sent and locked: the database holds it now.
			pendingOrder.delete(side);
			render();
		}
	});


	// The reserve pickers and the L and W switches, inside the sessions, and
	// a player's own L and W in their frames.
	const onFrameChange = (e) => {
		const pick = e.target.closest('[data-action="reserve"]');
		if (pick) {
			if (!pick.value) return;
			write('Saving', () => supabaseClient.rpc('tdc_swap_frame_player', {
				p_frame_id: pick.dataset.frame, p_player_id: pick.value
			}));
			return;
		}

		const tri = e.target.closest('select[data-action="lag"], select[data-action="win"]');
		if (!tri) return;
		// A special win's stop on W (UV, 19 Nov) is "side:event".
		const [sideValue, event] = tri.value.split(':');
		const action = tri.dataset.action === 'win' && event ? 'special' : tri.dataset.action;
		const side = sideValue === 'home' || sideValue === 'away' ? sideValue : null;
		const frameNo = parseInt(tri.dataset.frame, 10);
		const f = card.find((x) => x.frame_no === frameNo);
		if (!f) { TDC.error(AREA, 'no frame ' + frameNo + ' on this card.', null, els.status); return; }

		// tdc_record_frame writes the whole frame from what it is sent, so each
		// toggle sends the frame as it stands with its own change laid over:
		// recording the winner keeps the lag, and the lag keeps the winner.
		// The change is also kept in unsaved until the re-read after its own
		// save, and laid over every re-read before that (loadAll), so a lag
		// and a win set in quick succession do not undo each other, even when
		// a re-read from an earlier save lands between them.
		const send = (what, change) => {
			const u = unsaved.get(frameNo) || { fields: {}, saves: 0, failed: false };
			Object.assign(u.fields, change, { status: change.status || (f.status === 'complete' ? 'complete' : 'pending') });
			Object.assign(f, u.fields);
			u.saves++;
			unsaved.set(frameNo, u);
			const p = {
				status: f.status,
				winner_side: f.winner_side,
				result_event: f.result_event,
				break_side: f.break_side
			};
			for (const k of Object.keys(p)) if (p[k] === null || p[k] === undefined) delete p[k];
			write(what + ' frame ' + frameNo, () => supabaseClient.rpc('tdc_record_frame', {
				p_match_id: matchId, p_frame_no: frameNo, p_frame: p
			})).then((ok) => {
				if (!ok) u.failed = true;
				if (--u.saves || unsaved.get(frameNo) !== u) return;
				unsaved.delete(frameNo);
				// The re-read just drawn laid this frame's choices over what the
				// database holds; one of them was not saved, so read it again
				// without them. The writer has already said why.
				if (u.failed) loadAll();
			});
		};

		if (action === 'special') {
			// A special win's stop on W (UV, 19 Nov): that side won with it.
			// Only stops that fit are drawn; checked again, as the lag may
			// have moved since the switch was drawn.
			if (!side || !fits(event, f, side)) { render(); return; }
			send('Saving', { status: 'complete', winner_side: side, result_event: event });
		} else if (action === 'win' && side) {
			// W's own stop: that side won, a plain win (UV, 19 Nov: the special
			// wins are stops of their own beyond it), the lag kept.
			send('Saving', { status: 'complete', winner_side: side, result_event: 'win' });
		} else if (action === 'win') {
			// W back to the middle clears the result; the lag stays.
			send('Clearing', { status: 'pending', winner_side: null, result_event: null });
		} else if (f.status === 'complete' && RESULT_ICON[f.result_event]
			&& !fits(f.result_event, Object.assign({}, f, { break_side: side }), f.winner_side)) {
			// The lag moved so the special win no longer fits it (a B&F's
			// winner lost the lag, an rB&F's winner won it): a plain win now,
			// or the database refuses the move (the breaker rule).
			send('Saving', { break_side: side, result_event: 'win' });
		} else {
			send('Saving', { break_side: side });
		}
	};
	els.sessions.addEventListener('change', onFrameChange);
	els.mineFrames.addEventListener('change', onFrameChange);
	els.quickList.addEventListener('change', onFrameChange);

	// The blue tick tapped (UV, 17 Nov): the change is accepted and the frame
	// stands as it is. Nothing on the frame is written, so no signature is
	// lost. The re-read clears the tick and the glow.
	const onAccept = (e) => {
		const tri = e.target.closest('select[data-action="lag"], select[data-action="win"]');
		if (!tri) return;
		const frameNo = parseInt(tri.dataset.frame, 10);
		write('Accepting frame ' + frameNo, () => supabaseClient.rpc('tdc_accept_frame_change', {
			p_match_id: matchId, p_frame_no: frameNo, p_thing: tri.dataset.action === 'lag' ? 'lag' : 'result'
		}));
	};
	els.sessions.addEventListener('tdc-accept', onAccept);
	els.mineFrames.addEventListener('tdc-accept', onAccept);
	els.quickList.addEventListener('tdc-accept', onAccept);

	// The view toggle. Nothing is saved to the database, so the dots stay
	// the 0.2 s every control gets (docs/systems/dots.md §8).
	els.playerViews.addEventListener('click', (e) => {
		const b = e.target.closest('.cp-view');
		if (!b || b.dataset.view === playerView) return;
		playerView = b.dataset.view;
		try { localStorage.setItem(VIEW_KEY, playerView); } catch { /* kept for this visit only */ }
		showView();
		if (typeof TDCDots !== 'undefined') {
			TDCDots.serve(b, new Promise((r) => setTimeout(r, 200)), { status: els.status });
		}
	});

	// Each button signs for its own side (data-side), whichever side is being
	// set up. The league director's signature is recorded as theirs, not the
	// team's (tdc_submit_card, signed_as).
	const sign = (e) => {
		const side = e.currentTarget.dataset.side;
		const pending = card.filter((f) => f.status === 'pending');
		const empty = pending.filter((f) => !f.home_player_id || !f.away_player_id).length;
		const unplayed = pending.length - empty;
		let warning = '';
		if (empty) warning += `\n\n${empty} ${empty === 1 ? 'frame still has an empty seat and becomes a walkover' : 'frames still have an empty seat and become walkovers'} to the side that turned up.`;
		if (unplayed) warning += `\n\n${unplayed} ${unplayed === 1 ? 'frame has' : 'frames have'} no result. Signing says this is the final card, not that every frame was played.`;
		const as = lineupState.i_run_it ? ' as the league director' : '';
		if (!confirm('Sign this card for ' + teamName(side) + as + '?' + warning)) return;

		write('Signing', () => supabaseClient.rpc('tdc_submit_card', {
			p_match_id: matchId, p_side: side
		}), 'Signed.');
	};
	els.signHome.addEventListener('click', sign);
	els.signAway.addEventListener('click', sign);

	els.disputeBtn.addEventListener('click', () => {
		const note = prompt('What is wrong with this card?');
		if (note === null) return;
		if (note.trim().length < 3) {
			TDC.status(els.status, 'Say briefly what is wrong, so the other captain knows what to look at.', '');
			return;
		}
		write('Raising it', () => supabaseClient.rpc('tdc_answer_card', {
			p_match_id: matchId, p_agree: false, p_note: note.trim()
		}));
	});

	// ─── Live (UV, 29 Oct) ───
	// The other captain's changes and signatures arrive without a reload. A
	// frame write moves the match's card_version and a signature is an event,
	// and both tables are sent live (20261017130000), as the match page uses
	// them. Realtime is for immediacy, not correctness: the card is read again
	// whenever it is shown again or the connection returns, so a missed
	// message does no harm. Never while this person's own saves are going out
	// or a choice of theirs is still waiting (unsaved, above): tried again
	// shortly. The echo of their own save cannot be told from the other
	// captain's change, so it costs one more re-read.
	let liveTimer = null;
	function onLive() {
		clearTimeout(liveTimer);
		liveTimer = setTimeout(function again() {
			if (cardWriter.pending || unsaved.size) { liveTimer = setTimeout(again, 1500); return; }
			loadAll();
		}, 500);
	}
	// Hidden, the socket is let go (3 Nov: battery) and taken up again when
	// shown; the read on being shown covers the gap.
	let liveChannel = null;
	function startLive() {
		subscribeLive();
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible') {
				if (liveChannel) { supabaseClient.removeChannel(liveChannel); liveChannel = null; }
				return;
			}
			subscribeLive();
			onLive();
		});
		window.addEventListener('online', onLive);
	}
	function subscribeLive() {
		if (liveChannel) return;
		liveChannel = supabaseClient.channel('card:' + matchId)
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tbl_matches', filter: 'id=eq.' + matchId }, onLive)
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tbl_match_events', filter: 'match_id=eq.' + matchId }, onLive)
			// A discrepancy accepted (20261117060737): the tick and the glow go on every phone.
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tbl_frame_change_accept', filter: 'match_id=eq.' + matchId }, onLive)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') return;
				// Not fatal: the card still works and is read again when shown,
				// it just stops following the other captain until then.
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					console.error('[' + AREA + '] live updates are not running (' + status + ').');
				}
			});
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!matchId) {
			TDC.error(AREA, 'no match in the address. Open this page from the fixtures.', null, els.status);
			return;
		}

		// The share icon, shown already drawn: a page load draws nothing in (UV, 16 Nov).
		try {
			const face = els.share.querySelector('.tdc-ring');
			face.innerHTML = TDCRing.svg();
			new TDCRing.RingStatus(face, {
				icons: ['share'], labels: { share: 'Share', empty: 'Share', loading: 'Working' }, initial: 'share'
			});
		} catch (err) {
			TDC.error(AREA, 'the share icon could not be drawn.', err, els.status);
		}
		TDC.shareButton(els.share, 'match', matchId, {
			area: AREA, status: els.status, title: () => document.title
		});
		// The scoresheet picture's icon, the same way (UV, 19 Nov).
		try {
			const face = els.sheet.querySelector('.tdc-ring');
			face.innerHTML = TDCRing.svg();
			new TDCRing.RingStatus(face, {
				icons: ['picture'], labels: { picture: 'Save a picture of the scoresheet', empty: 'Save a picture', loading: 'Working' }, initial: 'picture'
			});
		} catch (err) {
			TDC.error(AREA, 'the scoresheet picture icon could not be drawn.', err, els.status);
		}
		els.sheet.addEventListener('click', sheetClicked);

		// Who the reader is, for the player's view, asked at once: it needs only
		// the sign-in (UV, 16 Nov: as fast as it can load). An account with no
		// player (rare) simply never gets it, so no error is shown for one.
		// (Promise.resolve sends it now: a supabase query waits to be awaited.)
		const meRead = Promise.resolve(supabaseClient.from('tbl_players').select('id').eq('user_id', session.user.id).maybeSingle());
		if (!await loadMatch()) return;
		// The rosters, the league around the match and the reader together;
		// none needs another. The cutoff still follows the rosters and comes
		// before the card is read, as it always has.
		const rostersRead = loadRosters();
		const context = loadContext();
		// The cutoff is evaluated when somebody opens the night, which is what
		// makes it lazy — there is no scheduled job. It does nothing unless
		// the cutoff has passed, and a failure here must not stop the page
		// loading, so it is reported and then stepped over.
		const cutoff = rostersRead.then(async (ok) => {
			if (!ok) return;
			const { error } = await supabaseClient.rpc('tdc_apply_lineup_cutoff', { p_match_id: matchId });
			if (error) TDC.showSupabaseError(AREA, error, els.status);
		});
		const me = await meRead;
		if (me.error) TDC.showSupabaseError(AREA, me.error, els.status);
		else myPlayerId = me.data ? me.data.id : null;
		if (!await rostersRead) { await context; return; }
		await context;
		await cutoff;

		await loadAll();
		startLive();
	})(), 'Team card');
})();
