// A recurring tournament's History tab (UV, 25 Nov; migration
// 20261125130921; _includes/tournament/history.html): every other tournament of
// its series, from tdc_tournament_history, newest first. Each is a card as on
// /tournaments/ (tournaments.js): the name and the number who entered, the
// date, the status, and once its final is decided the winner and the
// runner-up, counted from the final as the draw counts them. A card opens the
// draw, or the poster for one not started when the poster can be opened, as
// a tournament's card does (UV, 5 Nov). A picture opens the player's profile
// (TDC.profilePic: the card round it is a link).
//
// Needs: tdc.js, tournament-nav.js; league.css for the people.

TDCTournamentNav.panel('history', () => {
	const AREA = 'Tournament history';
	const tournamentId = new URLSearchParams(location.search).get('t');
	const el = (id) => document.getElementById(id);
	const els = { intro: el('th-intro'), status: el('th-status'), list: el('th-list') };

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the history tab is missing expected elements: ' + missing.join(', '));
		return;
	}

	// As /tournaments/ words and colours them (tournaments.js).
	const STATUS = {
		draft: 'Draft', open: 'Open for entries', in_progress: 'Running',
		complete: 'Finished', cancelled: 'Cancelled'
	};
	const STATUS_CLASS = {
		draft: 'pending', open: 'needs-you', in_progress: 'live',
		complete: 'verified', cancelled: 'pending'
	};
	const NOT_STARTED = ['draft', 'open'];

	const node = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text !== undefined) n.textContent = text;
		return n;
	};

	// The day it was played, said in full: a history is read by date.
	function day(iso) {
		if (!iso) return 'No date set';
		const d = new Date(iso);
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date on a tournament: ' + iso); return ''; }
		return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}

	function face(name, path, playerId) {
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
		return TDC.profilePic(box, playerId);
	}

	function person(name, path, playerId, role) {
		const p = node('span', 'person');
		const names = node('span', 'person-names');
		names.append(node('span', 'person-name', name), node('span', 'person-sub', role));
		p.append(face(name, path, playerId), names);
		return p;
	}

	function card(t) {
		const box = node('a', 'match-card');
		const id = encodeURIComponent(t.tournament_id);
		box.href = NOT_STARTED.includes(t.status) && t.poster_open
			? '/tournaments/poster/?t=' + id
			: '/tournaments/bracket/?t=' + id;

		const top = node('div', 'match-top');
		top.append(node('span', 'match-opponent', t.name), node('span', 'match-score', String(t.entrants)));
		const meta = node('div', 'match-meta',
			day(t.starts_at) + ' · ' + (t.entrants === 1 ? '1 entrant' : t.entrants + ' entrants'));
		box.append(top, meta);

		if (t.winner_player_id) {
			const podium = node('div', 'th-podium');
			podium.append(person(t.winner_name, t.winner_avatar, t.winner_player_id, 'Winner'));
			if (t.runner_up_player_id) podium.append(person(t.runner_up_name, t.runner_up_avatar, t.runner_up_player_id, 'Runner-up'));
			box.append(podium);
		}

		const tags = node('div', 'match-tags');
		tags.append(node('span', 'badge ' + (STATUS_CLASS[t.status] || ''), STATUS[t.status] || t.status));
		box.append(tags);
		return box;
	}

	async function load() {
		const { data, error } = await supabaseClient.rpc('tdc_tournament_history', { p_tournament_id: tournamentId });
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return; }
		const rows = data || [];
		els.list.replaceChildren(...rows.map(card));
		els.intro.textContent = rows.length
			? (rows.length === 1 ? 'One other tournament in this series.' : rows.length + ' other tournaments in this series, newest first.')
			: 'No other tournaments in this series yet. Each one made with Next tournament shows here.';
	}

	TDCLoader.hold((async () => {
		if (!await TDC.requireSession(AREA)) return;
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Open this page from the tournament list.', null, els.status);
			return;
		}
		await load();
	})(), AREA);

	// Shown again as a tab: read again.
	return { refresh: () => load().catch((err) => TDC.error(AREA, 'the history could not be read again.', err, els.status)) };
});
