(async () => {
	const { data: { session } } = await supabaseClient.auth.getSession();
	const notifBtn = document.getElementById('enable-notifications');
	const loginLink = document.getElementById('login-link');
	if (session) {
		if (loginLink) loginLink.style.display = 'none';
	} else {
		if (notifBtn) notifBtn.style.display = 'none';
	}
})();

const VAPID_PUBLIC_KEY = 'BENdnENh5pBAg7H09U_01mIC_PFgg3DxfS3DBsMKz0YZ1-nEhA-xid2FLLPnY7eRbImKWT851SyLwqrmBzDg_OI';

function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - base64String.length % 4) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

document.getElementById('enable-notifications').addEventListener('click', async () => {
	const statusEl = document.getElementById('notif-status');
	statusEl.textContent = 'Working...';
	console.log('[Push] Button clicked, starting subscribe flow.');

	const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
	if (sessionError) {
		console.error('[Push] Error getting session:', sessionError);
		statusEl.textContent = 'TDC (Error): could not check login status.';
		return;
	}
	if (!session) {
		console.warn('[Push] No active session — user is not logged in.');
		statusEl.textContent = 'Please log in first.';
		return;
	}
	console.log('[Push] Logged in as user_id:', session.user.id);

	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		console.error('[Push] Push not supported in this browser/context.');
		statusEl.textContent = 'TDC (Error): push not supported on this browser.';
		return;
	}

	try {
		// The service worker is switched off on localhost, and 'ready' would then wait forever.
		const existing = await navigator.serviceWorker.getRegistration();
		if (!existing) {
			console.error('[Push] No service worker registered (it is switched off on localhost).');
			statusEl.textContent = 'TDC (Error): no service worker. Notifications only work on the live site.';
			return;
		}
		const registration = await navigator.serviceWorker.ready;
		console.log('[Push] Service worker ready:', registration);

		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
		});
		console.log('[Push] Browser subscription created:', subscription);

		const subJson = subscription.toJSON();
		if (!subJson.endpoint || !subJson.keys || !subJson.keys.p256dh || !subJson.keys.auth) {
			console.error('[Push] Subscription object missing expected fields:', subJson);
			statusEl.textContent = 'TDC (Error): incomplete subscription data.';
			return;
		}

		// Through a function, not a direct upsert. A push endpoint belongs to the
		// browser, so the same phone signed into a different account produces a
		// row that already belongs to somebody else — and an upsert on endpoint
		// is refused by the access rules in exactly that case.
		const { error: dbError } = await supabaseClient.rpc('tdc_save_push_subscription', {
			p_endpoint: subJson.endpoint,
			p_p256dh: subJson.keys.p256dh,
			p_auth: subJson.keys.auth
		});

		if (dbError) {
			console.error('[Push] Error saving subscription to Supabase:', dbError);
			statusEl.textContent = 'TDC (Error): ' + dbError.message;
			return;
		}

		console.log('[Push] Subscription saved successfully.');
		statusEl.textContent = 'Notifications enabled!';
	} catch (err) {
		console.error('[Push] Unexpected error in subscribe flow:', err);
		statusEl.textContent = 'TDC (Error): ' + err.message;
	}
});

async function sendNotification(title, body, icon) {
	const statusEl = document.getElementById('notif-status');
	statusEl.textContent = 'Sending...';
	console.log('[Push] Sending notification:', { title, body, icon });

	const { data, error } = await supabaseClient.functions.invoke('send-test-notification', {
		body: { title, body, icon },
	});

	if (error) {
		console.error('[Push] Error invoking send-test-notification:', error);
		// For error replies, the function's own message (e.g. "TDC (No subscriptions found)") is in the response body.
		let message = 'TDC (Error): ' + error.message;
		try {
			if (error.context && typeof error.context.json === 'function') {
				const details = await error.context.json();
				if (details && details.error) message = details.error;
			}
		} catch (readErr) {
			console.error('[Push] Could not read the error details:', readErr);
		}
		statusEl.textContent = message;
		return;
	}

	console.log('[Push] send-test-notification response:', data);

	if (data.error) {
		statusEl.textContent = data.error;
		return;
	}

	const sentCount = data.results.filter(r => r.status === 'sent').length;
	const failedCount = data.results.filter(r => r.status === 'failed').length;
	statusEl.textContent = `Sent to ${sentCount} device(s)${failedCount ? `, ${failedCount} failed` : ''}.`;
}

document.getElementById('notif-preset-1').addEventListener('click', () => {
	sendNotification('Match Starting', 'Your match on Table 3 starts in 10 minutes.', '/resources/icons/notifications/test.png');
});

// ─── What buzzes your phone ───────────────────────────────────────
//
// Per-category push switches. They govern the push only: the notification is
// recorded either way and waits in the bell menu, which is what makes muting
// a category a reasonable thing to do rather than a way to lose things.
//
// The list is built from whatever tdc_notification_prefs returns rather than
// written out here, so a category added in the database appears on this page
// without a edit. Labels fall back to the key, so a new one is usable before
// anybody writes a nice name for it.

(() => {
	const AREA = 'Notifications';

	const box    = document.getElementById('notif-prefs');
	const status = document.getElementById('notif-prefs-status');
	if (!box || !status) return;   // not this page

	const LABEL = {
		match:      'Matches',
		tournament: 'Tournaments',
		league:     'Leagues',
		admin:      'Account and admin'
	};
	const HINT = {
		match:      'Scorecards, results, and somebody changing a frame on your card.',
		tournament: 'Being entered or confirmed, and when your next match is ready.',
		league:     'League nights and standings.',
		admin:      'Anything about your account itself.'
	};

	let busy = false;

	function row(pref) {
		const field = document.createElement('div');
		field.className = 'field';

		const id = 'notif-pref-' + pref.category;

		const label = document.createElement('label');
		label.setAttribute('for', id);
		label.textContent = LABEL[pref.category] || pref.category;

		const box2 = document.createElement('input');
		box2.type = 'checkbox';
		box2.id = id;
		box2.checked = pref.push_enabled;
		box2.addEventListener('change', () => save(pref.category, box2.checked, box2));

		field.append(label, box2);

		if (HINT[pref.category]) {
			const hint = document.createElement('div');
			hint.className = 'hint';
			hint.textContent = HINT[pref.category];
			field.append(hint);
		}
		return field;
	}

	async function save(category, enabled, control) {
		if (busy) return;
		busy = true;
		TDC.status(status, 'Saving…', '');

		const { error } = await supabaseClient.rpc('tdc_set_notification_pref', {
			p_category: category,
			p_enabled: enabled
		});
		busy = false;

		if (error) {
			// Put the switch back: leaving it where the finger left it says
			// the setting changed when it did not.
			control.checked = !enabled;
			TDC.showSupabaseError(AREA, error, status);
			return;
		}
		TDC.status(status, 'Saved.', 'success');
	}

	(async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;   // the section above already hides itself

		const { data, error } = await supabaseClient.rpc('tdc_notification_prefs');
		if (error) { TDC.showSupabaseError(AREA, error, status); return; }

		box.replaceChildren(...(data || []).map(row));
	})();
})();
