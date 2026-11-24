// The words a tournament poster is written in (UV, 24 Nov): shared by the
// poster (tournament-poster.js), which draws them, and the poster's settings
// page in a tournament's Manage menu (tournament-poster-settings.js), which
// holds the text for a poster designer. Moved here unchanged from
// tournament-poster.js, so the page and the text can never call the same
// thing two different things.
//
// Needs: tdc.js, match-settings.js.

const TDCPosterWords = (() => {
	const AREA = 'Poster';
	const D = TDCMatchDef;

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	const STATUS = {
		draft: 'Not open yet',
		open: 'Open for entries',
		in_progress: 'Under way',
		complete: 'Finished',
		cancelled: 'Cancelled'
	};

	function startsAt(iso) {
		if (!iso) return 'Date to be announced';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable start date in the snapshot: ' + iso); return ''; }
		return d.toLocaleString([], {
			weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}


	const DEF_BY_KEY = new Map((D.SETTINGS || []).map((s) => [s.key, s]));

	// A select's options may be a function (the sides are named per page), so
	// both shapes have to be handled.
	function optionLabel(def, value) {
		if (!def || def.type !== 'select') return null;
		const opts = typeof def.options === 'function' ? def.options() : def.options;
		return opts && opts[value] !== undefined ? opts[value] : null;
	}

	function ruleText(key, value) {
		const def = DEF_BY_KEY.get(key);

		const chosen = optionLabel(def, value);
		if (chosen !== null) return chosen;

		if (typeof value === 'boolean') return value ? 'Yes' : 'No';

		// A zero on a clock means "no clock", which is not what "0" reads as.
		if (key === 'max_match_minutes') return value > 0 ? value + ' minutes' : 'No match clock';
		if (key === 'shot_clock_seconds' || key === 'shot_clock_first_shot_seconds'
			|| key === 'extension_seconds') return value + ' seconds';

		return String(value);
	}

	// A rule's row on the page: the label without its unit, the value with it
	// ("Match clock" · "45 minutes"), as the league join page words them. The
	// race target is said with the win condition: "Race to 5".
	function ruleRow(def, rules) {
		const v = rules[def.key];
		let value;
		if (def.key === 'win_condition_type') {
			const name = ruleText('win_condition_type', v);
			value = v === 'free_play' || !rules.win_condition_target ? name : name + ' ' + rules.win_condition_target;
		} else if (def.type === 'bool') {
			value = v ? 'Yes' : 'No';
		} else if (def.type === 'int') {
			const unit = /\((\w+)\)$/.exec(def.label);
			value = !v ? 'None'
				: /_seconds$/.test(def.key) ? v + ' s'
				: unit ? v + ' ' + (v === 1 ? unit[1].replace(/s$/, '') : unit[1])
				: String(v);
		} else {
			value = ruleText(def.key, v);
		}
		return [def.label.replace(/\s*\(\w+\)$/, ''), value];
	}

	// A box per settings group, as on the join page. Only what is set (UV,
	// 5 Nov): a switch that is off and a number at 0 are left out, and so is
	// anything a switch makes irrelevant. The snapshot holds only the
	// player-facing keys, so a `when` that asks about another key is answered
	// from the defaults; a poster from before version 2 has no Record who
	// breaks, and its break settings are shown as they always were.
	const withDefaults = (rules) => Object.assign({}, D.DEFAULT_RULES, { track_breaks: true }, rules);

	// The rounds with rules of their own: a box each, holding only what
	// differs from the tournament's rules, an off switch included ("Golden
	// break · No"), since there it is the news.
	function roundRules(s) {
		const base = s.rules || {};
		const out = [];
		for (const rr of s.round_rules || []) {
			const rules = rr.rules || {};
			const whole = withDefaults(rules);
			const rows = [];
			for (const def of D.SETTINGS) {
				if (def.scope !== 'rules' || def.key === 'win_condition_target') continue;
				if (rules[def.key] === undefined) continue;
				const differs = JSON.stringify(rules[def.key]) !== JSON.stringify(base[def.key])
					|| (def.key === 'win_condition_type' && rules.win_condition_target !== base.win_condition_target);
				if (!differs) continue;
				if (def.when && !def.when(whole)) continue;
				rows.push(ruleRow(def, rules));
			}
			if (!rows.length) continue;
			const title = rr.bracket === 'third_place' ? 'Third place'
				: rr.bracket === 'main' ? roundName(rr.round, s.rounds)
				: 'Round ' + rr.round;
			out.push({ title, rows });
		}
		return out;
	}

	function roundName(round, last) {
		if (round === last) return 'Final';
		if (round === last - 1) return 'Semi-finals';
		if (round === last - 2) return 'Quarter-finals';
		return 'Round ' + round;
	}


	// ─────────────────────────────────────────────────────────────────
	// The text output
	//
	// UV's spec: a TD should be able to set a tournament up, copy a block of
	// text describing the whole thing, and hand it to an AI to get a poster
	// back. Built from the same snapshot the page renders, so the two can never
	// describe different tournaments.
	//
	// Written as prose rather than a key-value dump, because that is what an
	// image generator reads well.
	// ─────────────────────────────────────────────────────────────────

	function posterText(s) {
		const lines = [];

		lines.push(s.name);
		lines.push('');

		// "at A", "at A and B", "at A, B and C".
		const names = (s.venues || []).map((v) => v.name);
		const where = names.length
			? ' at ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0])
			: '';
		lines.push(`A ${(FORMAT[s.format] || s.format).toLowerCase()} ${ruleText('discipline', s.rules.discipline)} tournament${where}.`);

		if (s.starts_at) lines.push('Starts ' + startsAt(s.starts_at) + '.');
		if (s.sanctioned) lines.push('Ranked: results count towards the rankings.');
		if (s.third_place) lines.push('The losing semi-finalists play for third place.');

		lines.push('Status: ' + (STATUS[s.status] || s.status) + '.');
		lines.push('');

		// How it is played, as sentences.
		const r = s.rules;
		const how = [];
		if (r.win_condition_type) {
			how.push(`${ruleText('win_condition_type', r.win_condition_type)}${r.win_condition_target ? ' ' + r.win_condition_target : ''} frames`);
		}
		if (r.break_determination) how.push(ruleText('break_determination', r.break_determination).toLowerCase());
		if (r.shot_clock_enabled) {
			how.push(`a ${r.shot_clock_seconds}-second shot clock (${r.shot_clock_first_shot_seconds} on the first shot`
				+ (r.extensions_per_player ? `, ${r.extensions_per_player} extension${r.extensions_per_player === 1 ? '' : 's'} of ${r.extension_seconds}s each` : '')
				+ ')');
		}
		if (r.max_match_minutes > 0) how.push(`a ${r.max_match_minutes}-minute match clock`);
		if (r.break_finish_enabled) how.push('break and finish counts');
		if (r.golden_break_enabled) how.push('golden break counts');
		if (r.referee_required) how.push('refereed');
		if (how.length) { lines.push('Format: ' + how.join(', ') + '.'); lines.push(''); }

		// A round with rules of its own, in the page's words.
		const rounds = roundRules(s);
		for (const r of rounds) {
			lines.push(`${r.title}: ${r.rows.map(([k, v]) => k + ' ' + v).join(', ')}.`);
		}
		if (rounds.length) lines.push('');

		// Entry. A fee of 0 is left out (UV, 5 Nov), as on the page.
		const entry = [];
		if (s.max_entrants) entry.push(`${s.max_entrants} places`);
		if (s.entrants) {
			entry.push(`${s.entrants.confirmed} confirmed`);
			if (s.entrants.interested) entry.push(`${s.entrants.interested} interested`);
		}
		if (s.entry_fee_credits > 0) entry.push(`${s.entry_fee_credits} credits to enter`);
		if (entry.length) { lines.push('Entry: ' + entry.join(', ') + '.'); lines.push(''); }

		if (s.officials && s.officials.length) {
			lines.push('Run by: ' + s.officials.map((o) => `${o.name} (${o.role})`).join(', ') + '.');
			lines.push('');
		}

		if (s.entrant_names && s.entrant_names.length) {
			lines.push('Players: ' + s.entrant_names.join(', ') + '.');
			lines.push('');
		}

		// Results, where there are any. A poster made after the night is a
		// record of it, which was part of the original spec.
		if (s.draw && s.draw.length) {
			const main = s.draw.filter((f) => f.bracket === 'main');
			const last = main.length ? Math.max(...main.map((f) => f.round)) : 0;
			const final = main.find((f) => f.round === last);

			if (final && final.winner) {
				lines.push(`Winner: ${final.winner}.`);
				lines.push('');
			}

			lines.push('Results:');
			for (const f of s.draw) {
				const where2 = f.bracket === 'main' ? roundName(f.round, last) : 'Third place';
				const home = f.home || 'TBD';
				const away = f.away || 'TBD';
				if (f.winner && (!f.home || !f.away)) {
					lines.push(`  ${where2}: ${f.winner} (bye)`);
				} else if (f.home_frames === null || f.home_frames === undefined) {
					lines.push(`  ${where2}: ${home} : ${away}`);
				} else {
					lines.push(`  ${where2}: ${home} ${f.home_frames} — ${f.away_frames} ${away}`
						+ (f.winner && !f.published ? ' (not confirmed)' : ''));
				}
			}
			lines.push('');
		}

		lines.push('The Dive Club');

		return lines.join('\n');
	}


	return { FORMAT, STATUS, startsAt, DEF_BY_KEY, optionLabel, ruleText, ruleRow, withDefaults, roundRules, roundName, posterText };
})();
