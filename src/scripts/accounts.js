// The login page (/accounts/): opens the sign-in card (sign-in.js) at once. Signed in already
// (coming back from the sign-up email or Google), on to ?next=. Behaviour that lived here until
// 28 Nov (auth.js) is the card's now.
// Needs: supabaseClient.js, tdc.js, sign-in.js (loaded by layout.html).

(async () => {
	const AREA = 'Accounts';
	const btn = document.getElementById('accounts-open');
	const statusEl = document.getElementById('accounts-status');
	if (!btn || !statusEl) {
		TDC.error(AREA, 'the login page is missing expected elements.');
		return;
	}

	// Where to go after logging in (only pages on this site).
	const next = TDC.safeNext('/');

	const session = await TDC.getSession(AREA);
	if (session) {
		if (typeof TDCLoader !== 'undefined') TDCLoader.leaving();
		location.replace(next);
		return;
	}

	const open = () => TDCSignIn.open({ next });
	btn.hidden = false;
	btn.addEventListener('click', open);
	open();
})();
