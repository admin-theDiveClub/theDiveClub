var _log = null;
export function UpdateTournamentUI (log)
{
    _log = log;
    UpdateUI(_log);
}

function UpdateUI (log)
{
    PopulateLog(log);
    const rounds = _allRounds(log);
    const view = "championship"; //linear | championship
    const orientation = "vertical"; //horizontal | vertical
    const matchMode = "compact"; //compact | vertical | horizontal
    PopulateChart(rounds, view, orientation, matchMode);
}

function PopulateLog (log)
{
    const tbl_log = document.getElementById("tbl-log");
    const tbl_log_body = tbl_log.getElementsByTagName("tbody")[0];
    tbl_log_body.innerHTML = "";

    const rowColor = (index) =>
    {
        return index % 2 !== 0 ? "var(--color-base-02)" : "var(--color-base-03)";
    }

    for (let i = 0; i < log.length; i++)
    {
        const player = log[i].displayName;
        const pp = log[i].pp ? log[i].pp : "/resources/icons/icon_player.svg";

        const res = log[i].results || {};
        const tr = document.createElement("tr");
        tr.style.backgroundColor = rowColor(i);

        const tdRank = document.createElement("td");
        tdRank.textContent = res.rnk ?? (i + 1);
        tdRank.classList.add("col-rank");
        tr.appendChild(tdRank);

        const tdPP = document.createElement("td");
        tdPP.className = "log-pp";
        if (log[i].pp)
        {            
            const img = document.createElement("img");
            img.src = pp;
            img.alt = "player";
            tdPP.appendChild(img);
        }
        tr.appendChild(tdPP);

        const tdDN = document.createElement("td");
        tdDN.className = "log-dn";
        const p = document.createElement("p");
        p.textContent = player;
        tdDN.appendChild(p);
        tr.appendChild(tdDN);

        const tdMP = document.createElement("td");
        tdMP.textContent = res.mp ?? "";
        tr.appendChild(tdMP);

        const tdMW = document.createElement("td");
        tdMW.textContent = res.mw ?? "";
        tdMW.classList.add("col-match-win");
        tr.appendChild(tdMW);

        const tdFP = document.createElement("td");
        tdFP.textContent = res.fp ?? "";
        tr.appendChild(tdFP);

        const tdFW = document.createElement("td");
        tdFW.textContent = res.fw ?? "";
        tdFW.classList.add("col-frame-win");
        tr.appendChild(tdFW);

        const tdFWR = document.createElement("td");
        tdFWR.textContent = res.fwr ?? "";
        tr.appendChild(tdFWR);

        const tdBF = document.createElement("td");
        tdBF.textContent = res.bf ?? "";
        tdBF.classList.add("col-frame-bf");
        tr.appendChild(tdBF);

        tbl_log_body.appendChild(tr);
    }
}

function _allRounds (log)
{
    var rounds = [];

    for (let i = 0; i < log.length; i++)
    {
        const matches = log[i].matches || [];
        for (let j = 0; j < matches.length; j++)
        {
            const roundIndex = matches[j] && matches[j].info.round || null;
            if (roundIndex && !rounds[roundIndex])
            {
                rounds[roundIndex] = [];
            }
            if (roundIndex && !rounds[roundIndex].find(m => m.id === matches[j].id))
            {
                var match =
                {
                    id: matches[j].id,
                    playerH: log.find(p => p.username === matches[j].players.h.username)?.displayName,
                    playerHpp: log.find(p => p.username === matches[j].players.h.username)?.pp || null,
                    playerA: log.find(p => p.username === matches[j].players.a.username)?.displayName,
                    playerApp: log.find(p => p.username === matches[j].players.a.username)?.pp || null,
                    resultH: matches[j].results.h.fw || 0,
                    resultA: matches[j].results.a.fw || 0,
                    status: matches[j].info.status || "New",
                    round: roundIndex,
                    createdAt: new Date(matches[j].createdAt).getTime() || 0,
                }
                rounds[roundIndex].push(match);
            }
        }
    }

    for (let i = 0; i < rounds.length; i++)
    {
        if (rounds[i] && rounds[i].length > 0)
        {
            rounds[i].sort((a, b) => a.createdAt - b.createdAt);
        }
    }

    console.log("All Sorted Rounds:", rounds);
    return rounds;
}

