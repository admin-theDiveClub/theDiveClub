// The page a league director shares (/leagues/join/?s=<league season id>).
//
// One read, tdc_league_join_info, which answers for any signed-in player
// whether or not the season is listed — an unlisted league is simply one you
// have to be given the link to, exactly like a tournament poster.
//
// One write, tdc_league_show_interest. What it does depends on how the
// director set the season up: on "interested" it puts the player on the list
// for the director to confirm, and on "self_confirm" they are in straight
// away. The function decides and says which, so this page never has to.
//
// Needs: tdc.js.

(() => {
	const AREA = 'Join a league';

	const el = (id) => document.getElementById(id);
	const els = {
		name: el('l-name'), meta: el('l-meta'),
		whereLine: el('where-line'), whereDetail: el('where-detail'),
		interestBtn: el('interest-btn'), seasonLink: el('season-link'),
		status: el('page-status')
	};

	const missing = Object.entries(els).filter(([, v]) => !v).map(([k]) => k);
	if (missing.length) {
		TDC.error(AREA, 'the join page is missing expected elements: ' + missing.join(', '));
		return;
	}

	const seasonId = new URLSearchParams(location.search).get('s');
	let info = null;

	function day(s) {
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		if (isNaN(d)) { TDC.error(AREA, 'unreadable date: ' + s); return ''; }
		return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
	}

	async function load() {
		const { data, error } = await supabaseClient.rpc('tdc_league_join_info', {
			p_league_season_id: seasonId
		});
		if (error) { TDC.showSupabaseError(AREA, error, els.status); return false; }

		info = (data || [])[0];
		if (!info) {
			TDC.error(AREA, 'no league with that link. Check it with whoever sent it.', { seasonId }, els.status);
			return false;
		}

		els.name.textContent = info.league_name + ' — ' + info.name;

		const bits = [];
		if (info.starts_on) bits.push('From ' + day(info.starts_on));
		if (info.ends_on) bits.push('to ' + day(info.ends_on));
		if (info.venue_name) bits.push(info.venue_name);
		bits.push(info.players === 1 ? '1 player' : info.players + ' players');
		if (info.teams) bits.push(info.teams === 1 ? '1 team' : info.teams + ' teams');
		els.meta.textContent = bits.join(' · ');

		render();
		return true;
	}

	function render() {
		els.interestBtn.hidden = true;
		els.seasonLink.hidden = true;
		els.seasonLink.href = '/leagues/season/?s=' + encodeURIComponent(seasonId);

		// Where this person already stands comes first: somebody who is in
		// does not want to be asked to join.
		if (info.my_status === 'active') {
			els.whereLine.textContent = 'You are in this league.';
			els.whereDetail.textContent = info.i_confirmed
				? ''
				: 'You still have to confirm that you are playing.';
			els.seasonLink.hidden = false;
			return;
		}
		if (info.my_status === 'interested') {
			els.whereLine.textContent = 'Your name is down.';
			els.whereDetail.textContent = 'Whoever runs the league will confirm it. There is nothing else for you to do.';
			return;
		}
		if (info.my_status === 'suspended') {
			els.whereLine.textContent = 'Your place here has been suspended.';
			els.whereDetail.textContent = 'Speak to whoever runs the league.';
			return;
		}
		if (info.my_status === 'withdrawn') {
			els.whereLine.textContent = 'You withdrew from this league.';
			els.whereDetail.textContent = 'You can put your name down again.';
		} else if (info.my_status === 'inactive') {
			els.whereLine.textContent = 'You are marked inactive in this league.';
			els.whereDetail.textContent = 'Speak to whoever runs it.';
			return;
		} else if (info.entry_mode === 'ld_only') {
			els.whereLine.textContent = 'This league is not taking names.';
			els.whereDetail.textContent = 'Whoever runs it adds the players themselves.';
			return;
		} else {
			els.whereLine.textContent = 'Fancy a game?';
			els.whereDetail.textContent = info.entry_mode === 'self_confirm'
				? 'Put your name down and you are in.'
				: 'Put your name down and whoever runs the league will confirm it.';
		}

		els.interestBtn.hidden = false;
		els.interestBtn.textContent = info.my_status === 'withdrawn'
			? 'Put my name down again'
			: 'Put my name down';
	}

	// Queued, never refused (TDC.writer); a second press joins the first.
	const joinWriter = TDC.writer({
		area: AREA, status: els.status,
		reload: async () => { await load(); return true; },
		after: () => TDC.flushPushes()
	});
	els.interestBtn.addEventListener('click', () => {
		joinWriter.write('Putting your name down', () => supabaseClient.rpc('tdc_league_show_interest', {
			p_league_season_id: seasonId
		}), (data) => data === 'active' ? 'You are in.' : 'Your name is down.', { single: true });
	});

	(async () => {
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		if (!seasonId) {
			TDC.error(AREA, 'no league in the address. Check the link you were sent.', null, els.status);
			return;
		}
		await load();
	})();
})();
