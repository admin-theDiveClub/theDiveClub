// Your live match card (UV, 18 Nov): a glass card with a yellow glow inside for each
// match waiting on you (a team night at lineups or being played, a singles match being
// played), naming the other side, what is waiting (Lineups, or Playing with the frames
// so far) and the league or tournament; a tap opens the scorecard (a team night's card,
// else the match page). Its ✕ hides it until the page is next loaded: nothing is kept,
// so it is back on every reload until the match is finished (UV).
//
// Which matches is decided by the database alone: public.tdc_my_live_matches
// (migration 20261118073452), which the home page reads through tdc_home_cards.
// Drawn on the home page (home-cards.js, in the Get the app card's place) and on every
// tab of a league season's page (#league-live, above the page's card), that league's nights
// only (UV). Styles in stylesheets/live-match.css.
const TDCLiveMatch = (() => {
	'use strict';
	const AREA = 'Live match';

	function el(tag, cls, text) {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function initials(name) {
		return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	}

	// The other side's picture: a team's hexagon, a player's face or their initials, as
	// the home page's Matches card draws it (home-cards.js opponentPic). cls is the
	// circle's class.
	function face(m, cls) {
		if (m.opponent_kind === 'team') {
			const t = el('span', cls + ' ' + cls + '-team');
			t.append(TDC.teamPic(m.opponent_picture));
			return t;
		}
		const box = el('span', cls);
		const url = TDC.pictureUrl('player-avatars', m.opponent_picture);
		if (url) {
			const img = el('img');
			img.alt = '';
			img.loading = 'lazy';
			img.onerror = () => {
				console.error('[' + AREA + '] a player\'s picture could not be loaded, using the initials.', url);
				img.remove();
				box.textContent = initials(m.opponent);
			};
			img.src = url;
			box.append(img);
		} else {
			box.textContent = initials(m.opponent);
		}
		return box;
	}

	// Where a match opens, and what is waiting, as the card says it; the league tabs'
	// bottom bar uses both for its match pill (league-nav.js, UV 18 Nov).
	const href = (m) => (m.team_match ? '/leagues/card/?m=' + encodeURIComponent(m.id) : '/match/?id=' + encodeURIComponent(m.id));
	function waiting(m) {
		let what = m.state === 'lineups' ? 'Lineups' : 'Playing';
		if (m.state !== 'lineups' && m.my_frames + m.their_frames > 0) what += ' · ' + m.my_frames + '–' + m.their_frames;
		return what;
	}

	function card(m, onGone) {
		const wrap = el('div', 'live-card');
		const a = el('a', 'live-card-link');
		a.href = href(m);
		let what = waiting(m);
		if (m.competition) what += ' · ' + m.competition;
		const words = el('span', 'live-card-words');
		words.append(el('span', 'live-card-title', m.opponent), el('span', 'live-card-sub', what));
		const go = el('span', 'live-card-go', '›');
		go.setAttribute('aria-hidden', 'true');
		a.append(face(m, 'live-face'), words, go);
		const x = el('button', 'live-card-x', '✕');
		x.type = 'button';
		x.setAttribute('aria-label', 'Hide this until the page is reloaded');
		x.addEventListener('click', () => { wrap.remove(); onGone(); });
		wrap.append(a, x);
		return wrap;
	}

	// Fills box with a card per match and shows it; hides it when there are none, or
	// once every card's ✕ has been pressed (then onEmpty, if given)
	function fill(box, rows, onEmpty) {
		if (!rows.length) { box.hidden = true; return false; }
		const gone = () => {
			if (box.children.length) return;
			box.hidden = true;
			if (onEmpty) onEmpty();
		};
		box.replaceChildren(...rows.map((m) => card(m, gone)));
		box.hidden = false;
		return true;
	}

	// A league season's page: #league-live above the page's card, that league's nights only,
	// read once on opening, signed in only
	async function league(box) {
		const seasonId = new URLSearchParams(location.search).get('s');
		if (!seasonId) return;
		try {
			if (!(await TDC.getSession(AREA))) return;
			const { data, error } = await supabaseClient.rpc('tdc_my_live_matches', { p_league_season_id: seasonId });
			if (error) { TDC.showSupabaseError(AREA, error, box); box.hidden = false; return; }
			fill(box, data || []);
			// The bottom bar's match pill (UV, 18 Nov): from the same read, and kept
			// when the card's ✕ is pressed.
			if (typeof TDCLeagueNav !== 'undefined') TDCLeagueNav.live(data || []);
		} catch (e) {
			box.hidden = false;
			TDC.error(AREA, 'your live match could not be read.', e, box);
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		const box = document.getElementById('league-live');
		if (box) league(box);
	});

	return { fill, href, waiting };
})();
