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

	return { error, status, showSupabaseError, getSession, requireSession, safeNext, getMyPlayer, flushPushes };
})();