// My matches (/matches/). The way into a match page.
//
// Everything comes from one call to tdc_my_matches, which counts each scoreline
// from the frames. Counting them here instead would be one request per match to
// work out two numbers.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Matches';

	const els = {
		list: document.getElementById('match-list'),
		status: document.getElementById('list-status'),
		intro: document.getElementById('intro')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the matches page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const DISCIPLINE = { '8ball': '8-Ball', '9ball': '9-Ball', '10ball': '10-Ball', blackball: 'Blackball' };
	const WIN_CONDITION = { race_to: 'Race to', best_of: 'Best of', fixed_frames: 'Frames', timed: 'Timed', free_play: 'Free play' };

	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// "Today", "Yesterday", then the date. A league player looking for last
	// night's match should not have to read a timestamp to find it.
	function when(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a match: ' + iso); return ''; }

		const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const days = Math.round((midnight(new Date()) - midnight(d)) / 86400000);

		const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (days === 0) return 'Today ' + time;
		if (days === 1) return 'Yesterday ' + time;
		if (days < 7) return d.toLocaleDateString([], { weekday: 'long' }) + ' ' + time;
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// The scoreline is this player's frames first, always. Someone reading their
	// own list should not have to work out which number is theirs.
	// A match this player referees reads home first, with nobody's side picked out.
	function scoreline(m) {
		const wrap = el('span', 'match-score');
		const mine = el('strong', !m.refereeing && m.my_frames > m.their_frames ? 'win' : '', String(m.my_frames));
		wrap.append(mine, el('span', 'dash', '–'), el('span', '', String(m.their_frames)));
		return wrap;
	}

	function card(m) {
		const a = document.createElement('a');
		a.className = 'match-card' + (m.needs_me ? ' needs-you' : '');
		// A team match (20261029140544, UV 29 Oct): a captain or the league
		// director to the captain's card, a player to the player's page.
		// The player's page is not built yet, so a player goes to the card too,
		// where they see the night and enter nothing.
		a.href = m.team_match
			? '/leagues/card/?m=' + encodeURIComponent(m.id)
			: '/match/?id=' + encodeURIComponent(m.id);

		const top = el('div', 'match-top');
		// For a refereed match the function sends both names ("Alice : Bob").
		top.append(el('span', 'match-opponent', m.refereeing ? m.opponent : 'vs ' + m.opponent), scoreline(m));

		const meta = el('div', 'match-meta');
		const bits = [];
		if (m.played_at) bits.push(when(m.played_at));
		if (m.discipline) bits.push(DISCIPLINE[m.discipline] || m.discipline);
		if (m.win_condition === 'free_play') bits.push(WIN_CONDITION.free_play);
		else if (m.win_condition && m.target) {
			bits.push((WIN_CONDITION[m.win_condition] || m.win_condition) + ' ' + m.target);
		}
		if (!m.frames_played) bits.push('No frames yet');
		meta.textContent = bits.join(' · ');

		const tags = el('div', 'match-tags');

		// Where the scorecard stands comes first: it is the only thing on this
		// list that might be waiting on the person reading it.
		const card = (m.card_state && m.card_state.state) || 'in_progress';
		if (m.needs_me) tags.append(el('span', 'badge needs-you', 'Needs you'));
		else if (card === 'awaiting') tags.append(el('span', 'badge', 'Waiting on them'));
		else if (card === 'agreed') tags.append(el('span', 'badge verified', 'Agreed'));
		else if (card === 'disputed') tags.append(el('span', 'badge disputed', 'Disputed'));
		else if (m.status === 'in_progress') tags.append(el('span', 'badge', 'In progress'));

		if (m.refereeing) tags.append(el('span', 'badge', 'Referee'));
		if (m.status === 'abandoned') tags.append(el('span', 'badge', 'Abandoned'));
		if (m.sanctioned) tags.append(el('span', 'badge verified', 'Sanctioned'));

		a.append(top, meta);
		if (tags.childElementCount) a.append(tags);
		return a;
	}

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;   // requireSession has already sent them to log in

		const { data, error } = await supabaseClient.rpc('tdc_my_matches', { p_limit: 50 });

		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }

		if (!data || !data.length) {
			els.intro.textContent = 'You have not played a match on here yet.';
			TDC.status(els.status,
				'Once someone scores a match you are in, it will show up here.', '');
			return;
		}

		els.list.replaceChildren(...data.map(card));
		els.intro.textContent = data.length === 1
			? 'One match.'
			: `${data.length} matches, newest first.`;
	})(), 'Matches');
})();
