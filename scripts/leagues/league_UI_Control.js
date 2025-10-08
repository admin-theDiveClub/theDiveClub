const userAdmin = (coordinatorID) =>
{
    const userID = _userID();
    if (userID && coordinatorID && userID === coordinatorID)
    {
        return true;
    } else 
    {
        return false;
    }
}

function _userID ()
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    if (userProfile && userProfile.id)
    {
        return userProfile.id;
    } else 
    {
        return null;
    }
}

var _league, _log, _rounds = null;
export function UpdateLeagueUI (league, log, rounds)
{
    _league = league;
    _log = log;
    _rounds = rounds;

    console.log("UpdateLeagueUI:", league, log, rounds);

    PopulateLogTable(log);
    PopulateFilters(rounds, log);
    PopulateRounds(rounds);
}

function gid (id) { return document.getElementById(id); }

function PopulateLogTable (log)
{
    const tblLog = gid('table-log').querySelector('tbody');
    tblLog.innerHTML = '';

    for (let i = 0; i < log.length; i++)
    {
        const playerName = log[i].displayName;
        const stats = log[i].stats;

        const e_tr = document.createElement('tr');

        const e_td_rank = document.createElement('td');
        e_td_rank.textContent = stats.Rnk;

        const e_td_name = document.createElement('td');
        e_td_name.textContent = playerName;

        const e_td_mp = document.createElement('td');
        e_td_mp.textContent = stats.MP;

        const e_td_mw = document.createElement('td');
        e_td_mw.textContent = stats.MW;

        const e_td_fp = document.createElement('td');
        e_td_fp.textContent = stats.FP;

        const e_td_fw = document.createElement('td');
        e_td_fw.textContent = stats.FW;

        const e_td_fwr = document.createElement('td');
        e_td_fwr.textContent = stats.FWR;

        const e_td_bf = document.createElement('td');
        e_td_bf.textContent = stats.BF;

        const e_td_pts = document.createElement('td');
        e_td_pts.textContent = stats.Pts;

        e_tr.appendChild(e_td_rank);
        e_tr.appendChild(e_td_name);
        e_tr.appendChild(e_td_mp);
        e_tr.appendChild(e_td_mw);
        e_tr.appendChild(e_td_fp);
        e_tr.appendChild(e_td_fw);
        e_tr.appendChild(e_td_fwr);
        e_tr.appendChild(e_td_bf);
        e_tr.appendChild(e_td_pts);

        tblLog.appendChild(e_tr);
    }
}

function PopulateFilters (rounds, players)
{
    //Rounds
    const selRounds = gid('filter-rounds');
    if (!selRounds) return;

    selRounds.innerHTML = '';

    const optDefault = document.createElement('option');
    optDefault.value = 'null';
    optDefault.textContent = 'All Rounds';
    selRounds.appendChild(optDefault);

    for (const round of rounds) 
    {
        const opt = document.createElement('option');
        opt.value = round.id;
        opt.textContent = round.name;
        selRounds.appendChild(opt);
    }

    //Players
    const selPlayers = gid('filter-players');
    if (!selPlayers) return;

    selPlayers.innerHTML = '';

    const optDefaultP = document.createElement('option');
    optDefaultP.value = 'null';
    optDefaultP.textContent = 'All Players';
    selPlayers.appendChild(optDefaultP);

    for (const player of players) {
        const opt = document.createElement('option');
        opt.value = player.username || '';
        opt.textContent = player.displayName || player.username || '';
        selPlayers.appendChild(opt);
    }
}

gid('filter-rounds').addEventListener('change', (event) => 
{
    const player = gid('filter-players').value || null;
    const status = gid('filter-status').value || null;
    const f_rounds = GetFilteredMatches(event.target.value, player, status);
    PopulateRounds(f_rounds);
});

