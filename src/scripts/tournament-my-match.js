// Your match in a tournament (/tournaments/my-match/?t=<id>), where the follow
// page's QR sends players once play has started (UV, 28 Nov; "their current
// match on this draw; otherwise the draw").
//
// Reads the draw (tdc_tournament_draw, any signed-in player) and the signed-in
// person's player row, then leaves at once: to the match being played or
// waiting for them, the latest round first, or to the draw.
//
// Needs: tdc.js.

(() => {
	const AREA = 'My match';
	const status = document.getElementById('page-status');
	const tournamentId = new URLSearchParams(location.search).get('t');
	const drawUrl = '/tournaments/bracket/?t=' + encodeURIComponent(tournamentId || '');

	TDCLoader.hold((async () => {
		if (!tournamentId) {
			TDC.error(AREA, 'no tournament in the address. Scan the code on the screen again.', null, status);
			return;
		}
		const session = await TDC.requireSession(AREA);
		if (!session) return;

		const me = await TDC.getMyPlayer(AREA, session.user.id, status);
		if (!me) return;

		const { data, error } = await supabaseClient.rpc('tdc_tournament_draw', { p_tournament_id: tournamentId });
		if (error) { TDC.showSupabaseError(AREA, error, status); return; }

		// A match that exists and is not over, with this player in it.
		const open = (data || []).filter((f) => f.match_id
			&& f.match_status !== 'complete' && f.match_status !== 'abandoned'
			&& (f.home_player_id === me.id || f.away_player_id === me.id))
			.sort((a, b) => b.round - a.round);

		if (typeof TDCLoader !== 'undefined') TDCLoader.leaving();
		location.replace(open.length ? '/match/?id=' + encodeURIComponent(open[0].match_id) : drawUrl);
	})(), 'Your match');
})();
