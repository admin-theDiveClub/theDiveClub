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
    const orientation = window.innerWidth > window.innerHeight ? "horizontal" : "vertical"; //horizontal | vertical

    var matchMode = orientation === "vertical" ? "compact" : "vertical"; //compact | vertical | horizontal
    if (view == "linear")
    {
        matchMode = orientation === "vertical" ? "compact" : "vertical";
    }
    PopulateChart(rounds, log, view, orientation, matchMode);
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

    const e_cell_dn = (text, side) =>
    {
        const td = document.createElement("td");
        td.className = "match-player-dn";
        td.textContent = text || "Player";
        td.id = `match-${side}-player-${match.id}`;
        return td;
    }

    const e_cell_score = (score, side) =>
    {
        const td = document.createElement("td");
        td.className = "match-player-score";
        td.textContent = score !== undefined ? score : "-";
        td.id = `match-${side}-score-${match.id}`;
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
        const e_td_dn_H = e_cell_dn(match.playerH, 'h');
        e_tr_players.appendChild(e_td_dn_H);

        if (match.playerApp)
        {
            const e_td_pp_A = e_cell_pp(match.playerApp);
            e_tr_players.appendChild(e_td_pp_A);
        }
        const e_td_dn_A = e_cell_dn(match.playerA, 'a');
        e_tr_players.appendChild(e_td_dn_A);

        table.appendChild(e_tr_players);

        //Scores Row
        var e_tr_scores = document.createElement("tr");
        var e_td_score_H = e_cell_score(match.resultH, 'h');
        if (match.playerHpp)
        {
            e_td_score_H.colSpan = 2;
        }
        e_tr_scores.appendChild(e_td_score_H);

        var e_td_score_A = e_cell_score(match.resultA, 'a');
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

        const e_td_dn_H = e_cell_dn(match.playerH, 'h');
        if (!match.playerHpp)
        {
            e_td_dn_H.colSpan = 2;
        }

        e_tr_player_H.appendChild(e_td_dn_H);

        const e_td_score_H = e_cell_score(match.resultH, 'h');
        e_tr_player_H.appendChild(e_td_score_H);

        table.appendChild(e_tr_player_H);

        var e_tr_player_A = document.createElement("tr");

        if (match.playerApp)
        {
            const e_td_pp_A = e_cell_pp(match.playerApp);
            e_tr_player_A.appendChild(e_td_pp_A);
        }

        const e_td_dn_A = e_cell_dn(match.playerA, 'a');
        if (!match.playerApp)
        {
            e_td_dn_A.colSpan = 2;
        }

        e_tr_player_A.appendChild(e_td_dn_A);

        const e_td_score_A = e_cell_score(match.resultA, 'a');
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

        const e_td_dn_H = e_cell_dn(match.playerH, 'h');
        e_tr_main.appendChild(e_td_dn_H);

        const e_td_score_H = e_cell_score(match.resultH, 'h');
        e_tr_main.appendChild(e_td_score_H);

        const e_td_score_A = e_cell_score(match.resultA, 'a');
        e_tr_main.appendChild(e_td_score_A);

        const e_td_dn_A = e_cell_dn(match.playerA, 'a');
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

function PopulateChart (rounds, log, mode, orientation, matchMode)
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
        tbl_progChart.style.flexDirection = "column";

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
                    const match = round[j];
                    const e_td_match = _matchTable(match, matchMode);
                    e_td_match.id = `match-${match.id}`;
                    match.progChartElement = e_td_match;
                    e_tr_round.appendChild(e_td_match);
                }
            }
        }
    } else if (orientation === "horizontal")
    {
        tbl_progChart.style.flexDirection = "row";

        for (let i = 0; i < transformedRounds.length; i++)
        {
            if (transformedRounds[i] && transformedRounds[i].length > 0)
            {
                const e_round_table = document.createElement("table");
                e_round_table.className = "tbl-round";
                tbl_progChart.appendChild(e_round_table);

                if (transformedRounds[i] && transformedRounds[i].length > 0)
                {
                    for (let j = 0; j < transformedRounds[i].length; j++)
                    {
                        const e_tr_matchRow = document.createElement("tr");
                        const e_td_match = document.createElement("td");
                        const match = transformedRounds[i][j];
                        e_td_match.id = `match-${match.id}`;
                        const matchTable = _matchTable(match, matchMode);
                        match.progChartElement = e_td_match;
                        e_td_match.appendChild(matchTable);
                        e_tr_matchRow.appendChild(e_td_match);
                        e_round_table.appendChild(e_tr_matchRow);
                    }
                }
            }
        }
    }

    DrawProgArrows(rounds, log, mode, orientation);
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

