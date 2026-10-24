// The league pages' own navigation (UV, 24 Oct): every page of a league
// season in one horizontal pill at the top of the page, the current one in
// the green pill, as a select pill shows its choice. It replaced the links
// each page carried at its foot, some of them shown only now and then. All
// leagues is not in it: the site's own menu has that (UV, 24 Oct).
//
// A page puts <nav class="league-nav" id="league-nav" data-page="<key>">
// where it wants it. With ?s=<league season id> in the address the bar
// draws itself; a page that learns its season later (the card, opened by
// match) calls TDCLeagueNav.show(seasonId) and puts data-auto="no" on it.
//
// The pages only the people running the league can use (Run it, Settings,
// New season) are offered to them alone: tdc_league_season_info says who
// they are, and each of those pages refuses anybody else anyway.
//
// Needs: tdc.js, supabaseClient.js.

const TDCLeagueNav = (() => {
	const AREA = 'League pages';

	// [key, label, address, only for the people running it]
	const PAGES = [
		['season', 'Season', (s) => '/leagues/season/?s=' + s, false],
		['fixtures', 'Fixtures', (s) => '/leagues/fixtures/?s=' + s, false],
		['manage', 'Run it', (s) => '/leagues/manage/?s=' + s, true],
		['settings', 'Settings', (s) => '/leagues/settings/?s=' + s, true],
		['new', 'New season', (s, info) => '/leagues/new/?l=' + encodeURIComponent(info.league_id), true]
	];

	async function show(seasonId) {
		const nav = document.getElementById('league-nav');
		if (!nav) return;
		if (!seasonId) { nav.hidden = true; return; }

		const { data, error } = await supabaseClient.rpc('tdc_league_season_info', { p_league_season_id: seasonId });
		if (error) { TDC.showSupabaseError(AREA, error, document.getElementById('page-status')); return; }
		const info = (data || [])[0];
		if (!info) { nav.hidden = true; return; }   // the page itself says the season is not there

		const current = nav.dataset.page;
		const s = encodeURIComponent(seasonId);
		const track = document.createElement('div');
		track.className = 'league-nav-track scroll-x';
		for (const [key, label, href, runners] of PAGES) {
			if (runners && !info.i_run_it) continue;
			let item;
			if (key === current) {
				item = document.createElement('span');
				item.setAttribute('aria-current', 'page');
			} else {
				item = document.createElement('a');
				item.href = href(s, info);
			}
			item.className = 'league-nav-item';
			item.textContent = label;
			track.append(item);
		}
		nav.replaceChildren(track);
		nav.setAttribute('aria-label', 'This league’s pages');
		nav.hidden = false;

		// The current page in view when the bar is wider than the screen.
		const here = track.querySelector('[aria-current]');
		if (here) track.scrollLeft = here.offsetLeft - (track.clientWidth - here.offsetWidth) / 2;
	}

	document.addEventListener('DOMContentLoaded', () => {
		const nav = document.getElementById('league-nav');
		if (!nav || nav.dataset.auto === 'no') return;
		show(new URLSearchParams(location.search).get('s'));
	});

	return { show };
})();