gid('filter-players').addEventListener('change', (event) => 
{
    const round = gid('filter-rounds').value || null;
    const status = gid('filter-status').value || null;
    const f_rounds = GetFilteredMatches(round, event.target.value, status);
    PopulateRounds(f_rounds);
});
gid('filter-status').addEventListener('change', (event) => 
{
    const round = gid('filter-rounds').value || null;
    const player = gid('filter-players').value || null;
    const f_rounds = GetFilteredMatches(round, player, event.target.value);
    PopulateRounds(f_rounds);
});

function GetFilteredMatches (round, player, status)
{
    console.log("GetFilteredMatches:", round, player, status);
    var filteredRounds = [];
    const _r = _rounds;
    
    for (let i = 0; i < _r.length; i++)
    {
        const r = _r[i];
        if (!round || round === 'null' || round == null || r.id == round)
        {
            // create a shallow copy so we don't mutate the original _rounds data
            const rCopy = Object.assign({}, r);
            rCopy.matches = Array.isArray(r.matches) ? r.matches.slice() : [];
            filteredRounds.push(rCopy);
        }
    }
    console.log("Filtered Rounds by Round:", filteredRounds);

    for (let i = 0; i < filteredRounds.length; i++)
    {
        var filteredMatches = [];
        const r_matches = filteredRounds[i].matches || [];
        for (let j = 0; j < r_matches.length; j++)
        {
            const m = r_matches[j];
            var include = true;

            const m_status = m && m.info && m.info.status;
            if (!status || status === 'null' || m_status == status)
            {
                include = true;
            } else {
                include = false;
            }

            // apply player filter if provided
            if (include && player && player !== 'null')
            {
                const hUser = m && m.players && m.players.h && m.players.h.username;
                const aUser = m && m.players && m.players.a && m.players.a.username;
                if (player !== hUser && player !== aUser)
                {
                    include = false;
                }
            }

            if (include) 
            {
                filteredMatches.push(m);
            }
        }
        filteredRounds[i].matches = filteredMatches;
        if (filteredRounds[i].matches.length === 0)
        {
            filteredRounds.splice(i, 1);
            i--; // adjust index after removal
        } else 
        {
            console.log("Filtered Matches by Status:", filteredRounds[i].matches);
        }
    }

    return filteredRounds;
}