const _matchTable = (match, mode) =>
{
    const e_cell_pp = (src) =>
    {
        const td = document.createElement("td");
        td.className = "match-player-pp";
        if (src)
        {
            const img = document.createElement("img");
            img.src = src;
            img.alt = "player";
            td.appendChild(img);
        }
        return td;
    }

    const e_cell_dn = (text) =>
    {
        const td = document.createElement("td");
        td.className = "match-player-dn";
        td.textContent = text || "Player";
        return td;
    }

    const e_cell_score = (score) =>
    {
        const td = document.createElement("td");
        td.className = "match-player-score";
        td.textContent = score !== undefined ? score : "-";
        return td;
    }

    var table = document.createElement("table");
    table.className = "tbl-match";

    if (mode === "compact")
    {
        table.classList.add("match-compact");

        //Players Row
        var e_tr_players = document.createElement("tr");

        if (match.playerHpp)
        {
            const e_td_pp_H = e_cell_pp(match.playerHpp);
            e_tr_players.appendChild(e_td_pp_H);
        }
        const e_td_dn_H = e_cell_dn(match.playerH);
        e_tr_players.appendChild(e_td_dn_H);

        if (match.playerApp)
        {
            const e_td_pp_A = e_cell_pp(match.playerApp);
            e_tr_players.appendChild(e_td_pp_A);
        }
        const e_td_dn_A = e_cell_dn(match.playerA);
        e_tr_players.appendChild(e_td_dn_A);

        table.appendChild(e_tr_players);

        //Scores Row
        var e_tr_scores = document.createElement("tr");
        var e_td_score_H = e_cell_score(match.resultH);
        if (match.playerHpp)
        {
            e_td_score_H.colSpan = 2;
        }
        e_tr_scores.appendChild(e_td_score_H);

        var e_td_score_A = e_cell_score(match.resultA);
        if (match.playerApp)
        {
            e_td_score_A.colSpan = 2;
        }
        e_tr_scores.appendChild(e_td_score_A);

        table.appendChild(e_tr_scores);
    } else if (mode === "vertical")
    {
        table.classList.add("match-vertical");

        var e_tr_player_H = document.createElement("tr");

        if (match.playerHpp)
        {
            const e_td_pp_H = e_cell_pp(match.playerHpp);
            e_tr_player_H.appendChild(e_td_pp_H);
        }

        const e_td_dn_H = e_cell_dn(match.playerH);
        if (!match.playerHpp)
        {
            e_td_dn_H.colSpan = 2;
        }

        e_tr_player_H.appendChild(e_td_dn_H);

        const e_td_score_H = e_cell_score(match.resultH);
        e_tr_player_H.appendChild(e_td_score_H);

        table.appendChild(e_tr_player_H);

        var e_tr_player_A = document.createElement("tr");

        if (match.playerApp)
        {
            const e_td_pp_A = e_cell_pp(match.playerApp);
            e_tr_player_A.appendChild(e_td_pp_A);
        }

        const e_td_dn_A = e_cell_dn(match.playerA);
        if (!match.playerApp)
        {
            e_td_dn_A.colSpan = 2;
        }

        e_tr_player_A.appendChild(e_td_dn_A);

        const e_td_score_A = e_cell_score(match.resultA);
        e_tr_player_A.appendChild(e_td_score_A);

        table.appendChild(e_tr_player_A);
    } else if (mode === "horizontal")
    {
        table.classList.add("match-horizontal");
        var e_tr_main = document.createElement("tr");

        if (match.playerHpp)
        {
            const e_td_pp_H = e_cell_pp(match.playerHpp);
            e_tr_main.appendChild(e_td_pp_H);
        }

        const e_td_dn_H = e_cell_dn(match.playerH);
        e_tr_main.appendChild(e_td_dn_H);

        const e_td_score_H = e_cell_score(match.resultH);
        e_tr_main.appendChild(e_td_score_H);

        const e_td_score_A = e_cell_score(match.resultA);
        e_tr_main.appendChild(e_td_score_A);

        const e_td_dn_A = e_cell_dn(match.playerA);
        e_tr_main.appendChild(e_td_dn_A);

        if (match.playerApp)
        {
            const e_td_pp_A = e_cell_pp(match.playerApp);
            e_tr_main.appendChild(e_td_pp_A);
        }

        table.appendChild(e_tr_main);
    }

    return table;
}

