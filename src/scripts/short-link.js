// Short links (UV, 9 Nov; docs/design/short-links.md): thediveclub.org/<code>.
//
// Runs on 404.html, which GitHub Pages sends for any address that does not
// exist. Asks tdc_resolve_short_code where the code goes and replaces this page
// with it, so Back does not land here again. A code that goes nowhere says why.
//
// The address comes only from the database, built there from an id. The check
// before leaving is a second lock on the same door.
//
// Needs: tdc.js.

(() => {
	const AREA = 'ShortLink';

	const els = {
		box: document.getElementById('sl-reason'),
		head: document.getElementById('sl-head'),
		text: document.getElementById('sl-text'),
		status: document.getElementById('page-status')
	};

	function readCode() {
		const raw = location.pathname.replace(/^\/+|\/+$/g, '');
		try { return decodeURIComponent(raw); }
		catch (err) { return ''; }
	}

	const code = readCode();

	const REASONS = {
		invalid: ['Page not found', 'There is no page at this address. Check it for a typing mistake.'],
		not_found: ['Link not found', `Nothing has the code ${code.toUpperCase()}. It may be mistyped, or whoever set it may have changed it.`],
		no_such_match: ['Match not found', 'That league or tournament has no match with this number. It may be mistyped, or the match may have been removed.'],
		poster_not_shared: ['Not shared yet', 'This tournament has not shared its poster yet. Ask whoever sent you the link, or try again later.'],
		no_season: ['No season yet', 'This league has not started a season yet. Try again later.'],
		offline: ['You are offline', 'This link needs a connection. Try again when you are back online.'],
		failed: ['Could not open this link', 'Something went wrong checking this link. Try again in a moment.']
	};

	function show(reason) {
		const words = REASONS[reason];
		if (!words) {
			TDC.error(AREA, `unknown reason "${reason}" for this link.`, null, els.status);
			return;
		}
		els.head.textContent = words[0];
		els.text.textContent = words[1];
		els.box.hidden = false;
		document.title = `${words[0]} — The Dive Club`;
	}

	async function open() {
		// Anything that could not be a code is not worth a call.
		if (!/^[A-Za-z0-9-]{1,24}$/.test(code)) {
			show('invalid');
			return;
		}

		let answer;
		try {
			answer = await supabaseClient.rpc('tdc_resolve_short_code', { p_code: code });
		} catch (err) {
			answer = { error: err };
		}

		if (answer.error) {
			if (!navigator.onLine) {
				show('offline');
				return;
			}
			show('failed');
			TDC.error(AREA, 'could not look this link up.', answer.error, els.status);
			return;
		}

		const { path, reason } = answer.data || {};
		if (path) {
			if (!path.startsWith('/') || path.startsWith('//')) {
				show('failed');
				TDC.error(AREA, 'the lookup gave an address that is not on this site.', path, els.status);
				return;
			}
			TDCLoader.leaving();
			location.replace(path);
			return;
		}

		show(reason || 'failed');
	}

	TDCLoader.hold(open(), 'Opening the link');
})();
