export function UpdateTournamentUI(tournament, log, rounds, players)
{
    //console.log('UI: Tournament UI Update', tournament, log, rounds, players);
    tournamentRounds = rounds;
    tournamentPlayers = players;

    PopulateLog(log, players);
    DrawChart(tournamentRounds);
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
        if (idx % 2 === 1) {
            tr.style.backgroundColor = 'var(--color-base-02)';
        }

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


function PopulateVerticalProgressionChart (rounds)
{
    const container = document.getElementById('progressionChart-V');
    container.style.display = 'block';
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
            const e_card = CreateMatchCard(match, rounds[i][j].id, 'V');
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
    container.style.display = 'block';
    container.innerHTML = '';
    
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        if (i == rounds.length - 1)
        {
            for (let j = 0; j < rounds[i].length; j ++)
            {
                const match = rounds[i][j].match;
                const e_col = document.createElement('div');
                e_col.className = 'col';
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'V');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
                e_row.appendChild(e_col);
            }
        } else 
        {
            for (let j = 0; j < rounds[i].length / 2; j ++)
            {
                const match = rounds[i][j].match;
                const e_col = document.createElement('div');
                e_col.className = 'col';
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'V');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
                e_row.appendChild(e_col);
            }
        }
        
        container.appendChild(e_row);
    }

    for (let i = rounds.length - 1; i > 0; i --)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        if (i != rounds.length - 1) 
        {
            for (let j = Math.ceil(rounds[i].length / 2); j < rounds[i].length; j ++)
            {
                const match = rounds[i][j].match;
                const e_col = document.createElement('div');
                e_col.className = 'col';
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'V');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
                e_row.appendChild(e_col);
            }
            container.appendChild(e_row);
        }        
    }
}

function PopulateHorizontalProgressionChart (rounds)
{
    document.getElementById('progressionChart-H').style.display = 'block';
    const container = document.getElementById('prog-chart-h-container');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        for (let j = 0; j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_card = CreateMatchCard(match, rounds[i][j].id, 'H');
            rounds[i][j].card = e_card;
            e_col.appendChild(e_card);
        }
        container.appendChild(e_col);
    }
    
}

function PopulateHorizontalAltProgressionChart (rounds)
{
    document.getElementById('progressionChart-H-Alt').style.display = 'block';
    const container = document.getElementById('prog-chart-h-alt-container');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        if (i == rounds.length - 1)
        {
            for (let j = 0; j < rounds[i].length; j ++)
            {
                const match = rounds[i][j].match;
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'H');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
            }
        } else 
        {
            for (let j = 0; j < rounds[i].length / 2; j ++)
            {
                const match = rounds[i][j].match;
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'H');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
            }
        }
        
        container.appendChild(e_col);
    }
    
    for (let i = rounds.length - 1; i > 0; i --)
    {
        if (i != rounds.length - 1) // Skip last round as it's already been added
        {
            const e_col = document.createElement('div');
            e_col.className = 'col';
            for (let j = Math.ceil(rounds[i].length / 2); j < rounds[i].length; j ++)
            {
                const match = rounds[i][j].match;
                const e_card = CreateMatchCard(match, rounds[i][j].id, 'H');
                rounds[i][j].card = e_card;
                e_col.appendChild(e_card);
            }
            container.appendChild(e_col);
        }        
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

function CreateMatchCard (match, matchRefID, orientation)
{
    const e_card = document.createElement('div');
    e_card.className = 'card';
    e_card.id = `match-card-r${match.info.round}-m${matchRefID}`;
    e_card.classList.add('match-card');
    if (match.info.status === 'Complete')
    {
        e_card.classList.add('card-completed');
    } else 
    {
        e_card.classList.add('card-new');
    }
    const e_table = document.createElement('table');
    e_table.className = 'match-table';

    const e_tr_top = document.createElement('tr');
    const e_tr_bottom = document.createElement('tr');

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

    if (orientation === 'H')
    {        
        e_tr_top.appendChild(e_td_name_H);
        e_tr_bottom.appendChild(e_td_name_A);

        e_tr_top.appendChild(e_td_score_H);
        e_tr_bottom.appendChild(e_td_score_A);
    } else if (orientation === 'V')
    {
        
        e_tr_top.appendChild(e_td_name_H);
        e_tr_bottom.appendChild(e_td_score_H);

        e_tr_top.appendChild(e_td_name_A);
        e_tr_bottom.appendChild(e_td_score_A);
    }

    e_table.appendChild(e_tr_top);
    e_table.appendChild(e_tr_bottom);


    e_card.appendChild(e_table);
    return e_card;
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

const view_controlPanel = document.getElementById('view-controls-panel');

// Trigger redraw when any chartOrientation radio changes
if (view_controlPanel) {
    view_controlPanel.addEventListener('change', (e) => {
        if (e.target && e.target.matches('input[name="chartOrientation"]')) {
            DrawChart(tournamentRounds);
        }
    });
    view_controlPanel.addEventListener('change', (e) => {
        if (e.target && e.target.matches('input[name="chartStyle"]')) {
            DrawChart(tournamentRounds);
        }
    });
    view_controlPanel.addEventListener('change', (e) => {
        if (e.target && e.target.matches('input[name="pathType"], input[name="chartLineType"]')) {
            DrawChart(tournamentRounds);
        }
    });

    view_controlPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'card-spacing-increase') {
            UpdateCardMargins(true);
        } else if (btn.id === 'card-spacing-decrease') {
            UpdateCardMargins(false);
        }
    });

    view_controlPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        if (btn.id === 'card-magnification-increase') {
            MagnifyCards(true);
        } else if (btn.id === 'card-magnification-decrease') {
            MagnifyCards(false);
        }
    });
}

