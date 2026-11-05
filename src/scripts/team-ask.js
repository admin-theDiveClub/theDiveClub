// The ring with which a league player on no team asks to join a team (UV,
// 5 Nov; 20261105153021). Shared by the join page's team cards and the
// season page's Teams tab, so it is drawn one way: a person with a plus to
// ask, a tick in a green ring once asked, greyed when the team is full and
// not asked. Each page sends the request through its own writer
// (tdc_request_team, tdc_cancel_team_request) and finds the ring again after
// its re-read by button[data-ask="<team id>"].
//
//   TDCTeamAsk.ring(team, asked, area, statusEl)
//     team     a row of tdc_league_season_teams (team_id, name, active_players, team_limit)
//     asked    whether this player has asked this team
//   Returns the button. Its icon draws itself in the first time a team's
//   ring shows that icon on this page, and is simply shown on every redraw
//   after (a re-read must not replay every icon).
//
// Needs: tdc.js, ring-status.js.

const TDCTeamAsk = (() => {
	const drawn = new Set();

	function ring(t, asked, area, statusEl) {
		const id = t.team_id;
		const full = (t.active_players || 0) >= (t.team_limit || 0);
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'team-ask' + (asked ? ' is-asked' : '');
		b.dataset.ask = id;
		b.dataset.name = t.name;
		b.dataset.asked = asked ? '1' : '0';
		const label = asked ? 'Asked to join ' + t.name + '. Tap to take it back'
			: full ? t.name + ' is full'
			: 'Ask to join ' + t.name;
		b.title = label;
		b.setAttribute('aria-label', label);
		b.disabled = full && !asked;

		const icon = asked ? 'tick' : 'follow';
		const face = document.createElement('span');
		face.className = 'tdc-ring';
		face.innerHTML = TDCRing.svg();
		b.append(face);
		try {
			const first = !drawn.has(id + icon);
			const r = new TDCRing.RingStatus(face, {
				icons: [icon],
				labels: { [icon]: label, empty: label },
				initial: first ? 'empty' : icon
			});
			if (first) { drawn.add(id + icon); r.drawTo(icon); }
		} catch (err) {
			TDC.error(area, 'the ring to ask to join ' + t.name + ' could not be drawn.', err, statusEl);
		}
		return b;
	}

	return { ring };
})();
