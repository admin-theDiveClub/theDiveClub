// Create a tournament (/tournaments/new/).
//
// Two parts: the tournament, and the ruleset its matches inherit. The second
// is generated from TDCMatchDef.SETTINGS, the same list the match page's
// settings panel and the create-a-match page are built from, so a setting
// added there appears here without an edit.
//
// Only settings with scope 'rules' are shown. The 'match' ones (the lag winner,
// the referee's name) describe one match being played; there is no match here
// yet to describe.
//
// The ruleset is validated by private.tdc_check_match_rules inside
// tdc_create_tournament, the same function the match page uses, so a tournament
// cannot be created holding a ruleset its own matches would refuse.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'New tournament';
	const D = TDCMatchDef;

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	// Said once, here, rather than left for the TD to find out on the night.
	const FORMAT_HINT = {
		single_elimination: 'Lose once and you are out. The club-night default.',
		double_elimination: 'Two lives each. Takes about half as long again.',
		round_robin: 'Everybody plays everybody. Best for small fields.',
		groups_knockout: 'Groups first, then a knockout between whoever comes through.'
	};

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('t-name'), format: el('t-format'), formatHint: el('format-hint'),
		when: el('t-when'), max: el('t-max'), fee: el('t-fee'),
		entryMode: el('t-entry-mode'), entryModeHint: el('entry-mode-hint'),
		paidConfirms: el('t-paid-confirms'),
		progression: el('t-progression'), createMatches: el('t-create-matches'),
		main: el('settings-main'), rest: el('settings-rest'),
		create: el('create-btn'), status: el('create-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the new tournament page is missing expected elements: ' + missing.join(', '));
		return;
	}

	// ─── State ───
	const rules = Object.assign({}, D.DEFAULT_RULES);
	const openGroups = new Set();   // which collapsed groups the person has opened

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Format ───
	for (const [v, text] of Object.entries(FORMAT)) {
		els.format.append(new Option(text, v, false, v === 'single_elimination'));
	}

	function showFormatHint() {
		els.formatHint.textContent = FORMAT_HINT[els.format.value] || '';
	}

	// ─── How people get in ───
	// The same three sentences the entrants page shows, because it is the same
	// setting and a TD should not have to work out that they match.
	const ENTRY_HINT = {
		td_only: 'Nobody can put themselves down. You search for them and add them.',
		interested: 'Players can mark themselves interested. You confirm them, on whatever basis you use.',
		self_confirm: 'Players can confirm their own entry. Right for a free tournament, or one paid for at the desk.'
	};

	function showEntryHint() {
		els.entryModeHint.textContent = ENTRY_HINT[els.entryMode.value] || '';
	}

	els.entryMode.addEventListener('change', showEntryHint);
	showEntryHint();

	// A knockout needs somebody to advance, so a draw cannot be allowed in one.
	// The ruleset is corrected rather than the create button refused: the person
	// picked a format, and this is what that format means.
	function applyFormatToRules() {
		const knockout = els.format.value !== 'round_robin';
		if (knockout && rules.draws_allowed) {
			rules.draws_allowed = false;
			TDC.status(els.status, 'Draws turned off: a knockout needs somebody to advance.', '');
			renderSettings();
		}
	}

	els.format.addEventListener('change', () => { showFormatHint(); applyFormatToRules(); });

	// ─── Ruleset ───
	// Same shape as the create-a-match page, minus the scope 'match' settings,
	// which have no meaning before a match exists.
	function setValue(def, raw) {
		let v = raw;
		if (def.type === 'bool') v = !!raw;
		if (def.type === 'int') {
			v = parseInt(raw, 10);
			if (isNaN(v)) { TDC.error(AREA, `"${def.label}" needs a number.`, raw, els.status); return false; }
			if (def.min !== undefined) v = Math.max(def.min, v);
			if (def.max !== undefined) v = Math.min(def.max, v);
		}
		rules[def.key] = v;
		return true;
	}

	// This page used to carry its own copy of control() and of the "which
	// settings are live" filter — written before TDCMatchDef exported either,
	// and identical to them bar the element-id prefix. Two copies of the form
	// builder meant a setting added to TDCMatchDef appeared on the bracket's
	// round panel and silently not here. Removed 22 Oct; the shared ones are
	// the only copy now.
	function renderSettings() {
		const live = D.liveRuleKeys(rules);
		const control = (d) => D.control(d, rules, 'tr');

		const main = live.filter((d) => D.MAIN_KEYS.includes(d.key));
		els.main.replaceChildren(
			node('h2', null, 'How will these matches be played?'),
			...main.map(control)
		);

		els.rest.replaceChildren();
		for (const group of D.GROUPS) {
			const defs = live.filter(
				(d) => d.group === group && !D.MAIN_KEYS.includes(d.key)
			);
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// The form is rebuilt whenever a setting changes, so a group the
			// person opened has to be put back open — otherwise ticking a box
			// folds away the box you just ticked.
			box.open = openGroups.has(group);
			box.addEventListener('toggle', () => {
				if (box.open) openGroups.add(group); else openGroups.delete(group);
			});

			const head = document.createElement('summary');
			head.textContent = group;
			box.append(head, ...defs.map(control));
			els.rest.append(box);
		}
	}

	function onSettingChange(e) {
		const input = e.target.closest('[data-setting]');
		if (!input) return;
		const def = D.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }

		if (!setValue(def, def.type === 'bool' ? input.checked : input.value)) return;

		// Turning one on can reveal others, so the form is rebuilt. Focus is put
		// back, or changing a checkbox would throw you to the top of the page.
		const id = input.id;
		renderSettings();
		applyFormatToRules();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	}

	document.addEventListener('change', onSettingChange);

	// ─── Reading the fields ───

	// A datetime-local field has no time zone: "2026-10-21T19:30" means half
	// seven where the person is standing. Date() reads it as local time, which
	// is exactly right, and toISOString() then pins it to a real moment.
	function whenValue() {
		const raw = (els.when.value || '').trim();
		if (!raw) return null;
		const d = new Date(raw);
		if (isNaN(d.getTime())) {
			TDC.error(AREA, 'the date entered could not be read: ' + raw, null, els.status);
			return undefined;   // undefined means "unreadable", null means "not set"
		}
		return d.toISOString();
	}

	// Blank is a real answer for both of these — no limit, and free — so an
	// empty box is not an error, but a number that cannot be read is.
	function numberValue(input, label, { min, max, blank }) {
		const raw = (input.value || '').trim();
		if (!raw) return blank;
		const n = parseInt(raw, 10);
		if (isNaN(n)) {
			TDC.status(els.status, `"${label}" needs to be a number.`, 'error');
			return undefined;
		}
		if (min !== undefined && n < min) {
			TDC.status(els.status, `"${label}" cannot be less than ${min}.`, 'error');
			return undefined;
		}
		if (max !== undefined && n > max) {
			TDC.status(els.status, `"${label}" cannot be more than ${max}.`, 'error');
			return undefined;
		}
		return n;
	}

	// ─── Create ───
	els.create.addEventListener('click', async () => {
		const name = (els.name.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'Give the tournament a name first.', '');
			els.name.focus();
			return;
		}

		const startsAt = whenValue();
		if (startsAt === undefined) return;

		const maxEntrants = numberValue(els.max, 'Maximum entrants', { min: 2, max: 1024, blank: null });
		if (maxEntrants === undefined) return;

		const fee = numberValue(els.fee, 'Entry fee', { min: 0, blank: 0 });
		if (fee === undefined) return;

		els.create.disabled = true;
		TDC.status(els.status, 'Creating…', '');

		// p_venue_id is null for now. A venue makes this a club tournament and
		// requires staff there; the page to choose one does not exist yet, and
		// guessing a venue would quietly refuse people who run their own.
		const { data, error } = await supabaseClient.rpc('tdc_create_tournament', {
			p_name: name,
			p_rules: rules,
			p_format: els.format.value,
			p_venue_id: null,
			p_starts_at: startsAt,
			p_max_entrants: maxEntrants,
			p_entry_fee_credits: fee,
			p_entry_mode: els.entryMode.value,
			p_paid_confirms: els.paidConfirms.checked,
			p_progression: els.progression.value,
			p_create_matches: els.createMatches.value
		});

		if (error) {
			els.create.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}
		if (!data) {
			els.create.disabled = false;
			TDC.error(AREA, 'the tournament was not created and no reason was given.', null, els.status);
			return;
		}

		// Straight to the entrant list: a tournament with nobody in it is not
		// finished being made.
		location.href = '/tournaments/manage/?t=' + encodeURIComponent(data);
	});

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		showFormatHint();
		renderSettings();
		els.name.focus();
	})();
})();
