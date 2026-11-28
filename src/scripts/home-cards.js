// The home page's content on the cloth (UV, 16 Nov; cut down on 20 Nov, when UV removed the
// Matches, Leagues and Tournaments cards): your live match, in the Get the app card's place
// (live-match.js draws it), and your player star (player-star.js). Everything comes from one
// call, tdc_home_cards (migration 20261116132606), which says whether you are signed in
// and lists your live matches; the star is read from tdc_player_profile.
(function () {
	'use strict';
	var AREA = 'Home';
	var root = document.getElementById('home-cards');
	if (!root) return;
	var statusEl = document.getElementById('home-cards-status');

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	}

	function initials(name) {
		// Words that start with a letter or digit, so a name reads as its first two letters.
		return (name || '?').split(/\s+/).filter(function (w) { return /^[\p{L}\p{N}]/u.test(w); }).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?';
	}

	// Your picture and display name, above your star (UV, 20 Nov): the picture, or your
	// initials without one, then the name in the display face. Not a link.
	function whoRow(me) {
		var row = el('div', 'home-star-who');
		var pic = el('span', 'home-star-pic');
		var url = TDC.pictureUrl('player-avatars', me.avatar_path);
		if (url) {
			var img = el('img');
			img.alt = '';
			img.onerror = function () {
				console.error('[' + AREA + '] your picture could not be loaded, using your initials.', url);
				img.remove();
				pic.textContent = initials(me.display_name);
			};
			img.src = url;
			pic.append(img);
		} else {
			pic.textContent = initials(me.display_name);
		}
		row.append(pic, el('span', 'home-star-name', me.display_name));
		return row;
	}

	// Your live match (UV, 18 Nov; live-match.js draws it): in the Get the app card's
	// place, that one hidden while it shows (home.js places whichever shows). Once every
	// live card's ✕ is pressed, Get the app comes back if it was showing.
	function drawLive(d) {
		var box = document.getElementById('home-live');
		if (!box || !d.signed_in) return;
		if (!Array.isArray(d.live)) {
			TDC.error(AREA, 'your live match could not be shown: the database has not been updated (tdc_home_cards sends no live list).', d, statusEl);
			return;
		}
		var install = document.getElementById('home-install');
		var installShown = !!install && !install.hidden;
		if (TDCLiveMatch.fill(box, d.live, function () { if (installShown) install.hidden = false; }) && install) install.hidden = true;
	}

	// Your player star (UV, 20 Nov), above Matches: the one on your own profile, all time,
	// from tdc_player_profile (player-star.js draws it), directly on the cloth with no
	// card and no heading. Signed in only; shown at once with the dots in it and filled
	// when your frames arrive.
	function drawStar() {
		var card = document.getElementById('hc-star-card');
		var body = document.getElementById('hc-star');
		if (!card || !body) return;
		card.hidden = false;
		var work = (async function () {
			var session = await TDC.getSession(AREA);
			if (!session) { card.hidden = true; return; }
			var me = await TDC.getMyPlayer(AREA, session.user.id, statusEl);
			if (!me) { card.hidden = true; return; }
			var r = await supabaseClient.rpc('tdc_player_profile', { p_player_id: me.id });
			if (r.error) { card.hidden = true; TDC.showSupabaseError(AREA, r.error, statusEl); return; }
			var p = r.data;
			if (!p || !Array.isArray(p.matches) || !Array.isArray(p.frames)) {
				card.hidden = true;
				TDC.error(AREA, 'your frames came back in a shape this page does not know.', p, statusEl);
				return;
			}
			var set = TDCStar.defaults();
			var counts = TDCStar.count(TDCStar.allFrames(p), set.walkovers);
			body.replaceChildren(whoRow(me), TDCStar.draw('Your star', [{ counts: counts, adjusted: true }], set, TDCStar.LEAGUE_SPOKES, { stats: true }).svg);
		})();
		work.catch(function (e) { card.hidden = true; TDC.error(AREA, 'your star could not be drawn.', e, statusEl); });
		TDC.busy(body, work);
	}

	// Your QR in the logo's place (UV, 28 Nov): signed in, the first screen's logo
	// becomes a QR of your player short link (thediveclub.org/First-Last-2), which
	// opens your player page (signed in only: a stranger scanning it signs in first).
	// Drawn in the site's QR look (TDCCredits.qrSvg). Signed out, the logo stays.
	// With no short link (a first or last name not saved: foundations.md, "Short
	// links", Players) the logo stays too, and the console says why.
	function drawQr() {
		var logo = document.getElementById('home-logo');
		var box = document.getElementById('home-qr');
		if (!logo || !box) return;
		var work = (async function () {
			var session = await TDC.getSession(AREA);
			if (!session) return;
			var me = await TDC.getMyPlayer(AREA, session.user.id, statusEl);
			if (!me) return;
			var r = await supabaseClient.rpc('tdc_short_link', { p_kind: 'player', p_id: me.id });
			if (r.error) { TDC.showSupabaseError(AREA, r.error, statusEl); return; }
			if (!r.data || !r.data.code) {
				console.info('[' + AREA + '] no QR in the logo\'s place: this player has no short link until both names are saved on the profile.');
				return;
			}
			logo.classList.add('has-qr');
			box.hidden = false;
			await TDC.busy(box, TDCCredits.loadQr(), statusEl);
			box.replaceChildren(TDCCredits.qrSvg(location.origin + '/' + r.data.code));
		})();
		work.catch(function (e) {
			logo.classList.remove('has-qr');
			box.hidden = true;
			TDC.error(AREA, 'your QR code could not be drawn.', e, statusEl);
		});
	}

	function draw(d) {
		drawLive(d);
		if (d.signed_in) { drawStar(); drawQr(); }
	}

	try {
		supabaseClient.rpc('tdc_home_cards').then(function (r) {
			if (r.error) { TDC.showSupabaseError(AREA, r.error, statusEl); return; }
			try { draw(r.data || {}); }
			catch (e) { TDC.error(AREA, 'the page could not be drawn.', e, statusEl); }
		}, function (e) {
			TDC.error(AREA, 'the page could not be read.', e, statusEl);
		});
	} catch (e) {
		TDC.error(AREA, 'the page could not be read.', e, statusEl);
	}
})();
