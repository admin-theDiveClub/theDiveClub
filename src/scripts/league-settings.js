// A league's settings (/leagues/settings/?s=<league season id>).
//
// The league's name and its ruleset — including the Team play group, where
// team size and the rotation table live (version 3, 23 Oct). The rules belong
// to the league, so this edits every season of it at once.
//
// The ruleset is read from tbl_leagues, not from tdc_league_season_info: that
// one returns the league's rules with this season's overrides laid over them,
// and sending the merged copy back would bake one season's changes into the
// whole league.
//
// Saving is tdc_update_league, which validates the ruleset against every
// season, writes it, and re-freezes it onto every match that has not started.
// It answers how many matches changed and how many kept their old rules, and
// the page says both: a director must not believe a match follows the new
// rules when it does not. Then everything is read again.
//
// Needs: tdc.js, match-settings.js.

(() => {
	const AREA = 'League settings';
	const D = TDCMatchDef;

	const el = (id) => document.getElementById(id);
	const els = {
		title: el('l-title'), meta: el('l-meta'), name: el('l-name'),
		overrides: el('overrides-note'),
		main: el('settings-main'), rest: el('settings-rest'),
		save: el('save-btn'), status: el('page-status'),
		manageLink: el('manage-link')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the settings page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');

	// ─── State ───
	let leagueId = null;
	let rules = null;
	// Team play is what this page is mostly for, so it starts open.
	const openGroups = new Set(['Team play']);
	let busy = false;

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A league made before 23 Oct is at version 1 or 2. Every key added since
	// defaults to how the system already behaved — no cutoff, any order, no
	// sessions — so filling them in and calling it version 3 changes nothing
	// about how its matches play until the director changes a setting.
	function upgrade(stored) {
		return Object.assign({}, D.DEFAULT_RULES, stored, { version: D.DEFAULT_RULES.version });
	}

	// ─── Ruleset ───
	// The same as the new-league page, which predates TDCMatchDef.control
	// handling the reading back. Kept in step with it.
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
		const control = (d) => D.control(d, rules, 'ls');

		const main = live.filter((d) => D.MAIN_KEYS.includes(d.key));
		els.main.replaceChildren(
			node('h2', null, 'How are these matches played?'),
			...main.map(control)
		);

		els.rest.replaceChildren();
		for (const group of D.GROUPS.concat(D.LEAGUE_GROUPS)) {
			const defs = live.filter((d) => d.group === group && !D.MAIN_KEYS.includes(d.key));
			if (!defs.length) continue;

			const box = document.createElement('details');
			box.className = 'set-group';
			box.dataset.group = group;
			// Rebuilt on every change, so an opened group has to be put back open.
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
		if (!input || !rules) return;
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

	// ─── Reading ───
	async function load() {
		const info = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
		if (info.error) { TDC.showSupabaseError(AREA, info.error, els.status); return false; }
		const s = (info.data || [])[0];
		if (!s) {
			TDC.error(AREA, 'no league season with that id. Check the link.', { seasonId }, els.status);
			return false;
		}
		leagueId = s.league_id;
		els.meta.textContent = 'Opened from ' + s.name + '. These rules apply to every season of the league.';

		// A season's own changes still apply on top. There is no form for
		// them yet, so the director is at least told they exist.
		const own = Object.keys(s.rules_overrides || {});
		els.overrides.hidden = !own.length;
		els.overrides.textContent = own.length
			? `${s.name} changes ${own.length === 1 ? 'one rule' : own.length + ' rules'} on top of these (${own.join(', ')}), and those still apply to it.`
			: '';

		const league = await supabaseClient
			.from('tbl_leagues').select('name, rules').eq('id', leagueId).maybeSingle();
		if (league.error) { TDC.showSupabaseError(AREA, league.error, els.status); return false; }
		if (!league.data) {
			TDC.error(AREA, 'the league for this season could not be read.', { leagueId }, els.status);
			return false;
		}

		els.title.textContent = league.data.name + ' — Settings';
		els.name.value = league.data.name;
		rules = upgrade(league.data.rules);
		D.tidyRules(rules);
		renderSettings();
		return true;
	}

	// ─── Saving ───
	function savedText(r) {
		const n = (k, one, many) => (k === 1 ? one : k + ' ' + many);
		const parts = ['Saved.'];
		if (r && r.matches_updated) {
			parts.push(n(r.matches_updated, 'One match', 'matches') + ' not yet started now ' +
				(r.matches_updated === 1 ? 'uses' : 'use') + ' these rules.');
		}
		if (r && r.matches_kept) {
			parts.push(n(r.matches_kept, 'One match has', 'matches have') +
				' already begun — a lineup locked, a frame recorded or a signature — and ' +
				(r.matches_kept === 1 ? 'keeps' : 'keep') + ' the rules ' +
				(r.matches_kept === 1 ? 'it' : 'they') + ' started with.');
		}
		return parts.join(' ');
	}

	els.save.addEventListener('click', async () => {
		if (busy || !rules) return;

		const name = (els.name.value || '').trim();
		if (name.length < 2) {
			TDC.status(els.status, 'The league needs a name of two characters or more.', '');
			els.name.focus();
			return;
		}

		// Allowed, but said once more at the moment it matters (UV, 23 Oct).
		if (rules.team_size >= 2) {
			const repeats = D.rotationRepeats(D.rotationGrid(rules));
			if (repeats.length && !confirm(
				`The rotation table has ${repeats.length === 1 ? 'a pairing' : repeats.length + ' pairings'} meeting twice in a night. Save it anyway?`)) {
				return;
			}
		}

		busy = true;
		els.save.disabled = true;
		TDC.status(els.status, 'Saving…', '');

		const { data, error } = await supabaseClient.rpc('tdc_update_league', {
			p_league_id: leagueId,
			p_name: name,
			p_rules: rules
		});

		// A refusal wrote nothing, so the form keeps what the person chose for
		// them to correct — re-reading would throw a dozen changes away over
		// one bad setting. A save is followed by a full re-read.
		if (error) {
			busy = false;
			els.save.disabled = false;
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}

		const ok = await load();
		busy = false;
		els.save.disabled = false;
		if (ok) TDC.status(els.status, savedText(data), 'success');
	});

	// ─── Start ───
	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league season in the address. Open this page from the league.', null, els.status);
			return;
		}
		els.manageLink.href = '/leagues/manage/?s=' + encodeURIComponent(seasonId);

		// Settled before anything is drawn. tdc_update_league asks whether the
		// caller may manage the league, which a season's director always may.
		const { data: mayRun, error } = await supabaseClient.rpc('tdc_may_run_league', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		if (!mayRun) {
			TDC.status(els.status, 'Taking you to the season — this page is for whoever is running the league.', '');
			location.replace('/leagues/season/?s=' + encodeURIComponent(seasonId));
			return;
		}

		if (!await load()) return;
		els.save.disabled = false;
	})();
})();
