export function UpdateTournamentUI(tournament, log, rounds, players)
{
    //console.log('UI: Tournament UI Update', tournament, log, rounds, players);
    tournamentRounds = rounds;
    tournamentPlayers = players;

    PopulateLog(log, players);
    PopulateProgressionCharts(rounds);
}

var tournamentRounds = null;
var tournamentPlayers = null;

function PopulateLog (log)
{
    const tbody = document.getElementById('tournament-standings');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(log)) return;

    log.forEach(entry => {
        const tr = document.createElement('tr');
        const fPct = entry['F%'] != null ? String(entry['F%']).replace('%', '') + '%' : '';
        const cols = [
            entry.Rank ?? '',
            GetPlayerDisplayName(entry.username) ?? '',
            entry.MP ?? '',
            entry.MW ?? '',
            entry.ML ?? '',
            entry.FP ?? '',
            entry.FW ?? '',
            fPct,
            entry['B/F'] ?? ''
        ];

        cols.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function PopulateProgressionCharts (rounds)
{       
    // PopulateVerticalProgressionChart(rounds);
    // PopulateVerticalAltProgressionChart(rounds);
    // PopulateHorizontalProgressionChart(rounds);
     PopulateHorizontalAltProgressionChart(rounds);

    DrawProgressionArrows(rounds);
}

function PopulateVerticalProgressionChart (rounds)
{
    const container = document.getElementById('progressionChart-V');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = 0; j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }    
}

function PopulateVerticalAltProgressionChart (rounds)
{
    const container = document.getElementById('progressionChart-V-Alt');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = 0; j < rounds[i].length / 2; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }

    for (let i = rounds.length - 1; i > 0; i --)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = Math.ceil(rounds[i].length / 2); j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }
}

function PopulateHorizontalProgressionChart (rounds)
{
    const container = document.getElementById('prog-chart-h-container');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        for (let j = 0; j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
        }
        container.appendChild(e_col);
    }
    
}

function PopulateHorizontalAltProgressionChart (rounds)
{
    const container = document.getElementById('prog-chart-h-alt-container');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        for (let j = 0; j < rounds[i].length / 2; j ++)
        {
            const match = rounds[i][j].match;
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
        }
        container.appendChild(e_col);
    }
    
    for (let i = rounds.length - 1; i > 0; i --)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        for (let j = Math.ceil(rounds[i].length / 2); j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_card = CreateMatchCard(match, rounds[i][j].id);
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
        }
        container.appendChild(e_col);
    }
}

function GetPlayerDisplayName(username)
{
    const player = username;
    if (username)
    {
        for (var i = 0; i < Object.keys(tournamentPlayers).length; i ++)
        {
            var p = tournamentPlayers[i.toString()];
            if (p.username === username)
            {
                return p.displayName;
            }
        }
    } 
    return player;
}

function CreateMatchCard (match, matchRefID)
{
    const e_card = document.createElement('div');
    e_card.className = 'card';
    e_card.id = `match-card-r${match.info.round}-m${matchRefID}`;
    if (match.info.status === 'Complete')
    {
        e_card.classList.add('card-completed');
    } else 
    {
        e_card.classList.add('card-new');
    }
    const e_table = document.createElement('table');

    const e_tr_names = document.createElement('tr');
    const e_td_name_H = document.createElement('td');
    var name_H = '-';
    if (match.players && match.players.h && match.players.h.username)
    {
        name_H = GetPlayerDisplayName(match.players.h.username, tournamentPlayers);
    }
    e_td_name_H.textContent = name_H;
    e_td_name_H.classList.add('prog-player');
    const e_td_name_A = document.createElement('td');
    var name_A = '-';
    if (match.players && match.players.a && match.players.a.username)
    {
        name_A = GetPlayerDisplayName(match.players.a.username, tournamentPlayers);
    }
    e_td_name_A.textContent = name_A;
    e_td_name_A.classList.add('prog-player');
    e_tr_names.appendChild(e_td_name_H);
    e_tr_names.appendChild(e_td_name_A);
    e_table.appendChild(e_tr_names);

    const e_tr_scores = document.createElement('tr');

    const e_td_score_H = document.createElement('td');
    var score_H = 0;
    if (match.results && match.results.h)
    {
        score_H = match.results.h.fw;
    }
    e_td_score_H.textContent = score_H;
    e_td_score_H.classList.add('prog-score');

    const e_td_score_A = document.createElement('td');
    var score_A = 0;
    if (match.results && match.results.a)
    {
        score_A = match.results.a.fw;
    }
    e_td_score_A.textContent = score_A;
    e_td_score_A.classList.add('prog-score');

    if (score_H > score_A && match.info.status === 'Complete')
    {
        e_td_score_H.classList.add('prog-winner');
        e_td_name_H.classList.add('prog-winner');
    } else if (score_A > score_H && match.info.status === 'Complete')
    {
        e_td_score_A.classList.add('prog-winner');
        e_td_name_A.classList.add('prog-winner');
    }

    if (match.info.status !== 'Complete')
    {
        if (name_H !== '-' || name_A !== '-' || score_H !== 0 || score_A !== 0)
        {
            e_card.classList.remove('card-new');
            e_card.classList.add('card-live');
        }
    }

    e_tr_scores.appendChild(e_td_score_H);
    e_tr_scores.appendChild(e_td_score_A);
    e_table.appendChild(e_tr_scores);
    e_card.appendChild(e_table);
    return e_card;
}