function PopulateChart (rounds, mode, orientation, matchMode)
{
    const tbl_progChart = document.getElementById("tbl-progChart");
    tbl_progChart.innerHTML = "";

    var transformedRounds = rounds;
    if (mode === "championship")
    {
        transformedRounds = _splitRounds(rounds);
    }

    if (orientation === "vertical")
    {
        for (let i = 0; i < transformedRounds.length; i++)
        {
            const e_tr_round = document.createElement("tr");
            e_tr_round.className = "tr-matches";
            tbl_progChart.appendChild(e_tr_round);            

            const round = transformedRounds[i] || [];
            if (round && round.length > 0)
            {
                for (let j = 0; j < round.length; j++)
                {
                    const e_td_match = document.createElement("td");
                    const match = round[j];
                    const matchDiv = _matchTable(match, matchMode);
                    e_td_match.appendChild(matchDiv);
                    e_tr_round.appendChild(e_td_match);
                }
            }
        }
    }

    /*if (mode === "championship")
    {
        var splitRounds = rounds;
        
        
        
        for (let i = 0; i < splitRounds.length; i++)
        {
            if (splitRounds[i] && splitRounds[i].length > 0)
            {
                const round = splitRounds[i] || [];
                const colDiv = document.createElement("div");
                colDiv.className = "tournament-column col";
                rowDiv.appendChild(colDiv);

                const roundTitle = document.createElement("p");
                if (i < rounds.length)
                {
                    roundTitle.textContent = `Round ${i}`;
                } else if (i >= rounds.length)
                {
                    roundTitle.textContent = `Round ${rounds.length * 2 - 2 - i}`;
                }
                roundTitle.className = "tournament-round-title";
                colDiv.appendChild(roundTitle);

                for (let j = 0; j < round.length; j++)
                {
                    const match = round[j];
                    const matchDiv = document.createElement("div");
                    matchDiv.className = "tournament-match";
                    matchDiv.appendChild(_matchTable(match, matchMode));
                    colDiv.appendChild(matchDiv);
                }
            }
        }
    } else if (mode === "linear")
    {
        for (let i = 0; i < rounds.length; i++)
        {
            if (rounds[i] && rounds[i].length > 0)
            {
                const round = rounds[i] || [];
                const colDiv = document.createElement("div");
                colDiv.className = "tournament-column col";

                const roundTitle = document.createElement("p");
                roundTitle.textContent = `Round ${i}`;
                colDiv.appendChild(roundTitle);

                for (let j = 0; j < round.length; j++)
                {
                    const match = round[j];
                    const matchDiv = document.createElement("div");
                    matchDiv.className = "tournament-match";
                    matchDiv.appendChild(_matchTable(match, matchMode));
                    colDiv.appendChild(matchDiv);
                }

                rowDiv.appendChild(colDiv);
            }
        }
    }*/    
}

function _splitRounds (rounds)
{
    var splitRounds = [];

    splitRounds[rounds.length - 1] = rounds[rounds.length - 1];

    for (let i = rounds.length - 2; i >= 0; i--)
    {
        splitRounds[i] = rounds[i];
        splitRounds[rounds.length * 2 - 2 - i] = rounds[i];
    }

    const lastRoundIndex = rounds.length % 2 === 0 ? rounds.length : rounds.length - 1;
    for (let i = 0; i < lastRoundIndex; i++)
    {
        if (splitRounds[i] && splitRounds[i].length > 0)
        {
            const matchesCount = splitRounds[i].length;
            const half = Math.ceil(matchesCount / 2);
            splitRounds[i] = splitRounds[i].slice(0, half);
        }
    }

    for (let i = lastRoundIndex + 1; i < splitRounds.length; i++)
    {
        if (splitRounds[i] && splitRounds[i].length > 0)
        {
            const matchesCount = splitRounds[i].length;
            const half = Math.floor(matchesCount / 2);
            splitRounds[i] = splitRounds[i].slice(-half);
        }
    }

    return splitRounds;
}