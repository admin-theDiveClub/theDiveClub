// The wallpaper page (UV, 27 Nov; docs/systems/foundations.md, "Wallpapers"):
// /sandbox/wallpaper/?w=<id>, where a W- short link lands. Signed in or not (a TV).
// Reads the wallpaper once (tdc_wallpaper) and hands it to TDCWallpaper
// (wallpaper-show.js); hides the bar after a few seconds of nothing.
//
// Needs: tdc.js, hero.js, wallpaper-show.js.

(() => {
	const AREA = 'Wallpaper';
	const BUCKET = 'wallpaper-pictures';
	const IDLE_MS = 4000;   // the bar hides after this long with nothing done (Claude's)

	const els = {
		scope: document.getElementById('wp'),
		stage: document.getElementById('hero-stage'),
		pics: document.getElementById('wp-pics'),
		logo: document.getElementById('wp-logo'),
		icon: document.getElementById('wp-icon'),
		status: document.getElementById('wp-status')
	};

	const show = TDCWallpaper.create({
		area: AREA,
		scope: els.scope,
		clothEl: document.body,
		stage: els.stage,
		pics: els.pics,
		logo: els.logo,
		icon: els.icon,
		status: els.status
	});

	// ─── The bar hides itself (UV, 27 Nov) ───
	// Back on any mouse move, tap or key (a TV remote's arrows are keys); never
	// hidden while its menu or profile panel is open. Hidden as nav.js hides it on
	// a scroll (.is-hidden), which this page never has.
	const bar = document.querySelector('.site-nav');
	let idle = null;
	function anyOpen() {
		return !!document.querySelector('#nav-menu-toggle[aria-expanded="true"], #nav-profile[aria-expanded="true"]');
	}
	function wake() {
		if (!bar) return;
		bar.classList.remove('is-hidden');
		clearTimeout(idle);
		idle = setTimeout(function sleep() {
			if (anyOpen() || bar.matches(':focus-within')) { idle = setTimeout(sleep, IDLE_MS); return; }
			bar.classList.add('is-hidden');
		}, IDLE_MS);
	}
	['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
		window.addEventListener(type, wake, { passive: true });
	});
	wake();

	async function load() {
		const id = new URLSearchParams(location.search).get('w');
		if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
			TDC.error(AREA, 'this address has no wallpaper in it. Open the wallpaper by its link.', id, els.status);
			return;
		}
		const { data, error } = await supabaseClient.rpc('tdc_wallpaper', { p_id: id });
		if (error) {
			TDC.error(AREA, 'the wallpaper could not be loaded.', error, els.status);
			return;
		}
		if (!data) {
			TDC.error(AREA, 'there is no wallpaper at this link. It may have been removed.', id, els.status);
			return;
		}
		const images = (data.images || []).map((im) => ({ src: TDC.pictureUrl(BUCKET, im.path), fit: im.fit }));
		show.set(data, images);
	}

	TDCLoader.hold(load(), 'Opening the wallpaper');
})();
