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

	// For pages (and taps) that need a login: the sign-in card over this page
	// (UV, 28 Nov; sign-in.js), which reloads it once signed in. Until 28 Nov
	// this sent the visitor to /accounts/ and back.
	async function requireSession(area) {
		const session = await getSession(area);
		if (!session) {
			signInHere();
			return null;
		}
		return session;
	}

	// The card, and if it is closed without signing in, one line at the top of
	// the page to open it again. Nothing on the page is hidden: a public league
	// tab asks for a sign-in only on a tap.
	function signInHere() {
		if (typeof TDCSignIn === 'undefined') {
			error('SignIn', 'the sign-in card is missing (sign-in.js); going to the login page.');
			location.replace('/accounts/?next=' + encodeURIComponent(location.pathname + location.search));
			return;
		}
		TDCSignIn.open({
			onClose() {
				if (document.getElementById('tdc-signed-out')) return;
				const host = document.querySelector('main') || document.body;
				const note = document.createElement('div');
				note.id = 'tdc-signed-out';
				note.className = 'tdc-signed-out';
				const text = document.createElement('span');
				text.textContent = "You're not signed in.";
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'btn btn-primary btn-sm';
				btn.textContent = 'Log In';
				btn.addEventListener('click', () => TDCSignIn.open());
				note.append(text, btn);
				host.prepend(note);
			}
		});
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

	// May this person create a tournament or a league? For now only the owner
	// of a venue: the site owner (admin@, The Dive Club's owner) and club
	// owners (UV, 27 Nov). Temporary, and the pages only: tdc_create_tournament
	// and tdc_create_league still allow anyone signed in. A person reads their
	// own tbl_venue_staff rows. Returns true or false; a failure to check is
	// shown and counts as false.
	async function canCreateCompetitions(area, userId, targetEl) {
		const { data, error: err } = await supabaseClient
			.from('tbl_venue_staff')
			.select('venue_id')
			.eq('user_id', userId)
			.eq('role', 'owner')
			.limit(1);
		if (err) {
			error(area, 'could not check whether you may create tournaments and leagues.', err, targetEl);
			return false;
		}
		return !!(data && data.length);
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
		// The shop's receipt emails ride on the same sweep (shop Stage 5): every page that
		// sends pushes sends waiting emails too. Never awaited, as the pushes aren't.
		flushEmails();
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

	// Send any shop receipt emails that are waiting (send-shop-emails; migration
	// shop_receipt_emails). The same shape as the pushes: a count first, nothing in the
	// common case, and the edge function is told nothing. A missed sweep leaves the email
	// waiting for the next one (it is skipped after a day). Console only, never the page.
	async function flushEmails() {
		try {
			const { data: waiting, error } = await supabaseClient.rpc('tdc_shop_emails_waiting');
			if (error || !(waiting > 0)) return;
			for (let i = 0; i < 3; i++) {
				const { data, error: sendError } = await supabaseClient.functions.invoke('send-shop-emails');
				if (sendError) { console.error('[Email] could not send receipt emails.', sendError); return; }
				if (!data || !data.more) return;
			}
		} catch (e) {
			console.error('[Email] could not send receipt emails.', e);
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

	// ─── Reads started early (UV, 16 Nov: every page as fast as it can load) ───
	// A page starts the reads it is going to need all at once, so they travel to
	// the server together instead of one after another (each trip is about a
	// quarter of a second from Johannesburg). Each loader then takes its own with
	// TDC.read when it gets there, in the order it always has, so what is drawn,
	// and when, is unchanged; only the waiting overlaps. A read nobody started,
	// or one started more than EARLY_MS ago, is made there and then, so a stale
	// answer is never used.
	//   TDC.readEarly(key, make)  start make() now (a supabase call)
	//   TDC.read(key, make)       the early one if there is a fresh one, else make()
	const early = new Map();
	const EARLY_MS = 10000;
	function readEarly(key, make) {
		early.set(key, { at: Date.now(), p: Promise.resolve(make()) });
	}
	function read(key, make) {
		const got = early.get(key);
		early.delete(key);
		if (got && Date.now() - got.at < EARLY_MS) return got.p;
		return make();
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
	// whole: keep the whole picture, its longer side shrunk to size, rather
	// than the middle square (a venue's, UV 17 Nov: shown in full).
	// quality: the encoder's, 0.85 unless asked (a wallpaper's, 0.9: shown on a TV).
	async function preparePicture(file, size, area, statusEl, { whole = false, quality = 0.85 } = {}) {
		let bitmap;
		try {
			// from-image so a photo taken sideways is not saved sideways.
			bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		} catch (err) {
			error(area, 'that image could not be read. Try a JPEG or PNG.', err, statusEl);
			return null;
		}

		const side = Math.min(bitmap.width, bitmap.height);
		// Whole: never enlarged, so a small picture is not blurred up to size.
		const scale = whole ? Math.min(1, size / Math.max(bitmap.width, bitmap.height)) : 1;
		const canvas = document.createElement('canvas');
		canvas.width = whole ? Math.max(1, Math.round(bitmap.width * scale)) : size;
		canvas.height = whole ? Math.max(1, Math.round(bitmap.height * scale)) : size;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			error(area, 'this browser would not give us a canvas to resize the picture.', null, statusEl);
			return null;
		}
		if (whole) {
			ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		} else {
			ctx.drawImage(bitmap,
				(bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
				0, 0, size, size);
		}
		if (bitmap.close) bitmap.close();

		// toBlob quietly falls back to PNG for a type it does not know, so the
		// type is checked rather than trusted.
		for (const type of ['image/webp', 'image/jpeg']) {
			const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
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

	// ─── A full name: the surname in a lower weight (UV, 12 Nov) ───
	// Wherever a player's first name and surname are shown, the surname is
	// drawn at 400 (.tdc-surname, global.css) and the first name keeps the
	// weight of whatever holds it. A display name is never split: it is the
	// player's own choice, often a nickname. The surname comes on its own
	// (migration surnames_apart, or the row's last_name), because a first
	// name can have a space in it ("Mary Anne Smith").
	//
	//   TDC.fullName(full, surname)     a DocumentFragment to append
	//   TDC.fullNameOf(first, last)     the same, from the two names
	//
	// Both strings are built from the same row, so the surname always ends
	// the full name; if it ever does not, that is reported and the name is
	// drawn whole.
	function fullName(full, surname) {
		const out = document.createDocumentFragment();
		const text = (full || '').trim();
		const last = (surname || '').trim();
		if (!text) return out;
		if (!last) { out.append(text); return out; }
		if (!text.endsWith(last)) {
			console.error('[Names] the surname does not end the full name, so it is drawn whole.', { full, surname });
			out.append(text);
			return out;
		}
		const first = text.slice(0, text.length - last.length);
		const s = document.createElement('span');
		s.className = 'tdc-surname';
		s.textContent = last;
		if (first) out.append(first);
		out.append(s);
		return out;
	}
	function fullNameOf(first, last) {
		return fullName([first, last].map((x) => (x || '').trim()).filter(Boolean).join(' '), last);
	}

	// ─── A player's picture opens their profile (UV, 5 Nov) ───
	// Wherever a player's picture (or initials) is shown, a tap on it opens
	// /players/?p=<id>. The picture is marked, not wrapped in a link: it often
	// sits inside something tappable already (a draw card opening its match, a
	// match row that is itself a link, a seat that opens a picker), and a link
	// inside a link or a button is not allowed. One listener for the page, on
	// the document's capture phase, takes the tap before anything round the
	// picture hears it. Ctrl, Cmd or the middle button opens a new tab, as a
	// link would. Returns the element.
	function profilePic(el, playerId) {
		if (!el || !playerId) return el;
		el.classList.add('pic-link');
		el.dataset.profile = playerId;
		el.setAttribute('role', 'link');
		el.tabIndex = 0;
		if (!el.title) el.title = 'Open their profile';
		return el;
	}
	const profileHref = (id) => '/players/?p=' + encodeURIComponent(id);
	function openProfile(e) {
		const pic = e.target.closest && e.target.closest('.pic-link[data-profile]');
		if (!pic) return;
		if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
		if (e.type === 'auxclick' && e.button !== 1) return;
		e.preventDefault();
		e.stopPropagation();
		const href = profileHref(pic.dataset.profile);
		if (e.ctrlKey || e.metaKey || e.type === 'auxclick') window.open(href, '_blank', 'noopener');
		else location.href = href;
	}
	document.addEventListener('click', openProfile, true);
	document.addEventListener('auxclick', openProfile, true);
	document.addEventListener('keydown', openProfile, true);

	// The venues a competition or match is played at, as every read gives them:
	// [{ id, name }] in the director's order (migration 20261105203829; UV, 5 Nov:
	// every name, and a name opens the venue's page). On a card that is itself a
	// link only the words can go, since a link cannot hold a link.
	function venueNames(list) {
		return (list || []).map((v) => v.name).join(', ');
	}

	// A venue's picture before its name, wherever a venue is shown (UV, 24 Nov;
	// docs/ui-list.md item 11): a small circle the height of the text, as a
	// player's picture; the map pin when it has none, as the venue card shows.
	// From picture_path in every venue list (migration 20261124190347). A
	// picture that will not load falls back to the pin and says so.
	function venuePin() {
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		svg.style.strokeWidth = 'var(--icon-line)';
		for (const d of ['M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z', 'M12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5z']) {
			const path = document.createElementNS(NS, 'path');
			path.setAttribute('d', d);
			path.setAttribute('vector-effect', 'non-scaling-stroke');
			svg.append(path);
		}
		return svg;
	}
	function venueMark(v) {
		const box = document.createElement('span');
		box.className = 'venue-mark';
		box.setAttribute('aria-hidden', 'true');
		const url = v && v.picture_path ? pictureUrl('venue-pictures', v.picture_path) : null;
		if (!url) { box.classList.add('is-pin'); box.append(venuePin()); return box; }
		const img = document.createElement('img');
		img.alt = '';
		img.loading = 'lazy';
		img.onerror = () => {
			console.error('[Venues] a venue\'s picture could not be loaded, showing the pin.', url);
			box.classList.add('is-pin');
			img.replaceWith(venuePin());
		};
		img.src = url;
		box.append(img);
		return box;
	}

	function venueLink(v) {
		const a = document.createElement('a');
		a.href = '/venues/?v=' + encodeURIComponent(v.id);
		a.className = 'venue-named';
		a.append(venueMark(v), document.createTextNode(v.name));
		return a;
	}

	// The same without the link, for a card that is itself a link (a link cannot
	// hold a link): every venue, picture and name, comma between.
	function venueTags(list) {
		const frag = document.createDocumentFragment();
		(list || []).forEach((v, i) => {
			if (i) frag.append(', ');
			const s = document.createElement('span');
			s.className = 'venue-named';
			s.append(venueMark(v), document.createTextNode(v.name));
			frag.append(s);
		});
		return frag;
	}

	// A heading's line under its title: what it already says, then the venues on
	// a line of their own. With neither, the line is hidden.
	function venueHeading(el, text, list) {
		const venues = list || [];
		el.replaceChildren();
		if (text) el.append(text);
		if (text && venues.length) el.append(document.createElement('br'));
		venues.forEach((v, i) => {
			if (i) el.append(', ');
			el.append(venueLink(v));
		});
		el.hidden = !text && !venues.length;
	}

	// A banner's fact (.jumbo-fact): every venue on a line of its own. With none,
	// null: the row is left out (UV, 5 Nov).
	function venueFact(list) {
		const venues = list || [];
		if (!venues.length) return null;
		const row = document.createElement('div');
		row.className = 'jumbo-fact';
		const dt = document.createElement('dt');
		dt.textContent = venues.length === 1 ? 'Venue' : 'Venues';
		const dd = document.createElement('dd');
		for (const v of venues) {
			const line = venueLink(v);
			line.classList.add('jumbo-venue');
			dd.append(line);
		}
		row.append(dt, dd);
		return row;
	}

	// ─── A league's and a team's picture, in its own shape (UV, 9 Nov) ───
	// A league's is a shield, a team's a hexagon, each set into the page: the
	// shadow is the rest of the page's shape, blurred, lying over the picture
	// and moved by the light (design.css, .tdc-shade). An inset box-shadow
	// could only follow a rounded rectangle. The paths are in a 100 box; the
	// shield fills its box, which is narrower than it is tall (UV, 9 Nov).
	const SHAPES = {
		shield: 'M50 0C61 9 79 14 97 14Q100 14 100 17V50C100 76 76 92 50 100C24 92 0 76 0 50V17Q0 14 3 14C21 14 39 9 50 0Z',
		hexagon: 'M46 4Q50 2 54 4L90 24Q94 26 94 31V69Q94 74 90 76L54 96Q50 98 46 96L10 76Q6 74 6 69V31Q6 26 10 24Z'
	};
	function shapeClip(kind) {
		const id = 'tdc-clip-' + kind;
		if (document.getElementById(id)) return id;
		let defs = document.getElementById('tdc-clips');
		if (!defs) {
			defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			defs.id = 'tdc-clips';
			defs.setAttribute('aria-hidden', 'true');
			defs.setAttribute('width', '0');
			defs.setAttribute('height', '0');
			defs.style.position = 'absolute';
			document.body.append(defs);
		}
		defs.insertAdjacentHTML('beforeend', `<clipPath id="${id}" clipPathUnits="objectBoundingBox"><path transform="scale(0.01)" d="${SHAPES[kind]}"/></clipPath>`);
		return id;
	}
	function shaped(kind, content) {
		const box = document.createElement('span');
		box.className = 'tdc-shaped tdc-shaped-' + kind;
		box.style.clipPath = `url(#${shapeClip(kind)})`;
		box.append(content);
		for (const side of ['dark', 'lit']) {
			box.insertAdjacentHTML('beforeend', `<svg class="tdc-shade tdc-shade-${side}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path fill-rule="evenodd" d="M-60-60H160V160H-60Z${SHAPES[kind]}"/></svg>`);
		}
		return box;
	}

	// What goes inside a league's picture box: its own picture (league-pictures,
	// tbl_leagues.picture_path), or the empty shield with a trophy in it.
	// A tournament's the same (UV, 24 Nov: "same as leagues"), from
	// tournament-pictures (tbl_tournaments.picture_path).
	function leaguePic(path, alt) { return shieldPic('league-pictures', path, alt); }
	function tournamentPic(path, alt) { return shieldPic('tournament-pictures', path, alt); }
	function shieldPic(bucket, path, alt) {
		const url = pictureUrl(bucket, path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = alt || '';
			img.loading = 'lazy';
			return shaped('shield', img);
		}
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const trophy = document.createElementNS(NS, 'path');
		trophy.setAttribute('fill', 'currentColor');
		trophy.setAttribute('d', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z');
		svg.append(trophy);
		return shaped('shield', svg);
	}

	// What goes inside a team's .team-pic: its own picture (team-pictures,
	// tbl_teams.picture_path; 29 Oct), or the shield it had until it had one,
	// in the team's hexagon (UV, 9 Nov).
	// Shared by the season, fixtures and card pages.
	function teamPic(path) {
		const url = pictureUrl('team-pictures', path);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.loading = 'lazy';
			return shaped('hexagon', img);
		}
		const NS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		const shield = document.createElementNS(NS, 'path');
		shield.setAttribute('d', 'M12 3l7 3v5c0 4.5-3 8-7 10c-4-2-7-5.5-7-10V6z');
		shield.setAttribute('fill', 'none');
		shield.setAttribute('stroke', 'currentColor');
		shield.style.strokeWidth = 'var(--icon-line)';   // as a ring's line, at any size (UV, 5 Nov)
		shield.setAttribute('vector-effect', 'non-scaling-stroke');
		shield.setAttribute('stroke-linejoin', 'round');
		svg.append(shield);
		return shaped('hexagon', svg);
	}

	// A singles league's player in a team's place (19 Nov): their own photo,
	// or their initials, in a circle (UV). Goes in the same .team-pic box as
	// teamPic, which is a circle until it holds a shaped picture, so the
	// photo is round by itself. A photo that will not load falls back to the
	// initials and says so in the console.
	function playerTeamPic(path, name) {
		const initials = () => {
			const s = document.createElement('span');
			s.className = 'team-initials';
			s.textContent = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
			return s;
		};
		const url = pictureUrl('player-avatars', path);
		if (!url) return initials();
		const img = document.createElement('img');
		img.alt = '';
		img.loading = 'lazy';
		img.onerror = () => {
			console.error('[Leagues] a player\'s picture could not be loaded, using the initials.', url);
			img.replaceWith(initials());
		};
		img.src = url;
		return img;
	}

	// ─── A banner's picture as tall as the name (UV, 24 Nov; docs/ui-list.md item 10) ───
	// On a tournament's and a league's banner the picture sits only in the name's
	// row, its height the name's (both lines when it wraps), so the lines under
	// the name have the banner's whole width. CSS cannot size a box from a
	// heading beside it, so the name's height is measured whenever it changes and
	// handed to league-join.css as --lj-name-h. The venue's banner is not one.
	if (typeof ResizeObserver !== 'undefined') {
		const nameWatch = new ResizeObserver((entries) => {
			for (const e of entries) {
				const id = e.target.closest('.lj-id');
				const h = Math.round(e.target.getBoundingClientRect().height);
				if (id && h && id.style.getPropertyValue('--lj-name-h') !== h + 'px') id.style.setProperty('--lj-name-h', h + 'px');
			}
		});
		document.querySelectorAll('.lj-hero:not(.venue-hero) .lj-id .lj-names > h1').forEach((h1) => nameWatch.observe(h1));
	}

	// ─── Text that changed, faded (UV, 29 Oct) ───
	// A page that draws itself again with data it has re-read (a live update,
	// a tab shown again) shows what moved: before drawing it takes
	// liveSnapshot(root), the text of every [data-live] element by its key,
	// and after drawing liveFade(root, snap) fades each one whose text changed
	// out with its old value and in with its new, in --live-fade. For elements
	// holding text alone; the first draw (no snapshot) fades nothing, nor does
	// anything the dots are serving. With reduced motion the new text simply
	// shows. Its inline style goes with the text (the match score's centring
	// is set there for its digits), so the old value fades out as it stood.
	function liveSnapshot(root) {
		const snap = new Map();
		if (root) for (const el of root.querySelectorAll('[data-live]')) snap.set(el.dataset.live, { text: el.textContent, style: el.getAttribute('style') });
		return snap;
	}
	function setStyle(el, style) {
		if (style === null) el.removeAttribute('style');
		else el.setAttribute('style', style);
	}
	function liveFade(root, snap) {
		if (!root || !snap || !snap.size) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ms = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--live-fade')) || 0.5) * 1000;
		for (const el of root.querySelectorAll('[data-live]')) {
			const old = snap.get(el.dataset.live);
			const was = old && old.text;
			const now = el.textContent, nowStyle = el.getAttribute('style');
			if (old === undefined || was === now || el.children.length) continue;
			// The dots are showing this one's change already (a tap's save,
			// traced): a fade on top would fight them.
			if (el.closest('[data-dots]')) continue;
			el.textContent = was;
			setStyle(el, old.style);
			const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms / 2, easing: 'ease-in' });
			const swap = () => {
				// Drawn again meanwhile: what the page put there stands.
				if (el.textContent !== was) return;
				el.textContent = now;
				setStyle(el, nowStyle);
				el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms / 2, easing: 'ease-out' });
			};
			out.finished.then(swap, swap);
		}
	}

	// A short link as an address to show (UV, 9 Nov). Read each time, unlike
	// shareButton's: a director can change the code on another tab of the page.
	// A page may start it early with TDC.readEarly(shortKey(kind, id), shortRead(kind, id)).
	const shortKey = (kind, id) => 'short:' + kind + ':' + id;
	const shortRead = (kind, id) => () => supabaseClient.rpc('tdc_short_link', { p_kind: kind, p_id: id });
	async function shortUrl(area, kind, id, statusEl) {
		const { data, error: err } = await read(shortKey(kind, id), shortRead(kind, id));
		if (err) { showSupabaseError(area, err, statusEl); return null; }
		return location.origin + '/' + data.code;
	}

	// ─── A Share button (short links, UV 9 Nov) ───
	// Open to anyone who can see the page. A phone only shares from inside the
	// tap itself, so the link is read first and the button waits for it. Read
	// once per page: a match's ⋯ menu is drawn again each time it opens.
	const shortLinks = new Map();

	// longUrl: what to share when this has no code, as a player with no surname.
	// Resolves to the link read, or nothing if it could not be.
	function shareButton(button, kind, id, { area, status: statusEl, title, longUrl }) {
		button.disabled = true;
		const key = kind + '|' + id;
		if (!shortLinks.has(key)) {
			shortLinks.set(key, Promise.resolve(supabaseClient.rpc('tdc_short_link', { p_kind: kind, p_id: id })));
		}
		return shortLinks.get(key).then(({ data, error: err }) => {
			if (err) {
				shortLinks.delete(key);
				showSupabaseError(area, err, statusEl);
				return null;
			}
			const url = data.code ? location.origin + '/' + data.code : longUrl;
			button.disabled = false;
			button.addEventListener('click', async () => {
				try {
					if (navigator.share) { await navigator.share({ title: title(), url }); return; }
					await navigator.clipboard.writeText(url);
					status(statusEl, 'Link copied: ' + url.replace(/^https?:\/\//, ''), 'success');
				} catch (e) {
					if (e && e.name === 'AbortError') return;   // the share sheet closed
					error(area, 'the link could not be shared or copied.', e, statusEl);
				}
			});
			return data;
		});
	}

	// ─── A team name on one line, running sideways when too long (UV, 16 Nov) ───
	// Never broken inside a word: the name stays on one line, and one too long
	// for its room runs sideways and back, as the Season tab's cards and the
	// players' fixtures do (UV, 10-11 Nov). Puts text into el (or keeps el's
	// own) inside a .lj-run and watches both: the room changes with the screen
	// and the words when the display font arrives. Styles: .tdc-run, design.css.
	const runRoom = typeof ResizeObserver === 'undefined' ? null
		: new ResizeObserver((seen) => seen.forEach((e) => fitRun(e.target.closest('.tdc-run'))));
	function fitRun(el) {
		if (!el || !el.clientWidth || !el.firstChild) return;
		const over = el.firstChild.offsetWidth - el.clientWidth;
		el.classList.toggle('is-long', over > 1);
		el.style.setProperty('--run', -Math.max(over, 0) + 'px');
		el.style.setProperty('--run-time', (3 + Math.max(over, 0) / 25).toFixed(1) + 's');
	}
	function runName(el, text) {
		const words = text === undefined ? el.textContent : (text || '');
		const inner = document.createElement('span');
		inner.className = 'lj-run';
		inner.textContent = words;
		el.classList.add('tdc-run');
		el.title = words;
		el.replaceChildren(inner);
		if (runRoom) { runRoom.observe(el); runRoom.observe(inner); }
		fitRun(el);
		return el;
	}
	// The same, wrapping between words (UV, 16 Nov, the scorecard's banner: "you
	// may still word-wrap but do not break words"). Each word is its own run, so
	// the name takes as many lines as it needs and a word too long for the room
	// alone runs sideways and back. Styles: .tdc-wrap, design.css.
	function runWords(el, text) {
		const words = (text === undefined ? el.textContent : (text || '')).trim().split(/\s+/).filter(Boolean);
		el.classList.remove('tdc-run', 'is-long');
		el.classList.add('tdc-wrap');
		el.title = words.join(' ');
		const parts = [];
		words.forEach((w, i) => {
			if (i) parts.push(' ');
			const word = document.createElement('span');
			word.className = 'tdc-run';
			const inner = document.createElement('span');
			inner.className = 'lj-run';
			inner.textContent = w;
			word.append(inner);
			parts.push(word);
		});
		el.replaceChildren(...parts);
		for (const word of el.children) {
			if (runRoom) { runRoom.observe(word); runRoom.observe(word.firstChild); }
			fitRun(word);
		}
		return el;
	}
	// A league tab's heading line (UV, 17 Nov on Standings; 18 Nov, Fixtures the
	// same): the league · the season · the venue on one line, short separators
	// between them, running sideways and back when too long (runName's run,
	// holding these parts in place of a name). The league in the display face,
	// the season cream, the venue its green link. The league's picture before
	// its name (UV, 18 Nov): its shield, or the empty one (leaguePic). Styles:
	// h1.sd-line, league.css.
	function leagueLine(el, { picture, league, season, venues }) {
		const node = (cls, text) => {
			const s = document.createElement('span');
			s.className = cls;
			if (text !== undefined) s.textContent = text;
			return s;
		};
		const pic = node('sd-l-pic');
		pic.setAttribute('aria-hidden', 'true');
		pic.append(leaguePic(picture));
		const parts = [pic, node('sd-l-league', league)];
		const sep = () => { const s = node('sd-l-sep'); s.setAttribute('aria-hidden', 'true'); return s; };
		if (season) parts.push(sep(), node('sd-l-season', season));
		if ((venues || []).length) {
			const where = node('sd-l-venue');
			venues.forEach((v, i) => { if (i) where.append(', '); where.append(venueLink(v)); });
			parts.push(sep(), where);
		}
		runName(el, '');
		el.firstChild.replaceChildren(...parts);
		el.title = [league, season, ...(venues || []).map((v) => v.name)].filter(Boolean).join(' · ');
		return el;
	}

	if (document.fonts) {
		const refitRuns =() => document.querySelectorAll('.tdc-run').forEach(fitRun);
		document.fonts.ready.then(refitRuns);
		document.fonts.addEventListener('loadingdone', refitRuns);
	}

	// Reload onto the current deploy (17 Nov; moved here from nav.js's Reload
	// button so the pull down at the top, pull-refresh.js, does the same).
	// Asks the service worker to look for a new version first, so a stale
	// install gets the latest files rather than redrawing the old ones. Never
	// allowed to hold the reload up: a slow or missing worker must not leave
	// somebody waiting on a page that never goes.
	async function freshReload() {
		try {
			if ('serviceWorker' in navigator) {
				const reg = await Promise.race([
					navigator.serviceWorker.getRegistration(),
					new Promise((done) => setTimeout(() => done(null), 1500))
				]);
				if (reg) await Promise.race([
					reg.update(),
					new Promise((done) => setTimeout(done, 1500))
				]);
			}
		} catch (err) {
			console.error('[Reload] could not check for a new version before reloading.', err);
		}
		location.reload();
	}

	// ─── A card over the page (.cc, credits-card.css; UV, 25 Nov) ───
	// It rises from the foot as it opens and sinks as it closes (Escape and a phone's back
	// gesture too); between its screens the new one slides across, in from the right going on
	// and from the left going back, while the card grows or shrinks to it; and when what is on
	// it changes in place (a line taken out of the cart), it grows or shrinks to that.
	// The product sheet, the cart and the Add credits card use these:
	//   cardOpen(dlg)                    shows it, rising (or rising again if it was sinking)
	//   cardClose(dlg)                   sinks and closes it; answers once closed
	//   const turn = cardTurn(dlg, old)  before changing screens: where the card and the old
	//   turn(now, dir, gone)             screen stand; after: slide old out and now in, dir 1
	//                                    going on, -1 back, 0 not at all; gone(old) once old
	//                                    has left (remove it), never if old is now
	//   cardResize(dlg, change)          change() redraws the card; its height follows
	// Times --cc-rise and --cc-turn (variables.css). With less motion, all of it simply happens.
	const CARD_EASE = 'cubic-bezier(0.2, 0.7, 0.3, 1)';
	function cardMs(dlg, token) {
		const less = typeof TDCPrefs !== 'undefined' ? TDCPrefs.lessMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (less) return 0;
		const v = getComputedStyle(dlg).getPropertyValue(token).trim();
		const n = parseFloat(v);
		return isNaN(n) ? 0 : v.endsWith('ms') ? n : n * 1000;
	}
	// The dim round the card fades with it, where the browser can animate it.
	function cardDim(dlg, from, to, opts) {
		try { return dlg.animate([{ opacity: from }, { opacity: to }], Object.assign({ pseudoElement: '::backdrop' }, opts)); }
		catch (err) { return null; }
	}
	// How far down it starts and ends: just under the bottom of the screen.
	const cardBelow = (dlg) => Math.max(0, window.innerHeight - dlg.getBoundingClientRect().top);

	function cardOpen(dlg) {
		if (!dlg.tdcCard) {
			dlg.tdcCard = true;
			dlg.addEventListener('cancel', (e) => { e.preventDefault(); cardClose(dlg); });
		}
		const sinking = dlg.tdcSink;
		if (sinking) {
			// Opened again while it sinks: it rises again.
			dlg.tdcSink = null;
			for (const a of sinking) if (a) a.cancel();
		} else if (dlg.open) {
			return;
		} else {
			dlg.showModal();
		}
		const ms = cardMs(dlg, '--cc-rise');
		if (!ms) return;
		dlg.animate([{ transform: `translateY(${cardBelow(dlg)}px)` }, { transform: 'none' }], { duration: ms, easing: CARD_EASE });
		cardDim(dlg, 0, 1, { duration: ms, easing: 'ease-out' });
	}

	function cardClose(dlg) {
		if (!dlg.open) return Promise.resolve();
		if (dlg.tdcSink) return dlg.tdcSinkDone;
		if (dlg.tdcTurn) dlg.tdcTurn();
		const ms = cardMs(dlg, '--cc-rise');
		if (!ms) { dlg.close(); return Promise.resolve(); }
		const opts = { duration: ms, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' };
		const sink = dlg.animate([{ transform: 'none' }, { transform: `translateY(${cardBelow(dlg)}px)` }], opts);
		const anims = dlg.tdcSink = [sink, cardDim(dlg, 1, 0, opts)];
		return dlg.tdcSinkDone = sink.finished.then(() => {
			if (dlg.tdcSink !== anims) return;   // opened again meanwhile
			dlg.tdcSink = null;
			dlg.close();
			for (const a of anims) if (a) a.cancel();
		}, () => {});
	}

	function cardTurn(dlg, old) {
		if (dlg.tdcTurn) dlg.tdcTurn();   // a turn still under way ends where it was going
		const ms = cardMs(dlg, '--cc-turn');
		const from = dlg.offsetHeight;
		const dr = dlg.getBoundingClientRect();
		const r = old ? old.getBoundingClientRect() : null;
		return (now, dir, gone) => {
			if (!old || old === now) return;
			if (!ms || !dir || !dlg.open || dlg.tdcSink) { if (gone) gone(old); return; }
			// The old screen stays where it stood, out of the flow, while it slides away.
			const was = { hidden: old.hidden, style: old.getAttribute('style') };
			old.hidden = false;
			old.inert = true;
			Object.assign(old.style, {
				position: 'absolute', top: (r.top - dr.top) + 'px', left: (r.left - dr.left) + 'px',
				width: r.width + 'px', margin: '0', pointerEvents: 'none'
			});
			dlg.scrollTop = 0;
			dlg.style.boxSizing = 'border-box';
			const to = dlg.offsetHeight;
			const across = dlg.clientWidth;
			dlg.style.overflow = 'hidden';   // both screens are cut off at the card's edge
			const ease = { duration: ms, easing: CARD_EASE };
			const anims = [
				old.animate([{ transform: 'none' }, { transform: `translateX(${-dir * across}px)` }], ease),
				now.animate([{ transform: `translateX(${dir * across}px)` }, { transform: 'none' }], ease)
			];
			if (to !== from) anims.push(dlg.animate([{ height: from + 'px' }, { height: to + 'px' }], ease));
			let over = false;
			const end = () => {
				if (over) return;
				over = true;
				if (dlg.tdcTurn === end) dlg.tdcTurn = null;
				for (const a of anims) a.cancel();
				old.hidden = was.hidden;
				old.inert = false;
				if (was.style === null) old.removeAttribute('style');
				else old.setAttribute('style', was.style);
				dlg.style.overflow = '';
				dlg.style.boxSizing = '';
				if (gone) gone(old);
			};
			dlg.tdcTurn = end;
			anims[0].finished.then(end, () => {});
		};
	}

	function cardResize(dlg, change) {
		if (!dlg || !dlg.open || dlg.tdcTurn || dlg.tdcSink) { change(); return; }
		const ms = cardMs(dlg, '--cc-turn');
		const from = dlg.offsetHeight;   // mid-way, if it was already growing
		if (dlg.tdcResize) { dlg.tdcResize.cancel(); dlg.tdcResize = null; }
		change();
		if (!ms) return;
		dlg.style.boxSizing = 'border-box';
		const to = dlg.offsetHeight;
		if (to === from) { dlg.style.boxSizing = ''; dlg.style.overflow = ''; return; }
		dlg.style.overflow = 'hidden';
		const a = dlg.tdcResize = dlg.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: ms, easing: CARD_EASE });
		const end = () => {
			if (dlg.tdcResize !== a) return;
			dlg.tdcResize = null;
			dlg.style.overflow = '';
			dlg.style.boxSizing = '';
		};
		a.finished.then(end, end);
	}

	return { shortUrl, shareButton, error, status, freshReload, showSupabaseError, getSession, requireSession, safeNext, getMyPlayer, canCreateCompetitions, flushPushes, flushEmails, queued, writer, readEarly, read, shortKey, shortRead,
		get writes() { return writes; }, writeSince, busy, groupDots, preparePicture, pictureUrl, profilePic, fullName, fullNameOf, leaguePic, tournamentPic, teamPic, playerTeamPic, SHAPES, venueNames, venueLink, venueTags, venueMark, venueHeading, venueFact, liveSnapshot, liveFade, runName, runWords, leagueLine,
		cardOpen, cardClose, cardTurn, cardResize };
})();