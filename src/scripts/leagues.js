// Leagues (/leagues/). The way into a league.
//
// One call to tdc_my_leagues gives the list: the league seasons this account
// runs and the ones it is entered in, newest first. A season you run opens the
// management page; a season you play in opens the season page.
//
// A player who has been added but has not confirmed yet is the one thing on
// this list that needs them, so it says so on the card.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Leagues';

	const els = {
		list: document.getElementById('league-list'),
		status: document.getElementById('list-status'),
		intro: document.getElementById('intro')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the leagues page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A season's dates are plain dates with no time of day.
	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a league: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function card(l) {
		const box = document.createElement('a');
		box.className = 'match-card';
		const needsYou = l.my_status === 'active' && !l.confirmed_at;
		if (needsYou) box.classList.add('needs-you');
		box.href = (l.i_run_it ? '/leagues/manage/?s=' : '/leagues/season/?s=')
			+ encodeURIComponent(l.league_season_id);

		const top = el('div', 'match-top');
		top.append(el('span', 'match-opponent', l.league_name));

		const bits = [l.name];
		if (l.season_name && l.season_name !== l.name) bits.push(l.season_name);
		if (l.starts_on) bits.push('From ' + day(l.starts_on));
		if (l.venue_name) bits.push(l.venue_name);

		const tags = el('div', 'match-tags');
		if (needsYou) tags.append(el('span', 'badge needs-you', 'Confirm your place'));
		if (l.my_status === 'withdrawn') tags.append(el('span', 'badge pending', 'You withdrew'));
		if (l.my_status === 'inactive') tags.append(el('span', 'badge pending', 'Inactive'));
		if (l.my_team_name) tags.append(el('span', 'badge', l.my_team_name));
		if (l.i_captain && l.my_status === 'active' && l.confirmed_at) tags.append(el('span', 'badge live', 'Captain'));
		if (l.i_run_it) tags.append(el('span', 'badge live', 'You run this'));

		box.append(top, el('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		const { data, error } = await supabaseClient.rpc('tdc_my_leagues', { p_limit: 50 });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.intro.textContent = 'You are not in a league yet.';
			TDC.status(els.status,
				'Create one above, or ask whoever runs yours to add you. You will be told when they do.', '');
			return;
		}

		els.list.replaceChildren(...data.map(card));
		els.intro.textContent = data.length === 1
			? 'One league season.'
			: `${data.length} league seasons, newest first.`;
	})();
})();
