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

		const { error: dbError } = await supabaseClient.from('tbl_push_subscriptions').upsert({
			user_id: session.user.id,
			endpoint: subJson.endpoint,
			p256dh: subJson.keys.p256dh,
			auth: subJson.keys.auth
		}, { onConflict: 'endpoint' });

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
		statusEl.textContent = 'TDC (Error): ' + error.message;
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