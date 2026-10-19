// Tournaments (/tournaments/). The way into a tournament.
//
// One call to tdc_my_tournaments gives the list: the ones this account runs
// and the ones it is entered in, newest first, with the entrant count already
// counted. Counting entrants here would be a request per tournament.
//
// A tournament you run opens its entrant list. One you are only entered in has
// nowhere to go yet — the public bracket does not exist — so it is shown
// without a link rather than linking somewhere that will refuse you.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Tournaments';

	const els = {
		list: document.getElementById('tournament-list'),
		status: document.getElementById('list-status'),
		intro: document.getElementById('intro')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the tournaments page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const FORMAT = {
		single_elimination: 'Single elimination',
		double_elimination: 'Double elimination',
		round_robin: 'Round robin',
		groups_knockout: 'Groups then knockout'
	};
	const STATUS = {
		draft: 'Draft',
		open: 'Open for entries',
		in_progress: 'Running',
		complete: 'Finished',
		cancelled: 'Cancelled'
	};
	// Which badge each status wears. A draft is nobody's problem yet; a running
	// tournament is the one thing on this list that is happening now.
	const STATUS_CLASS = {
		draft: 'pending',
		open: 'needs-you',
		in_progress: 'live',
		complete: 'verified',
		cancelled: 'pending'
	};

	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// A tournament is a date in the diary, so this reads forwards as well as
	// back: "Tomorrow" matters more here than it does on a match list.
	function when(iso) {
		if (!iso) return 'No date set';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a tournament: ' + iso); return ''; }

		const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const days = Math.round((midnight(d) - midnight(new Date())) / 86400000);

		const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (days === 0) return 'Today ' + time;
		if (days === 1) return 'Tomorrow ' + time;
		if (days === -1) return 'Yesterday ' + time;
		if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: 'long' }) + ' ' + time;
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function card(t) {
		// Only a tournament you run has somewhere to go. The rest are a record
		// until the public bracket exists.
		const box = document.createElement(t.i_run_it ? 'a' : 'div');
		box.className = 'match-card';
		if (t.i_run_it) box.href = '/tournaments/manage/?t=' + encodeURIComponent(t.id);

		const top = el('div', 'match-top');
		top.append(
			el('span', 'match-opponent', t.name),
			el('span', 'match-score', String(t.entrants))
		);

		const bits = [when(t.starts_at), FORMAT[t.format] || t.format];
		if (t.venue_name) bits.push(t.venue_name);
		bits.push(t.entrants === 1 ? '1 entrant' : t.entrants + ' entrants');

		const tags = el('div', 'match-tags');
		tags.append(el('span', 'badge ' + (STATUS_CLASS[t.status] || ''), STATUS[t.status] || t.status));
		if (t.i_run_it) tags.append(el('span', 'badge live', 'You run this'));

		box.append(top, el('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;   // requireSession has already sent them to log in

		const { data, error } = await supabaseClient.rpc('tdc_my_tournaments', { p_limit: 50 });

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.intro.textContent = 'You are not in a tournament yet.';
			TDC.status(els.status,
				'Create one above, or ask whoever is running yours to add you.', '');
			return;
		}

		els.list.replaceChildren(...data.map(card));
		els.intro.textContent = data.length === 1
			? 'One tournament.'
			: `${data.length} tournaments, newest first.`;
	})();
})();
