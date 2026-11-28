// /tv/: the phone's side of signing in a TV (UV, 28 Nov; docs/systems/foundations.md,
// "Signing in a TV with a phone"). Reads the code (from the QR's ?code= or typed), shows which
// device asks, and answers with tdc_device_login_answer. The TV notices within 3 s.
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(async () => {
	const AREA = 'TV';
	const $ = (id) => document.getElementById(id);
	const els = {
		title: $('tv-title'), enter: $('tv-enter'), input: $('tv-code'), go: $('tv-go'),
		ask: $('tv-ask'), device: $('tv-device'), as: $('tv-as'),
		allow: $('tv-allow'), cancel: $('tv-cancel'), status: $('tv-status'),
	};
	if (Object.values(els).some((el) => !el)) {
		TDC.error(AREA, 'the page is missing expected elements.');
		return;
	}

	const session = await TDC.requireSession(AREA);
	if (!session) return;
	const me = await TDC.getMyPlayer(AREA, session.user.id, els.status);

	let code = '';

	function showEnter(message, type) {
		els.title.textContent = 'Sign in a TV';
		els.ask.hidden = true;
		els.enter.hidden = false;
		TDC.status(els.status, message || '', type || '');
	}

	function done(message) {
		els.ask.hidden = true;
		els.enter.hidden = true;
		TDC.status(els.status, message, 'success');
	}

	async function look(typed) {
		const { data, error } = await TDC.busy(els.status, supabaseClient.rpc('tdc_device_login_view', { p_code: typed }), els.status);
		if (error) {
			TDC.showSupabaseError(AREA, error, els.status);
			return;
		}
		if (!data) {
			showEnter('There is no such code. Check the code on the screen and try again.', 'error');
			return;
		}
		code = data.code;
		history.replaceState(null, '', '/tv/?code=' + code);
		if (data.state === 'waiting') {
			els.enter.hidden = true;
			els.ask.hidden = false;
			els.title.textContent = 'Allow this device?';
			els.device.textContent = data.device;
			els.as.textContent = 'It will be signed in as ' + (me ? me.display_name : 'you') + '.';
			TDC.status(els.status, '', '');
		} else if (data.state === 'expired') {
			showEnter('That code has run out. Scan the code on the screen again, or type the new one.', 'error');
		} else if (data.state === 'refused') {
			showEnter('That code was cancelled. The screen shows a new one.', '');
		} else if (data.mine) {
			done('Done. ' + data.device + ' is signed in to your account.');
		} else {
			showEnter('That code has already been used. The screen shows a new one.', 'error');
		}
	}

	async function answer(allow) {
		els.allow.disabled = els.cancel.disabled = true;
		try {
			const { error } = await TDC.busy(allow ? els.allow : els.cancel,
				supabaseClient.rpc('tdc_device_login_answer', { p_code: code, p_allow: allow }), els.status);
			if (error) {
				TDC.showSupabaseError(AREA, error, els.status);
				return;
			}
			if (allow) {
				done('Done. ' + els.device.textContent + ' is signing in now. You can put your phone away.');
			} else {
				els.ask.hidden = true;
				TDC.status(els.status, 'Cancelled. Nothing was signed in.', '');
			}
		} finally {
			els.allow.disabled = els.cancel.disabled = false;
		}
	}

	els.enter.addEventListener('submit', (e) => {
		e.preventDefault();
		const typed = els.input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
		if (typed.length !== 8) {
			TDC.status(els.status, 'A code has 8 letters and numbers, like K7QM-4XPD.', 'error');
			return;
		}
		look(typed);
	});
	els.allow.addEventListener('click', () => answer(true));
	els.cancel.addEventListener('click', () => answer(false));

	const fromQr = new URLSearchParams(location.search).get('code');
	if (fromQr) look(fromQr);
	else showEnter();
})();
