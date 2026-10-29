// Shared helpers for The Dive Club pages.
// Loaded on every page by layout.html, after supabaseClient.js.

const TDC = (() => {

	// Unexpected problem: log it, and show "TDC (Error): …" on the page if a target is given.
	function error(area, message, detail, targetEl) {
		console.error(`[${area}] ${message}`, detail ?? '');
		if (targetEl) {
			targetEl.textContent = `TDC (Error): ${message}`;
			targetEl.className = 'status error';
		}
	}

	// Normal message for the person using the page. type: 'success', 'error' or '' (neutral).
	function status(targetEl, message, type) {
		if (!targetEl) {
			console.error('[TDC] status() called without a target element for message:', message);
			return;
		}
		targetEl.textContent = message;
		targetEl.className = 'status' + (type ? ' ' + type : '');
	}

	// Error from a Supabase call. Database functions already return messages written for people,
	// and unexpected ones already start with "TDC (Error)", so the message is shown as-is.
	function showSupabaseError(area, err, targetEl) {
		console.error(`[${area}]`, err);
		const message = err && err.message ? err.message : 'TDC (Error): unknown problem, see console.';
		status(targetEl, message, 'error');
	}

	// Current session, or null. A failure to check is reported, never hidden.
	async function getSession(area) {
		const { data, error: err } = await supabaseClient.auth.getSession();
		if (err) {
			error(area, 'could not check login status.', err);
			return null;
		}
		return data.session;
	}

	// For pages that need a login: send logged-out visitors to the login page,
	// which brings them back here afterwards.
	async function requireSession(area) {
		const session = await getSession(area);
		if (!session) {
			const back = encodeURIComponent(location.pathname + location.search);
			// The loading screen stays up until the browser has gone (loader.js).
			if (typeof TDCLoader !== 'undefined') TDCLoader.leaving();
			location.replace('/accounts/?next=' + back);
			return null;
		}
		return session;
	}

	// Only allow redirects to pages on this site (stops "?next=https://evil.site" tricks).
	function safeNext(fallback = '/') {
		const next = new URLSearchParams(location.search).get('next');
		if (next && next.startsWith('/') && !next.startsWith('//')) {
			return next;
		}
		return fallback;
	}

	// The logged-in person's player row.
	async function getMyPlayer(area, userId, targetEl) {
		const { data, error: err } = await supabaseClient
			.from('tbl_players')
			.select('id, display_name, first_name, last_name, player_type, avatar_path')
			.eq('user_id', userId)
			.maybeSingle();

		if (err) {
			error(area, 'could not load your player profile.', err, targetEl);
			return null;
		}
		if (!data) {
			error(area, 'no player profile found for this account.', { userId }, targetEl);
			return null;
		}
		return data;
	}

	// Send any notification pushes that are waiting.
	//
	// Notification rows are written inside the database — by the function or
	// trigger that owns the moment — so the page that caused them does not
	// know how many were written or to whom, and cannot compose them. All it
	// can do is say "something happened, go and look". That is this.
	//
	// Cheap to call and safe to call often: it asks for a count first and
	// does nothing at all in the common case, which is that nothing is
	// waiting. Never awaited by anything that matters and never surfaced to
	// the person — a push that does not go out costs the push and nothing
	// else, because the notification is already recorded and will be in
	// their tray. Failures go to the console and no further.
	async function flushPushes() {
		try {
			const { data: waiting, error } = await supabaseClient.rpc('tdc_pushes_waiting');
			if (error || !(waiting > 0)) return;

			// Up to three rounds. One sweep takes a fixed batch, and a round
			// of a tournament can tell sixteen people at once; the cap stops
			// a backlog turning one page load into a long run of requests.
			for (let i = 0; i < 3; i++) {
				const { data, error: sendError } = await supabaseClient.functions.invoke('notify-push');
				if (sendError) { console.error('[Push] could not send notifications.', sendError); return; }
				if (!data || !data.more) return;
			}
		} catch (e) {
			console.error('[Push] could not send notifications.', e);
		}
	}

	// ─── Saving: one queue, nothing turned away ───
	// A click is never refused because an earlier save is still going (UV,
	// 24 Oct). Every save on a page waits its turn in this one queue and runs
	// in the order it was made, never two at once, so two saves cannot race
	// and finish the wrong way round. That race is why pages used to have a
	// "busy" flag that dropped the second click, without saying so.
	let writeTail = Promise.resolve();
	function queued(task) {
		const run = writeTail.then(task);
		writeTail = run.catch(() => {});
		return run;
	}

	// A page's saves. Each goes into the queue; the page is read again once,
	// when the last save of a burst has finished, so quick clicks do not
	// flicker back while the others are still saving (and a ring stays
	// orbiting until then). A failed save does not stop the rest: the errors
	// are kept and shown after that re-read, so it cannot wipe them, and the
	// re-read shows what the database actually holds.
	//
	//   const { write } = TDC.writer({ area, status: el, reload, after });
	//   const ok = await write('Saving', () => supabaseClient.rpc(...), done);
	//     reload  async, read the page again; returns true / false
	//     after   once a burst has saved and been read again (pushes)
	//     done    (data) => the message for success, optional
	//   ok is true when this save worked and the re-read after it did.
	//
	// A big action (generate the fixtures, redraw, save the settings) passes
	// { single: key }: pressing it again while it is still waiting or running
	// joins the first press rather than doing it twice. Nothing is refused;
	// the second press simply is the first. The key says what counts as the
	// same press ('generate', or 'start-' + a fixture's id); true means the
	// action's own words.
	//
	// The dots (scripts/dots.js, 26 Oct): { dots: el } gives this save to the
	// site's one set of dots, which go to el and stay until the burst has
	// saved and been read again, so what they trace is what the database
	// kept. A save that failed is not traced; the page's own message says
	// why, on its status line, which the dots also use for their own
	// failures. follow and leaves go to TDCDots.serve as they are: the
	// element standing for el once the page has been drawn again, and
	// whether the save may take el away. A custom control (tdc-controls.js)
	// gives itself to the dots by asking writeSince() after a change.
	let writes = 0;          // saves asked for on this page, every writer
	let lastWrite = null;    // the latest: { saved, status }
	// Asked by whoever shows the save with the dots (a control, a button):
	// marked claimed, so the writer does not also give it to them.
	function writeSince(n) {
		if (writes <= n) return null;
		lastWrite.claimed = true;
		return lastWrite;
	}

	// ─── Working, shown by the dots (UV, 29 Oct) ───
	// Never a loading message ("Saving…", "Checking…"): busy(el, work,
	// statusEl) puts the site's dots on el for as long as work (a promise)
	// takes, and returns it. el is what was used: the button pressed, the
	// control changed, the section loading. A failure still goes on
	// statusEl, as the dots' own failures do.
	// Where the dots sit while a folding group loads (UV, 29 Oct): in its
	// heading, at the right, in the site's green, not round the whole group.
	// A small invisible spot (.group-dots, dots.css), made once per heading.
	function groupDots(summary) {
		if (!summary) return null;
		let spot = summary.querySelector(':scope > .group-dots');
		if (!spot) {
			spot = document.createElement('span');
			spot.className = 'group-dots';
			spot.setAttribute('aria-hidden', 'true');
			summary.append(spot);
		}
		return spot;
	}

	function busy(el, work, statusEl) {
		const p = Promise.resolve(work);
		if (el && el.isConnected && typeof TDCDots !== 'undefined') {
			TDCDots.serve(el, p, { status: statusEl || undefined, leaves: true });
		}
		return p;
	}

	function writer({ area, status: statusEl, reload, after }) {
		let pending = 0;
		let errors = [];
		let message = '';
		let batch = null;
		const singles = new Map();   // what -> the press already in hand

		async function finish(b) {
			let ok = true;
			try { ok = reload ? (await reload()) !== false : true; }
			catch (err) { ok = false; error(area, 'could not read the page again after saving.', err, statusEl); }
			if (errors.length) {
				showSupabaseError(area, errors[errors.length - 1], statusEl);
				if (errors.length > 1 && statusEl) {
					statusEl.textContent = `${errors.length} changes were not saved. The last: ` + statusEl.textContent;
				}
			} else if (ok) {
				status(statusEl, message, message ? 'success' : '');
			}
			errors = [];
			message = '';
			if (after) after();
			b.resolve(ok);
		}

		function write(what, fn, done, opts) {
			if (opts && opts.single) {
				const key = opts.single === true ? what : opts.single;
				if (singles.has(key)) return singles.get(key);
				const first = write(what, fn, done, Object.assign({}, opts, { single: null }));
				singles.set(key, first);
				first.finally(() => singles.delete(key));
				return first;
			}
			if (!batch) {
				let resolve;
				batch = { promise: new Promise((r) => { resolve = r; }), resolve: (v) => resolve(v) };
			}
			const b = batch;
			pending++;
			let failed = false;
			queued(async () => {
				// No "Saving…" line (UV, 29 Oct: never a loading message): the
				// dots on what was used show it (below, and tdc-controls.js).
				let res;
				try { res = (await fn()) || {}; } catch (err) { res = { error: err }; }
				if (res.error) { failed = true; errors.push(res.error); }
				else if (done) message = done(res.data) || '';
			}).finally(() => {
				pending--;
				if (pending) return;
				batch = null;
				queued(() => finish(b));
			});
			const result = b.promise.then((ok) => ok && !failed);
			// For the dots: rejects when this save, or the re-read after it,
			// did not work. Handled here as well, so nobody waiting is no error.
			const saved = result.then((ok) => { if (!ok) throw new Error(what + ': not saved.'); });
			saved.catch(() => {});
			writes++;
			const mine = lastWrite = { saved, status: statusEl };
			if (opts && opts.dots && typeof TDCDots !== 'undefined') {
				TDCDots.serve(opts.dots, saved, { status: statusEl, follow: opts.follow, leaves: opts.leaves });
			} else {
				// Nobody gave this save to the dots by the time the page's
				// handler is done (a control or a button takes it through
				// writeSince): they go to whatever was used, the focused
				// element, so no save goes unseen.
				// After the buttons and controls have had their turn (they ask
				// a tick after the page's handler): an iPhone does not focus
				// a tapped button, so going first could pick an older field.
				const used = document.activeElement;
				setTimeout(() => {
					if (mine.claimed || typeof TDCDots === 'undefined') return;
					const el = used && used !== document.body && used.isConnected ? used : null;
					if (el && !el.closest('[data-dots]')) TDCDots.serve(el, saved, { status: statusEl, leaves: true });
					else if (!el) console.error('[Dots] a save had nothing to show it on:', statusEl);
				}, 30);
			}
			return result;
		}

		return { write, get pending() { return pending; } };
	}

	// ─── A picture for upload ───
	// A profile picture or a league's: the middle square, shrunk to size px,
	// re-encoded as WebP (JPEG where the browser cannot). Re-encoding drops
	// the EXIF block, and with it a phone photo's GPS position. Returns a
	// Blob, or null having said why (a HEIC the browser cannot read is the
	// likely failure). Shared by the profile page and league settings.
	async function preparePicture(file, size, area, statusEl) {
		let bitmap;
		try {
			// from-image so a photo taken sideways is not saved sideways.
			bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		} catch (err) {
			error(area, 'that image could not be read. Try a JPEG or PNG.', err, statusEl);
			return null;
		}

		const side = Math.min(bitmap.width, bitmap.height);
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			error(area, 'this browser would not give us a canvas to resize the picture.', null, statusEl);
			return null;
		}
		ctx.drawImage(bitmap,
			(bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
			0, 0, size, size);
		if (bitmap.close) bitmap.close();

		// toBlob quietly falls back to PNG for a type it does not know, so the
		// type is checked rather than trusted.
		for (const type of ['image/webp', 'image/jpeg']) {
			const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
			if (blob && blob.type === type) return blob;
		}
		error(area, 'the picture could not be prepared for upload.', null, statusEl);
		return null;
	}

	// The address of a picture in a public bucket (player-avatars,
	// league-pictures), or null for none.
	function pictureUrl(bucket, path) {
		if (!path) return null;
		return supabaseClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;
	}

	// What goes inside a team's .team-pic: its own picture (team-pictures,
	// tbl_teams.picture_path; 29 Oct), or the shield it had until it had one.
	// Shared by the season, fixtures and card pages.
	function teamPic(path) {
		const url = pictureUrl('team-pictures', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			return img;
		}
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const shield = document.createElementNS(NS, 'path');
		shield.setAttribute('d', 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z');
		shield.setAttribute('fill', 'none');
		shield.setAttribute('stroke', 'currentColor');
		shield.setAttribute('stroke-width', '2');
		shield.setAttribute('stroke-linejoin', 'round');
		svg.append(shield);
		return svg;
	}

	// ─── Text that changed, faded (UV, 29 Oct) ───
	// A page that draws itself again with data it has re-read (a live update,
	// a tab shown again) shows what moved: before drawing it takes
	// liveSnapshot(root), the text of every [data-live] element by its key,
	// and after drawing liveFade(root, snap) fades each one whose text changed
	// out with its old value and in with its new, in --live-fade. For elements
	// holding text alone; the first draw (no snapshot) fades nothing, nor does
	// anything the dots are serving. With reduced motion the new text simply
	// shows.
	function liveSnapshot(root) {
		const snap = new Map();
		if (root) for (const el of root.querySelectorAll('[data-live]')) snap.set(el.dataset.live, el.textContent);
		return snap;
	}
	function liveFade(root, snap) {
		if (!root || !snap || !snap.size) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ms = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--live-fade')) || 0.5) * 1000;
		for (const el of root.querySelectorAll('[data-live]')) {
			const was = snap.get(el.dataset.live);
			const now = el.textContent;
			if (was === undefined || was === now || el.children.length) continue;
			// The dots are showing this one's change already (a tap's save,
			// traced): a fade on top would fight them.
			if (el.closest('[data-dots]')) continue;
			el.textContent = was;
			const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms / 2, easing: 'ease-in' });
			const swap = () => {
				// Drawn again meanwhile: what the page put there stands.
				if (el.textContent !== was) return;
				el.textContent = now;
				el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms / 2, easing: 'ease-out' });
			};
			out.finished.then(swap, swap);
		}
	}

	return { error, status, showSupabaseError, getSession, requireSession, safeNext, getMyPlayer, flushPushes, queued, writer,
		get writes() { return writes; }, writeSince, busy, groupDots, preparePicture, pictureUrl, teamPic, liveSnapshot, liveFade };
})();