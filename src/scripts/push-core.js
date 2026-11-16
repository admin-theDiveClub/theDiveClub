// Turning notifications on for this device (on every page, before nav.js): the
// subscribe flow the profile page's button has always run (push.js), moved here so
// the installed app's welcome strip can run it too, in the tap itself (UV, 16 Nov:
// after signing in, ask for notifications there rather than waiting for the profile
// page). The steps, checks and messages are the profile page's, unchanged; only how
// the outcome is handed back is new: { ok } or { ok: false, message }, the message
// what the profile page has always shown.
//
//   TDCPush.subscribe()  -> Promise<{ ok: boolean, message: string }>
const TDCPush = (() => {
	const VAPID_PUBLIC_KEY = 'BENdnENh5pBAg7H09U_01mIC_PFgg3DxfS3DBsMKz0YZ1-nEhA-xid2FLLPnY7eRbImKWT851SyLwqrmBzDg_OI';

	function urlBase64ToUint8Array(base64String) {
		const padding = '='.repeat((4 - base64String.length % 4) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
	}

	async function subscribe() {
		console.log('[Push] Button clicked, starting subscribe flow.');

		const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
		if (sessionError) {
			console.error('[Push] Error getting session:', sessionError);
			return { ok: false, message: 'TDC (Error): could not check login status.' };
		}
		if (!session) {
			console.warn('[Push] No active session — user is not logged in.');
			return { ok: false, message: 'Please log in first.' };
		}
		console.log('[Push] Logged in as user_id:', session.user.id);

		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			console.error('[Push] Push not supported in this browser/context.');
			return { ok: false, message: 'TDC (Error): push not supported on this browser.' };
		}

		try {
			// The service worker is switched off on localhost, and 'ready' would then wait forever.
			const existing = await navigator.serviceWorker.getRegistration();
			if (!existing) {
				console.error('[Push] No service worker registered (it is switched off on localhost).');
				return { ok: false, message: 'TDC (Error): no service worker. Notifications only work on the live site.' };
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
				return { ok: false, message: 'TDC (Error): incomplete subscription data.' };
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
				return { ok: false, message: 'TDC (Error): ' + dbError.message };
			}

			console.log('[Push] Subscription saved successfully.');
			return { ok: true, message: 'Notifications enabled!' };
		} catch (err) {
			console.error('[Push] Unexpected error in subscribe flow:', err);
			return { ok: false, message: 'TDC (Error): ' + err.message };
		}
	}

	return { subscribe };
})();
