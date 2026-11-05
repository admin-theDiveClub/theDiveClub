// The poster (/tournaments/poster/?t=<id>). The one page that works signed out.
//
// Everything on it comes from one call to tdc_tournament_poster, which returns
// a jsonb snapshot the TD built and stored. There is no second read: the page
// cannot ask for anything the snapshot does not hold, which is the point — anon
// reaches that function and the table behind it and nothing else on the site.
//
// So this page renders a blob rather than querying the tournament. Two things
// follow from that and are deliberate:
//
//   - It can be out of date, and says so. A poster shows the tournament as it
//     was when it was generated. The TD regenerates it.
//   - Keys may be missing. The TD chooses whether entrant names and the draw go
//     in, so every section here checks for its data rather than assuming it.
//
// Entry is the exception: those buttons need an account, so they come from
// tdc_my_entry and only appear once there is a session.
//
// Drawn in the league join page's look (UV, 5 Nov): as much as the snapshot
// holds, and nothing the director left unset. No date, no venue, no limit, a
// fee of 0, a switch that is off: each is left out rather than said.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'Poster';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		nothing: el('nothing'), poster: el('poster'),
		hero: el('p-hero'), pic: el('p-pic'), name: el('p-name'), meta: el('p-meta'),
		statusBadge: el('p-status'), facts: el('p-facts'),
		private: el('p-private'), numbers: el('p-numbers'),
		rulesBox: el('p-rules-box'), rules: el('p-rules'),
		roundsBox: el('p-rounds-box'), rounds: el('p-rounds'),
		namesBox: el('p-names-box'), names: el('p-names'), namesCount: el('p-names-count'),
		drawBox: el('p-draw-box'), draw: el('p-draw'),
		officialsBox: el('p-officials-box'), officials: el('p-officials'),
		entry: el('p-entry'), entryState: el('p-entry-state'), entryDetail: el('p-entry-detail'),
		entryActions: el('p-entry-actions'), entryStatus: el('p-entry-status'),
		text: el('p-text'), copy: el('p-copy'), generated: el('p-generated'),
		links: el('p-links'), status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the poster page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const tournamentId = new URLSearchParams(location.search).get('t');

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
	// How a player gets in, in the words the join page uses for a league.
	const ENTRY = {
		td_only: 'Added by whoever runs it',
		interested: 'Put your name down',
		self_confirm: 'Join straight away'
	};

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};
	const plural = (n, one, many) => (n === 1 ? '1 ' + one : (n || 0) + ' ' + (many || one + 's'));

	// The trophy in the banner's ring: a tournament has no picture of its own.
	const TROPHY = 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';
	function trophy() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const path = document.createElementNS(NS, 'path');
		path.setAttribute('d', TROPHY);
		path.setAttribute('fill', 'currentColor');
		svg.append(path);
		return svg;
	}

	// A picture, or initials. The snapshot holds no player ids, so nothing
	// here opens a profile.
	function face(name, path) {
		const box = node('span', 'person-pic');
		const url = path ? TDC.pictureUrl('player-avatars', path) : null;
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

	function person(name, path, sub) {
		const p = node('span', 'person');
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name));
		if (sub) names.append(node('span', 'person-sub', sub));
		p.append(face(name, path), names);
		return p;
	}

	// ─── State ───
	let snap = null;

	// ─────────────────────────────────────────────────────────────────
	// Dates
	//
	// A poster is read in advance, so this says the day out loud rather than
	// leaning on "in 3 days" — somebody looking at it on a wall has no idea
	// when the page was built.
	// ─────────────────────────────────────────────────────────────────

	function startsAt(iso) {
		if (!iso) return 'Date to be announced';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable start date in the snapshot: ' + iso); return ''; }
		return d.toLocaleString([], {
			weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	// The banner's Date and Time, said apart.
	function dayOf(iso) {
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable start date in the snapshot: ' + iso); return ''; }
		return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	}
	function timeOf(iso) {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
	}

	function generatedWhen(iso) {
		const d = new Date(iso);
		if (isNaN(d)) return '';
		return d.toLocaleString([], {
			day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// The ruleset, in words
	//
	// Labels come from TDCMatchDef.SETTINGS, so the poster and the settings
	// panel call the same setting the same thing. The snapshot only ever holds
	// the player-facing keys — the server decides that, not this page — so this
	// renders whatever it is given and does not filter.
	// ─────────────────────────────────────────────────────────────────

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

	function ruleBox(title, rows) {
		const box = node('section', 'lj-rule-box');
		box.append(node('h3', 'lj-rule-title', title));
		const dl = node('dl', 'lj-rule-list');
		for (const [k, v] of rows) {
			const row = node('div', 'lj-rule');
			row.append(node('dt', null, k), node('dd', null, v));
			dl.append(row);
		}
		box.append(dl);
		return box;
	}

	function renderRules(rules) {
		rules = rules || {};
		// A key with no definition is a setting added to the server list and
		// not to TDCMatchDef. Said out loud rather than dropped silently.
		for (const key of Object.keys(rules)) {
			if (!DEF_BY_KEY.has(key)) TDC.error(AREA, 'the poster carries a setting this page has no label for: ' + key);
		}
		const whole = withDefaults(rules);
		const boxes = [];
		for (const group of D.GROUPS) {
			const rows = [];
			for (const def of D.SETTINGS) {
				if (def.group !== group || def.scope !== 'rules') continue;
				if (def.key === 'win_condition_target') continue;   // said with the win condition
				const v = rules[def.key];
				if (v === undefined || v === null || v === false || v === 0) continue;
				if (def.when && !def.when(whole)) continue;
				rows.push(ruleRow(def, rules));
			}
			if (rows.length) boxes.push(ruleBox(group, rows));
		}
		els.rulesBox.hidden = !boxes.length;
		els.rules.replaceChildren(...boxes);
	}

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

	function renderRoundRules(s) {
		const boxes = roundRules(s).map((r) => ruleBox(r.title, r.rows));
		els.roundsBox.hidden = !boxes.length;
		els.rounds.replaceChildren(...boxes);
	}

	// ─────────────────────────────────────────────────────────────────
	// The draw
	//
	// Grouped by round. A fixture with nobody in it yet is still drawn, because
	// an empty bracket is what a draw sheet on the wall looks like before the
	// night starts.
	// ─────────────────────────────────────────────────────────────────

	function roundName(round, last) {
		if (round === last) return 'Final';
		if (round === last - 1) return 'Semi-finals';
		if (round === last - 2) return 'Quarter-finals';
		return 'Round ' + round;
	}

	// A match as a card set into the page, its state in the strip down the
	// left as the league fixtures have it: yellow being played, green
	// decided, grey not yet. A bye shows only the player going through, as
	// the draw page does.
	function fixtureLine(f) {
		const decided = !!f.winner;
		const bye = decided && (!f.home || !f.away);
		const box = node('div', 'poster-fixture'
			+ (f.match_status === 'in_progress' ? ' is-live' : decided ? ' is-done' : ''));

		if (bye) {
			const row = node('div', 'poster-side');
			row.append(face(f.winner, null), node('span', 'poster-side-name', f.winner));
			box.append(row, node('div', 'poster-fixture-tag', 'Bye: through to the next round'));
			return box;
		}

		const side = (name, frames, isWinner) => {
			const row = node('div', 'poster-side' + (isWinner ? ' won' : '') + (name ? '' : ' tbd'));
			row.append(face(name || '', null), node('span', 'poster-side-name', name || 'To be decided'));
			if (frames !== null && frames !== undefined) {
				row.append(node('span', 'poster-side-score', String(frames)));
			}
			return row;
		};

		box.append(
			side(f.home, f.home_frames, decided && f.winner === f.home),
			side(f.away, f.away_frames, decided && f.winner === f.away)
		);

		// A result that has not been published is not official, and a poster
		// that showed it as settled would be making a claim the TD has not.
		const tags = [];
		if (f.match_status === 'in_progress') tags.push('Playing now');
		if (decided && !f.published) tags.push('Not confirmed yet');
		if (f.set_by_hand) tags.push('Set by the director');
		if (tags.length) box.append(node('div', 'poster-fixture-tag', tags.join(' · ')));

		return box;
	}

	function renderDraw(draw) {
		els.drawBox.hidden = !draw || !draw.length;
		if (!draw || !draw.length) return;

		els.draw.replaceChildren();

		const main = draw.filter((f) => f.bracket === 'main');
		const rest = draw.filter((f) => f.bracket !== 'main');
		const last = main.length ? Math.max(...main.map((f) => f.round)) : 0;

		const round = (title, list) => {
			const col = node('section', 'poster-round');
			col.append(node('h3', 'lj-rule-title', title));
			const cards = node('div', 'poster-round-cards');
			cards.append(...list.map(fixtureLine));
			col.append(cards);
			return col;
		};

		for (let r = 1; r <= last; r++) {
			const inRound = main.filter((f) => f.round === r);
			if (!inRound.length) continue;
			els.draw.append(round(roundName(r, last), inRound));
		}

		// Third place and anything else that is not the main bracket.
		if (rest.length) els.draw.append(round('Third place', rest));
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

	els.copy.addEventListener('click', async () => {
		// navigator.clipboard needs a secure context and a permission that can
		// be refused, so the failure is said out loud — the text is on screen
		// and selectable either way.
		try {
			await navigator.clipboard.writeText(els.text.value);
			TDC.status(els.status, 'Copied.', '');
		} catch (e) {
			console.error('[Poster] could not write to the clipboard', e);
			els.text.select();
			TDC.status(els.status, 'Could not copy automatically — the text is selected, so copy it yourself.', '');
		}
	});

	// ─────────────────────────────────────────────────────────────────
	// Entering
	// ─────────────────────────────────────────────────────────────────

	async function loadEntry(signedIn) {
		// A stranger is told to sign in rather than shown nothing: a poster
		// advertising for entries with no way in is a dead end, and attracting
		// somebody who has not signed up is the point of the page.
		if (!signedIn) {
			if (snap.entry_mode === 'td_only') { els.entry.hidden = true; return; }
			els.entry.hidden = false;
			els.entryState.textContent = 'Fancy a game?';
			els.entryDetail.textContent = 'Sign in to enter this tournament.';
			els.entryActions.replaceChildren(link('Sign in', '/accounts/?next='
				+ encodeURIComponent(location.pathname + location.search)));
			return;
		}

		const { data, error } = await supabaseClient.rpc('tdc_my_entry', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.entryStatus); return; }

		const e = (data || [])[0];
		if (!e) { els.entry.hidden = true; return; }

		els.entry.hidden = false;
		renderEntry(e);
	}

	// The stage's buttons, as on the league join page: green for the one the
	// TD wants pressed, cream for the rest, red to withdraw.
	function link(text, href) {
		const a = node('a', 'lj-btn lj-btn-go', text);
		a.href = href;
		return a;
	}

	// A line in the stage's large type, and the detail under it.
	const ENTERED = {
		interested: ['Your name is down.', 'Whoever is running this will confirm entries.'],
		confirmed: ['You are in.', 'You are confirmed for this tournament.'],
		withdrawn: ['You withdrew.', 'You have withdrawn from this tournament.']
	};

	function renderEntry(e) {
		els.entryActions.replaceChildren();

		const inIt = e.status && e.status !== 'withdrawn';
		const [line, detail] = e.status
			? (ENTERED[e.status] || [e.status, ''])
			: ['Fancy a game?', e.why_not || 'You are not entered yet.'];
		els.entryState.textContent = line;
		els.entryDetail.textContent = detail;

		if (e.paid) {
			els.entryDetail.textContent += ' Marked paid.';
		}

		// may_enter already accounts for the mode, the draw and the account, so
		// the page does not work any of that out for itself.
		//
		// Where somebody may confirm themselves they are still offered
		// "interested" — deciding to come is not the same as committing, and a
		// mode that allows the stronger answer should not withhold the weaker
		// one. The confirm button leads, as the one the TD wants pressed.
		if (e.may_confirm && e.status !== 'confirmed') {
			els.entryActions.append(button('Confirm my entry', 'lj-btn-go',
				() => enter('confirmed')));
		}

		if (e.may_enter && !inIt) {
			els.entryActions.append(button("I'm interested",
				e.may_confirm ? '' : 'lj-btn-go',
				() => enter('interested')));
		}

		if (inIt) {
			els.entryActions.append(button('Withdraw', 'poster-btn-stop', withdraw));
		}
	}

	function button(text, cls, fn) {
		const b = node('button', 'lj-btn ' + cls, text);
		b.type = 'button';
		b.addEventListener('click', fn);
		return b;
	}

	// After entering, the whole page is re-read rather than the entry box
	// patched: the counts on the poster are part of the snapshot, so they do
	// not move until the TD regenerates it, and pretending otherwise here
	// would be the page inventing a number.
	// Queued, never refused (TDC.writer): a second press of the same button
	// joins the first.
	const entryWriter = TDC.writer({
		area: AREA, status: els.entryStatus,
		reload: async () => { await loadEntry(true); return true; }
	});

	function enter(status) {
		return entryWriter.write('Entering', () => supabaseClient.rpc('tdc_enter_tournament', {
			p_tournament_id: tournamentId, p_status: status
		}), () => status === 'confirmed' ? 'You are in.' : 'Noted.', { single: 'enter-' + status });
	}

	async function withdraw() {
		if (!confirm('Withdraw from this tournament?')) return;
		return entryWriter.write('Withdrawing', () => supabaseClient.rpc('tdc_withdraw_from_tournament', {
			p_tournament_id: tournamentId
		}), () => 'Withdrawn.', { single: 'withdraw' });
	}

	// ─── The banner ───
	// The trophy in a ring coloured by the status, the name, the format and
	// the status; then the facts, each only if the director set it.
	function renderBanner(s) {
		els.hero.className = 'jumbo lj-hero poster-status-' + s.status;
		els.pic.replaceChildren(trophy());
		els.name.textContent = s.name;
		els.meta.textContent = FORMAT[s.format] || s.format;
		els.statusBadge.textContent = STATUS[s.status] || s.status;

		const facts = [];
		if (s.rules && s.rules.discipline) facts.push(['Game', ruleText('discipline', s.rules.discipline)]);
		if (s.starts_at) {
			facts.push(['Date', dayOf(s.starts_at)]);
			facts.push(['Time', timeOf(s.starts_at)]);
		}
		const venuesAt = facts.length;
		if (s.entry_mode) facts.push(['Entries', ENTRY[s.entry_mode] || s.entry_mode]);
		if (s.max_entrants) facts.push(['Places', String(s.max_entrants)]);
		if (s.entry_fee_credits > 0) facts.push(['Entry fee', plural(s.entry_fee_credits, 'credit')]);
		if (s.sanctioned) facts.push(['Ranked', 'Counts towards the rankings']);
		if (s.third_place) facts.push(['Third place', 'Played off']);

		const venues = TDC.venueFact(s.venues);
		els.facts.hidden = !facts.length && !venues;
		els.facts.replaceChildren(...facts.map(([k, v]) => {
			const row = node('div', 'jumbo-fact');
			row.append(node('dt', null, k), node('dd', null, v));
			return row;
		}));
		if (venues) els.facts.insertBefore(venues, els.facts.children[venuesAt] || null);
	}

	// ─── The numbers ───
	// The stage's scores, set into the page. From the snapshot, so they are
	// as of when it was generated, as the footnote says.
	function renderNumbers(s) {
		const c = s.entrants || {};
		const tiles = [['Confirmed', c.confirmed || 0]];
		if (c.interested) tiles.push(['Interested', c.interested]);
		if (s.max_entrants) tiles.push(['Places left', Math.max(0, s.max_entrants - (c.total || 0))]);
		if (s.rounds) tiles.push(['Rounds', s.rounds]);
		const draw = (s.draw || []).filter((f) => f.home && f.away);
		if (draw.length) {
			tiles.push(['Matches', draw.length]);
			tiles.push(['Decided', draw.filter((f) => f.winner).length]);
		}
		els.numbers.replaceChildren(...tiles.map(([label, value]) => {
			const tile = node('div', 'lj-num');
			tile.append(node('span', 'lj-num-value', String(value)), node('span', 'lj-num-label', label));
			return tile;
		}));
	}

	// ─── Rendering the whole thing ───
	function render(row) {
		snap = row.snapshot;

		els.poster.hidden = false;
		renderBanner(snap);
		renderNumbers(snap);
		renderRules(snap.rules);
		renderRoundRules(snap);

		// Counts, not names — unless the TD included names.
		const names = snap.entrant_names || [];
		els.namesBox.hidden = !names.length;
		els.namesCount.textContent = String(names.length);
		els.names.replaceChildren(...names.map((n) => person(n, null)));

		renderDraw(snap.draw);

		// Who runs it: in the snapshot from version 2 (20261105160712).
		const officials = snap.officials || [];
		els.officialsBox.hidden = !officials.length;
		els.officials.replaceChildren(...officials.map((o) => person(o.name, o.avatar_path, o.role)));

		els.text.value = posterText(snap);

		// Said plainly, because a poster is a snapshot and a reader deserves to
		// know how old it is before trusting a score on it.
		els.generated.textContent = 'This page was generated on ' + generatedWhen(row.generated_at)
			+ '. It shows the tournament as it was then.';

		els.private.hidden = row.is_public;

		// The TD gets the way back to running it. Nobody else does.
		els.links.replaceChildren();
		if (row.i_run_it) {
			els.links.append(linkPlain('Entrants', '/tournaments/bracket/?t=' + encodeURIComponent(tournamentId) + '&tab=entrants'));
			els.links.append(document.createTextNode(' · '));
			els.links.append(linkPlain('Draw', '/tournaments/bracket/?t=' + encodeURIComponent(tournamentId)));
		}
	}

	function linkPlain(text, href) {
		const a = node('a', null, text);
		a.href = href;
		return a;
	}

	// ─── Start ───
	TDCLoader.hold((async () => {
		if (!tournamentId) {
			els.nothing.hidden = false;
			TDC.error(AREA, 'no tournament in the address.', null, els.status);
			return;
		}

		// getSession, not requireSession: a signed-out visitor is the expected
		// case on this page and must not be redirected to the login screen.
		const session = await TDC.getSession(AREA);

		const { data, error } = await supabaseClient.rpc('tdc_tournament_poster', {
			p_tournament_id: tournamentId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		const row = (data || [])[0];
		if (!row) { els.nothing.hidden = false; return; }

		render(row);
		await loadEntry(!!session);
	})(), 'Poster');
})();
