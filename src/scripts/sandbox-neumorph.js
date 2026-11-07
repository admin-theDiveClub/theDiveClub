// Neumorphism's sandbox (/sandbox/neumorph/): the design's elements on one page, wired to
// nothing (UV, 6 and 7 Nov). They are the real ones now the design is the site's
// (design.css, tdc-controls.js, page-light.js); this is only what the page does itself.

(() => {
	const $ = (id) => document.getElementById(id);
	$('nm-tabs').addEventListener('click', (e) => {
		const tab = e.target.closest('.league-nav-item');
		if (!tab) return;
		$('nm-tabs').querySelectorAll('.league-nav-item').forEach((item) => item.removeAttribute('aria-current'));
		tab.setAttribute('aria-current', 'page');
		tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });   // on a narrow phone they scroll inside the pill
	});

	const scratch = (e) => {
		e.preventDefault();
		TDC.status($('nm-status'), 'A scratch page: nothing happens here.', '');
	};
	$('nm-form').addEventListener('submit', scratch);
	document.querySelectorAll('[data-nm-link]').forEach((a) => a.addEventListener('click', scratch));
})();
