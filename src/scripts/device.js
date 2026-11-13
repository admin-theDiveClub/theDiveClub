// What device and browser this is, and whether the site is running as the
// installed app (13 Nov; docs/systems/foundations.md, "Getting the app").
//
// Read by the nav's install strip and menu row, the install page, and the
// profile page's notifications. In the <head>, with no dependencies, so it is
// listening before Android Chrome offers the install (beforeinstallprompt can
// arrive before the body's scripts have run).
//
//   TDCDevice.os          'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'other'
//   TDCDevice.browser     'safari' | 'chrome' | 'edge' | 'samsung' | 'firefox'
//                         | 'opera' | 'in-app' | 'other'
//   TDCDevice.inApp       which app's own browser this is ('instagram', 'facebook',
//                         'tiktok', …), or null. Nothing can be installed from one.
//   TDCDevice.mobile      an iPhone, iPad or Android device
//   TDCDevice.installed   running as the installed app, not in a browser
//   TDCDevice.canInstall  the browser has offered a one-tap install (Android
//                         Chrome, Samsung Internet, Edge; desktop Chrome and Edge)
//   TDCDevice.install()   shows that one-tap dialog: 'accepted' | 'dismissed' | 'unavailable'
//   TDCDevice.kind        which install steps fit (the install page's sections):
//                         'installed' | 'in-app' | 'ios-safari' | 'ios-other'
//                         | 'android' | 'desktop'
//   TDCDevice.openInBrowserUrl()  Android only: an address that reopens this page in
//                         Chrome from inside an app's browser; null elsewhere
//
// Events on window: 'tdc:installable' when the one-tap install becomes possible,
// 'tdc:installed' when the app has just been installed (Android and desktop only:
// an iPhone says nothing).
//
// Read from the browser's user agent. That is enough to choose which steps to
// show, which is all it is for: never use it to refuse anybody anything.

(function () {
	const ua = navigator.userAgent || '';

	// An iPad on iPadOS 13+ says it is a Mac; a Mac has no touch screen.
	const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;

	const os = /iPhone|iPad|iPod/.test(ua) || iPadAsMac ? 'ios'
		: /Android/.test(ua) ? 'android'
		: /Macintosh|Mac OS X/.test(ua) ? 'mac'
		: /Windows/.test(ua) ? 'windows'
		: /Linux|CrOS/.test(ua) ? 'linux'
		: 'other';

	const installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
		|| window.navigator.standalone === true;

	// The apps whose own browser a shared link opens in. Their names are in the
	// user agent; a plain Android web view says "; wv)".
	const IN_APP = [
		['instagram', /Instagram/],
		['facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/],
		['tiktok', /musical_ly|BytedanceWebview|TikTok/i],
		['snapchat', /Snapchat/],
		['linkedin', /LinkedInApp/],
		['twitter', /Twitter/],
		['line', /\bLine\//],
		['wechat', /MicroMessenger/],
		['web view', /; wv\)/]
	];
	let inApp = null;
	if (!installed) {
		for (const [name, re] of IN_APP) if (re.test(ua)) { inApp = name; break; }
		// An app's browser on an iPhone that does not name itself: every real
		// browser there says "Safari/" (Chrome and the rest included); an app's
		// web view does not. The installed app does not either, hence !installed.
		if (!inApp && os === 'ios' && !/Safari\//.test(ua)) inApp = 'web view';
	}

	const browser = inApp ? 'in-app'
		: /EdgA|EdgiOS|Edg\//.test(ua) ? 'edge'
		: /SamsungBrowser/.test(ua) ? 'samsung'
		: /OPR\/|OPT\/|Opera/.test(ua) ? 'opera'
		: /Firefox|FxiOS/.test(ua) ? 'firefox'
		: /CriOS|Chrome\//.test(ua) ? 'chrome'
		: /Safari\//.test(ua) ? 'safari'
		: 'other';

	const mobile = os === 'ios' || os === 'android';

	const kind = installed ? 'installed'
		: inApp ? 'in-app'
		: os === 'ios' ? (browser === 'safari' ? 'ios-safari' : 'ios-other')
		: os === 'android' ? 'android'
		: 'desktop';

	// ── The one-tap install (Android and desktop Chrome, Edge, Samsung) ──
	// Held rather than let the browser show its own banner, so the site's strip
	// is the only prompt (13 Nov). The held event can be used once.
	let deferred = null;
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		// Never on an iPhone or in an app's browser; if one ever came, the
		// steps for that kind are still the right answer.
		if (os === 'ios' || inApp) return;
		deferred = e;
		window.dispatchEvent(new CustomEvent('tdc:installable'));
	});
	window.addEventListener('appinstalled', () => {
		deferred = null;
		window.dispatchEvent(new CustomEvent('tdc:installed'));
	});

	async function install() {
		if (!deferred) return 'unavailable';
		const e = deferred;
		deferred = null;
		try {
			await e.prompt();
			const choice = await e.userChoice;
			return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
		} catch (err) {
			console.error('[Device] the install dialog would not open.', err);
			return 'unavailable';
		}
	}

	// Android: an intent address opens the same page in Chrome, or, with Chrome
	// missing, in whatever browser the fallback address finds.
	function openInBrowserUrl() {
		if (os !== 'android') return null;
		const here = location.href;
		return 'intent://' + location.host + location.pathname + location.search
			+ '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url='
			+ encodeURIComponent(here) + ';end';
	}

	window.TDCDevice = {
		os, browser, inApp, mobile, installed, kind,
		get canInstall() { return !!deferred; },
		install, openInBrowserUrl
	};
})();
