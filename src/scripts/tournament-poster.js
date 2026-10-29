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
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'Poster';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		nothing: el('nothing'), poster: el('poster'),
		name: el('p-name'), meta: el('p-meta'), badges: el('p-badges'),
		private: el('p-private'), counts: el('p-counts'), rules: el('p-rules'),
		namesBox: el('p-names-box'), names: el('p-names'),
		drawBox: el('p-draw-box'), draw: el('p-draw'),
		entry: el('p-entry'), entryState: el('p-entry-state'),
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
	const STATUS_CLASS = {
		draft: 'pending', open: 'needs-you', in_progress: 'live',
		complete: 'verified', cancelled: 'pending'
	};

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

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

	// The race target reads as part of the win condition rather than as a
	// number on its own: "Race to 5", not "Win condition: Race to / Target: 5".
	function renderRules(rules) {
		els.rules.replaceChildren();
		if (!rules) return;

		const shown = Object.keys(rules);
		const pairs = [];

		if (rules.discipline !== undefined) {
			pairs.push(['Game', ruleText('discipline', rules.discipline)]);
		}

		if (rules.win_condition_type !== undefined) {
			let v = ruleText('win_condition_type', rules.win_condition_type);
			if (rules.win_condition_target) v += ' ' + rules.win_condition_target;
			pairs.push(['Matches', v]);
		}

		for (const key of shown) {
			if (['discipline', 'win_condition_type', 'win_condition_target'].includes(key)) continue;
			const def = DEF_BY_KEY.get(key);
			// A key with no definition is a setting added to the server list and
			// not to TDCMatchDef. Said out loud rather than dropped silently.
			if (!def) {
				TDC.error(AREA, 'the poster carries a setting this page has no label for: ' + key);
				continue;
			}
			// A switch that is off is not worth a line on a poster — "Golden
			// break: No" is noise. The ones that are on are the interesting
			// facts, and the numbers always matter.
			if (rules[key] === false) continue;
			pairs.push([def.label, ruleText(key, rules[key])]);
		}

		for (const [label, value] of pairs) {
			els.rules.append(node('dt', null, label), node('dd', null, value));
		}
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

	function fixtureLine(f) {
		const box = node('div', 'poster-fixture');

		const side = (name, frames, isWinner) => {
			const row = node('div', 'poster-side' + (isWinner ? ' won' : ''));
			row.append(node('span', 'poster-side-name', name || 'To be decided'));
			if (frames !== null && frames !== undefined) {
				row.append(node('span', 'poster-side-score', String(frames)));
			}
			return row;
		};

		const decided = !!f.winner;
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

		for (let r = 1; r <= last; r++) {
			const inRound = main.filter((f) => f.round === r);
			if (!inRound.length) continue;
			const col = node('div', 'poster-round');
			col.append(node('h3', null, roundName(r, last)));
			col.append(...inRound.map(fixtureLine));
			els.draw.append(col);
		}

		// Third place and anything else that is not the main bracket.
		if (rest.length) {
			const col = node('div', 'poster-round');
			col.append(node('h3', null, 'Third place'));
			col.append(...rest.map(fixtureLine));
			els.draw.append(col);
		}
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

		const where = s.venue_name ? ' at ' + s.venue_name : '';
		lines.push(`A ${(FORMAT[s.format] || s.format).toLowerCase()} ${ruleText('discipline', s.rules.discipline)} tournament${where}.`);

		if (s.starts_at) lines.push('Starts ' + startsAt(s.starts_at) + '.');
		else lines.push('Date to be announced.');

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

		// Entry.
		const entry = [];
		if (s.max_entrants) entry.push(`${s.max_entrants} places`);
		if (s.entrants) {
			entry.push(`${s.entrants.confirmed} confirmed`);
			if (s.entrants.interested) entry.push(`${s.entrants.interested} interested`);
		}
		if (s.entry_fee_credits > 0) entry.push(`${s.entry_fee_credits} credits to enter`);
		else entry.push('free to enter');
		if (entry.length) { lines.push('Entry: ' + entry.join(', ') + '.'); lines.push(''); }

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
				if (f.home_frames === null || f.home_frames === undefined) {
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
			els.entryState.textContent = 'Sign in to enter this tournament.';
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

	function link(text, href) {
		const a = node('a', 'btn btn-secondary btn-sm', text);
		a.href = href;
		return a;
	}

	const ENTERED = {
		interested: 'You are down as interested. Whoever is running this will confirm entries.',
		confirmed: 'You are confirmed for this tournament.',
		withdrawn: 'You have withdrawn from this tournament.'
	};

	function renderEntry(e) {
		els.entryActions.replaceChildren();

		const inIt = e.status && e.status !== 'withdrawn';
		els.entryState.textContent = e.status
			? (ENTERED[e.status] || e.status)
			: (e.why_not || 'You are not entered yet.');

		if (e.paid) {
			els.entryState.textContent += ' Marked paid.';
		}

		// may_enter already accounts for the mode, the draw and the account, so
		// the page does not work any of that out for itself.
		//
		// Where somebody may confirm themselves they are still offered
		// "interested" — deciding to come is not the same as committing, and a
		// mode that allows the stronger answer should not withhold the weaker
		// one. The confirm button leads, as the one the TD wants pressed.
		if (e.may_confirm && e.status !== 'confirmed') {
			els.entryActions.append(button('Confirm my entry', 'btn-primary',
				() => enter('confirmed')));
		}

		if (e.may_enter && !inIt) {
			els.entryActions.append(button("I'm interested",
				e.may_confirm ? 'btn-secondary' : 'btn-primary',
				() => enter('interested')));
		}

		if (inIt) {
			els.entryActions.append(button('Withdraw', 'btn-danger', withdraw));
		}
	}

	function button(text, cls, fn) {
		const b = node('button', 'btn ' + cls + ' btn-sm', text);
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

	// ─── Rendering the whole thing ───
	function render(row) {
		snap = row.snapshot;

		els.poster.hidden = false;
		els.name.textContent = snap.name;

		const bits = [FORMAT[snap.format] || snap.format, startsAt(snap.starts_at)];
		if (snap.venue_name) bits.push(snap.venue_name);
		els.meta.textContent = bits.join(' · ');

		els.badges.replaceChildren(
			node('span', 'badge ' + (STATUS_CLASS[snap.status] || ''),
				STATUS[snap.status] || snap.status));
		if (snap.sanctioned) {
			els.badges.append(node('span', 'badge verified', 'Ranked'));
		}
		if (snap.entry_fee_credits > 0) {
			els.badges.append(node('span', 'badge', snap.entry_fee_credits + ' credits'));
		} else {
			els.badges.append(node('span', 'badge', 'Free entry'));
		}

		// Counts, not names — unless the TD included names.
		els.counts.replaceChildren();
		if (snap.entrants) {
			const c = snap.entrants;
			const parts = [`${c.confirmed} confirmed`];
			if (c.interested) parts.push(`${c.interested} interested`);
			if (snap.max_entrants) parts.push(`${snap.max_entrants} places`);
			els.counts.textContent = parts.join(' · ');
		}

		renderRules(snap.rules);

		els.namesBox.hidden = !snap.entrant_names || !snap.entrant_names.length;
		if (snap.entrant_names) {
			els.names.replaceChildren(...snap.entrant_names.map(
				(n) => node('span', 'poster-name', n)));
		}

		renderDraw(snap.draw);

		els.text.value = posterText(snap);

		// Said plainly, because a poster is a snapshot and a reader deserves to
		// know how old it is before trusting a score on it.
		els.generated.textContent = 'This page was generated on ' + generatedWhen(row.generated_at)
			+ '. It shows the tournament as it was then.';

		els.private.hidden = row.is_public;

		// The TD gets the way back to running it. Nobody else does.
		els.links.replaceChildren();
		if (row.i_run_it) {
			els.links.append(linkPlain('Entrants', '/tournaments/manage/?t=' + encodeURIComponent(tournamentId)));
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
