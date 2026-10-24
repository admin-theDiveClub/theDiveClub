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
//   tdc_card_changes_since_signing — what moved since you signed
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
// session's totals; a tap on a player's name opens the reserve picker; a table of
// every player's frames by session; the result in a banner; the signatures as
// a form waiting to be signed.
//
// Writes: tdc_set_match_squad, tdc_set_lineup_slot, tdc_lock_lineup,
// tdc_swap_frame_player, tdc_record_frame, tdc_submit_card, tdc_answer_card.
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
		setup: el('setup'), sideSwitch: el('side-switch'), sidePick: el('side-pick'),
		squadHint: el('squad-hint'), squadList: el('squad-list'),
		orderHint: el('order-hint'), orderList: el('order-list'),
		lockBtn: el('lock-btn'),
		otherSide: el('other-side'), otherHead: el('other-head'), otherDetail: el('other-detail'),
		grid: el('grid'), sessions: el('session-list'), gridHint: el('grid-hint'),
		playerTable: el('player-table'), playerNote: el('player-note'),
		summary: el('summary'), sumDetail: el('sum-detail'),
		sumHomePic: el('sum-home-pic'), sumHomeName: el('sum-home-name'), sumHomeScore: el('sum-home-score'),
		sumAwayPic: el('sum-away-pic'), sumAwayName: el('sum-away-name'), sumAwayScore: el('sum-away-score'),
		signPanel: el('sign-panel'), sfLeague: el('sf-league'), sfDate: el('sf-date'),
		sfHomeName: el('sf-home-name'), sfHomeScore: el('sf-home-score'), sfHomeSig: el('sf-home-sig'), sfHomeCap: el('sf-home-cap'),
		sfAwayName: el('sf-away-name'), sfAwayScore: el('sf-away-score'), sfAwaySig: el('sf-away-sig'), sfAwayCap: el('sf-away-cap'),
		sfDispute: el('sf-dispute'),
		changedSince: el('changed-since'), changedList: el('changed-list'),
		signBtn: el('sign-btn'), disputeBtn: el('dispute-btn'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the team card page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const matchId = new URLSearchParams(location.search).get('m');

	// ─── State ───
	let match = null;          // the row, plus the two team names
	let info = null;           // the league season: league name, season name, rules
	let seasonRow = null;      // the season's reserves
	let fixture = null;        // the fixture this match is on: round, tables
	let lineupState = null;
	let lineup = [];
	let squad = [];
	let rosters = new Map();   // team id -> its players, for the squad and reserve pickers
	let pictures = new Map();  // player id -> avatar path, from the two rosters
	let card = [];
	let cardState = null;
	let changes = [];
	let working = null;        // the side being set up: mine, or the director's choice

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

	// A team's shield, as on the fixtures and season pages, until teams have
	// pictures of their own.
	const SHIELD = 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z';
	function shield() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('d', SHIELD);
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'currentColor');
		path.setAttribute('stroke-width', '2');
		path.setAttribute('stroke-linejoin', 'round');
		svg.append(path);
		return svg;
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
		return box;
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
			.select('id, name, league_season_id')
			.in('id', [data.home_team_id, data.away_team_id]);

		if (teamError) { TDC.showSupabaseError(AREA, teamError, els.status); return false; }

		const byId = new Map((teams || []).map((t) => [t.id, t]));
		match = Object.assign({}, data, {
			home_name: (byId.get(data.home_team_id) || {}).name || 'Home',
			away_name: (byId.get(data.away_team_id) || {}).name || 'Away',
			league_season_id: (byId.get(data.home_team_id) || {}).league_season_id
		});

		els.title.textContent = match.home_name + ' v ' + match.away_name;
		document.title = match.home_name + ' v ' + match.away_name + ' · The Dive Club';
		for (const [pic, name, side] of [
			[els.homePic, els.homeName, 'home'], [els.awayPic, els.awayName, 'away'],
			[els.sumHomePic, els.sumHomeName, 'home'], [els.sumAwayPic, els.sumAwayName, 'away']]) {
			pic.replaceChildren(shield());
			name.textContent = teamName(side);
		}
		els.sfHomeName.textContent = match.home_name;
		els.sfAwayName.textContent = match.away_name;

		// The league's pages, once the match has said which season it is in.
		TDCLeagueNav.show(match.league_season_id);
		return true;
	}

	// ─── The league around it ───
	// For the banner and the signature form only: a failure here is reported
	// and the card still loads, because none of it is needed to score.
	async function loadContext() {
		const [season, row, fx] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: match.league_season_id }),
			supabaseClient.from('tbl_league_seasons').select('max_reserves').eq('id', match.league_season_id).maybeSingle(),
			supabaseClient.from('tbl_league_fixtures').select('round, table_numbers').eq('match_id', matchId).maybeSingle()
		]);
		if (season.error) TDC.showSupabaseError(AREA, season.error, els.status);
		else info = (season.data || [])[0] || null;
		if (row.error) TDC.showSupabaseError(AREA, row.error, els.status);
		else seasonRow = row.data;
		if (fx.error) TDC.showSupabaseError(AREA, fx.error, els.status);
		else fixture = fx.data;
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

		changes = [];
		if (working) {
			const { data, error } = await supabaseClient.rpc('tdc_card_changes_since_signing', {
				p_match_id: matchId, p_side: working
			});
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			changes = data || [];
		}

		render();
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
		renderSetup(locked, both, canSet);
		renderOther(locked, both);
		renderSessions(both);
		renderPlayers(both);
		renderSummary(both);
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
		if (state === 'awaiting') return ['awaiting', 'Waiting on a signature'];
		return ['playing', 'Playing'];
	}

	// ─── The banner ───
	// Both teams, the state as a badge, a line on what happens next, and the
	// fixture's details as label and value pairs.
	function renderBanner(locked, both) {
		const [key, label] = stateOf(both);
		els.jumbo.className = 'jumbo card-jumbo card-state-' + key;
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

	function renderSetup(locked, both, canSet) {
		// Nothing to set up once this side is locked.
		els.setup.hidden = !canSet || !working || locked[working];
		if (els.setup.hidden) return;

		const teamId = working === 'home' ? match.home_team_id : match.away_team_id;
		const roster = rosters.get(teamId) || [];
		const inSquad = new Set(squad.filter((s) => s.side === working).map((s) => s.player_id));

		els.squadHint.textContent = roster.length
			? 'Tick everybody who is here. You can add somebody later — a reserve changes a frame rather than the order.'
			: 'Nobody is on this team yet.';

		els.squadList.replaceChildren(...roster.map((r) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(person(r.player_id, r.display_name));
			const sub = [];
			if (r.is_captain) sub.push('Captain');
			if (r.status !== 'active') sub.push(r.status === 'withdrawn' ? 'Withdrawn' : 'Away');
			if (sub.length) main.append(node('span', 'sub', sub.join(' · ')));

			const actions = node('div', 'list-row-actions');
			const box = document.createElement('input');
			box.type = 'checkbox';
			box.dataset.control = 'ring';   // a tick against a person, not a setting
			box.checked = inSquad.has(r.player_id);
			// The database refuses anybody not active (away or withdrawn);
			// saying so here spares a pointless tap. Confirmation is not asked
			// for, and has not been since 23 Oct.
			box.disabled = r.status !== 'active';
			box.dataset.action = 'squad';
			box.dataset.player = r.player_id;
			box.setAttribute('aria-label', 'Here tonight: ' + r.display_name);
			actions.append(box);

			row.append(main, actions);
			return row;
		}));

		// The order: one row per position, choosing from the squad.
		const available = squad.filter((s) => s.side === working);
		const mySlots = lineup.filter((l) => l.side === working);
		els.orderHint.textContent = available.length
			? 'Your players for the first session, in order. Each keeps their position all night; the rest of the night follows from the rotation. A position left empty can still be filled by a reserve or a latecomer until the card is signed.'
			: 'Tick somebody above first — the order is chosen from who is here.';

		els.orderList.replaceChildren(...mySlots.map((slot) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, 'Position ' + slot.lineup_slot));
			if (slot.player_id) main.append(person(slot.player_id, slot.display_name, 'card-person-sm'));
			row.append(main);

			const actions = node('div', 'list-row-actions');
			const pick = document.createElement('select');
			pick.dataset.control = 'none';   // a list of players: a pill would scroll on beside the position
			pick.dataset.action = 'slot';
			pick.dataset.slot = slot.lineup_slot;
			pick.setAttribute('aria-label', 'Who plays position ' + slot.lineup_slot);
			pick.append(new Option('Nobody yet', '', false, !slot.player_id));
			for (const s of available) {
				pick.append(new Option(s.display_name, s.player_id, false, s.player_id === slot.player_id));
			}
			actions.append(pick);
			row.append(actions);
			return row;
		}));

		const filled = mySlots.filter((s) => s.player_id).length;
		els.lockBtn.textContent = filled === mySlots.length
			? 'Lock the lineup'
			: `Lock the lineup (${filled} of ${mySlots.length} filled)`;
	}

	function renderOther(locked, both) {
		const other = working === 'home' ? 'away' : 'home';
		els.otherSide.hidden = both || !working;
		if (els.otherSide.hidden) return;

		const theirs = lineup.filter((l) => l.side === other);
		const hidden = theirs.filter((l) => l.hidden).length;
		const named = theirs.filter((l) => l.player_id).length;

		els.otherHead.textContent = teamName(other);
		els.otherDetail.textContent = locked[other]
			? 'Locked. Their order is sealed until you lock yours — ' + (hidden + named) + ' of ' + theirs.length + ' positions filled.'
			: 'Still choosing. ' + (hidden + named) + ' of ' + theirs.length + ' positions filled so far.';
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
	function sessionBlock(heading, frames, strict, nextOpen) {
		const block = node('section', 'cs-session');
		block.append(node('h3', 'cs-title', heading));

		const grid = node('div', 'cs-grid');
		const head = node('div', 'cs-row cs-head');
		head.append(node('span', 'cs-team cs-home', match.home_name), node('span', 'cs-team cs-away', match.away_name));
		grid.append(head);

		for (const f of frames) grid.append(frameRow(f, strict, nextOpen));

		const total = node('div', 'cs-row cs-total');
		const both = node('div', 'cs-tots');
		for (const side of ['home', 'away']) {
			const cell = node('span', 'cs-tot cs-' + side);
			cell.append(node('span', 'cs-tot-label', 'Total'),
				node('span', 'cs-tot-value', String(frames.filter((f) => f.winner_side === side).length)));
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
		if (side === 'home') sub.push('Frame ' + f.frame_no);
		if (pos) sub.push((side === 'home' ? 'H' : 'A') + pos);
		if (f.result_event === 'default' && f.winner_side === side) sub.push('Walkover');
		cell.append(node('span', 'cs-sub', sub.join(' · ')));
		return cell;
	}

	// L over W, each a three-way switch (UV, 24 Oct): home at the left,
	// nobody in the middle, away at the right. L is who won the lag (the
	// frame's break_side), W who won the frame. A viewer who may not enter the
	// frame sees them as they stand, greyed.
	function toggles(f, mayEnter) {
		const cell = node('div', 'cs-toggles');
		for (const [action, letter, value, words] of [
			['lag', 'L', f.break_side, 'won the lag'],
			['win', 'W', f.winner_side, 'won the frame']]) {
			const line = node('span', 'cs-tog cs-tog-' + action);
			const pick = document.createElement('select');
			pick.dataset.control = 'tri';
			// The lag in the warning colour with a spotted cue ball (UV, 24 Oct),
			// so it never reads as the result.
			if (action === 'lag') { pick.dataset.icon = 'cue'; pick.dataset.tone = 'warning'; }
			// The action and frame tell the page's redraw which live control
			// this is, so its animation carries on (tdc-controls.js).
			pick.dataset.action = action;
			pick.dataset.frame = f.frame_no;
			pick.append(
				new Option(match.home_name + ' ' + words, 'home', false, value === 'home'),
				new Option('Nobody yet', '', false, !value),
				new Option(match.away_name + ' ' + words, 'away', false, value === 'away'));
			pick.disabled = !mayEnter;
			pick.setAttribute('aria-label', (action === 'lag' ? 'Lag' : 'Winner') + ', frame ' + f.frame_no);
			line.append(node('span', 'cs-tog-key' + (value === 'home' ? ' is-on' : ''), letter), pick,
				node('span', 'cs-tog-key' + (value === 'away' ? ' is-on' : ''), letter));
			cell.append(line);
		}
		return cell;
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
		return false;   // a player records their own frame on the match page
	}

	// ─── Every player's frames ───
	// One column per position on each side, headed by the player in it
	// tonight, a row per session: 1 for a frame won, 0 for one lost, a dash
	// for one not played yet. Totals at the foot. A frame played by a reserve
	// is marked, since the column is the position's.
	function renderPlayers(both) {
		if (!both || !card.length) return;
		const positions = teamSize() || Math.max(0, ...card.map((f) => Math.max(posOf(f, 'home') || 0, posOf(f, 'away') || 0)));
		const sessions = [...new Set(card.map((f) => f.session || 1))];
		const range = Array.from({ length: positions }, (_, i) => i + 1);
		let reserves = false;

		const headCell = (side, pos) => {
			const th = node('th', 'cp-player');
			const slot = lineup.find((l) => l.side === side && l.lineup_slot === pos) || {};
			if (slot.player_id) {
				th.append(avatar(slot.player_id, slot.display_name), node('span', 'cp-name', slot.display_name));
			} else {
				th.append(node('span', 'cp-name', 'Empty'));
			}
			th.append(node('span', 'cp-pos', (side === 'home' ? 'H' : 'A') + pos));
			return th;
		};

		const thead = node('thead');
		const top = node('tr', 'cp-teams');
		top.append(node('th'));
		const homeTh = node('th', 'cp-team', match.home_name); homeTh.colSpan = positions;
		const awayTh = node('th', 'cp-team', match.away_name); awayTh.colSpan = positions;
		top.append(homeTh, node('th', 'cp-sep'), awayTh);
		const names = node('tr');
		names.append(node('th', 'cp-label', 'Sessions'));
		for (const p of range) names.append(headCell('home', p));
		names.append(node('th', 'cp-sep', 'Score'));
		for (const p of range) names.append(headCell('away', p));
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
					const td = node('td', 'num cp-cell');
					if (!f || f.status !== 'complete') {
						td.textContent = '–';
						td.classList.add('is-open');
					} else {
						const won = f.winner_side === side ? 1 : 0;
						totals[side][p - 1] += won;
						td.textContent = String(won);
						if (won) td.classList.add('is-won');
					}
					const id = f && (side === 'home' ? f.home_player_id : f.away_player_id);
					const regular = (lineup.find((l) => l.side === side && l.lineup_slot === p) || {}).player_id;
					if (id && regular && id !== regular) {
						td.append(node('sup', 'cp-reserve', '*'));
						td.title = 'Played by ' + (side === 'home' ? f.home_player : f.away_player) + ', a reserve';
						reserves = true;
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
		els.playerNote.hidden = !reserves;
		els.playerNote.textContent = '* A reserve played this frame for that position.';
	}

	// ─── The result ───
	function renderSummary(both) {
		els.summary.hidden = !both || !card.length;
		if (els.summary.hidden) return;
		const [key] = stateOf(both);
		els.summary.className = 'jumbo card-jumbo card-summary card-state-' + key;

		const home = score('home'), away = score('away');
		els.sumHomeScore.textContent = home;
		els.sumAwayScore.textContent = away;
		els.summary.dataset.lead = home > away ? 'home' : away > home ? 'away' : '';

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
		break_side: 'Break', break_outcome: 'Break outcome', winner_side: 'Winner',
		result_event: 'Result', status: 'Status', abandon_reason: 'Abandoned because',
		referee_player_id: 'Referee', break_player_id: 'Broke'
	};

	function readable(changed) {
		if (!changed) return '';
		return changed.split(', ').map((part) => {
			const key = Object.keys(FIELD).find((k) => part.startsWith(k + ' '));
			if (!key) return part;
			const rest = part.slice(key.length + 1)
				.split(' → ')
				.map((v) => {
					if (v === 'home') return match.home_name;
					if (v === 'away') return match.away_name;
					if (v === '—') return 'nothing';
					return (D.RESULT_EVENT && D.RESULT_EVENT[v])
						|| (D.BREAK_OUTCOME && D.BREAK_OUTCOME[v])
						|| v;
				})
				.join(' → ');
			return FIELD[key] + ': ' + rest;
		}).join(', ');
	}

	// ─── Signatures ───
	// A form waiting to be signed: the league, the date, the teams and their
	// scores side by side, a line for each captain's signature, whether
	// anything is disputed, then the two buttons.
	function renderSignatures(both) {
		els.signPanel.hidden = !both || !card.length;
		if (els.signPanel.hidden) return;

		els.sfLeague.textContent = info ? info.league_name + (info.name ? ' · ' + info.name : '') : '';
		els.sfDate.textContent = match.scheduled_at
			? new Date(match.scheduled_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
			: 'No date set';
		els.sfHomeScore.textContent = score('home');
		els.sfAwayScore.textContent = score('away');

		const sides = (cardState && cardState.sides) || {};
		const sigLine = (side, line, cap) => {
			const s = sides[side];
			line.className = 'sf-line' + (!s ? ' is-empty' : s.current ? ' is-signed' : ' is-stale');
			line.replaceChildren();
			if (s) {
				line.append(node('span', 'sf-signed', 'Signed'),
					node('span', 'sf-when', when(s.at) + (s.current ? '' : ' · the card changed since')));
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

		els.changedSince.hidden = !changes.length;
		els.changedList.replaceChildren(...changes.map((c) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, 'Frame ' + c.frame_no + ' — ' + (readable(c.changed) || c.action)));
			main.append(node('span', 'sub', (c.by_name || 'somebody') + ' · ' + when(c.at)));
			row.append(main);
			return row;
		}));

		const mine = working && sides[working];
		const canSign = working && (lineupState.i_run_it || lineupState.my_side === working)
			&& state !== 'approved' && state !== 'agreed'
			&& !(mine && mine.current);

		els.signBtn.hidden = !canSign;
		els.signBtn.textContent = (mine && !mine.current ? 'Sign again for ' : 'Sign and submit for ') + teamName(working);
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

	els.squadList.addEventListener('change', (e) => {
		const box = e.target.closest('[data-action="squad"]');
		if (!box) return;
		write('Saving', () => supabaseClient.rpc('tdc_set_match_squad', {
			p_match_id: matchId,
			p_player_id: box.dataset.player,
			p_available: box.checked
		}));
	});

	els.orderList.addEventListener('change', (e) => {
		const pick = e.target.closest('[data-action="slot"]');
		if (!pick) return;
		write('Saving', () => supabaseClient.rpc('tdc_set_lineup_slot', {
			p_match_id: matchId,
			p_lineup_slot: parseInt(pick.dataset.slot, 10),
			p_player_id: pick.value || null,
			p_side: working
		}));
	});

	els.lockBtn.addEventListener('click', () => {
		const mySlots = lineup.filter((l) => l.side === working);
		const empty = mySlots.filter((s) => !s.player_id).length;
		const warning = empty
			? `\n\n${empty} ${empty === 1 ? 'position has' : 'positions have'} nobody in. You can put a reserve or a latecomer into those frames until the card is signed; any still empty then are walkovers.`
			: '';
		if (!confirm('Lock this lineup?' + warning + '\n\nThe order cannot be changed afterwards — a late change is a reserve in one frame.')) return;

		write('Locking', () => supabaseClient.rpc('tdc_lock_lineup', {
			p_match_id: matchId, p_side: working
		}), 'Lineup locked.');
	});

	// The reserve pickers and the L and W switches, all inside the sessions.
	els.sessions.addEventListener('change', (e) => {
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
		const keys = tri.closest('.cs-tog').querySelectorAll('.cs-tog-key');
		keys[0].classList.toggle('is-on', side === 'home');
		keys[1].classList.toggle('is-on', side === 'away');

		// tdc_record_frame writes the whole frame from what it is sent, so each
		// toggle sends the frame as it stands with its own change laid over:
		// recording the winner keeps the lag, and the lag keeps the winner.
		// The change is also kept on the frame here until the re-read, so a
		// lag and a win set in quick succession do not undo each other (the
		// second used to send the lag as it was before the first).
		const send = (what, change) => {
			Object.assign(f, change, { status: change.status || (f.status === 'complete' ? 'complete' : 'pending') });
			const p = {
				status: f.status,
				winner_side: f.winner_side,
				result_event: f.result_event,
				break_side: f.break_side
			};
			for (const k of Object.keys(p)) if (p[k] === null || p[k] === undefined) delete p[k];
			write(what + ' frame ' + frameNo, () => supabaseClient.rpc('tdc_record_frame', {
				p_match_id: matchId, p_frame_no: frameNo, p_frame: p
			}));
		};

		if (action === 'win' && side) {
			// The winner, and the lag already chosen. Break outcomes and the
			// richer result events belong to the match page, which has the
			// controls for them; this grid is for getting results down fast.
			send('Saving', { status: 'complete', winner_side: side,
				result_event: f.status === 'complete' && f.winner_side === side && f.result_event ? f.result_event : 'win' });
		} else if (action === 'win') {
			// W back to the middle clears the result; the lag stays.
			send('Clearing', { status: 'pending', winner_side: null, result_event: null });
		} else {
			send('Saving', { break_side: side });
		}
	});

	els.signBtn.addEventListener('click', () => {
		const pending = card.filter((f) => f.status === 'pending');
		const empty = pending.filter((f) => !f.home_player_id || !f.away_player_id).length;
		const unplayed = pending.length - empty;
		let warning = '';
		if (empty) warning += `\n\n${empty} ${empty === 1 ? 'frame still has an empty seat and becomes a walkover' : 'frames still have an empty seat and become walkovers'} to the side that turned up.`;
		if (unplayed) warning += `\n\n${unplayed} ${unplayed === 1 ? 'frame has' : 'frames have'} no result. Signing says this is the final card, not that every frame was played.`;
		if (!confirm('Sign this card for ' + teamName(working) + '?' + warning)) return;

		write('Signing', () => supabaseClient.rpc('tdc_submit_card', {
			p_match_id: matchId, p_side: working
		}), 'Signed.');
	});

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

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!matchId) {
			TDC.error(AREA, 'no match in the address. Open this page from the fixtures.', null, els.status);
			return;
		}

		if (!await loadMatch()) return;
		if (!await loadRosters()) return;
		await loadContext();

		// The cutoff is evaluated when somebody opens the night, which is what
		// makes it lazy — there is no scheduled job. It does nothing unless
		// the cutoff has passed, and a failure here must not stop the page
		// loading, so it is reported and then stepped over.
		const { error } = await supabaseClient.rpc('tdc_apply_lineup_cutoff', { p_match_id: matchId });
		if (error) TDC.showSupabaseError(AREA, error, els.status);

		await loadAll();
	})();
})();
