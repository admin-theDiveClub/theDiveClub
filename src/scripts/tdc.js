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
			.select('id, display_name, first_name, last_name, player_type')
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

	return { error, status, showSupabaseError, getSession, requireSession, safeNext, getMyPlayer };
})();