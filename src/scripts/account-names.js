// A first name and surname after signing in (/accounts/names/, UV 10 Nov).
//
// auth.js sends people here while either name is missing. It can be skipped, and
// asks again at the next sign-in. Google sends one full name, which cannot be
// split safely, so it only starts the boxes off: nothing is saved until Save.
//
// Needs: supabaseClient.js, tdc.js (loaded by layout.html).

(() => {
	const AREA = 'Names';

	const els = {
		body: document.getElementById('names-body'),
		form: document.getElementById('names-form'),
		first: document.getElementById('names-first'),
		last: document.getElementById('names-last'),
		save: document.getElementById('names-save'),
		skip: document.getElementById('names-skip'),
		status: document.getElementById('names-status')
	};

	const next = TDC.safeNext('/');
	let player = null;

	function goOn() {
		TDCLoader.leaving();
		location.replace(next);
	}

	els.skip.addEventListener('click', goOn);

	els.form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const first = els.first.value.trim();
		const last = els.last.value.trim();
		if (!first || !last) {
			TDC.status(els.status, 'Enter both names, or skip for now.', 'error');
			return;
		}

		els.save.disabled = true;
		TDC.status(els.status, '', '');
		try {
			const { data, error } = await TDC.busy(els.save, supabaseClient
				.from('tbl_players')
				.update({ first_name: first, last_name: last })
				.eq('id', player.id)
				.select('id'), els.status);

			if (error) {
				TDC.showSupabaseError(AREA, error, els.status);
				return;
			}
			if (!data || data.length !== 1) {
				TDC.error(AREA, 'your names were not saved (no row updated).', { data }, els.status);
				return;
			}
			goOn();
		} catch (err) {
			TDC.error(AREA, 'unexpected problem saving your names.', err, els.status);
		} finally {
			els.save.disabled = false;
		}
	});

	TDCLoader.hold((async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;
		player = await TDC.getMyPlayer(AREA, session.user.id, els.status);
		if (!player) return;

		if (player.first_name && player.last_name) {
			goOn();
			return;
		}

		const words = ((session.user.user_metadata || {}).full_name || '').trim().split(/\s+/);
		els.first.value = player.first_name || words[0] || '';
		els.last.value = player.last_name || words.slice(1).join(' ');
		els.body.hidden = false;
	})(), 'Your name');
})();