function DrawChart (rounds)
{
    const orientationInput = document.querySelector('input[name="chartOrientation"]:checked');
    const styleInput = document.querySelector('input[name="chartStyle"]:checked');

    const orientation = orientationInput ? orientationInput.value : 'horizontal';
    const style = styleInput ? styleInput.value : 'linear';

    const pathInput = document.querySelector('input[name="chartLineType"]:checked') || document.querySelector('input[name="chartLineType"]:checked');
    console.log(pathInput.value);
    const pathType = pathInput ? pathInput.value : 'fluid';
    console.log('DrawChart', rounds, orientation, style, pathType);

    SetView(rounds, orientation, style, pathType);
}

function SetView (rounds, orientation, style, pathType)
{
    document.getElementById('progressionChart-V').style.display = 'none';
    document.getElementById('progressionChart-V-Alt').style.display = 'none';
    document.getElementById('progressionChart-H').style.display = 'none';
    document.getElementById('progressionChart-H-Alt').style.display = 'none';
    if (orientation === 'horizontal' && style === 'linear') {PopulateHorizontalProgressionChart(rounds);};
    if (orientation === 'horizontal' && style === 'championship') {PopulateHorizontalAltProgressionChart(rounds);};
    if (orientation === 'vertical' && style === 'linear') {PopulateVerticalProgressionChart(rounds);};
    if (orientation === 'vertical' && style === 'championship') {PopulateVerticalAltProgressionChart(rounds);}
    DrawProgressionArrows(rounds, pathType);
}

function UpdateCardMargins (increase)
{
    const STEP_REM = 0.25;
    const MIN_REM = 0;
    const MAX_REM = 4;

    const getBasePx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    const parseRem = (val) => {
        if (!val) return NaN;
        const n = parseFloat(val);
        if (Number.isNaN(n)) return NaN;
        if (/\brem\b/i.test(val)) return n;
        if (/\bpx\b/i.test(val)) return +(n / getBasePx()).toFixed(3);
        return n; // assume rem if unitless
    };

    const findMatchCardRule = () => {
        for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try { rules = sheet.cssRules; } catch { continue; }
            if (!rules) continue;
            for (const rule of Array.from(rules)) {
                if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.split(',').map(s => s.trim()).includes('.match-card')) {
                    return rule;
                }
            }
        }
        return null;
    };

    const rule = findMatchCardRule();
    let currentRem = parseRem(rule?.style?.margin);

    if (Number.isNaN(currentRem)) {
        const sample = document.querySelector('.match-card');
        const comp = sample ? getComputedStyle(sample) : null;
        currentRem = parseRem(comp?.marginLeft) || 1; // default
    }

    currentRem += increase ? STEP_REM : -STEP_REM;
    currentRem = Math.min(MAX_REM, Math.max(MIN_REM, Math.round(currentRem * 100) / 100));

    if (rule) {
        rule.style.margin = `${currentRem}rem`;
    } else {
        // Fallback: inject/replace a simple override for .match-card
        let styleEl = document.getElementById('match-card-dynamic-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'match-card-dynamic-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `.match-card { margin: ${currentRem}rem; }`;
    }

    if (window.__tournamentLines && Array.isArray(window.__tournamentLines)) {
        requestAnimationFrame(() => {
            window.__tournamentLines.forEach(l => { try { l.position(); } catch {} });
        });
    }
}

function MagnifyCards (increase)
{
    const STEP = 0.1;
    const MIN = 0.5;
    const MAX = 3;

    const cards = document.querySelectorAll('.match-card');
    if (!cards.length) return;

    const current = typeof window.__matchCardScale === 'number' ? window.__matchCardScale : 1;
    let next = current + (increase ? STEP : -STEP);
    next = Math.min(MAX, Math.max(MIN, Math.round(next * 100) / 100));
    window.__matchCardScale = next;

    cards.forEach(card => {
        if (!card.dataset.baseTransform) {
            const t = getComputedStyle(card).transform;
            card.dataset.baseTransform = t && t !== 'none' ? t : '';
        }
        card.style.transformOrigin = card.style.transformOrigin || 'center center';
        const base = card.dataset.baseTransform || '';
        card.style.transform = `${base} scale(${next})`.trim();
    });

    const lines = window.__tournamentLines;
    if (Array.isArray(lines) && lines.length) {
        requestAnimationFrame(() => {
            lines.forEach(l => { try { l.position(); } catch {} });
        });
    }
}