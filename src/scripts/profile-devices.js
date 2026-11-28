// The device manager: "Where you're signed in" in the profile's Account section (UV, 28 Nov;
// docs/systems/foundations.md, "The device manager"; migration 20261128132115).
//
// Every sign-in of the account (tdc_my_sessions): the device, when it signed in and was last
// used, its IP, "This device", and for a TV signed in by QR the phone that allowed it. Sign out
// on each other device (tdc_sign_out_session) and Sign out everywhere else
// (tdc_sign_out_other_sessions). This device is signed out with Log out (profile.js).
// After every sign-out the list is read again from the server.

(function () {
	const AREA = 'Devices';

	// The device's name from its browser's user agent. The same rules as deviceOf in the edge
	// function device-login (supabase/functions/device-login/index.ts), which names the TV on the
	// phone's Allow screen: change both together.
	function deviceOf(ua) {
		ua = ua || '';
		const tv = /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|Android TV|GoogleTV|CrKey|HbbTV|Roku|PlayStation|Xbox/i.test(ua);
		const os = /iPhone/.test(ua) ? 'iPhone'
			: /iPad/.test(ua) ? 'iPad'
			: /Tizen/.test(ua) ? 'Samsung TV'
			: /Web0S|webOS|NetCast/.test(ua) ? 'LG TV'
			: /AFT[A-Z]/.test(ua) ? 'Fire TV'
			: /CrKey|GoogleTV/.test(ua) ? 'Google TV'
			: /Android/.test(ua) ? (tv ? 'Android TV' : 'Android')
			: /CrOS/.test(ua) ? 'Chromebook'
			: /Macintosh|Mac OS X/.test(ua) ? 'Mac'
			: /Windows/.test(ua) ? 'Windows'
			: /Linux/.test(ua) ? (tv ? 'a TV' : 'Linux')
			: tv ? 'a TV' : 'a device';
		const browser = /SamsungBrowser/.test(ua) ? 'Samsung Internet'
			: /EdgA|EdgiOS|Edg\//.test(ua) ? 'Edge'
			: /OPR\/|Opera/.test(ua) ? 'Opera'
			: /Firefox|FxiOS/.test(ua) ? 'Firefox'
			: /CriOS|Chrome\//.test(ua) ? 'Chrome'
			: /Safari\//.test(ua) ? 'Safari'
			: '';
		return browser ? browser + ' on ' + os : (os === 'a device' ? 'A browser' : os);
	}

	function day(iso) {
		return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Supabase stamps a session about once an hour while it is in use, so nothing finer than that.
	function ago(iso) {
		const mins = (Date.now() - new Date(iso).getTime()) / 60000;
		if (mins < 60) return 'in the last hour';
		const hours = Math.floor(mins / 60);
		if (hours < 24) return hours === 1 ? 'an hour ago' : hours + ' hours ago';
		const days = Math.floor(hours / 24);
		if (days < 7) return days === 1 ? 'yesterday' : days + ' days ago';
		return day(iso);
	}

	document.addEventListener('DOMContentLoaded', async () => {
		const els = {
			list:   document.getElementById('devices-list'),
			others: document.getElementById('devices-others'),
			status: document.getElementById('devices-status'),
		};
		if (!els.list || !els.others || !els.status) {
			TDC.error(AREA, 'profile page is missing the device list\'s elements.');
			return;
		}

		const session = await TDC.getSession(AREA);
		if (!session) return;   // profile.js opens the sign-in card

		function row(s) {
			const r = document.createElement('div');
			r.className = 'id-row device-row';

			const head = document.createElement('div');
			head.className = 'device-head';
			const name = document.createElement('div');
			name.className = 'device-name';
			name.textContent = s.qr && s.qr.device ? s.qr.device : deviceOf(s.user_agent);
			head.appendChild(name);

			if (s.current) {
				const badge = document.createElement('span');
				badge.className = 'badge verified';
				badge.textContent = 'This device';
				head.appendChild(badge);
			} else {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'btn btn-secondary btn-sm';
				btn.textContent = 'Sign out';
				btn.addEventListener('click', async () => {
					btn.disabled = els.others.disabled = true;
					TDC.status(els.status, '', '');
					const { error } = await TDC.busy(btn, supabaseClient.rpc('tdc_sign_out_session', { p_session_id: s.id }), els.status);
					if (error) {
						btn.disabled = els.others.disabled = false;
						TDC.showSupabaseError(AREA, error, els.status);
						return;
					}
					await load();
					TDC.status(els.status, name.textContent + ' is signed out. It may keep working until it next loads a page, and within the hour at most.', 'success');
				});
				head.appendChild(btn);
			}
			r.appendChild(head);

			if (s.qr) {
				const qr = document.createElement('div');
				qr.className = 'muted';
				qr.textContent = 'Signed in by QR' + (s.qr.allowed_by_user_agent ? ' from ' + deviceOf(s.qr.allowed_by_user_agent) : '');
				r.appendChild(qr);
			}

			const when = document.createElement('div');
			when.className = 'muted';
			when.textContent = ['Signed in ' + day(s.created_at), s.current ? 'in use now' : 'last used ' + ago(s.last_used_at), s.ip]
				.filter(Boolean).join(' · ');
			r.appendChild(when);
			return r;
		}

		async function load() {
			const { data, error } = await supabaseClient.rpc('tdc_my_sessions');
			if (error) {
				TDC.showSupabaseError(AREA, error, els.status);
				return;
			}
			const list = data || [];
			els.list.replaceChildren(...list.map((s) => row(s)));
			els.others.hidden = list.filter((s) => !s.current).length === 0;
			els.others.disabled = false;
		}

		els.others.addEventListener('click', async () => {
			els.others.disabled = true;
			els.list.querySelectorAll('button').forEach((b) => { b.disabled = true; });
			TDC.status(els.status, '', '');
			const { data, error } = await TDC.busy(els.others, supabaseClient.rpc('tdc_sign_out_other_sessions'), els.status);
			if (error) {
				els.others.disabled = false;
				els.list.querySelectorAll('button').forEach((b) => { b.disabled = false; });
				TDC.showSupabaseError(AREA, error, els.status);
				return;
			}
			await load();
			TDC.status(els.status, (data === 1 ? '1 other device is' : data + ' other devices are')
				+ ' signed out. They may keep working until they next load a page, and within the hour at most.', 'success');
		});

		const first = load();
		if (typeof TDCDots !== 'undefined') TDCDots.track(els.list, first, { status: els.status });
		await first;
	});
})();
