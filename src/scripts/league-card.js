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
//   tdc_match_squad    — who is available tonight
//   tdc_match_card     — every frame with its two players, its session and
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
		homePic: el('home-pic'), homeName: el('home-name'), awayPic: el('away-pic'), awayName: el('away-name'),
		sideSwitch: el('side-switch'), sidePick: el('side-pick'),
		lineups: el('lineups'), compare: el('team-compare'), teamTables: el('team-tables'),
		squadHint: el('squad-hint'), lockRow: el('lock-row'), lockBtn: el('lock-btn'),
		// The managing team's table body: made once and moved into whichever
		// table is being set up, so its listener and steppers persist.
		squadList: document.createElement('tbody'),
		quick: el('quick'), quickList: el('quick-list'),
		grid: el('grid'), sessions: el('session-list'), gridHint: el('grid-hint'),
		mine: el('mine'), mineFrames: el('mine-frames'), mineSessions: el('mine-sessions'),
		playerTable: el('player-table'),
		playerViews: el('player-views'), h2hView: el('h2h-view'), h2hTables: el('h2h-tables'), sessionView: el('session-view'),
		sumDetail: el('sum-detail'),
		sumHomePic: el('sum-home-pic'), sumHomeName: el('sum-home-name'), sumHomeScore: el('sum-home-score'),
		sumAwayPic: el('sum-away-pic'), sumAwayName: el('sum-away-name'), sumAwayScore: el('sum-away-score'),
		signPanel: el('sign-panel'), sfLeague: el('sf-league'), sfDate: el('sf-date'),
		sfHomeSig: el('sf-home-sig'), sfHomeCap: el('sf-home-cap'),
		sfAwaySig: el('sf-away-sig'), sfAwayCap: el('sf-away-cap'),
		sfDispute: el('sf-dispute'),
		changedSince: el('changed-since'), changedCount: el('changed-count'), changedList: el('changed-list'),
		signHome: el('sign-home'), signAway: el('sign-away'), disputeBtn: el('dispute-btn'),
		share: el('share-btn'),
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
	let squad = [];
	let rosters = new Map();   // team id -> its players, for the squad and reserve pickers
	let pictures = new Map();  // player id -> avatar path, from the two rosters
	let card = [];
	let cardState = null;
	let signatures = [];       // every signature, newest first: side, by_name, signed_as, at
	let changes = [];          // every change since the first signature
	let edited = new Map();    // frame no -> { lag, win }: which switch changed since then
	const unsaved = new Map(); // frame no -> { fields, saves, failed }: L and W chosen, not yet read back
	let drawnOnce = false;              // a re-read after the first draw fades what changed
	const foldedSessions = new Set();
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
			[els.sumHomePic, els.sumHomeName, 'home'], [els.sumAwayPic, els.sumAwayName, 'away']]) {
			// The team's own picture, or the shield (TDC.teamPic, 29 Oct).
			const team = byId.get(side === 'home' ? data.home_team_id : data.away_team_id) || {};
			pic.replaceChildren(TDC.teamPic(team.picture_path));
			name.textContent = teamName(side);
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
			supabaseClient.from('tbl_league_seasons').select('max_reserves').eq('id', match.league_season_id).maybeSingle(),
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

	// ─── The rosters behind the squad picker ───
	// Read once: a roster does not change during a night, and this is two
	// requests rather than two on every redraw. They carry each player's
	// picture too.
	async function loadRosters() {
		for (const id of [match.home_team_id, match.away_team_id]) {
			if (rosters.has(id)) continue;
			const { data, error } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: id });
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			rosters.set(id, data || []);
			for (const r of data || []) if (r.avatar_path) pictures.set(r.player_id, r.avatar_path);
		}
		return true;
	}

	// ─── Everything that moves ───
	async function loadAll() {
		const calls = [
			['tdc_lineup_state', { p_match_id: matchId }, (d) => { lineupState = (d || [])[0] || null; }],
			['tdc_match_lineup', { p_match_id: matchId }, (d) => { lineup = d || []; }],
			['tdc_match_squad', { p_match_id: matchId }, (d) => { squad = d || []; }],
			['tdc_match_card', { p_match_id: matchId }, (d) => { card = d || []; }],
			['tdc_card_state', { p_match_id: matchId }, (d) => { cardState = d || null; }]
		];

		for (const [fn, args, keep] of calls) {
			const { data, error } = await supabaseClient.rpc(fn, args);
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			keep(data);
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

		// Every change made after either captain first signed (UV, 28 Oct),
		// for everybody to see: listed under the signatures and marked on the
		// frames in blue. A signature is an append-only event, so the first
		// one is still there after a side signs again. An edit is stamped with
		// the version it changed, hence one below the signed version. The
		// signatures themselves, with who signed and as what (captain or
		// league director, UV 29 Oct), join that list and the signature lines.
		changes = [];
		edited = new Map();
		const sigs = await supabaseClient.rpc('tdc_card_signatures', { p_match_id: matchId });
		if (sigs.error) { TDC.showSupabaseError(AREA, sigs.error, els.status); return false; }
		signatures = sigs.data || [];
		if (signatures.length) {
			const firstVersion = Math.min(...signatures.map((g) => g.card_version));
			const { data, error } = await supabaseClient.rpc('tdc_frame_history', {
				p_match_id: matchId, p_since_version: firstVersion - 1
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			changes = (data || []).filter((c) => c.changed);
			// Blue marks only what this person has not yet put their name to
			// (UV, 29 Oct): a captain who signs approves the card as it stands,
			// their own changes and the other side's alike. A captain looks
			// from their side's latest signature. Anybody else (the league
			// director included) sees what both sides have not yet agreed:
			// from the older of the two sides' latest signatures that no
			// longer stand. A signature that stands means the card is what
			// was signed, so nothing is blue from it.
			const sides = (cardState && cardState.sides) || {};
			const latest = (side) => signatures.find((g) => g.side === side);
			const stale = (g) => g && !(sides[g.side] && sides[g.side].current);
			// A captain who has not signed yet looks as anybody else does.
			const mineSide = !lineupState.i_run_it && lineupState.my_side && latest(lineupState.my_side) && lineupState.my_side;
			const ref = mineSide
				? [latest(mineSide)].filter(stale)[0]
				: [latest('home'), latest('away')].filter(stale).sort((a, b) => new Date(a.at) - new Date(b.at))[0];
			for (const c of ref ? changes.filter((x) => x.card_version >= ref.card_version) : []) {
				const e = edited.get(c.frame_no) || { lag: false, win: false };
				if (/\bbreak_side /.test(c.changed)) e.lag = true;
				if (/\b(winner_side|result_event|status) /.test(c.changed)) e.win = true;
				edited.set(c.frame_no, e);
			}
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

		renderBanner(locked, both);
		renderSwitch(both);
		renderLineups(locked, both, canSet);
		renderQuick(both);
		// A player sees their own frames in place of every session.
		if (asPlayer()) { els.grid.hidden = true; renderMine(both); }
		else { els.mine.hidden = true; renderSessions(both); }
		renderSummary(both);
		renderPlayers(both);
		renderSignatures(both);
	}

	const score = (side) => card.filter((f) => f.winner_side === side).length;
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
	// fixture's details as label and value pairs.
	function renderBanner(locked, both) {
		const [key, label] = stateOf(both);
		els.jumbo.className = 'jumbo card-jumbo card-state-' + key;
		// The page speaks a fixture's colours (UV, 11 Nov): the state on the
		// body colours every score; a banner name turns yellow once its side
		// has locked and is underlined for the viewer's own team.
		document.body.dataset.cardState = key;
		const mine = myTeamSide();
		for (const [name, side] of [[els.homeName, 'home'], [els.awayName, 'away'], [els.sumHomeName, 'home'], [els.sumAwayName, 'away']]) {
			name.classList.toggle('is-locked', !!locked[side]);
			name.classList.toggle('is-mine', mine === side);
		}
		els.jumboStatus.hidden = false;
		els.jumboStatus.textContent = label;
		els.stateDetail.textContent = stateDetail(locked, both);

		const facts = [];
		if (info) facts.push(['League', info.league_name + (info.name ? ' · ' + info.name : '')]);
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
	// Nothing is sent while a captain goes down the list: each switch and
	// position is kept here, laid over what the database holds (anything
	// saved by the page before 12 Nov), and the lot goes in one call when
	// Lock the lineup is pressed (tdc_submit_lineup). A redraw in between, a
	// live update from the other side, shows what they chose. A reload loses
	// it (accepted by UV, 12 Nov).
	const pendingHere = new Map();   // player -> here or not
	const pendingPos = new Map();    // player -> { at: position or null, n: order chosen }
	let chosen = 0;

	// Who is here and who is in which position, as this page should show it:
	// the database's, with the choices on their way laid over. A position
	// chosen here empties whoever held it, as the database will; of two
	// chosen for one position, the later stands.
	function lineupShown() {
		const inSquad = new Set(squad.filter((s) => s.side === working).map((s) => s.player_id));
		const saved = new Map(lineup.filter((l) => l.side === working && l.player_id).map((l) => [l.player_id, l.lineup_slot]));
		const here = (id) => (pendingHere.has(id) ? pendingHere.get(id) : inSquad.has(id));
		const claim = new Map();   // position -> { id, n } latest chosen
		for (const [id, p] of pendingPos) {
			if (p.at != null && here(id) && !(claim.get(p.at) && claim.get(p.at).n > p.n)) claim.set(p.at, { id, n: p.n });
		}
		const pos = (id) => {
			if (!here(id)) return null;
			if (pendingPos.has(id)) {
				const p = pendingPos.get(id);
				return p.at != null && claim.get(p.at).id === id ? p.at : null;
			}
			const at = saved.get(id);
			return at != null && !claim.has(at) ? at : null;
		};
		return { here, pos };
	}

	// ─── The lineup page (UV, 12 Nov) ───
	// Until both lineups are in: the two teams' season so far as a football
	// head-to-head, then each team in a table of its own with the league's
	// Standings columns. The team being set up (a captain's own, or the side
	// the director chose) has the switch and the stepper in its table, the
	// hint above it and Lock the lineup under it; everybody else sees the
	// tables read-only. Players never see this page once the lineups are in.
	const LINEUP_HINT = 'Switch on everybody who is here and give each player in the first session their position. Each keeps their position all night; the rest follows from the rotation. A position left empty can still be filled by a reserve or a latecomer until the card is signed. Nothing is sent until you lock the lineup.';

	function renderLineups(locked, both, canSet) {
		els.lineups.hidden = both;
		if (els.lineups.hidden) return;
		const managing = canSet && working && !locked[working] ? working : null;

		renderCompare();
		els.teamTables.replaceChildren(...['home', 'away'].map((side) => teamTable(side, locked, side === managing)));

		// The hint and the lock button go with the table being set up; parked
		// out of sight in the section otherwise.
		els.squadHint.hidden = els.lockRow.hidden = !managing;
		if (managing) {
			const box = els.teamTables.querySelector('.lu-team[data-side="' + managing + '"]');
			const roster = rosters.get(managing === 'home' ? match.home_team_id : match.away_team_id) || [];
			els.squadHint.textContent = roster.length ? LINEUP_HINT : 'Nobody is on this team yet.';
			box.querySelector('.lu-state').after(els.squadHint);
			box.append(els.lockRow);
			showLockCount();
		} else {
			els.lineups.append(els.squadHint, els.lockRow);
		}
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
		head.append(node('span', 'lu-cmp-v lu-cmp-home lu-cmp-team', match.home_name), node('span', 'lu-cmp-k'),
			node('span', 'lu-cmp-v lu-cmp-away lu-cmp-team', match.away_name));
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
	// then name order for anybody not ranked yet.
	function teamTable(side, locked, manage) {
		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		const stat = (id) => (standings && standings.players.get(id)) || null;
		const roster = (rosters.get(teamId) || []).slice().sort((a, b) => {
			const x = stat(a.player_id), y = stat(b.player_id);
			const rx = x && x.rank !== null ? x.rank : Infinity, ry = y && y.rank !== null ? y.rank : Infinity;
			return rx - ry || String(a.display_name).localeCompare(String(b.display_name));
		});
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
		head.append(pic, name);
		box.append(head);

		let state;
		if (manage) state = 'Setting up tonight\'s lineup.';
		else if (locked[side]) {
			const filled = theirs.filter((l) => l.player_id || l.hidden).length;
			state = 'Locked: ' + filled + ' of ' + theirs.length + ' positions filled.'
				+ (!posFor.size && theirs.some((l) => l.hidden) ? ' The order is sealed until both lineups are in.' : '');
		} else state = 'Still choosing.';
		const stateLine = node('p', 'lu-state' + (locked[side] ? ' is-locked' : ''), state);
		box.append(stateLine);

		const table = node('table', 'tdc-table sd-table lu-table');
		const thead = node('thead'), htr = node('tr');
		const picHead = node('th', 'sd-pic');
		picHead.setAttribute('aria-label', 'Picture');
		htr.append(node('th', 'num sd-rank', '#'), picHead, node('th', 'sd-name', 'Player'));
		if (manage) htr.append(node('th', 'lu-ctl', 'Here'), node('th', 'lu-ctl', 'Position'));
		if (showPos) htr.append(node('th', 'lu-ctl', 'Position'));
		for (const c of cols) htr.append(node('th', 'num', c.name));
		thead.append(htr);

		const body = manage ? els.squadList : node('tbody');
		const { here, pos } = manage ? lineupShown() : { here: null, pos: null };
		const max = theirs.length || 1;
		body.replaceChildren(...roster.map((r, i) => {
			const id = r.player_id;
			const st = stat(id);
			const tr = node('tr', i % 2 ? 'sd-alt' : null);
			if (myPlayerId && id === myPlayerId) tr.classList.add('sd-me');
			tr.append(node('td', 'num sd-rank', st && st.rank !== null ? String(st.rank) : '–'));
			const pic = node('td', 'sd-pic');
			pic.append(avatar(id, r.display_name));
			const who = node('td', 'sd-name');
			who.append(node('span', 'lu-player', r.display_name));
			if (r.is_captain) who.append(node('span', 'badge live lu-badge', 'Captain'));
			if (r.status !== 'active') who.append(node('span', 'lu-sub', r.status === 'withdrawn' ? 'Withdrawn' : 'Away'));
			tr.append(pic, who);

			if (manage) {
				// Here tonight and the position (UV, 29 Oct), as they were in
				// the list: kept on the page until the lock (UV, 12 Nov).
				const box = document.createElement('input');
				box.type = 'checkbox';   // a switch
				box.id = 'here-' + id;
				box.checked = here(id);
				// The database refuses anybody not active (away or withdrawn);
				// saying so here spares a pointless tap. Confirmation is not asked
				// for, and has not been since 23 Oct.
				box.disabled = r.status !== 'active';
				box.dataset.action = 'squad';
				box.dataset.player = id;
				box.setAttribute('aria-label', 'Here tonight: ' + r.display_name);

				const at = document.createElement('input');
				at.type = 'number';      // a stepper
				at.dataset.stepper = 'across';   // on its side: a row of small numbers, one per player
				at.dataset.control = 'stepper';  // asked for by name: nothing inside a table is taken otherwise
				at.id = 'pos-' + id;
				at.min = '1';
				at.max = String(max);
				at.step = '1';
				at.placeholder = '–';
				at.value = pos(id) == null ? '' : String(pos(id));
				at.dataset.was = at.value;   // where a step came from (choosePos)
				at.disabled = !here(id);
				at.dataset.action = 'pos';
				at.dataset.player = id;
				at.setAttribute('aria-label', 'Position for ' + r.display_name);

				const c1 = node('td', 'lu-ctl'), c2 = node('td', 'lu-ctl');
				c1.append(box);
				c2.append(at);
				tr.append(c1, c2);
			}
			if (showPos) {
				const p = posFor.get(id);
				tr.append(node('td', 'lu-ctl lu-pos', p ? (side === 'home' ? 'H' : 'A') + p : ''));
			}
			for (const c of cols) tr.append(node('td', 'num', TDCStandings.shown(st ? st.values[c.id] : null, c.decimals)));
			return tr;
		}));
		if (!roster.length) {
			const tr = node('tr');
			const td = node('td', 'empty', 'Nobody on this team yet.');
			td.colSpan = 3 + cols.length + (manage ? 2 : 0);
			tr.append(td);
			body.append(tr);
		}
		table.append(thead, body);
		const scroll = node('div', 'table-scroll sd-scroll');
		scroll.append(table);
		box.append(scroll);
		return box;
	}

	// The lineup as it will be sent: who is here, and the player for each
	// position (null for an empty one), from the page's choices.
	function lineupToSend() {
		const teamId = working === 'home' ? match.home_team_id : match.away_team_id;
		const roster = rosters.get(teamId) || [];
		const { here, pos } = lineupShown();
		// Only active players: the database refuses anybody away or withdrawn,
		// and their switch is disabled, so one left in an earlier save is dropped.
		const ids = roster.filter((r) => r.status === 'active').map((r) => r.player_id).filter(here);
		const order = lineup.filter((l) => l.side === working).map(() => null);
		for (const id of ids) { const at = pos(id); if (at != null && at <= order.length) order[at - 1] = id; }
		return { here: ids, order };
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
	// The next four frames without a result, in the night's order, and above
	// them any frame out of that order that is under way: a frame is under
	// way from the moment its lag is in. So a captain who strays from the
	// order still finds every live frame at the top. Each is an inset pill
	// with the frame's L and W, live for the captains and the league
	// director only (UV), greyed for everybody else, players included.
	//
	// A frame that leaves (its result is in) fades out completely, the list
	// lifts into its place, and only then does the next fade in at the
	// bottom (UV). A redraw during that waits for it and then draws once
	// from the latest card.
	const QUICK_NEXT = 4;
	let quickRun = null;
	let quickAgain = false;
	let quickDrawn = false;

	// Each frame with its group: 'stray' (under way, out of order, at the
	// top) or 'next'.
	function quickFrames() {
		const open = card.filter((f) => f.status !== 'complete');   // the card is in frame order
		const next = open.slice(0, QUICK_NEXT);
		const inNext = new Set(next.map((f) => f.frame_no));
		return open.filter((f) => f.break_side && !inNext.has(f.frame_no)).map((f) => ({ f, group: 'stray' }))
			.concat(next.map((f) => ({ f, group: 'next' })));
	}

	function renderQuick(both) {
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		const list = both && !lockedCard ? quickFrames() : [];
		if (quickRun) { quickAgain = true; return; }
		if (!list.length) {
			els.quick.hidden = true;
			els.quickList.replaceChildren();
			quickDrawn = false;
			return;
		}
		els.quick.hidden = false;
		quickRun = syncQuick(list, quickDrawn)
			.catch((err) => TDC.error(AREA, 'could not draw Now and next.', err, els.status))
			.finally(() => {
				quickRun = null;
				quickDrawn = true;
				if (quickAgain) { quickAgain = false; renderQuick(lineupState.home_locked && lineupState.away_locked); }
			});
	}

	async function syncQuick(list, animate) {
		const want = new Map(list.map((x) => [String(x.f.frame_no), x]));
		const rows = [...els.quickList.children];
		// A pill that stays in its group is drawn again in place, as every
		// frame row is. One that left the list goes; so does one that changed
		// group (a stray now among the next four), to come back in its place.
		const stays = (r) => want.has(r.dataset.frame) && want.get(r.dataset.frame).group === r.dataset.group;
		for (const r of rows) if (stays(r)) r.replaceChildren(...quickPill(want.get(r.dataset.frame).f));
		await Promise.all(rows.filter((r) => !stays(r)).map((r) => (animate ? quickLeave(r) : r.remove())));

		const have = new Map([...els.quickList.children].map((r) => [r.dataset.frame, r]));
		const fresh = [];
		for (const { f, group } of list) {
			let r = have.get(String(f.frame_no));
			if (!r) {
				r = node('div', 'qv-pill');
				r.dataset.frame = String(f.frame_no);
				r.dataset.group = group;
				r.replaceChildren(...quickPill(f));
				fresh.push(r);
			}
			els.quickList.append(r);   // in the list's order: strays at the top, the next at the bottom
		}
		if (animate) await Promise.all(fresh.map(quickEnter));
	}

	// Less motion (the person's choice, else the device's): no fading.
	const lessMotion = () => {
		const m = document.documentElement.dataset.motion;
		return m === 'reduce' || (m !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
	};
	const QUICK_FADE_MS = 280, QUICK_LIFT_MS = 260;
	const done = (a) => a.finished.catch(() => { /* cancelled: nothing to wait for */ });

	async function quickLeave(r) {
		if (lessMotion()) { r.remove(); return; }
		r.style.pointerEvents = 'none';
		await done(r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: QUICK_FADE_MS, easing: 'ease-out', fill: 'forwards' }));
		const cs = getComputedStyle(r);
		r.style.overflow = 'hidden';
		await done(r.animate([
			{ height: r.offsetHeight + 'px', marginTop: cs.marginTop, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 0 },
			{ height: '0px', marginTop: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }
		], { duration: QUICK_LIFT_MS, easing: 'ease-in-out', fill: 'forwards' }));
		r.remove();
	}

	function quickEnter(r) {
		if (lessMotion()) return Promise.resolve();
		return done(r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: QUICK_FADE_MS, easing: 'ease-in', fill: 'backwards' }));
	}

	// One pill: the session, "Under way" once the lag is in, then the frame
	// as a session row draws it (its F and positions under the names).
	function quickPill(f) {
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		const strict = !!(match.rules && match.rules.strict_frame_order);
		const nextOpen = strict ? (card.find((x) => x.status === 'pending') || {}).frame_no : null;
		const captain = !!(lineupState.i_run_it || lineupState.my_side);
		const mayEnter = captain && f.result_event !== 'default' && !lockedCard
			&& !!f.home_player_id && !!f.away_player_id && (!strict || f.frame_no === nextOpen);

		const top = node('div', 'qv-top');
		top.append(node('span', 'qv-where', 'Session ' + (f.session || 1)));   // the frame's F is under the home player
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
		const hint = ((strict ? 'Frames must be played in order, so only frame ' + (nextOpen || '—') + ' can be entered.' : '')
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
		for (const [s, frames] of bySession) {
			blocks.push(sessionBlock(bySession.size > 1 ? 'Session ' + s : 'The frames', frames, strict, nextOpen));
		}
		els.sessions.replaceChildren(...blocks);
	}

	// Three tracks: home player, the frame's L and W in the middle, away
	// player. The totals sit either side of the middle, under each team's end
	// of the toggles.
	//
	// Each session folds (UV, 29 Oct): a folding group (set-group, so it opens
	// and closes as every other on the site, tdc-controls.js), open unless the
	// reader closed it, which is remembered through every redraw. Its heading
	// carries the session's score, so a closed one still says how it went.
	function sessionBlock(heading, frames, strict, nextOpen) {
		const block = node('details', 'cs-session set-group');
		block.open = !foldedSessions.has(heading);
		block.addEventListener('toggle', () => {
			if (block.open) foldedSessions.delete(heading); else foldedSessions.add(heading);
		});
		const won = (side) => frames.filter((f) => f.winner_side === side).length;
		const title = node('summary', 'cs-title', heading);
		const sesScore = node('span', 'cs-title-score', won('home') + ' : ' + won('away'));
		sesScore.dataset.live = 'ses|' + heading;
		title.append(sesScore);
		block.append(title);

		const grid = node('div', 'cs-grid');
		const head = node('div', 'cs-row cs-head');
		head.append(node('span', 'cs-team cs-home', match.home_name), node('span', 'cs-team cs-away', match.away_name));
		grid.append(head);

		for (const f of frames) grid.append(frameRow(f, strict, nextOpen));

		const total = node('div', 'cs-row cs-total');
		const both = node('div', 'cs-tots');
		for (const side of ['home', 'away']) {
			const cell = node('span', 'cs-tot cs-' + side);
			const value = node('span', 'cs-tot-value', String(frames.filter((f) => f.winner_side === side).length));
			value.dataset.live = 'tot|' + heading + '|' + side;
			cell.append(node('span', 'cs-tot-label', 'Total'), value);
			both.append(cell);
		}
		total.append(both);
		grid.append(total);
		block.append(grid);
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

		const sub = [];
		if (side === 'home') sub.push('F' + f.frame_no);   // F1, not Frame 1 (UV, 12 Nov)
		if (pos) sub.push((side === 'home' ? 'H' : 'A') + pos);
		if (f.result_event === 'default' && f.winner_side === side) sub.push('Walkover');
		cell.append(node('span', 'cs-sub', sub.join(' · ')));
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
			const line = node('span', 'cs-tog cs-tog-' + action);
			// Changed since this person last signed: the switch's bar turns
			// blue (UV, 29 Oct; it was the knob's ring).
			if ((edited.get(f.frame_no) || {})[action]) {
				line.classList.add('is-edited');
				line.title = 'Changed after the card was signed';
			}
			const pick = document.createElement('select');
			pick.dataset.control = 'tri';
			// The lag in the warning colour with a spotted cue ball (UV, 24 Oct),
			// so it never reads as the result.
			if (action === 'lag') { pick.dataset.icon = 'cue'; pick.dataset.tone = 'warning'; }
			// W wears the result (UV, 29 Oct): a tick, BF or GB. With either
			// on in the league, tapping the chosen end again steps through
			// them (cycleNext) rather than clearing it.
			if (action === 'win') {
				pick.dataset.icon = RESULT_ICON[f.result_event] || 'tick';
				const cycle = specials().map((e) => RESULT_ICON[e]);
				if (cycle.length) pick.dataset.cycle = cycle.join(' ');
			}
			// The action and frame tell the page's redraw which live control
			// this is, so its animation carries on (tdc-controls.js).
			pick.dataset.action = action;
			pick.dataset.frame = f.frame_no;
			if (where) pick.dataset.player = where;
			pick.append(
				new Option(teamName(left) + ' ' + words, left, false, value === left),
				new Option('Nobody yet', '', false, !value),
				new Option(teamName(right) + ' ' + words, right, false, value === right));
			pick.disabled = !mayEnter;
			pick.setAttribute('aria-label', (action === 'lag' ? 'Lag' : 'Winner') + ', frame ' + f.frame_no);
			line.append(node('span', 'cs-tog-key' + (value === left ? ' is-on' : ''), letter), pick,
				node('span', 'cs-tog-key' + (value === right ? ' is-on' : ''), letter));
			cell.append(line);
		}
		return cell;
	}

	// ─── Break & finish and golden break (UV, 29 Oct) ───
	// The special wins the league has on, in the order a repeat tap on W
	// steps through them: tick, BF, GB, back to the tick when the winner won
	// the lag; tick, rBF, back to the tick when they lost it (UV, 29 Oct).
	const RESULT_ICON = { break_and_finish: 'bf', golden_break: 'gb', reverse_break_and_finish: 'rbf' };
	const RESULT_MARK = { break_and_finish: 'BF', golden_break: 'GB', reverse_break_and_finish: 'rBF' };
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
	function cycleNext(f, side) {
		const steps = ['win'].concat(specials().filter((e) => fits(e, f, side)));
		const at = steps.indexOf(f.result_event);
		return steps[(at < 0 ? 0 : at + 1) % steps.length];
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
		head.append(node('span', 'cs-team cs-home', teamName(mySide)), node('span', 'cs-team cs-away', teamName(otherOf(mySide))));
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
		renderMineTables(frames, mySide);
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
		els.mineSessions.replaceChildren(wrap('By session', bySes));
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
	// a yellow ring if they won the lag (round the dot, or on its own when
	// they won the lag and lost the frame), a dash while it is not played.
	// Both tables use it.
	function frameMark(f, side) {
		const done = f.status === 'complete';
		const win = done && f.winner_side === side;
		const lag = f.break_side === side;
		// A break & finish, a golden break or a reverse break & finish: its
		// letters in place of the dot (UV, 29 Oct).
		const special = win && RESULT_MARK[f.result_event];
		const mark = node('span', 'h2h-mark' + (win ? ' is-won' : '') + (special ? ' is-special' : '') + (lag ? ' is-lag' : '') + (done ? '' : ' is-open'), special || undefined);
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

	// A table cell holding a frame changed since a captain signed gets the
	// edited blue as its border (UV, 28 Oct).
	function markEdited(td, frames) {
		if (!frames.some((f) => edited.has(f.frame_no))) return;
		td.classList.add('is-edited');
		td.title = (td.title ? td.title + '. ' : '') + 'Changed after the card was signed';
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
		const at = when(match.scheduled_at) || 'No date';
		const seats = { home: seatsOf('home', range), away: seatsOf('away', range) };

		const tables = ['home', 'away'].map((side) => {
			const other = side === 'home' ? 'away' : 'home';
			const block = node('section', 'h2h-team');
			block.append(node('h3', 'h2h-title lj-heading', teamName(side)));

			const table = node('table', 'tdc-table card-players h2h-table');
			const thead = node('thead');
			const head = node('tr');
			head.append(node('th', 'cp-label h2h-when', at));
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

		els.sfLeague.textContent = info
			? [info.league_name, info.name, TDC.venueNames(venues)].filter(Boolean).join(' · ')
			: '';
		els.sfDate.textContent = match.scheduled_at
			? new Date(match.scheduled_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
			: 'No date set';

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

	// ─── Writing ───
	// Queued, never refused (TDC.writer): a captain ticking down a squad or
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

	// Here tonight and a position, one row per player (UV, 29 Oct). Neither
	// is sent: each is kept on the page (lineupShown) until the lock (UV,
	// 12 Nov).
	els.squadList.addEventListener('change', (e) => {
		const box = e.target.closest('input[data-action="squad"]');
		if (box) { setHere(box.dataset.player, box.checked); return; }
		const at = e.target.closest('input[data-action="pos"]');
		if (at) choosePos(at);
	});

	// A position somebody else holds is skipped, not taken (UV, 29 Oct):
	// stepping onto one carries on in the same direction to the next free
	// position, rolling through the held ones on the way so it is seen. With
	// none free that way, it goes back to where it was.
	const SKIP_MS = 140;   // each held position rolled past
	function choosePos(field) {
		const id = field.dataset.player;
		clearTimeout(field.skipTimer);
		field.skipTimer = 0;
		const was = field.dataset.was ? Number(field.dataset.was) : null;
		const v = field.value === '' ? null : Math.round(Number(field.value));
		if (v == null) { acceptPos(field, null); return; }
		const max = lineup.filter((l) => l.side === working).length;
		const held = takenBesides(id);
		if (!held.has(v)) { acceptPos(field, v); return; }

		const dir = was == null || v > was ? 1 : -1;
		const path = [];
		let n = v + dir;
		while (n >= 1 && n <= max && held.has(n)) { path.push(n); n += dir; }
		path.push(n >= 1 && n <= max ? n : was);
		const next = () => {
			const to = path.shift();
			field.value = to == null ? '' : String(to);
			if (path.length) field.skipTimer = setTimeout(next, SKIP_MS);
			else { field.skipTimer = 0; acceptPos(field, to); }
		};
		field.skipTimer = setTimeout(next, SKIP_MS);
	}

	// The positions held by everybody else here, as the page shows them.
	function takenBesides(id) {
		const { here, pos } = lineupShown();
		const held = new Set();
		for (const f of els.squadList.querySelectorAll('input[data-action="pos"]')) {
			const other = f.dataset.player;
			if (other !== id && here(other) && pos(other) != null) held.add(pos(other));
		}
		return held;
	}

	function acceptPos(field, at) {
		field.dataset.was = at == null ? '' : String(at);
		setPos(field.dataset.player, at);
	}

	// The page is put right in place rather than drawn again: a stepper held
	// down would be thrown away under the finger. The card's re-read once the
	// saves are back draws it all from lineupShown.
	const posField = (id) => document.getElementById('pos-' + id);

	// Every other stepper set to what lineupShown says. A held position is
	// skipped now (choosePos), so this puts right only what a re-read or a
	// race moved.
	function showPositions(except) {
		const { pos } = lineupShown();
		for (const f of els.squadList.querySelectorAll('input[data-action="pos"]')) {
			if (f.dataset.player === except || f.skipTimer) continue;   // mid-roll: choosePos lands it
			const v = pos(f.dataset.player);
			const want = v == null ? '' : String(v);
			if (f.value !== want) f.value = want;
			f.dataset.was = want;
		}
	}

	function setHere(id, on) {
		pendingHere.set(id, on);
		const f = posField(id);
		if (f) f.disabled = !on;
		// Here: the first free position, given at once (UV, 29 Oct); the
		// captain adjusts from there. None free: left empty.
		if (on && f && f.value === '') {
			const held = takenBesides(id);
			const max = lineup.filter((l) => l.side === working).length;
			let n = 1;
			while (n <= max && held.has(n)) n++;
			if (n <= max) { f.value = String(n); acceptPos(f, n); }
		}
		if (!on) {
			// Out of the squad is out of the order (the database does it too).
			pendingPos.set(id, { at: null, n: ++chosen });
			if (f) { clearTimeout(f.skipTimer); f.value = ''; f.dataset.was = ''; }
		}
		showLockCount();
	}

	function setPos(id, at) {
		const max = lineup.filter((l) => l.side === working).length;
		if (at != null && !(at >= 1 && at <= max)) at = null;
		pendingPos.set(id, { at, n: ++chosen });
		showPositions(id);
		showLockCount();
	}

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
			for (const m of [pendingHere, pendingPos]) for (const id of [...m.keys()]) if (isOnSide(id, side)) m.delete(id);
			render();
		}
	});

	// Whether a player is on a side's team tonight, by the rosters.
	function isOnSide(id, side) {
		const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
		return (rosters.get(teamId) || []).some((r) => r.player_id === id);
	}

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
		const action = tri.dataset.action;
		const side = tri.value === 'home' || tri.value === 'away' ? tri.value : null;
		const frameNo = parseInt(tri.dataset.frame, 10);
		const f = card.find((x) => x.frame_no === frameNo);
		if (!f) { TDC.error(AREA, 'no frame ' + frameNo + ' on this card.', null, els.status); return; }

		// The letter beside the chosen end lights at once, not after the re-read.
		// The left end is home on the captain's rows, the player's own side on theirs.
		const keys = tri.closest('.cs-tog').querySelectorAll('.cs-tog-key');
		keys[0].classList.toggle('is-on', !!side && side === tri.options[0].value);
		keys[1].classList.toggle('is-on', !!side && side === tri.options[2].value);

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

		if (action === 'win' && side && f.status === 'complete' && f.winner_side === side) {
			// The chosen end tapped again (data-cycle): the next result.
			// Nothing to send when there is nowhere to step (the winner
			// does not hold L): the tick stays.
			const next = cycleNext(f, side);
			if (next !== f.result_event) send('Saving', { status: 'complete', winner_side: side, result_event: next });
		} else if (action === 'win' && side) {
			// The winner, and the lag already chosen. Break outcomes and the
			// richer result events belong to the match page, which has the
			// controls for them; this grid is for getting results down fast.
			send('Saving', { status: 'complete', winner_side: side,
				result_event: f.status === 'complete' && f.winner_side === side && f.result_event ? f.result_event : 'win' });
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

		// The share icon draws itself in, as the Season tab's.
		try {
			const face = els.share.querySelector('.tdc-ring');
			face.innerHTML = TDCRing.svg();
			const ring = new TDCRing.RingStatus(face, {
				icons: ['share'], labels: { share: 'Share', empty: 'Share', loading: 'Working' }, initial: 'empty'
			});
			ring.drawTo('share');
		} catch (err) {
			TDC.error(AREA, 'the share icon could not be drawn.', err, els.status);
		}
		TDC.shareButton(els.share, 'match', matchId, {
			area: AREA, status: els.status, title: () => document.title
		});

		if (!await loadMatch()) return;
		if (!await loadRosters()) return;
		// Who the reader is, for the player's view. An account with no player
		// (rare) simply never gets it, so no error is shown for one.
		const me = await supabaseClient.from('tbl_players').select('id').eq('user_id', session.user.id).maybeSingle();
		if (me.error) TDC.showSupabaseError(AREA, me.error, els.status);
		else myPlayerId = me.data ? me.data.id : null;
		await loadContext();

		// The cutoff is evaluated when somebody opens the night, which is what
		// makes it lazy — there is no scheduled job. It does nothing unless
		// the cutoff has passed, and a failure here must not stop the page
		// loading, so it is reported and then stepped over.
		const { error } = await supabaseClient.rpc('tdc_apply_lineup_cutoff', { p_match_id: matchId });
		if (error) TDC.showSupabaseError(AREA, error, els.status);

		await loadAll();
		startLive();
	})(), 'Team card');
})();
