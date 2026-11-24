TDCLoader.hold((async () => {
	const { data: { session } } = await supabaseClient.auth.getSession();
	const notifBtn = document.getElementById('enable-notifications');
	const loginLink = document.getElementById('login-link');
	if (session) {
		if (loginLink) loginLink.style.display = 'none';
	} else {
		if (notifBtn) notifBtn.style.display = 'none';
	}
})(), 'Notifications');

// The dots show it's working, on the button pressed (UV, 29 Oct: never a
// loading message).
//
// On an iPhone in a browser (13 Nov) the phone will not send a website
// notifications at all, only the installed app, so the button leads to the
// install steps instead of failing.
if (typeof TDCDevice !== 'undefined' && TDCDevice.os === 'ios' && !TDCDevice.installed) {
	const btn = document.getElementById('enable-notifications');
	const hint = document.getElementById('notif-hint');
	const test = document.getElementById('notif-preset-1');
	btn.textContent = 'Get the app first';
	if (hint) hint.textContent = 'On an iPhone, notifications only come to the app. Put it on your home screen, open it from there, and turn them on here.';
	if (test) test.hidden = true;
	btn.addEventListener('click', () => { location.href = '/install/'; });
} else {
	document.getElementById('enable-notifications').addEventListener('click', (e) => {
		TDC.busy(e.currentTarget, enableNotifications(), document.getElementById('notif-status'));
	});
}

// The subscribe flow itself is TDCPush.subscribe (push-core.js, 16 Nov), shared with the
// installed app's welcome strip; the messages are the ones this page always showed.
async function enableNotifications() {
	const statusEl = document.getElementById('notif-status');
	statusEl.textContent = '';
	const result = await TDCPush.subscribe();
	statusEl.textContent = result.message;
}

async function sendNotification(title, body, icon) {
	const statusEl = document.getElementById('notif-status');
	statusEl.textContent = '';
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

document.getElementById('notif-preset-1').addEventListener('click', (e) => {
	TDC.busy(e.currentTarget, sendNotification('Match Starting', 'Your match on Table 3 starts in 10 minutes.', '/resources/icons/notifications/test.png'), document.getElementById('notif-status'));
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
		admin:      'Account and admin',
		shop:       'Shop'
	};
	const HINT = {
		match:      'Scorecards, results, and somebody changing a frame on your card.',
		tournament: 'Being entered or confirmed, and when your next match is ready.',
		league:     'League nights and standings.',
		admin:      'Anything about your account itself.',
		shop:       'Your order is ready to collect, or it was cancelled.'
	};

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

	// Queued, never refused (TDC.writer): flicking three switches quickly
	// saves all three, in order.
	const prefWriter = TDC.writer({ area: AREA, status });
	function save(category, enabled, control) {
		return prefWriter.write('Saving', async () => {
			const res = await supabaseClient.rpc('tdc_set_notification_pref', {
				p_category: category,
				p_enabled: enabled
			});
			// Put the switch back: leaving it where the finger left it says
			// the setting changed when it did not.
			if (res.error) control.checked = !enabled;
			return res;
		}, () => 'Saved.');
	}

	TDCLoader.hold((async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;   // the section above already hides itself

		const { data, error } = await supabaseClient.rpc('tdc_notification_prefs');
		if (error) { TDC.showSupabaseError(AREA, error, status); return; }

		box.replaceChildren(...(data || []).map(row));
	})(), 'Notifications');
})();

// ─── Which emails you get (shop Stage 5) ──────────────────────────
//
// One switch per receipt email, all on until turned off (no row means on, as the
// notification switches). Built from tdc_email_prefs, which also says where they go.

(() => {
	const AREA = 'Emails';

	const box    = document.getElementById('email-prefs');
	const to     = document.getElementById('email-prefs-to');
	const status = document.getElementById('email-prefs-status');
	if (!box || !to || !status) return;   // not this page

	const LABEL = {
		top_up_paid:     'Credits added',
		order_placed:    'Order placed',
		order_ready:     'Ready to collect',
		order_collected: 'Collected (your receipt)',
		order_cancelled: 'Order cancelled'
	};

	function row(pref) {
		const field = document.createElement('div');
		field.className = 'field';
		const id = 'email-pref-' + pref.kind;
		const label = document.createElement('label');
		label.setAttribute('for', id);
		label.textContent = LABEL[pref.kind] || pref.kind;
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.id = id;
		input.checked = pref.enabled;
		input.addEventListener('change', () => save(pref.kind, input.checked, input));
		field.append(label, input);
		return field;
	}

	const writer = TDC.writer({ area: AREA, status });
	function save(kind, enabled, control) {
		return writer.write('Saving', async () => {
			const res = await supabaseClient.rpc('tdc_set_email_pref', { p_kind: kind, p_enabled: enabled });
			if (res.error) control.checked = !enabled;
			return res;
		}, () => 'Saved.');
	}

	TDCLoader.hold((async () => {
		const session = await TDC.getSession(AREA);
		if (!session) return;

		const { data, error } = await supabaseClient.rpc('tdc_email_prefs');
		if (error) { TDC.showSupabaseError(AREA, error, status); return; }

		to.textContent = data.email ? `From the shop, to ${data.email}.` : '';
		box.replaceChildren(...(data.prefs || []).map(row));
	})(), 'Emails');
})();