function DrawProgressionArrows(rounds) {
    // Clear existing lines if any
    if (window.__tournamentLines && Array.isArray(window.__tournamentLines)) {
        window.__tournamentLines.forEach(l => { try { l.remove(); } catch {} });
    }
    window.__tournamentLines = [];

    // Ensure LeaderLine is available
    if (typeof LeaderLine === 'undefined') {
        console.warn('LeaderLine not found. Skipping progression arrows.');
        return;
    }

    const getLineColor = (match) => 
    {
        const s = (match.info.status || '').toLowerCase();
        if (s !== 'complete' && (match.players.h?.username || match.players.a?.username)) return 'rgb(0, 255, 0)'; // gray
        if (s === 'complete') return 'rgb(229, 21, 119)';                 // green
        if (s === 'new' || s === 'live') return 'rgb(146, 126, 153)'; // amber
        return 'rgb(234, 228, 191)';                                       // gray
    };

    const getDashed = (match) =>
    {
        const s = (match.info.status || '').toLowerCase();
        if (s !== 'complete' && (match.players.h?.username || match.players.a?.username)) return true; // gray
        if (s === 'complete') return false;                 // green
        if (s === 'new' || s === 'live') true; // amber
        return true;   
    }

    // Helpers to compute relative positions and edge-anchors
    const centerOf = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    };

    // Build a pointAnchor at the edge based on the chosen side and offset percent along that edge
    const edgePointAnchor = (el, side, offsetPercent) => {
        switch (side) {
            case 'left':   return LeaderLine.pointAnchor(el, { x: '0%',   y: `${offsetPercent}%` });
            case 'right':  return LeaderLine.pointAnchor(el, { x: '100%', y: `${offsetPercent}%` });
            case 'top':    return LeaderLine.pointAnchor(el, { x: `${offsetPercent}%`, y: '0%' });
            case 'bottom': return LeaderLine.pointAnchor(el, { x: `${offsetPercent}%`, y: '100%' });
            default:       return LeaderLine.pointAnchor(el, { x: '50%',  y: '50%' });
        }
    };

    // Decide which edges to use based on relative positions (horizontal vs vertical dominant)
    const chooseSides = (prevCard, currCard) => {
        const a = centerOf(prevCard);
        const b = centerOf(currCard);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
            // Horizontal connection
            return {
                startSide: dx >= 0 ? 'right' : 'left',
                endSide:   dx >= 0 ? 'left'  : 'right',
                axis: 'horizontal'
            };
        } else {
            // Vertical connection
            return {
                startSide: dy >= 0 ? 'bottom' : 'top',
                endSide:   dy >= 0 ? 'top'    : 'bottom',
                axis: 'vertical'
            };
        }
    };

    for (let i = 1; i < rounds.length; i++) {
        const currRound = rounds[i];
        if (!Array.isArray(currRound)) continue;

        for (let j = 0; j < currRound.length; j++) {
            const currRef = currRound[j];
            if (!currRef) continue;

            const currCard = currRef.card || document.getElementById(`match-card-r${currRef.round}-m${currRef.id}`);
            if (!currCard) continue;

            const status = currRef.match && currRef.match.info ? currRef.match.info.status : null;

            const prevRoundIdx = Number.isInteger(currRef.precedingRound) ? currRef.precedingRound : (i - 1);
            const prevIdxs = Array.isArray(currRef.precedingMatches) ? currRef.precedingMatches : [];
            const totalIncoming = prevIdxs.length;

            prevIdxs.forEach((prevIdx, k) => {
            const prevRef = rounds[prevRoundIdx] && rounds[prevRoundIdx][prevIdx];
            if (!prevRef) return;

            const prevCard = prevRef.card || document.getElementById(`match-card-r${prevRef.round}-m${prevRef.id}`);
            if (!prevCard) return;

            // Choose sides using relative positions of the cards
            const { startSide, endSide } = chooseSides(prevCard, currCard);

            // Spread multiple lines along the edge of the target to reduce overlap
            const endOffsetPercent = 50;

            // For the start, mirror the same offset to keep lines neat
            const startOffsetPercent = endOffsetPercent;

            const startAnchor = edgePointAnchor(prevCard, startSide, startOffsetPercent);
            const endAnchor = edgePointAnchor(currCard, endSide, endOffsetPercent);

            // Use color based on the preceding match
            const color = getLineColor(prevRef.match);
            const dashed = getDashed(prevRef.match);

            const line = new LeaderLine(
                startAnchor,
                endAnchor,
                {
                color,
                size: 2.5,
                path: 'smooth',
                startPlug: 'disc',
                endPlug: 'arrow3',
                endPlugSize: 1.5,
                // sockets are already implied by edge pointAnchor; keep auto routing
                dash: dashed ? { animation: true } : false
                }
            );

            try { if (line && line.path) line.path.style.zIndex = '0'; } catch {}

            window.__tournamentLines.push(line);
            });
        }
    }

    // Reposition lines on scroll/resize
    if (!window.__tournamentLinesListenersAdded) {
        const reposition = () => {
            if (!window.__tournamentLines) return;
            window.__tournamentLines.forEach(l => { try { l.position(); } catch {} });
        };
        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, true);
        window.__tournamentLinesListenersAdded = true;
    }
}