function DrawProgArrows (rounds, log, mode, orientation)
{
    UpdateSizes();


    for (let i = 0; i < rounds.length; i++)
    {
        const round = rounds[i] || [];
        if (round && round.length > 0)
        {
            for (let j = 0; j < round.length; j++)
            {
                const match = round[j];
                for (let k = 0; k < log.length; k++)
                {
                    const player = log[k];
                    const idx = player.matches.findIndex(m => m && m.id === match.id);
                    if (idx !== -1)
                    {
                        player.matches[idx] = match;
                        const e_score_h = document.getElementById(`match-h-score-${match.id}`);
                        const e_score_a = document.getElementById(`match-a-score-${match.id}`);
                        player.matches[idx].scoreElements = {h: e_score_h, a: e_score_a};
                    }
                }
            }
        }
    }

    DrawArrows(log, orientation, mode);
}

function DrawArrows (log, orientation, mode)
{
    // clear previous lines
    if (Array.isArray(window._tournamentLeaderLines))
    {
        window._tournamentLeaderLines.forEach(l => { try { l.remove(); } catch (_) {} });
    }
    window._tournamentLeaderLines = [];

    const isElement = (el) => !!(el && el.nodeType === 1);

    const centerOf = (el) =>
    {
        if (!isElement(el)) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const getSide = (player, match) =>
    {
        const name = player?.displayName;
        if (!match || !name) return null;
        if (match.playerH === name) return "h";
        if (match.playerA === name) return "a";
        return null;
    };

    const getScoreEl = (player, match) =>
    {
        const side = getSide(player, match);
        if (!side) return null;
        const elFromCache = match?.scoreElements?.[side];
        if (isElement(elFromCache)) return elFromCache;
        // fallback by id
        const byId = document.getElementById(`match-${side}-score-${match.id}`);
        return isElement(byId) ? byId : null;
    };

    const getNameEl = (player, match) =>
    {
        const side = getSide(player, match);
        if (!side) return null;
        const dnEl = document.getElementById(`match-${side}-player-${match.id}`);
        return isElement(dnEl) ? dnEl : null;
    };

    const fallbackEl = (match) => isElement(match?.progChartElement) ? match.progChartElement : null;

    for (let p = 0; p < log.length; p++)
    {
        const player = log[p];
        if (!player || !Array.isArray(player.matches)) continue;

        const entries = player.matches
            .filter(Boolean)
            .map(m => ({
                m,
                createdAt: m.createdAt || 0,
                round: m.round ?? 0
            }))
            .sort((a, b) => (a.round - b.round) || (a.createdAt - b.createdAt));

        for (let i = 1; i < entries.length; i++)
        {
            const prevMatch = entries[i - 1].m;
            const nextMatch = entries[i].m;

            // preferred anchors
            const prevScore = getScoreEl(player, prevMatch) || getNameEl(player, prevMatch) || fallbackEl(prevMatch);
            const prevName  = getNameEl(player, prevMatch)  || getScoreEl(player, prevMatch) || fallbackEl(prevMatch);
            const nextName  = getNameEl(player, nextMatch)  || getScoreEl(player, nextMatch) || fallbackEl(nextMatch);
            const nextScore = getScoreEl(player, nextMatch) || getNameEl(player, nextMatch) || fallbackEl(nextMatch);

            if (!isElement(prevScore) && !isElement(prevName)) continue;
            if (!isElement(nextName) && !isElement(nextScore)) continue;

            let fromEl, toEl, startSocket, endSocket;

            if (mode === "linear")
            {
                // Always score -> name
                fromEl = isElement(prevScore) ? prevScore : (isElement(prevName) ? prevName : null);
                toEl   = isElement(nextName)  ? nextName  : (isElement(nextScore) ? nextScore : null);
                if (!isElement(fromEl) || !isElement(toEl)) continue;

                if (orientation === "horizontal")
                {
                    startSocket = "right";
                    endSocket = "left";
                }
                else // vertical
                {
                    startSocket = "bottom";
                    endSocket = "top";
                }
            }
            else // championship
            {
                // Determine based on positions
                const cPrevScore = isElement(prevScore) ? centerOf(prevScore) : null;
                const cNextName  = isElement(nextName)  ? centerOf(nextName)  : null;
                const cPrevName  = isElement(prevName)  ? centerOf(prevName)  : null;
                const cNextScore = isElement(nextScore) ? centerOf(nextScore) : null;

                // Candidate A: score(prev) -> name(next)
                const aValid = !!(cPrevScore && cNextName);
                // Candidate B: name(prev) -> score(next)
                const bValid = !!(cPrevName && cNextScore);

                const chooseA = () =>
                {
                    fromEl = prevScore;
                    toEl = nextName;
                    if (orientation === "horizontal") { startSocket = "right"; endSocket = "left"; }
                    else { startSocket = "bottom"; endSocket = "top"; }
                };
                const chooseB = () =>
                {
                    fromEl = prevName;
                    toEl = nextScore;
                    if (orientation === "horizontal") { startSocket = "left"; endSocket = "right"; }
                    else { startSocket = "top"; endSocket = "bottom"; }
                };

                if (orientation === "horizontal")
                {
                    if (aValid && bValid)
                    {
                        if (cPrevScore.x <= cNextName.x) chooseA();
                        else chooseB();
                    }
                    else if (aValid) chooseA();
                    else if (bValid) chooseB();
                    else
                    {
                        // Fallback to available elements
                        fromEl = isElement(prevScore) ? prevScore : prevName;
                        toEl   = isElement(nextName)  ? nextName  : nextScore;
                        if (!isElement(fromEl) || !isElement(toEl)) continue;

                        const cf = centerOf(fromEl), ct = centerOf(toEl);
                        if (!cf || !ct || cf.x <= ct.x) { startSocket = "right"; endSocket = "left"; }
                        else { startSocket = "left"; endSocket = "right"; }
                    }
                }
                else // vertical
                {
                    if (aValid && bValid)
                    {
                        if (cPrevScore.y <= cNextName.y) chooseA();
                        else chooseB();
                    }
                    else if (aValid) chooseA();
                    else if (bValid) chooseB();
                    else
                    {
                        fromEl = isElement(prevScore) ? prevScore : prevName;
                        toEl   = isElement(nextName)  ? nextName  : nextScore;
                        if (!isElement(fromEl) || !isElement(toEl)) continue;

                        const cf = centerOf(fromEl), ct = centerOf(toEl);
                        if (!cf || !ct || cf.y <= ct.y) { startSocket = "bottom"; endSocket = "top"; }
                        else { startSocket = "top"; endSocket = "bottom"; }
                    }
                }
            }

            try
            {
                const container = document.getElementById("tbl-chart-prog");

                // Ensure container can host absolutely positioned children
                if (container)
                {
                    const cs = window.getComputedStyle(container);
                    // if (cs.position === "static") container.style.position = "relative";
                }

                const lineSize = Math.max(window.innerWidth, window.innerHeight) / 250;

                // Prefer built-in container option if supported by LeaderLine
                const line = new LeaderLine(fromEl, toEl, {
                    color: "rgba(0, 255, 0, 0.75)",
                    size: lineSize,
                    path: "fluid",
                    startSocket,
                    endSocket,
                    startPlug: "disc",
                    endPlug: "arrow1",
                    startSocketGravity: 35,
                    endSocketGravity: 40,
                    ...(container ? { container } : {})
                });

                // Fallback: try to reparent created DOM node into chart-prog
                if (container)
                {
                    try
                    {
                        // Try known/internal handles first
                        const el = line.svg || line.element || line._element || null;
                        if (el && el.parentNode !== container) container.appendChild(el);
                    } catch (_) {}

                    try
                    {
                        // Generic fallback: move the last created leader-line root
                        const els = document.querySelectorAll(".leader-line");
                        const last = els[els.length - 1];
                        if (last && last.parentNode !== container) container.appendChild(last);
                    } catch (_) {}
                }

                window._tournamentLeaderLines.push(line);
            } catch (_) {}
        }
    }

    // ensure lines are children of #chart-prog so they move when chart-prog scrolls
    (function ensureLinesInChartProg() {
        const chartProg = document.getElementById("chart-prog");
        if (chartProg) {
            try {
                const cs = window.getComputedStyle(chartProg);
                if (cs.position === "static") chartProg.style.position = "relative";
            } catch (_) {}

            (window._tournamentLeaderLines || []).forEach(l => {
                try {
                    const el = l.svg || l.element || l._element || null;
                    if (el && el.parentNode !== chartProg) chartProg.appendChild(el);
                } catch (_) {}
            });
        }
    })();

    // refresh positions on resize
    if (window._tournamentLeaderLinesResizeHandler) {
        window.removeEventListener("resize", window._tournamentLeaderLinesResizeHandler);
    }
    window._tournamentLeaderLinesResizeHandler = () =>
    {
        (window._tournamentLeaderLines || []).forEach(l => { try { l.position(); } catch (_) {} });
    };
    window.addEventListener("resize", window._tournamentLeaderLinesResizeHandler);

    // also refresh on scroll of the chart container so lines stay aligned while scrolling
    const _chartProgScrollHandlerAttach = () =>
    {
        const chartProg = document.getElementById("chart-prog");
        if (!chartProg) return;

        if (window._tournamentLeaderLinesScrollHandler)
        {
            try { chartProg.removeEventListener("scroll", window._tournamentLeaderLinesScrollHandler); } catch (_) {}
        }
        window._tournamentLeaderLinesScrollHandler = () =>
        {
            // position() can be expensive; batch with rAF
            window.requestAnimationFrame(() =>
            {
                (window._tournamentLeaderLines || []).forEach(l => { try { l.position(); } catch (_) {} });
            });
        };
        chartProg.addEventListener("scroll", window._tournamentLeaderLinesScrollHandler, { passive: true });
    };
    _chartProgScrollHandlerAttach();
}

function UpdateSizes ()
{
    const root = document.documentElement;
    const container = document.getElementById("chart-prog");
    if (!root || !container) return;

    const toRem = v => `${v}rem`;
    const step = 0.2;
    const max = 2;
    const viewportH = window.innerHeight * 0.8;
    const viewportW = window.innerWidth * 0.8;

    // reset to zero
    root.style.setProperty("--sep-h", toRem(0));
    root.style.setProperty("--sep-v", toRem(0));
    root.style.setProperty("--font-size", toRem(0));

    let v = 0;
    let guard = 1000; // safety

    while (v < max && guard-- > 0)
    {
        v = Math.min(max, Math.round((v + step) * 10) / 10);

        if (window.innerWidth > window.innerHeight)
        {
            root.style.setProperty("--sep-h", toRem(v * 0.2));
            root.style.setProperty("--sep-v", toRem(v * 0.1));
        } else 
        {
            root.style.setProperty("--sep-h", toRem(v * 0.1));
            root.style.setProperty("--sep-v", toRem(v * 0.8));
        }
        root.style.setProperty("--font-size", toRem(v * 0.75));

        const rect = container.getBoundingClientRect();
        const heightHit = rect.height >= viewportH;
        const widthHit = rect.width >= viewportW;
        if (heightHit) break;
    }
}