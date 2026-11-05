// Tournaments (/tournaments/). The way into a tournament.
//
// One call to tdc_my_tournaments gives the list: the ones this account runs
// and the ones it is entered in, newest first, with the entrant count already
// counted. Counting entrants here would be a request per tournament.
//
// A tournament not yet started opens its poster, whoever you are; one that has
// started opens the draw (UV, 5 Nov). tdc_my_tournaments says whether you can
// open the poster, and without one the card opens the draw.
//
// Open for entry (UV, 5 Nov) comes from tdc_open_tournaments: tournaments a
// director made visible to public that this account could enter and has not.
// Each opens its poster, which is where entering happens; making one visible
// shares its poster, so the link always has something behind it.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Tournaments';

	const els = {
		list: document.getElementById('tournament-list'),
		status: document.getElementById('list-status'),
		intro: document.getElementById('intro'),
		openList: document.getElementById('open-list'),
		openIntro: document.getElementById('open-intro')
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

	// Not started: the poster, for everybody (UV, 5 Nov). Started (running,
	// finished or cancelled): the draw.
	const NOT_STARTED = ['draft', 'open'];

	function card(t) {
		// Everyone gets somewhere to go. This was a plain div for players
		// until 20 Oct, written before the bracket page existed and left
		// behind when it arrived.
		const box = document.createElement('a');
		box.className = 'match-card';
		// Before the start, the poster (the director reaches Entrants from its
		// foot); once started, the draw. A poster this account cannot open
		// would say "Nothing here", so without one the draw it is.
		box.href = NOT_STARTED.includes(t.status) && t.poster_open
			? '/tournaments/poster/?t=' + encodeURIComponent(t.id)
			: '/tournaments/bracket/?t=' + encodeURIComponent(t.id);

		const top = el('div', 'match-top');
		top.append(
			el('span', 'match-opponent', t.name),
			el('span', 'match-score', String(t.entrants))
		);

		const bits = [when(t.starts_at), FORMAT[t.format] || t.format];
		if (t.venues.length) bits.push(TDC.venueNames(t.venues));
		bits.push(t.entrants === 1 ? '1 entrant' : t.entrants + ' entrants');

		const tags = el('div', 'match-tags');
		// Until 21 Oct this was always "Draft": the column existed and nothing
		// ever wrote it. It is derived now, so it tells the truth on its own.
		tags.append(el('span', 'badge ' + (STATUS_CLASS[t.status] || ''), STATUS[t.status] || t.status));
		// A status the TD set by hand is a different kind of fact from one the
		// tournament worked out about itself, and a cancelled tournament
		// should not look like something the system decided.
		if (t.status_manual) tags.append(el('span', 'badge pending', 'Set by hand'));
		if (t.i_run_it) tags.append(el('span', 'badge live', 'You run this'));

		box.append(top, el('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	// How you get in, in the words of the poster's leading button.
	const ENTRY = {
		interested: "I'm interested",
		self_confirm: 'Confirm my entry'
	};

	function openCard(t) {
		const box = document.createElement('a');
		box.className = 'match-card';
		box.href = '/tournaments/poster/?t=' + encodeURIComponent(t.id);

		const full = t.max_entrants != null && t.entrants >= t.max_entrants;
		const count = t.max_entrants != null
			? t.entrants + ' of ' + t.max_entrants
			: String(t.entrants);

		const top = el('div', 'match-top');
		top.append(
			el('span', 'match-opponent', t.name),
			el('span', 'match-score', count)
		);

		const bits = [when(t.starts_at), FORMAT[t.format] || t.format];
		if (t.venues.length) bits.push(TDC.venueNames(t.venues));
		bits.push(t.entrants === 1 ? '1 entrant' : t.entrants + ' entrants');

		// A full one stays listed and says so; the poster refuses the entry.
		const tags = el('div', 'match-tags');
		tags.append(full
			? el('span', 'badge pending', 'Full')
			: el('span', 'badge needs-you', ENTRY[t.entry_mode] || t.entry_mode));

		box.append(top, el('div', 'match-meta', bits.join(' · ')), tags);
		return box;
	}

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;   // requireSession has already sent them to log in

		const [mine, open] = await Promise.all([
			supabaseClient.rpc('tdc_my_tournaments', { p_limit: 50 }),
			supabaseClient.rpc('tdc_open_tournaments', { p_limit: 50 })
		]);

		if (mine.error) { TDC.showSupabaseError(AREA, mine.error, els.status); return; }
		if (open.error) { TDC.showSupabaseError(AREA, open.error, els.status); return; }

		const data = mine.data || [];
		if (!data.length) {
			els.intro.textContent = 'You are not in a tournament yet. Create one above, or enter one below.';
		} else {
			els.list.replaceChildren(...data.map(card));
			els.intro.textContent = data.length === 1
				? 'One tournament.'
				: `${data.length} tournaments, newest first.`;
		}

		const opens = open.data || [];
		if (!opens.length) {
			els.openIntro.textContent = 'No tournaments are open for entry right now.';
		} else {
			els.openList.replaceChildren(...opens.map(openCard));
			els.openIntro.textContent = opens.length === 1
				? 'One tournament you can enter.'
				: `${opens.length} tournaments you can enter, soonest first.`;
		}
	})(), 'Tournaments');
})();
