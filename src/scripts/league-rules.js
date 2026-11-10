// A league's Rules tab (UV, 10 Nov): the rules as a written document, in
// numbered sections, with whoever to ask at the foot. It was a folded list of
// labels and values on the Season tab. rules-doc.js draws it and holds the words
// a league shares with a tournament.
//
// Two kinds of clause. A setting's clause is worded by WORDS below, from what
// that setting does on a league night. The fixed clauses are how every league
// runs, whatever its settings: the blind exchange of lineups, reserves,
// walkovers, signing the card.
//
// Left out on purpose: Approval and the Dispute window. A team card is settled
// by both captains signing (private.tdc_card_state), whatever those two say,
// so describing them here would promise something a league night does not do.
// They stay on Settings (UV, 10 Nov).
//
// Open to signed-out visitors as the Season tab is, from the same public read;
// that read gives no player ids, so the league director is then not a link.
//
// Needs: tdc.js, match-settings.js, rules-doc.js, league-nav.js.

TDCLeagueNav.panel('rules', () => {
	const AREA = 'League rules';
	const R = TDCRulesDoc;
	const { plural } = R;
	const seasonId = new URLSearchParams(location.search).get('s');
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('ru-status'), doc: el('ru-doc'), league: el('ru-league'),
		intro: el('ru-intro'), body: el('ru-body'), people: el('ru-people')
	};

	let signedOut = false;
	let info = null;
	let reserves = 0;
	let officials = [];

	// ─── What each setting means on a league night ───
	const PLAYED_OUT = 'The card is still played to the end, because every frame counts in the standings.';
	const words = Object.assign(R.sharedWords({
		sides: 'teams', runner: 'the league', onExpiry: 'the frames being played are finished'
	}), {
		win_condition_type: (r) => ({
			race_to: 'The first team to ' + r.win_condition_target + ' frames wins the match. ' + PLAYED_OUT,
			best_of: 'The team that wins the majority of the frames wins the match. ' + PLAYED_OUT,
			fixed_frames: 'The team that wins more frames over the whole card wins the match.',
			timed: 'The team ahead when time is called wins the match.',
			free_play: 'There is no target. Frames are counted and no winner is declared.'
		})[r.win_condition_type],
		team_size: (r) => {
			const n = r.team_size;
			let text = 'Each team fields ' + n + ' players. A match is ' + n + ' sessions of ' + n + ' frames, ' + n * n + ' frames in all, and each frame is one game between two named players.';
			if (reserves) text += ' A team may hold up to ' + (n + reserves) + ' active players: its ' + n + ' and ' + plural(reserves, 'reserve') + '. A player marked away does not count towards that limit.';
			return text;
		},
		rotation: (r) => (r.rotation
			? 'Whoever runs the league has set its own table of who meets whom, and every session follows it.'
			: 'After the first session the away order moves along one place each session, so every home player meets every away player once.'),
		strict_frame_order: (r) => (r.strict_frame_order
			? 'Frames are played in the order on the card, and only the next frame can be entered.'
			: 'Frames may be played in any order as tables come free, and each can be entered as it finishes.'),
		lineup_cutoff_hours: (r) => (r.lineup_cutoff_hours
			? 'Each lineup must be locked ' + plural(r.lineup_cutoff_hours, 'hour') + ' before the match is due to start. A lineup not locked by then is locked as it stands, so a team that has named nobody gives up those frames.'
			: 'There is no cutoff. Captains lock their lineups when they are ready.'),
		score_entry_mode: (r) => ({
			players: 'Players enter the result of their own frame. Captains and whoever runs the league may enter any frame.',
			scorer: 'Scores are entered by a scorer, a referee or whoever runs the league.',
			referee: 'Scores are entered by a referee or whoever runs the league.',
			td_only: 'Only whoever runs the league enters scores.'
		})[r.score_entry_mode]
	});
	const ownValue = (def, r) => (def.key === 'team_size'
		? r.team_size + ' a side' + (reserves ? ', up to ' + plural(reserves, 'reserve') : '')
		: null);

	// ─── Clauses that hold in every league ───
	const lineupClauses = () => {
		const size = info.rules && info.rules.team_size;
		return [
			['Naming a lineup', 'Each captain says who is available for the night and sets the order for the first session.'
				+ (size ? ' Every later session follows from that order.' : '')],
			['Blind exchange', 'Neither captain can see the other team’s order until both have locked theirs.'],
			['Once locked', 'When both lineups are locked the frames are made, and the order can no longer change. Only a reserve coming in can change who plays a frame.']
		];
	};
	const reserveClause = () => (reserves
		? ['Reserves', 'A reserve replaces a player for one frame at a time and never changes the number of frames. No player may play more than one frame in a session, a player in the lineup stays in the same position every session, and a reserve may not face the same opponent twice.']
		: ['Reserves', 'This season has no reserves.']);
	const SEAT_CLAUSE = ['Empty seats', 'A seat left empty can be filled by a reserve or a latecomer until the card is signed. A frame with a seat still empty then is a walkover to the side that turned up.'];
	const SIGNING_CLAUSES = [
		['Signing the card', 'A match is finished when both captains have signed the same card. Signing means this is the final card, so it may be signed with frames unplayed, and those frames count for nobody. If a captain will not sign, the league director can sign for that side.'],
		['Changes after signing', 'If a frame is changed after the card is signed, both signatures stop counting and the match is re-opened until both captains sign again. Every change is listed on the card, with who made it.'],
		['Disputes', 'A captain who disagrees with the card can raise a dispute, which re-opens it.'],
		['The standings', 'Standings are counted from matches both captains have signed. The Live switch on the Standings tab also shows matches still being played, and those are not final.']
	];

	// ─── The document ───
	function render() {
		const rules = info.rules || {};
		els.league.textContent = info.league_name + ' · ' + info.name;
		els.intro.replaceChildren(...R.intro([
			'These rules apply to every match played in ' + info.league_name + ', ' + info.name + ': every team, every night and every frame.',
			'Whoever runs the league sets them, and each match keeps its own copy from the moment it is created. If the rules change during the season, matches not yet under way follow the change. A match with a locked lineup or a frame on its card keeps the rules it began with, so nothing already played is ever rescored.'
		]));
		els.body.replaceChildren(...R.sections([
			{ title: 'Format', keys: ['discipline', 'win_condition_type', 'draws_allowed'] },
			{ title: 'The match', keys: ['team_size', 'rotation', 'strict_frame_order'] },
			{ title: 'Lineups and reserves', rows: lineupClauses(), keys: ['lineup_cutoff_hours'], after: [reserveClause(), SEAT_CLAUSE] },
			{ title: 'At the table', keys: ['track_breaks', 'break_determination', 'break_finish_enabled', 'golden_break_enabled', 'reverse_break_finish_enabled', 'break_finish_requires_breaker', 'referee_required'] },
			{ title: 'Timing', keys: ['max_match_minutes', 'shot_clock_enabled'] },
			{ title: 'Scores and signing', keys: ['score_entry_mode'], after: SIGNING_CLAUSES }
		], rules, { words, ownValue, leftOut: ['approval_mode', 'dispute_window_hours'] }));

		const directors = officials.filter((o) => o.role_name === 'League director');
		R.contact(els.people, directors.length ? directors : officials);
		els.doc.hidden = false;
	}

	// ─── Reading ───
	async function loadPublic() {
		const { data, error } = await supabaseClient.rpc('tdc_public_league_season', { p_league_season_id: seasonId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) { await TDC.requireSession(AREA); return false; }
		info = data;
		reserves = data.max_reserves || 0;
		officials = data.officials || [];
		return true;
	}

	async function loadMember() {
		const [season, row, people] = await Promise.all([
			supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId }),
			supabaseClient.from('tbl_league_seasons').select('max_reserves').eq('id', seasonId).maybeSingle(),
			supabaseClient.rpc('tdc_league_officials', { p_league_season_id: seasonId })
		]);
		const failed = season.error || row.error || people.error;
		if (failed) { TDC.showSupabaseError(AREA, failed, els.status); return false; }
		info = (season.data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}
		reserves = (row.data && row.data.max_reserves) || 0;
		officials = people.data || [];
		return true;
	}

	async function load() {
		if (await (signedOut ? loadPublic() : loadMember())) render();
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the leagues list.', null, els.status);
			return;
		}
		signedOut = !await TDC.getSession(AREA);
		await load();
	})(), AREA);

	// Shown again as a tab: read again, so a rule saved on Settings shows here.
	return { refresh: () => load().catch((err) => TDC.error(AREA, 'the rules could not be read again.', err, els.status)) };
});
