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
    PopulateChart(rounds, log, "linear", "vertical");
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
                    round: roundIndex
                }
                rounds[roundIndex].push(match);
            }
        }
    }

    console.log("All Rounds:", rounds);
    return rounds;
}

const _matchTable = (match, mode) =>
{
    var table = document.createElement("table");
    table.className = "tbl-match";

    if (mode === "compact")
    {
        table.classList.add("match-compact");

        var tr1 = document.createElement("tr");

        var td1 = document.createElement("td");
        td1.className = "match-player-pp";
        if (match.playerHpp)
        {
            var img1 = document.createElement("img");
            img1.src = match.playerHpp ? match.playerHpp : "/resources/icons/icon_player.svg";
            img1.alt = "player";
            td1.appendChild(img1);
            tr1.appendChild(td1);
        }

        var td2 = document.createElement("td");
        td2.className = "match-player-dn";
        td2.textContent = match.playerH ? match.playerH : "Player H";
        tr1.appendChild(td2);

        var td3 = document.createElement("td");
        td3.className = "match-player-pp";        
        if (match.playerApp)
        {
            var img2 = document.createElement("img");
            img2.src = match.playerApp ? match.playerApp : "/resources/icons/icon_player.svg";
            img2.alt = "player";
            td3.appendChild(img2);            
            tr1.appendChild(td3);
        }

        var td4 = document.createElement("td");
        td4.className = "match-player-dn";
        td4.textContent = match.playerA ? match.playerA : "Player A";
        tr1.appendChild(td4);

        table.appendChild(tr1);

        var tr2 = document.createElement("tr");
        var td5 = document.createElement("td");
        td5.className = "match-player-score";
        if (match.playerHpp)
        {
            td5.colSpan = 2;
        }
        td5.textContent = match.resultH !== undefined ? match.resultH : "-";
        tr2.appendChild(td5);

        var td6 = document.createElement("td");
        td6.className = "match-player-score";
        if (match.playerApp)
        {
            td6.colSpan = 2;
        }
        td6.textContent = match.resultA !== undefined ? match.resultA : "-";
        tr2.appendChild(td6);

        table.appendChild(tr2);
    } else if (mode === "vertical")
    {
        table.classList.add("match-vertical");

        var tr1 = document.createElement("tr");
        
        var td1 = document.createElement("td");
        td1.className = "match-player-pp";
        if (match.playerHpp)
        {
            var img1 = document.createElement("img");
            img1.src = match.playerHpp ? match.playerHpp : "/resources/icons/icon_player.svg";
            img1.alt = "player";
            td1.appendChild(img1);
            tr1.appendChild(td1);
        }

        var td2 = document.createElement("td");
        td2.className = "match-player-dn";
        td2.textContent = match.playerH ? match.playerH : "Player H";
        if (!match.playerHpp)
        {
            td2.colSpan = 2;
        }
        tr1.appendChild(td2);

        var td3 = document.createElement("td");
        td3.className = "match-player-score";
        td3.textContent = match.resultH !== undefined ? match.resultH : "-";
        tr1.appendChild(td3);

        var tr2 = document.createElement("tr");


        var td4 = document.createElement("td");
        td4.className = "match-player-pp";
        if (match.playerApp)
        {
            var img2 = document.createElement("img");
            img2.src = match.playerApp ? match.playerApp : "/resources/icons/icon_player.svg";
            img2.alt = "player";
            td4.appendChild(img2);
            tr2.appendChild(td4);
        }

        var td5 = document.createElement("td");
        td5.className = "match-player-dn";
        td5.textContent = match.playerA ? match.playerA : "Player A";
        if (!match.playerApp)
        {
            td5.colSpan = 2;
        }
        tr2.appendChild(td5);

        var td6 = document.createElement("td");
        td6.className = "match-player-score";
        td6.textContent = match.resultA !== undefined ? match.resultA : "-";
        tr2.appendChild(td6);

        table.appendChild(tr1);
        table.appendChild(tr2);
    } else if (mode === "horizontal")
    {
        table.classList.add("match-horizontal");
        var tr1 = document.createElement("tr");


        var td1 = document.createElement("td");
        td1.className = "match-player-pp";
        if (match.playerHpp)
        {
            var img1 = document.createElement("img");
            img1.src = match.playerHpp ? match.playerHpp : "/resources/icons/icon_player.svg";
            img1.alt = "player";
            td1.appendChild(img1);
            tr1.appendChild(td1);
        }

        var td2 = document.createElement("td");
        td2.className = "match-player-dn";
        td2.textContent = match.playerH ? match.playerH : "Player H";
        tr1.appendChild(td2);

        var td3 = document.createElement("td");
        td3.className = "match-player-score";
        td3.textContent = match.resultH !== undefined ? match.resultH : "-";
        tr1.appendChild(td3);

        var td4 = document.createElement("td");
        td4.className = "match-player-score";
        td4.textContent = match.resultA !== undefined ? match.resultA : "-";
        tr1.appendChild(td4);

        var td5 = document.createElement("td");
        td5.className = "match-player-dn";
        td5.textContent = match.playerA ? match.playerA : "Player A";
        tr1.appendChild(td5);

        var td6 = document.createElement("td");
        td6.className = "match-player-pp";
        if (match.playerApp)
        {
            var img2 = document.createElement("img");
            img2.src = match.playerApp ? match.playerApp : "/resources/icons/icon_player.svg";
            img2.alt = "player";
            td6.appendChild(img2);
            tr1.appendChild(td6);
        }

        table.appendChild(tr1);
    }

    return table;
}

function PopulateChart (rounds, log, mode, matchMode)
{
    const chartProg = document.getElementById("chart-prog");
    chartProg.innerHTML = "";

    const rowDiv = document.createElement("div");
    rowDiv.className = "tournament-row row";
    chartProg.appendChild(rowDiv);

    if (mode === "championship")
    {
        var splitRounds = [];
        for (let i = 0; i < rounds.length; i++)
        {
            if (rounds[i] && rounds[i].length > 0)
            {
                for (let j = 0; j < rounds[i].length; j++)
                {
                    if (j % 2 === 0)
                    {
                        if (!splitRounds[i])
                        {
                            splitRounds[i] = [];
                        }
                        splitRounds[i].push(rounds[i][j]);
                    }
                }
            }
        }

        for (let i = rounds.length - 1; i >= 0; i--)
        {
            if (rounds[i] && rounds[i].length > 0)
            {
                for (let j = 0; j < rounds[i].length; j++)
                {
                    if (j % 2 !== 0)
                    {
                        if (!splitRounds[rounds.length * 2 - 2 - i])
                        {
                            splitRounds[rounds.length * 2 - 2 - i] = [];
                        }
                        splitRounds[rounds.length * 2 - 2 - i].push(rounds[i][j]);
                    }
                }
            }
        }
        
        
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
    }    
}