export function UpdateTournamentUI(tournament, log, rounds, players)
{
    //console.log('UI: Tournament UI Update', tournament, log, rounds, players);
    tournamentRounds = rounds;
    tournamentPlayers = players;

    PopulateLog(log, players);
    DrawChart(tournamentRounds);

    
    if (window.location.href.includes('multi_view.html'))
    {
        const target = document.getElementById('iframe');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else
    {        
        const target = document.getElementById('progressionChart');
        target.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

var tournamentRounds = null;
var tournamentPlayers = null;

function PopulateLog (log)
{
    const tbody = document.getElementById('tournament-standings');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(log)) return;

    log.forEach((entry, idx) => {
        const tr = document.createElement('tr');

        // Zebra striping: give every second row a different background color
        if (idx % 2 === 1) 
        {
            tr.style.backgroundColor = 'var(--color-base-02)';
        } else 
        {
            tr.style.backgroundColor = 'var(--color-base-04)';
        }

        const fPct = entry['F%'] != null ? String(entry['F%']).replace('%', '') + '%' : '';
        const cols = [
            entry.Rank ?? '',
            GetPlayerProfile(entry.username).displayName || entry.username || '?',
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

function DrawChart (rounds)
{
    const orientationInput = document.querySelector('input[name="chartOrientation"]:checked');
    const styleInput = document.querySelector('input[name="chartStyle"]:checked');
    const pathInput = document.querySelector('input[name="chartLineType"]:checked') ||
                      document.querySelector('input[name="pathType"]:checked');

    const orientation = orientationInput ? orientationInput.value : 'horizontal';
    const style = styleInput ? styleInput.value : 'championship';
    const pathType = pathInput ? pathInput.value : 'straight';

    if (orientation === 'horizontal') {PopulateChart_H(rounds, style);};
    if (orientation === 'vertical') {PopulateChart_V(rounds, style);};

    DrawProgressionArrows(rounds, pathType);
}

document.addEventListener('DOMContentLoaded', () => 
{
    wireViewControls();
});

function wireViewControls() {
    const panel = document.getElementById('view-controls-panel');
    if (!panel) return;

    panel.addEventListener('change', (e) => {
        if (e.target?.matches('input[name="chartOrientation"]')) {
            DrawChart(tournamentRounds);
        }
    });
    panel.addEventListener('change', (e) => {
        if (e.target?.matches('input[name="chartStyle"]')) {
            DrawChart(tournamentRounds);
        }
    });
    panel.addEventListener('change', (e) => {
        if (e.target?.matches('input[name="pathType"], input[name="chartLineType"]')) {
            DrawChart(tournamentRounds);
        }
    });
    // Card spacing and magnification controls
    panel.addEventListener('click', (e) => 
    {
        const btn = e.target && e.target.closest('button');
        if (!btn) return;

        switch (btn.id) {
            case 'card-spacing-decrease-h':
                UpdateCardSpacing_H('-');
                break;
            case 'card-spacing-increase-h':
                UpdateCardSpacing_H('+');
                break;
            case 'card-spacing-decrease-v':
                UpdateCardSpacing_V('-');
                break;
            case 'card-spacing-increase-v':
                UpdateCardSpacing_V('+');
                break;
            case 'card-magnification-decrease':
                UpdateCardMagnification('-');
                break;
            case 'card-magnification-increase':
                UpdateCardMagnification('+');
                break;
        }

        DrawChart(tournamentRounds);
    });
}

function UpdateCardSpacing_H (direction)
{
    const root = document.documentElement;
    root.style.setProperty('--card-spacing-h',
        (parseFloat(getComputedStyle(root).getPropertyValue('--card-spacing-h')) || 1) + (direction === '+' ? 0.5 : -0.5) + 'rem');
}

function UpdateCardSpacing_V (direction)
{
    const root = document.documentElement;
    root.style.setProperty('--card-spacing-v',
        (parseFloat(getComputedStyle(root).getPropertyValue('--card-spacing-v')) || 1) + (direction === '+' ? 0.5 : -0.5) + 'rem');
}

function UpdateCardMagnification (direction)
{
    const root = document.documentElement;
    root.style.setProperty('--card-magnification',
        (parseFloat(getComputedStyle(root).getPropertyValue('--card-magnification')) || 1) + (direction === '+' ? 0.1 : -0.1));
}

function PopulateChart_V (rounds, style)
{
    const container = document.getElementById('progressionChart');
    container.innerHTML = '';

    var _rounds = rounds;
    if (style === 'championship')
    {
        const splitRounds = SplitRoundsInHalf(rounds);
        _rounds = splitRounds;
    }

    //Many Rows
    //for (let i = 1; i < _rounds.length; i ++)
    for (let i = _rounds.length - 1; i > 0; i --)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        const mObjs = _rounds[i];
        //Many Cols
        for (let j = 0; j < mObjs.length; j ++)
        {
            //One Card per Col
            const col_cards = newCardGroup_col([mObjs[j]]);
            e_row.appendChild(col_cards);
        }
        container.appendChild(e_row);
    }    
}

function PopulateChart_H (rounds, style)
{
    const container = document.getElementById('progressionChart');
    container.innerHTML = '';

    var _rounds = rounds;
    if (style === 'championship')
    {
        const splitRounds = SplitRoundsInHalf(rounds);
        _rounds = splitRounds;
    }

    //One Row
    const e_row = document.createElement('div');
    e_row.className = 'row';
    //Many Cols
    for (let i = 1; i < _rounds.length; i ++)
    {
        //Many Cards per Col
        const col_cards = newCardGroup_col(_rounds[i]);
        e_row.appendChild(col_cards);
    }
    container.appendChild(e_row);
}

function SplitRoundsInHalf(rounds)
{
    var splitRounds = [];
    splitRounds[rounds.length - 1] = rounds[rounds.length - 1];
    for (var i = 1; i < rounds.length - 1; i ++)
    {
        if (rounds[i].length % 2 == 0)
        {
            splitRounds[i] = rounds[i].slice(0, rounds[i].length / 2);
            splitRounds[rounds.length * 2 - 2 - i] = rounds[i].slice(rounds[i].length / 2);
        } else 
        {
            splitRounds[i] = rounds[i].slice(0, Math.floor(rounds[i].length / 2) + 1);
            splitRounds[rounds.length * 2 - 2 - i] = rounds[i].slice(Math.floor(rounds[i].length / 2) + 1);
        }
    }

    return splitRounds;
}

const newCardGroup_col = (_mObjs) => 
{
    const e_col = document.createElement('div');
    e_col.className = 'col';

    for (var i = 0; i < _mObjs.length; i ++)
    {
        const m_Obj = _mObjs[i];
        const e_matchCard = newMatchCard(m_Obj, 'H');
        e_col.appendChild(e_matchCard);
    }

    return e_col;
} 

const newMatchCard = (m_Obj, orientation) =>
{
    //card
    const e_card = document.createElement('div');
    e_card.className = 'card';
    e_card.id = `match-card-r${m_Obj.round}-m${m_Obj.id}`;
    e_card.classList.add('match-card');

    //table
    const e_table = document.createElement('table');
    e_table.className = 'match-table';

    //rows
    const e_tr_0 = document.createElement('tr');
    const e_tr_1 = document.createElement('tr');

    //cells
    const e_td_name_H = document.createElement('td');
    const e_td_score_H = document.createElement('td');
    const e_td_name_A = document.createElement('td');
    const e_td_score_A = document.createElement('td');

    //Set Info
    const player_H = GetPlayerProfile(m_Obj.match.players?.h?.username);
    e_td_name_H.textContent = player_H.displayName || player_H.username;
    const player_A = GetPlayerProfile(m_Obj.match.players?.a?.username);
    e_td_name_A.textContent = player_A.displayName || player_A.username;
    const score_H = (m_Obj.match.results?.h != null) ? m_Obj.match.results.h.fw ? m_Obj.match.results.h.fw : 0 : 0;
    const score_A = (m_Obj.match.results?.a != null) ? m_Obj.match.results.a.fw ? m_Obj.match.results.a.fw : 0 : 0;
    e_td_score_H.textContent = score_H;
    e_td_score_A.textContent = score_A;

    //Profile Pictures
    if (player_H.pp)
    {
        const e_img_H = document.createElement('img');
        e_img_H.src = player_H.pp;
        e_img_H.className = 'match-player-pp';
        e_td_name_H.prepend(e_img_H);
    }

    if (player_A.pp)
    {
        const e_img_A = document.createElement('img');
        e_img_A.src = player_A.pp;
        e_img_A.className = 'match-player-pp';
        e_td_name_A.prepend(e_img_A);
    }

    const status = (m_Obj) =>
    {
        if (!m_Obj || !m_Obj.match || !m_Obj.match.info) return;
        if (m_Obj.match.info.status && m_Obj.match.info.status === 'Complete')
        {
            return 'complete';
        } else if (m_Obj.match.info.status && m_Obj.match.info.status === 'Live')
        {
            return 'live';
        } else if (m_Obj.match.players?.h?.username || m_Obj.match.players?.a?.username || m_Obj.match.results?.h?.fw > 0 || m_Obj.match.results?.a?.fw > 0)
        {
            return 'live';
        } else 
        {
            return 'new';
        }
    }

    const s = status(m_Obj);
    //Set Styling

        //Standard
        e_card.classList.add('match-card');
        e_table.classList.add('match-table');
        e_td_name_H.classList.add('match-player');
        e_td_name_A.classList.add('match-player');
        e_td_score_H.classList.add('match-score');
        e_td_score_A.classList.add('match-score');

        //Win/Lose
        if (s === 'complete')
        {
            e_card.classList.add('match-complete');
            if (score_H > score_A)
            {
                e_td_name_H.classList.add('match-winner');
                e_td_score_H.classList.add('match-winner');
                e_td_name_A.classList.add('match-loser');
                e_td_score_A.classList.add('match-loser');
            } else if (score_A > score_H)
            {
                e_td_name_A.classList.add('match-winner');
                e_td_score_A.classList.add('match-winner');
                e_td_name_H.classList.add('match-loser');
                e_td_score_H.classList.add('match-loser');
            }

            if (m_Obj.match.info.round == tournamentRounds.length - 1)
            {
                e_card.classList.add('match-final');
                if (score_H > score_A)
                {
                    e_td_name_H.classList.add('match-final');
                    e_td_score_H.classList.add('match-final');
                    e_td_name_A.classList.add('match-loser');
                    e_td_score_A.classList.add('match-loser');
                } else if (score_A > score_H)
                {
                    e_td_name_A.classList.add('match-final');
                    e_td_score_A.classList.add('match-final');
                    e_td_name_H.classList.add('match-loser');
                    e_td_score_H.classList.add('match-loser');
                }
            }
        } else if (s === 'live')
        {
            e_card.classList.add('match-live');
            e_td_name_H.classList.add('match-live');
            e_td_score_H.classList.add('match-live');
            e_td_name_A.classList.add('match-live');
            e_td_score_A.classList.add('match-live');
        }

    //Append All
    if (orientation === 'H')
    {
        e_tr_0.appendChild(e_td_name_H);
        e_tr_0.appendChild(e_td_score_H);
        e_tr_1.appendChild(e_td_name_A);
        e_tr_1.appendChild(e_td_score_A);
    } else if (orientation === 'V')
    {
        e_tr_0.appendChild(e_td_name_H);
        e_tr_0.appendChild(e_td_name_A);
        e_tr_1.appendChild(e_td_score_H);
        e_tr_1.appendChild(e_td_score_A);
    }

    e_table.appendChild(e_tr_0);
    e_table.appendChild(e_tr_1);
    e_card.appendChild(e_table);

    //Add style classes for all elements
    return e_card;
}

function GetPlayerProfile(username)
{
    const playerName = username;
    if (username)
    {
        for (var i = 0; i < Object.keys(tournamentPlayers).length; i ++)
        {
            var p = tournamentPlayers[i.toString()];
            if (p.username === username)
            {
                return p;
            }
        }
    } 
    return { username: playerName };
}

function DrawProgressionArrows(rounds, pathType) {
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

    // Independently choose an exit side for the start card based on direction to target
    const chooseStartSide = (startEl, endEl) => {
        const a = centerOf(startEl);
        const b = centerOf(endEl);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // Favor the dominant axis to leave the start card
        if (Math.abs(dy) > Math.abs(dx)) {
            return dy >= 0 ? 'bottom' : 'top';
        } else {
            return dx >= 0 ? 'right' : 'left';
        }
    };

    // Independently choose an entry side for the end card based on where the line is coming from
    const chooseEndSide = (startEl, endEl) => {
        const a = centerOf(startEl);
        const b = centerOf(endEl);
        const dx = a.x - b.x; // vector from end to start (so we pick the facing side)
        const dy = a.y - b.y;
        // Favor the dominant axis to enter the end card from the side that faces the start
        if (Math.abs(dy) > Math.abs(dx)) {
            return dy <= 0 ? 'top' : 'bottom';
        } else {
            return dx <= 0 ? 'left' : 'right';
        }
    };

    for (let i = 1; i < rounds.length; i++) {
        const currRound = rounds[i];
        if (!Array.isArray(currRound)) continue;

        for (let j = 0; j < currRound.length; j++) {
            const currRef = currRound[j];
            if (!currRef) continue;

            const currCard =
                currRef.card ||
                document.getElementById(`match-card-r${(currRef.round ?? currRef.match?.info?.round)}-m${currRef.id}`);
            if (!currCard) continue;

            const prevRoundIdx = Number.isInteger(currRef.precedingRound) ? currRef.precedingRound : (i - 1);
            const prevIdxs = Array.isArray(currRef.precedingMatches) ? currRef.precedingMatches : [];
            const totalIncoming = prevIdxs.length;

            prevIdxs.forEach((prevIdx, k) => {
                const prevRef = rounds[prevRoundIdx] && rounds[prevRoundIdx][prevIdx];
                if (!prevRef) return;

                const prevCard =
                    prevRef.card ||
                    document.getElementById(`match-card-r${(prevRef.round ?? prevRef.match?.info?.round)}-m${prevRef.id}`);
                if (!prevCard) return;

                // Compute start and end sides independently so they can mix (e.g., bottom -> left)
                const startSide = chooseStartSide(prevCard, currCard);
                const endSide = chooseEndSide(prevCard, currCard);

                // Distribute incoming lines across the destination edge to reduce overlap
                const endOffsetPercent = 50;

                // Keep start centered; could be advanced later if we track outgoing counts
                const startOffsetPercent = 50;

                const startAnchor = edgePointAnchor(prevCard, startSide, startOffsetPercent);
                const endAnchor = edgePointAnchor(currCard, endSide, endOffsetPercent);

                // Style based on the preceding match
                const color = getLineColor(prevRef.match);
                const dashed = getDashed(prevRef.match);

                const line = new LeaderLine(
                    startAnchor,
                    endAnchor,
                    {
                        color,
                        size: 2.5,
                        path: pathType || 'fluid',
                        startPlug: 'disc',
                        startPlugSize: 1,
                        endPlug: 'arrow3',
                        endPlugSize: 2,
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