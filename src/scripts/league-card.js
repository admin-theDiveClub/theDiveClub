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
// Writes: tdc_set_match_squad, tdc_set_lineup_slot, tdc_lock_lineup,
// tdc_swap_frame_player, tdc_record_frame, tdc_submit_card, tdc_answer_card.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'Team card';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('m-title'), meta: el('m-meta'),
		stateLine: el('state-line'), stateDetail: el('state-detail'),
		setup: el('setup'), sideSwitch: el('side-switch'), sidePick: el('side-pick'),
		squadHint: el('squad-hint'), squadList: el('squad-list'),
		orderHint: el('order-hint'), orderList: el('order-list'),
		lockBtn: el('lock-btn'),
		otherSide: el('other-side'), otherHead: el('other-head'), otherDetail: el('other-detail'),
		grid: el('grid'), gridScore: el('grid-score'), gridHint: el('grid-hint'), frames: el('frame-list'),
		signPanel: el('sign-panel'), signHome: el('sign-home'), signAway: el('sign-away'),
		changedSince: el('changed-since'), changedList: el('changed-list'),
		signBtn: el('sign-btn'), disputeBtn: el('dispute-btn'),
		status: el('page-status'), fixturesLink: el('fixtures-link')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the team card page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const matchId = new URLSearchParams(location.search).get('m');

	// ─── State ───
	let match = null;          // the row, plus the two team names
	let lineupState = null;
	let lineup = [];
	let squad = [];
	let rosters = new Map();   // team id -> its players, for the squad and reserve pickers
	let card = [];
	let cardState = null;
	let changes = [];
	let working = null;        // the side being set up: mine, or the director's choice
	let busy = false;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	const teamName = (side) => side === 'home' ? match.home_name : match.away_name;

	function when(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable time: ' + iso); return ''; }
		return d.toLocaleString([], {
			weekday: 'short', day: 'numeric', month: 'short',
			hour: '2-digit', minute: '2-digit'
		});
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
		els.meta.textContent = when(match.scheduled_at);
		els.fixturesLink.href = '/leagues/fixtures/?s=' + encodeURIComponent(match.league_season_id);
		return true;
	}

	// ─── The rosters behind the squad picker ───
	// Read once: a roster does not change during a night, and this is two
	// requests rather than two on every redraw.
	async function loadRosters() {
		for (const id of [match.home_team_id, match.away_team_id]) {
			if (rosters.has(id)) continue;
			const { data, error } = await supabaseClient.rpc('tdc_team_roster', { p_team_id: id });
			if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
			rosters.set(id, data || []);
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

		renderState(locked, both);
		renderSwitch(both);
		renderSetup(locked, both, canSet);
		renderOther(locked, both);
		renderGrid(both);
		renderSignatures(both);
	}

	function renderState(locked, both) {
		const state = cardState && cardState.state;

		if (!both) {
			const waiting = [];
			if (!locked.home) waiting.push(match.home_name);
			if (!locked.away) waiting.push(match.away_name);
			els.stateLine.textContent = 'Lineups not in yet';
			els.stateDetail.textContent = 'Waiting on ' + waiting.join(' and ')
				+ '. The frames are made when the second lineup is locked.'
				+ (lineupState.cutoff_at
					? ' A side with nothing in by ' + when(lineupState.cutoff_at) + ' concedes.'
					: '');
			return;
		}

		if (state === 'agreed') {
			els.stateLine.textContent = 'Both captains have signed';
			els.stateDetail.textContent = 'The card is agreed. Only the league director can change it now.';
		} else if (state === 'approved') {
			els.stateLine.textContent = 'Published';
			els.stateDetail.textContent = 'The league director has approved this result.';
		} else if (state === 'disputed') {
			els.stateLine.textContent = 'Disputed';
			els.stateDetail.textContent = (cardState.note || '') + ' The card is open again.';
		} else if (state === 'awaiting') {
			const out = cardState.waiting_on;
			els.stateLine.textContent = 'Waiting on a signature';
			els.stateDetail.textContent = out === 'both'
				? 'The card changed, so neither signature stands any more.'
				: 'Waiting on ' + teamName(out) + '.';
		} else {
			els.stateLine.textContent = 'Playing';
			els.stateDetail.textContent = 'Record each frame as it finishes. Both captains sign at the end.';
		}

		// A lineup locked by the clock rather than by a person is worth saying
		// plainly, because somebody will otherwise wonder who did it.
		const byCutoff = [];
		if (lineupState.home_by_cutoff) byCutoff.push(match.home_name);
		if (lineupState.away_by_cutoff) byCutoff.push(match.away_name);
		if (byCutoff.length) {
			els.stateDetail.textContent += ' ' + byCutoff.join(' and ')
				+ (byCutoff.length === 1 ? ' did not put a lineup in before the cutoff.' : ' did not put lineups in before the cutoff.');
		}
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
			main.append(node('span', null, r.display_name));
			const sub = [];
			if (r.is_captain) sub.push('Captain');
			if (r.status !== 'active') sub.push(r.status === 'withdrawn' ? 'Withdrawn' : 'Away');
			if (sub.length) main.append(node('span', 'sub', sub.join(' · ')));

			const actions = node('div', 'list-row-actions');
			const box = document.createElement('input');
			box.type = 'checkbox';
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

	// ─── The grid ───
	function renderGrid(both) {
		els.grid.hidden = !both || !card.length;
		if (els.grid.hidden) return;

		const home = card.filter((f) => f.winner_side === 'home').length;
		const away = card.filter((f) => f.winner_side === 'away').length;
		els.gridScore.hidden = false;
		els.gridScore.textContent = home + ' – ' + away;

		const strict = !!(match.rules && match.rules.strict_frame_order);
		// Under a strict order only the next unplayed frame may be entered,
		// which is a nationals rule; most league play lets a scorer record
		// whichever table finishes first.
		const nextOpen = strict
			? (card.find((f) => f.status === 'pending') || {}).frame_no
			: null;

		const empty = card.filter((f) => f.status === 'pending' && (!f.home_player_id || !f.away_player_id)).length;
		els.gridHint.textContent = (strict
			? 'Frames must be played in order, so only frame ' + (nextOpen || '—') + ' can be entered.'
			: 'Record each frame as it finishes, in any order.')
			+ (empty
				? ' ' + empty + (empty === 1 ? ' frame has' : ' frames have') + ' an empty seat: put a reserve or a latecomer in, or it is a walkover when the card is signed.'
				: '')
			+ noReserveNote();

		// One heading per session. Frames are numbered session by session,
		// so the card is already in that order.
		const rows = [];
		let session = null;
		for (const f of card) {
			if (f.session && f.session !== session && card.some((g) => g.session > 1)) {
				session = f.session;
				rows.push(node('h3', null, 'Session ' + session));
			}
			rows.push(frameRow(f, strict, nextOpen));
		}
		els.frames.replaceChildren(...rows);
	}

	function frameRow(f, strict, nextOpen) {
		const row = node('div', 'list-row');
		const main = node('div', 'list-row-main');

		const seat = (name) => name || 'empty seat';
		main.append(node('span', null, 'Frame ' + f.frame_no + ': ' + seat(f.home_player) + '  v  ' + seat(f.away_player)));

		const sub = [];
		if (f.home_position && f.away_position) sub.push('H' + f.home_position + ' v A' + f.away_position);
		const oneSeat = !f.home_player_id || !f.away_player_id;
		if (f.result_event === 'default') sub.push('Walkover');
		else if (f.status === 'complete') sub.push('Won by ' + (f.winner_side === 'home' ? match.home_name : match.away_name));
		else if (f.status === 'pending' && oneSeat) sub.push('Waiting for a player');
		else if (f.status === 'pending') sub.push('Not played');
		if (sub.length) main.append(node('span', 'sub', sub.join(' · ')));

		// A walkover is settled, so there is nothing to enter; and a frame
		// with an empty seat has nobody to win it until somebody sits down.
		const settled = f.result_event === 'default';
		const lockedCard = cardState && (cardState.state === 'agreed' || cardState.state === 'approved');
		const mayEnter = !settled && !lockedCard && !oneSeat
			&& (!strict || f.frame_no === nextOpen)
			&& canRecord(f);

		if (f.status === 'pending' && !lockedCard) {
			for (const side of ['home', 'away']) {
				const pick = reservePick(f, side);
				if (pick) main.append(pick);
			}
		}

		if (mayEnter) {
			const actions = node('div', 'btn-row');
			for (const side of ['home', 'away']) {
				const b = node('button',
					'btn btn-sm ' + (f.winner_side === side ? 'btn-primary' : 'btn-secondary'),
					(side === 'home' ? match.home_name : match.away_name) + ' won');
				b.type = 'button';
				b.dataset.action = 'won';
				b.dataset.frame = f.frame_no;
				b.dataset.side = side;
				actions.append(b);
			}
			main.append(actions);

			// Who broke, directly under each side's win button, when the rules
			// leave it to the table: a lag before every frame, or the sheet.
			// Pressing the chosen side again takes it off.
			const tableDecides = match.rules && match.rules.track_breaks
				&& (match.rules.break_determination === 'lag_each_frame'
					|| match.rules.break_determination === 'by_schedule');
			if (tableDecides) {
				const lag = match.rules.break_determination === 'lag_each_frame';
				const breaks = node('div', 'btn-row');
				for (const side of ['home', 'away']) {
					const b = node('button',
						'btn btn-sm ' + (f.break_side === side ? 'btn-primary' : 'btn-secondary'),
						(lag ? 'Lag: ' : 'Breaks: ') + (side === 'home' ? match.home_name : match.away_name));
					b.type = 'button';
					b.dataset.action = 'break';
					b.dataset.frame = f.frame_no;
					b.dataset.side = side;
					b.setAttribute('aria-pressed', f.break_side === side ? 'true' : 'false');
					breaks.append(b);
				}
				main.append(breaks);
			}

			if (f.status === 'complete') {
				const tail = node('div', 'btn-row');
				const undo = node('button', 'btn btn-secondary btn-sm', 'Clear result');
				undo.type = 'button';
				undo.dataset.action = 'clear';
				undo.dataset.frame = f.frame_no;
				tail.append(undo);
				main.append(tail);
			}
		}

		row.append(main);
		return row;
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
		pick.dataset.control = 'none';   // a list of players, inside a frame row
		pick.dataset.action = 'reserve';
		pick.dataset.frame = f.frame_id;
		pick.setAttribute('aria-label', (current ? 'Reserve for ' : 'Player for ') + teamName(side) + ' in frame ' + f.frame_no);
		pick.append(new Option(current ? teamName(side) + ': reserve…' : teamName(side) + ': who sits here?', '', true, true));
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
	function renderSignatures(both) {
		els.signPanel.hidden = !both || !card.length;
		if (els.signPanel.hidden) return;

		const sides = (cardState && cardState.sides) || {};
		const line = (side) => {
			const s = sides[side];
			if (!s) return teamName(side) + ' — not signed.';
			return teamName(side) + ' — signed ' + when(s.at)
				+ (s.current ? '.' : ', but the card has changed since.');
		};
		els.signHome.textContent = line('home');
		els.signAway.textContent = line('away');

		els.changedSince.hidden = !changes.length;
		els.changedList.replaceChildren(...changes.map((c) => {
			const row = node('div', 'list-row');
			const main = node('div', 'list-row-main');
			main.append(node('span', null, 'Frame ' + c.frame_no + ' — ' + (readable(c.changed) || c.action)));
			main.append(node('span', 'sub', (c.by_name || 'somebody') + ' · ' + when(c.at)));
			row.append(main);
			return row;
		}));

		const state = cardState && cardState.state;
		const mine = working && sides[working];
		const canSign = working && (lineupState.i_run_it || lineupState.my_side === working)
			&& state !== 'approved' && state !== 'agreed'
			&& !(mine && mine.current);

		els.signBtn.hidden = !canSign;
		els.signBtn.textContent = mine && !mine.current ? 'Sign again' : 'Sign this card';
		els.disputeBtn.hidden = !working || state === 'approved';
	}

	// ─── Writing ───
	async function write(what, fn, done) {
		if (busy) return false;
		busy = true;
		TDC.status(els.status, what + '…', '');

		const { error } = await fn();
		if (error) {
			await loadAll();
			busy = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return false;
		}

		const ok = await loadAll();
		busy = false;
		if (ok) TDC.status(els.status, done || '', done ? 'success' : '');
		TDC.flushPushes();
		return ok;
	}

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

	els.frames.addEventListener('change', (e) => {
		const pick = e.target.closest('[data-action="reserve"]');
		if (!pick || !pick.value) return;
		write('Saving', () => supabaseClient.rpc('tdc_swap_frame_player', {
			p_frame_id: pick.dataset.frame, p_player_id: pick.value
		}));
	});

	els.frames.addEventListener('click', (e) => {
		const b = e.target.closest('button[data-action]');
		if (!b) return;
		const frameNo = parseInt(b.dataset.frame, 10);
		const f = card.find((x) => x.frame_no === frameNo);
		if (!f) { TDC.error(AREA, 'no frame ' + frameNo + ' on this card.', null, els.status); return; }

		// tdc_record_frame writes the whole frame from what it is sent, so each
		// button sends the frame as it stands with its own change laid over:
		// recording the winner keeps the lag, and the lag keeps the winner.
		const send = (what, change) => {
			const p = Object.assign({
				status: f.status === 'complete' ? 'complete' : 'pending',
				winner_side: f.winner_side,
				result_event: f.result_event,
				break_side: f.break_side
			}, change);
			for (const k of Object.keys(p)) if (p[k] === null || p[k] === undefined) delete p[k];
			write(what + ' frame ' + frameNo, () => supabaseClient.rpc('tdc_record_frame', {
				p_match_id: matchId, p_frame_no: frameNo, p_frame: p
			}));
		};

		if (b.dataset.action === 'won') {
			// The winner, and the lag already chosen. Break outcomes and the
			// richer result events belong to the match page, which has the
			// controls for them; this grid is for getting results down fast.
			send('Saving', { status: 'complete', winner_side: b.dataset.side,
				result_event: f.status === 'complete' && f.winner_side === b.dataset.side && f.result_event ? f.result_event : 'win' });
		} else if (b.dataset.action === 'break') {
			send('Saving', { break_side: f.break_side === b.dataset.side ? null : b.dataset.side });
		} else if (b.dataset.action === 'clear') {
			send('Clearing', { status: 'pending', winner_side: null, result_event: null });
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

		// The cutoff is evaluated when somebody opens the night, which is what
		// makes it lazy — there is no scheduled job. It does nothing unless
		// the cutoff has passed, and a failure here must not stop the page
		// loading, so it is reported and then stepped over.
		const { error } = await supabaseClient.rpc('tdc_apply_lineup_cutoff', { p_match_id: matchId });
		if (error) TDC.showSupabaseError(AREA, error, els.status);

		await loadAll();
	})();
})();
