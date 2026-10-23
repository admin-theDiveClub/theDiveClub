// Create a league (/leagues/new/).
//
// A league and its first season in one go: the league carries the ruleset, the
// season carries the people and the dates. Two calls, because they are two
// things — tdc_create_league, then tdc_create_league_season, which makes the
// caller the season's director.
//
// If the second fails the league already exists, so the address is changed to
// /leagues/new/?l=<league id> and the person is told: pressing the button
// again opens only the season, and no second league is made. The same address
// opens a further season of a league that has been running for years.
//
// The ruleset is generated from TDCMatchDef, the same list the match panel and
// the new-tournament page are built from, and is validated by
// private.tdc_check_match_rules inside the create call.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'New league';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('page-title'), intro: el('page-intro'),
		leaguePart: el('league-part'), rulesPart: el('rules-part'),
		name: el('l-name'), seasonName: el('s-name'),
		start: el('s-start'), end: el('s-end'), reserves: el('s-reserves'),
		main: el('settings-main'), rest: el('settings-rest'),
		create: el('create-btn'), status: el('create-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the new league page is missing expected elements: ' + missing.join(', '));
		return;
	}

	// ─── State ───
	// A league starts from what a team night wants rather than from a social
	// match's defaults: fixed frames, draws allowed, breaks off the sheet.
	// Every one of them is still a control below.
	const rules = Object.assign({}, D.LEAGUE_DEFAULT_RULES || D.DEFAULT_RULES);
	const openGroups = new Set();
	let leagueId = new URLSearchParams(location.search).get('l');   // set once the league exists

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// ─── Ruleset ───
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

	function renderSettings() {
		const live = D.liveRuleKeys(rules);
		const control = (d) => D.control(d, rules, 'lr');

		const main = live.filter((d) => D.MAIN_KEYS.includes(d.key));
		els.main.replaceChildren(
			node('h2', null, 'How will these matches be played?'),
			...main.map(control)
		);

		els.rest.replaceChildren();
		// The league pages are the only ones that show the Team play group:
		// a lineup cutoff and a strict frame order mean nothing to a social
		// match or a tournament, so TDCMatchDef keeps that group out of GROUPS
		// and the other pages never see it.
		for (const group of D.GROUPS.concat(D.LEAGUE_GROUPS)) {
			const defs = live.filter((d) => d.group === group && !D.MAIN_KEYS.includes(d.key));
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// The form is rebuilt whenever a setting changes, so a group the
			// person opened has to be put back open.
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

	document.addEventListener('change', (e) => {
		const input = e.target.closest('[data-setting]');
		if (!input) return;
		const def = D.SETTINGS.find((d) => d.key === input.dataset.setting);
		if (!def) { TDC.error(AREA, 'no definition for setting: ' + input.dataset.setting); return; }

		if (def.type === 'rotation') D.applyRotation(rules, input);
		else if (!setValue(def, def.type === 'bool' ? input.checked : input.value)) return;
		D.tidyRules(rules);

		const id = input.id;
		renderSettings();
		const again = document.getElementById(id);
		if (again) again.focus({ preventScroll: true });
	});

	// ─── The season in an existing league ───
	// Hides the league's own fields and says whose season this is. Read from
	// the table, which anyone signed in may read; whether they may open a
	// season is the database's question, asked when they press the button.
	async function showSeasonOnly() {
		const { data, error } = await supabaseClient
			.from('tbl_leagues').select('id, name').eq('id', leagueId).maybeSingle();
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }
		if (!data) {
			TDC.error(AREA, 'no league with that id. Check the link.', { leagueId }, els.status);
			els.create.disabled = true;
			return false;
		}

		els.title.textContent = 'New Season';
		els.intro.textContent = `A new season of ${data.name}. The league's rules carry over.`;
		els.leaguePart.hidden = true;
		els.rulesPart.hidden = true;
		els.create.textContent = 'Create Season';
		return true;
	}

	// ─── Reading the fields ───
	// Blank is a real answer for a date; an unreadable one is not. A date input
	// gives "" or "YYYY-MM-DD" and nothing else, so this only has to tell the
	// two apart and refuse an end before the start.
	function dates() {
		const start = els.start.value || null;
		const end = els.end.value || null;
		if (start && end && end < start) {
			TDC.status(els.status, 'The season cannot end before it starts.', 'error');
			els.end.focus();
			return undefined;
		}
		return { start, end };
	}

	// ─── Create ───
	els.create.addEventListener('click', async () => {
		const seasonName = (els.seasonName.value || '').trim();
		if (!leagueId && (els.name.value || '').trim().length < 2) {
			TDC.status(els.status, 'Give the league a name first.', '');
			els.name.focus();
			return;
		}
		if (seasonName.length < 2) {
			TDC.status(els.status, 'Give the season a name first.', '');
			els.seasonName.focus();
			return;
		}

		const d = dates();
		if (!d) return;

		const reserves = Number(els.reserves.value);
		if (els.reserves.value === '' || !Number.isInteger(reserves) || reserves < 0 || reserves > 10) {
			TDC.status(els.status, 'Reserves allowed must be a number from 0 to 10.', '');
			els.reserves.focus();
			return;
		}

		els.create.disabled = true;

		if (!leagueId) {
			TDC.status(els.status, 'Creating the league…', '');

			// p_venue_id is null for now. A venue makes this a club league and
			// requires staff there; the page to choose one does not exist yet,
			// and guessing would quietly refuse people who run their own.
			const made = await supabaseClient.rpc('tdc_create_league', {
				p_name: els.name.value.trim(),
				p_rules: rules,
				p_venue_id: null
			});
			if (made.error) {
				els.create.disabled = false;
				TDC.showSupabaseError(AREA, made.error, els.status);
				return;
			}
			if (!made.data) {
				els.create.disabled = false;
				TDC.error(AREA, 'the league was not created and no reason was given.', null, els.status);
				return;
			}
			leagueId = made.data;
		}

		TDC.status(els.status, 'Opening the season…', '');
		const season = await supabaseClient.rpc('tdc_create_league_season', {
			p_league_id: leagueId,
			p_name: seasonName,
			p_season_name: seasonName,
			p_starts_on: d.start,
			p_ends_on: d.end,
			p_max_reserves: reserves
		});

		if (season.error) {
			els.create.disabled = false;
			// The league exists now. Point the address at it, so pressing the
			// button again opens only the season rather than a second league.
			history.replaceState(null, '', '/leagues/new/?l=' + encodeURIComponent(leagueId));
			await showSeasonOnly();
			TDC.showSupabaseError(AREA, season.error, els.status);
			els.status.textContent += ' The league itself was created; press the button again to open its season.';
			return;
		}
		if (!season.data) {
			els.create.disabled = false;
			TDC.error(AREA, 'the season was not created and no reason was given.', null, els.status);
			return;
		}

		// Straight to the season's page: a league with nobody in it is not
		// finished being made.
		location.href = '/leagues/manage/?s=' + encodeURIComponent(season.data);
	});

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (leagueId) {
			if (!await showSeasonOnly()) return;
			els.seasonName.focus();
			return;
		}

		renderSettings();
		els.name.focus();
	})();
})();
