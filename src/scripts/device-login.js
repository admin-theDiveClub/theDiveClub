// The login page's QR: sign this screen in with a phone (UV, 28 Nov; docs/systems/foundations.md,
// "Signing in a TV with a phone"). TDCDeviceLogin.mount(box, { onSignedIn }) draws it into box and
// returns { open, close }: nothing is asked for until open(), and close() stops it.
// Needs: supabaseClient.js, tdc.js, credits-card.js (the site's QR look), device-login.css.
//
// The page makes a random secret and asks the edge function device-login for a code. The QR opens
// /tv/?code=<code> on the phone, where a signed-in person taps Allow. Meanwhile the page asks
// every 3 s whether it may sign in; once allowed it receives a one-time token and signs in with a
// session of its own. A new code every 30 s (UV: "a real security risk"); each may be allowed for
// 60 s, so the previous one is still asked about until it runs out. After 30 minutes with nobody
// scanning, it stops and offers a button (a forgotten login page would otherwise ask all night).
// Hidden (another tab, the screen off), it stops; shown again, it starts with a new code.

const TDCDeviceLogin = (() => {
	const AREA = 'DeviceLogin';
	const ROTATE_MS = 30 * 1000;
	const ASK_MS = 3 * 1000;
	const LIFE_MS = 60 * 1000;     // as the database's expires_at
	const GIVE_UP_MS = 30 * 60 * 1000;

	function newSecret() {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	function shown(code) { return code.slice(0, 4) + '-' + code.slice(4); }

	// The function's own "TDC (Error): …" message, when it sent one.
	async function messageOf(err) {
		try {
			const body = await err.context.json();
			if (body && body.error) return body.error;
		} catch { /* not JSON */ }
		return err && err.message ? err.message : 'unknown problem';
	}

	async function call(body) {
		const { data, error } = await supabaseClient.functions.invoke('device-login', { body });
		if (error) throw new Error(await messageOf(error));
		return data;
	}

	function mount(box, { onSignedIn } = {}) {
		box.classList.add('dl');
		box.innerHTML = `
			<div class="dl-or">or sign in with your phone</div>
			<div class="dl-qr" aria-label="QR code to sign in with your phone"></div>
			<div class="dl-code" aria-live="polite"></div>
			<p class="dl-hint">Scan it with your phone, or go to <strong>thediveclub.org/tv</strong> and enter the code.</p>
			<button type="button" class="btn btn-secondary dl-again" hidden>Show a new code</button>
			<div class="status dl-status"></div>`;
		const els = {
			qr: box.querySelector('.dl-qr'),
			code: box.querySelector('.dl-code'),
			hint: box.querySelector('.dl-hint'),
			again: box.querySelector('.dl-again'),
			status: box.querySelector('.dl-status'),
		};

		let live = [];            // { secret, code, until } newest first, at most two
		let rotateTimer = 0, askTimer = 0;
		let startedAt = 0;
		let asking = false, done = false, running = false;

		function stop() {
			running = false;
			clearTimeout(rotateTimer);
			clearTimeout(askTimer);
		}

		async function fresh(first) {
			if (!running || done) return;
			if (Date.now() - startedAt > GIVE_UP_MS) {
				stop();
				live = [];
				els.qr.replaceChildren();
				els.code.textContent = '';
				els.hint.hidden = true;
				els.again.hidden = false;
				return;
			}
			const secret = newSecret();
			try {
				const work = Promise.all([call({ action: 'start', secret }), TDCCredits.loadQr()]);
				// Dots on the first code only; later ones replace the old in place.
				const [data] = await (first ? TDC.busy(els.qr, work, els.status) : work);
				if (!running || done) return;
				live = [{ secret, code: data.code, until: Date.now() + LIFE_MS }, ...live].slice(0, 2);
				els.qr.replaceChildren(TDCCredits.qrSvg(location.origin + '/tv/?code=' + data.code));
				els.code.textContent = shown(data.code);
			} catch (err) {
				TDC.error(AREA, 'could not get a sign-in code: ' + err.message, err, els.status);
			}
			rotateTimer = setTimeout(() => fresh(false), ROTATE_MS);
		}

		async function ask() {
			if (!running || done) return;
			live = live.filter((l) => l.until > Date.now() - ASK_MS);
			if (!asking && live.length) {
				asking = true;
				try {
					for (const l of live) {
						const data = await call({ action: 'collect', secret: l.secret });
						if (data.state === 'approved') {
							done = true;
							stop();
							const { error } = await TDC.busy(els.qr, supabaseClient.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' }), els.status);
							if (error) {
								TDC.error(AREA, 'the phone allowed it, but signing in failed: ' + error.message, error, els.status);
								return;
							}
							els.code.textContent = 'Signed in';
							(onSignedIn || (() => location.reload()))();
							return;
						}
						if (data.state === 'refused') {
							live = live.filter((x) => x !== l);
							TDC.status(els.status, 'Cancelled on the phone. Here is a new code.', '');
							clearTimeout(rotateTimer);
							fresh(false);
						}
					}
				} catch (err) {
					TDC.error(AREA, 'could not check the phone\'s answer: ' + err.message, err, els.status);
				} finally {
					asking = false;
				}
			}
			if (running && !done) askTimer = setTimeout(ask, ASK_MS);
		}

		function start() {
			if (running || done) return;
			running = true;
			startedAt = Date.now();
			live = [];
			els.again.hidden = true;
			els.hint.hidden = false;
			TDC.status(els.status, '', '');
			fresh(true);
			askTimer = setTimeout(ask, ASK_MS);
		}

		// open() and close() are the host's: codes are made only while it shows the QR (UV, 28 Nov:
		// "only generate when the log-in card is opened and stop when the card is closed").
		let wanted = false;
		function open() {
			wanted = true;
			if (!document.hidden) start();
		}
		function close() {
			wanted = false;
			stop();
			live = [];
		}

		els.again.addEventListener('click', start);
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				stop();
			} else if (wanted && els.again.hidden) {
				start();
			}
		});

		return { open, close };
	}

	return { mount };
})();
