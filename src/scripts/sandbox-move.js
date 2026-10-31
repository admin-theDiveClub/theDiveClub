// One of the site's waiting moves on the real dots, on repeat
// (/sandbox/animations/move/?m=<move>): the animation picker shows each site
// move in its own card through this page in a frame. The dots wait on the
// ring for a call that never comes back, with the move forced.
// Needs: tdc.js, dots.js.

(() => {
	const AREA = 'Animations';
	// Under setTimeout's limit (about 24.8 days), so the dots never give up.
	const NEVER = 2e9;
	const ring = document.getElementById('move-ring'), status = document.getElementById('move-status');
	const name = new URLSearchParams(location.search).get('m') || '';
	if (!ring || !status) { console.error('[' + AREA + '] the move page is missing its ring.'); return; }
	if (typeof TDCDots === 'undefined') { TDC.error(AREA, 'dots.js is not loaded.', null, status); return; }
	if (!TDCDots.moves.includes(name) && !TDCDots.groups.includes(name)) { TDC.error(AREA, 'there is no move called "' + name + '".', null, status); return; }
	TDCDots.force(name);
	TDCDots.serve(ring, new Promise(() => {}), { line: true, timeout: NEVER, status })
		.catch((err) => TDC.error(AREA, 'the dots could not play ' + name + '.', err, status));
})();
