// The home page's three cards (UV, 16 Nov): Matches, Leagues and Tournaments, under the
// Get the app card, on the cloth (index.html). Everything comes from one call,
// tdc_home_cards (migration 20261116132606), signed out or in.
//
// Signed out: the public leagues and tournaments; Matches says "Sign in to start a new
// match." Signed in: my leagues, my tournaments, my recent matches. Active first (the
// database orders them). A league or tournament is a badge with its name under it (UV)
// and a status bar between them; a match is a row naming the player or team I played,
// with a strip in its state's colour. The colours are the state colours (docs/ui.md):
// yellow under way, green open or done, grey paused or over, red abandoned or disputed.
(function () {
	'use strict';
	var AREA = 'Home';
	var root = document.getElementById('home-cards');
	if (!root) return;
	var statusEl = document.getElementById('home-cards-status');
	var bodies = {
		matches: document.getElementById('hc-matches'),
		leagues: document.getElementById('hc-leagues'),
		tournaments: document.getElementById('hc-tournaments')
	};

	// A state's colour: the strip's class (home.css)
	var LEAGUE = {
		running: ['is-on', 'Running'], taking_entries: ['is-go', 'Taking entries'],
		on_break: ['is-rest', 'On break'], finished: ['is-rest', 'Finished']
	};
	var TOURNAMENT = {
		in_progress: ['is-on', 'Under way'], open: ['is-go', 'Open'],
		draft: ['is-none', 'Draft'], complete: ['is-rest', 'Finished']
	};

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function initials(name) {
		return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
	}

	var TROPHY = 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';
	function trophy() {
		var NS = 'http://www.w3.org/2000/svg';
		var svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		var path = document.createElementNS(NS, 'path');
		path.setAttribute('d', TROPHY);
		path.setAttribute('fill', 'currentColor');
		svg.append(path);
		return svg;
	}

	// A badge: the picture, the status bar, the name under it
	function badge(href, pic, name, state, kindClass) {
		var a = el('a', 'hc-badge ' + state[0]);
		a.href = href;
		a.title = name + ' · ' + state[1];
		var box = el('span', 'hc-pic ' + kindClass);
		box.append(pic);
		a.append(box, el('span', 'hc-bar'), el('span', 'hc-name', name));
		var said = el('span', 'visually-hidden', ', ' + state[1]);
		a.append(said);
		return a;
	}

	function leagueBadge(l, signedIn) {
		// As the profile menu: whoever runs it lands on Run it
		var href = '/leagues/season/?s=' + encodeURIComponent(l.league_season_id) + (signedIn && l.i_run_it ? '&tab=manage' : '');
		return badge(href, TDC.leaguePic(l.picture_path), l.name, LEAGUE[l.status] || ['is-none', l.status], 'hc-pic-league');
	}

	function tournamentBadge(t, signedIn) {
		// As the profile menu: the poster until the start, then the draw. Signed out, the
		// poster always (the only one shown is one with a public poster)
		var poster = !signedIn || (t.status !== 'in_progress' && t.poster_open);
		var href = (poster ? '/tournaments/poster/?t=' : '/tournaments/bracket/?t=') + encodeURIComponent(t.id);
		return badge(href, trophy(), t.name, TOURNAMENT[t.status] || ['is-none', t.status], 'hc-pic-tournament');
	}

	// A match's state, as a fixture's and the card's (league.css): a dispute or an
	// abandoned match red, being played or waiting on a signature yellow, done green
	function matchState(m) {
		if (m.status === 'abandoned' || m.card_state === 'disputed') return 'is-bad';
		if (m.status === 'in_progress' || m.card_state === 'awaiting') return 'is-on';
		if (m.status === 'complete') return 'is-done';
		return 'is-go';
	}

	function opponentPic(m) {
		if (m.opponent_kind === 'team') {
			var t = el('span', 'hc-face hc-face-team');
			t.append(TDC.teamPic(m.opponent_picture));
			return t;
		}
		var box = el('span', 'hc-face');
		var url = TDC.pictureUrl('player-avatars', m.opponent_picture);
		if (url) {
			var img = el('img');
			img.alt = '';
			img.loading = 'lazy';
			img.onerror = function () {
				console.error('[' + AREA + '] a picture on the Matches card could not be loaded, using the initials.', url);
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

	function matchRow(m) {
		// As /matches/: a team night opens the team card
		var a = el('a', 'hc-match ' + matchState(m));
		a.href = m.team_match ? '/leagues/card/?m=' + encodeURIComponent(m.id) : '/match/?id=' + encodeURIComponent(m.id);
		var right = (m.my_frames + m.their_frames > 0) ? m.my_frames + '–' + m.their_frames
			: m.status === 'in_progress' ? 'Playing' : m.status === 'scheduled' ? 'Not started' : '';
		a.append(el('span', 'hc-strip'), opponentPic(m), el('span', 'hc-opp', m.opponent), el('span', 'hc-right', right));
		return a;
	}

	// An empty card says so, with the way in
	function empty(words, href, linkWords) {
		var p = el('p', 'hc-empty', words + ' ');
		if (href) {
			var a = el('a', null, linkWords);
			a.href = href;
			p.append(a);
		}
		return p;
	}

	function draw(d) {
		var signedIn = !!d.signed_in;
		var leagues = d.leagues || [], tournaments = d.tournaments || [], matches = d.matches || [];

		if (!signedIn) {
			var a = el('a', 'hc-signin', 'Sign in to start a new match.');
			a.href = '/accounts/?next=' + encodeURIComponent('/matches/new/');
			bodies.matches.replaceChildren(a);
		} else if (matches.length) {
			var list = el('div', 'hc-matches');
			list.append.apply(list, matches.map(matchRow));
			bodies.matches.replaceChildren(list);
		} else {
			bodies.matches.replaceChildren(empty('No matches yet.', '/matches/new/', 'Start a match'));
		}

		function grid(rows, make) {
			var g = el('div', 'hc-badges');
			g.append.apply(g, rows.map(function (r) { return make(r, signedIn); }));
			return g;
		}
		bodies.leagues.replaceChildren(leagues.length ? grid(leagues, leagueBadge)
			: signedIn ? empty('You are not in a league yet.', '/leagues/', 'Find a league')
			: empty('No public leagues yet.'));
		bodies.tournaments.replaceChildren(tournaments.length ? grid(tournaments, tournamentBadge)
			: signedIn ? empty('You are not in a tournament yet.', '/tournaments/', 'Find a tournament')
			: empty('No public tournaments yet.'));
	}

	try {
		var work = supabaseClient.rpc('tdc_home_cards');
		// The dots in each card while it loads
		Object.keys(bodies).forEach(function (k) { if (bodies[k]) TDC.busy(bodies[k], work); });
		work.then(function (r) {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, statusEl); return; }
			try { draw(r.data || {}); }
			catch (e) { TDC.error(AREA, 'the cards could not be drawn.', e, statusEl); }
		}, function (e) {
			TDC.error(AREA, 'the cards could not be read.', e, statusEl);
		});
	} catch (e) {
		TDC.error(AREA, 'the cards could not be read.', e, statusEl);
	}
})();