function PopulateRounds (rounds)
{
    const uA = userAdmin(_league.coordinatorID);
    const roundsContainer = gid('container-rounds');
    roundsContainer.innerHTML = '';

    for (const round of rounds)
    {
        const divRound = document.createElement('div');
        divRound.className = 'container-round';
        const pHeading = document.createElement('p');
        pHeading.className = 'round-heading';
        pHeading.textContent = round.name || 'Round';
        divRound.appendChild(pHeading);

        const tblRounds = document.createElement('table');
        tblRounds.id = 'table-rounds';
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        const headers = ['Home', 'FW', 'B/F', 'Pts', '|', 'Pts', 'B/F', 'FW', 'Away'];
        for (const header of headers) 
        {
            const th = document.createElement('th');
            th.textContent = header;
            trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        tblRounds.appendChild(thead);
        divRound.appendChild(tblRounds);
        roundsContainer.appendChild(divRound);

        const tbody = document.createElement('tbody');
        if (round.matches && round.matches.length > 0)
        {
            for (const match of round.matches)
            {

                async function UpdateMatch (match)
                {
                    const response = await supabase.from('tbl_matches').update(match).eq('id', match.id).select().single();
                    if (response.error)
                    {
                        console.log("Error Updating Match:", response.error.message);
                        return null;
                    } else 
                    {
                        return response.data;
                    }
                }

                const _cell_score = (cell, side, type) =>
                {
                    if (!uA) return cell;
                    cell.addEventListener('click', () =>
                    {
                        const e_input = document.createElement('input');
                        //<input class="form-control t-info-item" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" placeholder="-"></input>
                        e_input.type = 'number';
                        e_input.className = 'form-control';
                        e_input.inputMode = 'numeric';
                        e_input.pattern = '[0-9]*';
                        e_input.min = '0';
                        e_input.step = '1';
                        e_input.placeholder = '-';
                        e_input.value = cell.textContent || '';
                        cell.innerHTML = '';
                        cell.appendChild(e_input);
                        e_input.focus();

                        e_input.addEventListener('change', async () =>
                        {
                            const newValue = parseInt(e_input.value);
                            console.log("New Score Value:", newValue);

                            if (!isNaN(newValue))
                            {
                                if (!match.results) match.results = { h: { fw: 0, bf: 0}, a: { fw: 0, bf: 0} };
                                if (!match.results[side]) match.results[side] = { fw: 0, bf: 0};
                                match.results[side][type] = newValue;
                                const updatedMatch = await UpdateMatch(match);
                                if (updatedMatch)
                                {
                                    cell.textContent = newValue;
                                    e_input.remove();
                                } else 
                                {
                                    cell.textContent = cell.textContent || '0';
                                    e_input.remove();
                                }
                            }
                        });

                        e_input.addEventListener('blur', async () =>
                        {
                            e_input.remove();
                            cell.textContent = cell.textContent || '0';
                        });
                    });

                    cell.title = 'Click to edit score';
                    cell.classList.add('editable-cell');

                    return cell;
                }

                const formattedLink = (a, matchStatus) =>
                {
                    if (matchStatus === 'Complete')
                    {
                        a.href = `/matches/scoreboard.html?matchID=${match.id}`;
                        a.classList.add('link-complete');
                    } else if (matchStatus === 'Live')
                    {
                        a.href = `/matches/index.html?matchID=${match.id}`;
                        a.classList.add('link-live');
                    } else
                    {
                        a.href = `/matches/index.html?matchID=${match.id}`;
                        a.classList.add('link-new');
                    }

                    return a;
                }

                const tr = document.createElement('tr');
                const results = match.results || { h: { fw: 0, bf: 0, pts: 0 }, a: { fw: 0, bf: 0, pts: 0 } };

                const tdHome = document.createElement('td');
                const p_h = _log.find(log => log.username === match.players.h.username);
                tdHome.textContent = p_h ? p_h.displayName : 'Home';

                var tdHFW = document.createElement('td');
                tdHFW.textContent = results.h.fw || 0;
                tdHFW = _cell_score(tdHFW, 'h', 'fw');
                var tdHBF = document.createElement('td');
                tdHBF.textContent = results.h.bf || 0;
                tdHBF = _cell_score(tdHBF, 'h', 'bf');

                const tdHPts = document.createElement('td');
                tdHPts.textContent = results.h.fw + results.h.bf || 0;

                const tdSep = document.createElement('td');
                var iLink = document.createElement('a');
                iLink = formattedLink(iLink, match.info && match.info.status ? match.info.status : null);
                iLink.innerHTML = '<i class="bi bi-link"></i>';
                tdSep.appendChild(iLink);

                const tdAPts = document.createElement('td');
                tdAPts.textContent = results.a.fw + results.a.bf || 0;

                var tdABF = document.createElement('td');
                tdABF.textContent = results.a.bf || 0;
                tdABF = _cell_score(tdABF, 'a', 'bf');
                var tdAFW = document.createElement('td');
                tdAFW.textContent = results.a.fw || 0;
                tdAFW = _cell_score(tdAFW, 'a', 'fw');

                const tdAway = document.createElement('td');
                const p_a = _log.find(log => log.username === match.players.a.username);
                tdAway.textContent = p_a ? p_a.displayName : 'Away';

                tr.appendChild(tdHome);
                tr.appendChild(tdHFW);
                tr.appendChild(tdHBF);
                tr.appendChild(tdHPts);
                tr.appendChild(tdSep);
                tr.appendChild(tdAPts);
                tr.appendChild(tdABF);
                tr.appendChild(tdAFW);
                tr.appendChild(tdAway);
                tbody.appendChild(tr);
            }
        }
        tblRounds.appendChild(tbody);
    }
}
