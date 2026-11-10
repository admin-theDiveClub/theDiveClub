// A tournament's Rules tab (UV, 10 Nov): the rules as a written document, as a
// league's are (league-rules.js; rules-doc.js draws both). Signed-in only, as the
// Draw is; the Poster is the tournament's page for a stranger.
//
// Unlike a team night, a singles match settles by the approval mode, so Approval
// and the Dispute window are clauses here. A round's own rules are listed as what
// differs from the tournament's, as on the poster.
//
// Needs: tdc.js, match-settings.js, rules-doc.js, tournament-nav.js.

TDCTournamentNav.panel('rules', () => {
	const AREA = 'Tournament rules';
	const D = TDCMatchDef;
	const R = TDCRulesDoc;
	const { plural } = R;
	const tournamentId = new URLSearchParams(location.search).get('t');
	const el = (id) => document.getElementById(id);
	const els = {
		status: el('tr-status'), doc: el('tr-doc'), name: el('tr-name'),
		intro: el('tr-intro'), body: el('tr-body'), people: el('tr-people')
	};

	const FORMAT = {
		single_elimination: ['Single elimination', 'Lose one match and you are out.'],
		double_elimination: ['Double elimination', 'Every player has two lives: a first loss drops them into the losers’ bracket, and a second puts them out.'],
		round_robin: ['Round robin', 'Everybody plays everybody.'],
		groups_knockout: ['Groups then knockout', 'Players start in groups, then whoever comes through plays a knockout.']
	};

	let tournament = null;
	let officials = [];
	let roundRows = [];
	let lastRound = 0;

	// ─── What each setting means in a tournament ───
	const words = Object.assign(R.sharedWords({
		sides: 'players', runner: 'the tournament', onExpiry: 'the frame being played is finished'
	}), {
		win_condition_type: (r) => ({
			race_to: 'The first player to ' + r.win_condition_target + ' frames wins the match.',
			best_of: 'The match is the best of ' + r.win_condition_target + ' frames, and the player who wins the majority wins it.',
			fixed_frames: 'The match is ' + r.win_condition_target + ' frames, and the player who wins more of them wins it.',
			timed: 'The player ahead when time is called wins the match.',
			free_play: 'There is no target. Frames are counted and no winner is declared.'
		})[r.win_condition_type],
		score_entry_mode: (r) => ({
			players: 'Players enter the scores of their own match. Whoever runs the tournament may enter any score.',
			scorer: 'Scores are entered by a scorer, a referee or whoever runs the tournament.',
			referee: 'Scores are entered by a referee or whoever runs the tournament.',
			td_only: 'Only whoever runs the tournament enters scores.'
		})[r.score_entry_mode],
		approval_mode: (r) => ({
			none: 'A result is final as soon as the card is submitted, and the card locks.',
			dispute_window: 'A result is published as soon as the card is submitted, and the card locks.',
			coordinator_approval: 'A result is published once whoever runs the tournament approves it, and the card then locks.',
			both: 'A result is published once whoever runs the tournament approves it, and the card then locks.'
		})[r.approval_mode],
		dispute_window_hours: (r) => (r.dispute_window_hours
			? 'A player has ' + plural(r.dispute_window_hours, 'hour') + ' to object to a result. An objection does not re-open the card: it goes to whoever runs the tournament, who lets the result stand or changes the score.'
			: 'There is no time set aside for objecting to a result.')
	});

	// ─── Clauses that come from the tournament itself ───
	function drawClauses() {
		const t = tournament;
		const rows = [
			['Going through', t.progression === 'manual'
				? 'Whoever runs the tournament moves each winner into their next match.'
				: 'The winner of a match goes through to their next match automatically.'],
			['Starting a match', t.create_matches === 'manual'
				? 'Whoever runs the tournament starts each match when a table is free.'
				: 'A match starts as soon as both of its players are known.']
		];
		if (t.third_place) rows.push(['Third place', 'The two players who lose their semi-finals play off for third place.']);
		rows.push(['Byes and walkovers', 'A player with a bye goes through without playing. Whoever runs the tournament can also award a match without it being played, for a walkover or a withdrawal.']);
		return rows;
	}

	const roundName = (round) => {
		if (round === lastRound) return 'Final';
		if (round === lastRound - 1) return 'Semi-finals';
		if (round === lastRound - 2) return 'Quarter-finals';
		return 'Round ' + round;
	};

	// Each round with rules of its own: only what differs, an off switch
	// included, since there it is the news.
	function roundClauses(base) {
		const out = [];
		for (const rr of roundRows) {
			const rules = rr.rules || {};
			const whole = Object.assign({}, base, rules);
			const changes = [];
			for (const def of D.SETTINGS) {
				if (def.scope !== 'rules' || def.key === 'win_condition_target') continue;
				if (rules[def.key] === undefined) continue;
				const differs = JSON.stringify(rules[def.key]) !== JSON.stringify(base[def.key])
					|| (def.key === 'win_condition_type' && rules.win_condition_target !== base.win_condition_target);
				if (!differs || (def.when && !def.when(whole))) continue;
				changes.push(R.label(def) + ': ' + R.value(def, whole));
			}
			if (!changes.length) continue;
			const title = rr.bracket === 'third_place' ? 'Third place'
				: rr.bracket === 'main' ? roundName(rr.round) : 'Round ' + rr.round;
			out.push([title, changes.join('. ') + '.']);
		}
		return out;
	}

	// ─── The document ───
	function render() {
		const rules = tournament.rules || {};
		const format = FORMAT[tournament.format] || [tournament.format, ''];
		const rounds = roundClauses(rules);
		els.name.textContent = tournament.name;
		els.intro.replaceChildren(...R.intro([
			'These rules apply to every match played in ' + tournament.name + ', in every round' + (rounds.length ? ', except where a round below has rules of its own.' : '.'),
			'Whoever runs the tournament sets them, and each match keeps its own copy from the moment it is created. If the rules change, matches not yet under way follow the change. A match with a frame on its card keeps the rules it began with, so nothing already played is ever rescored.'
		]));
		els.body.replaceChildren(...R.sections([
			{ title: 'Format', rows: [['Tournament format', format[1], format[0]]], keys: ['discipline', 'win_condition_type', 'draws_allowed'] },
			{ title: 'The draw', after: drawClauses() },
			{ title: 'Rounds with their own rules', after: rounds },
			{ title: 'At the table', keys: ['track_breaks', 'break_determination', 'break_finish_enabled', 'golden_break_enabled', 'reverse_break_finish_enabled', 'break_finish_requires_breaker', 'referee_required'] },
			{ title: 'Timing', keys: ['max_match_minutes', 'shot_clock_enabled'] },
			{ title: 'Scores and results', keys: ['score_entry_mode', 'approval_mode', 'dispute_window_hours'], after: [
				['A score set by the director', 'Whoever runs the tournament can set a match’s score, with a reason given. That score stands in place of the frames and is published at once.']
			] }
		], rules, { words, leftOut: ['team_size', 'rotation', 'strict_frame_order', 'lineup_cutoff_hours'] }));

		const directors = officials.filter((o) => o.role === 'director');
		R.contact(els.people, directors.length ? directors : officials);
		els.doc.hidden = false;
	}

	// ─── Reading ───
	async function load() {
		const [t, people, rounds, last] = await Promise.all([
			supabaseClient.from('tbl_tournaments').select('name, format, third_place, progression, create_matches, rules').eq('id', tournamentId).maybeSingle(),
			supabaseClient.rpc('tdc_competition_officials', { p_tournament_id: tournamentId }),
			supabaseClient.rpc('tdc_round_rules', { p_tournament_id: tournamentId }),
			supabaseClient.from('tbl_tournament_fixtures').select('round').eq('tournament_id', tournamentId).eq('bracket', 'main').order('round', { ascending: false }).limit(1)
		]);
		const failed = t.error || people.error || rounds.error || last.error;
		if (failed) { TDC.showSupabaseError(AREA, failed, els.status); return; }
		if (!t.data) {
			TDC.error(AREA, 'no tournament with that id. Check the link.', { tournamentId }, els.status);
			return;
		}
		tournament = t.data;
		roundRows = rounds.data || [];
		lastRound = (last.data && last.data[0] && last.data[0].round) || 0;

		// The officials' read has no pictures; any signed-in player may read them.
		officials = people.data || [];
		const ids = officials.map((o) => o.player_id);
		if (ids.length) {
			const pics = await supabaseClient.from('tbl_players').select('id, avatar_path').in('id', ids);
			if (pics.error) { TDC.showSupabaseError(AREA, pics.error, els.status); return; }
			const byId = new Map((pics.data || []).map((p) => [p.id, p.avatar_path]));
			officials = officials.map((o) => Object.assign({}, o, { avatar_path: byId.get(o.player_id) }));
		}
		render();
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!await TDC.requireSession(AREA)) return;
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}
		await load();
	})(), AREA);

	// Shown again as a tab: read again, so a rule saved on Settings shows here.
	return { refresh: () => load().catch((err) => TDC.error(AREA, 'the rules could not be read again.', err, els.status)) };
});
