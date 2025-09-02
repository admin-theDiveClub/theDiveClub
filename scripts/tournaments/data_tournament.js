var tournament = null;
var matches = null;
var leaderboard = null;
var tournamentRounds = null;

Start();

async function Start ()
{
    const tournamentID = GetTournamentID();
    if (!tournamentID) 
    {
        alert("No tournament ID found");
        return;
    } else 
    {
        console.log("Tournament ID: " + tournamentID);
        tournament = await GetTournament(tournamentID);
        if (tournament) 
        {
            console.log("Tournament" , tournament);
            matches = await GetTournamentMatches(tournamentID);
            if (matches) 
            {
                console.log("Matches: ", matches);
                leaderboard = CompileTournamentData(tournament, matches);
                UpdateUI(tournament, matches, leaderboard);
                tournamentRounds = CreateRoundsData(matches);
                console.log("Tournament Rounds: ", tournamentRounds);
                CreateTournamentVisualization(tournamentRounds);
                SubscribeToUpdates(matches);
            }
        }
    }
}

function SubscribeToUpdates (_matches)
{
    // unsubscribe previous subscription if any
    try {
        if (window._tournamentMatchesSub) {
            try { supabase.removeSubscription?.(window._tournamentMatchesSub); } catch (e) { /* ignore */ }
            try { window._tournamentMatchesSub?.unsubscribe?.(); } catch (e) { /* ignore */ }
            window._tournamentMatchesSub = null;
        }
    } catch (e) { /* ignore */ }

    if (!Array.isArray(_matches) || _matches.length === 0) return;

    const ids = new Set(_matches.map(m => m && m.id).filter(Boolean));
    if (ids.size === 0) return;

    // debounce refresh to avoid many rapid Start() calls
    const debouncedRefresh = debounce(() => {
        try { Start(); } catch (e) { console.error('Failed to refresh after realtime change', e); }
    }, 250);

    const handler = (payload) => {
        const event = payload?.eventType ?? payload?.event ?? payload?.type ?? '';
        const rec = payload?.new ?? payload?.record ?? payload?.old ?? null;
        const id = rec?.id ?? null;
        if (!id || !ids.has(id)) return;

            matchUpdated = payload.new;
            console.log("Match updated: ", matchUpdated);
            console.log("Matches: ", matches);
            // Replace matching entry in `matches` with the updated record (or insert if not found)
            (() => {
                const updated = (typeof matchUpdated !== 'undefined' && matchUpdated) ? matchUpdated : rec;
                if (!updated || !Array.isArray(matches)) return;
                const id = updated.id;
                const idx = matches.findIndex(m => m && m.id === id);
                if (idx !== -1) {
                    matches[idx] = updated;
                } else {
                    matches.push(updated);
                }
            })();
            leaderboard = CompileTournamentData(tournament, matches);
            UpdateUI(tournament, matches, leaderboard);
            tournamentRounds = CreateRoundsData(matches);
            console.log("Tournament Rounds: ", tournamentRounds);
            CreateTournamentVisualization(tournamentRounds);

        // Refresh UI/state when relevant changes occur
        if (['INSERT', 'UPDATE', 'DELETE'].includes(String(event).toUpperCase()) || payload?.new || payload?.old) {
            debouncedRefresh();
        }
    };

    // Try the common subscription API first
    try {
        const sub = supabase.from('tbl_matches').on('*', handler).subscribe();
        window._tournamentMatchesSub = sub;
        console.log("Subscribed to tbl_matches changes");
        return;
    } catch (e) {
        // fall through to channel-based subscription
    }

    // Fallback: channel/postgres_changes style
    try {
        const ch = supabase
            .channel('realtime:tbl_matches')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_matches' }, handler)
            .subscribe();
        window._tournamentMatchesSub = ch;
        console.log("Subscribed to realtime:tbl_matches changes");
    } catch (e) {
        console.error('Failed to create realtime subscription for matches', e);
    }
}

function GetTournamentID()
{
    var tournamentID = new URLSearchParams(window.location.search).get('tournamentID');
    if (!tournamentID)
    {
        tournamentID = localStorage.getItem('tournamentID') || sessionStorage.getItem('tournamentID') || null;
    }

    if (tournamentID)
    {
        sessionStorage.setItem('tournamentID', tournamentID);
        localStorage.setItem('tournamentID', tournamentID);
        return tournamentID;
    } else 
    {
        return null;
    }
}

async function GetTournament (_tournamentID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _tournamentID);
    return response.data[0];
}

async function GetTournamentMatches (_tournamentID)
{
    const response = await supabase
        .from('tbl_matches')
        .select('*')
        .eq('competitions->>tournamentID', _tournamentID)
        .order('info->>round', { ascending: true })
        .order('createdAt', { ascending: true });
    return response.data;
}

function CompileTournamentData(tournament, matches)
{
    const leaderboard = (tournament?.players || []).map((username) => {
        // Find all matches where this player participated
        const playerMatches = matches.filter(match => {
            const playersObj = match && match.players ? match.players : {};
            return Object.values(playersObj).some(p => {
                const id = p?.username ?? p?.fullName ?? p?.nickname ?? p?.name ?? null;
                return id === username;
            });
        });

        // Aggregate stats
        // Only consider matches where match.info.status is "Complete"
        const completedMatches = playerMatches.filter(match => match?.info && match.info.status === "Complete");
        // Get player's display name (nickname > fullName > username)
        let PlayerName = null;
        if (playerMatches.length > 0) {
            // Use the first completed match to get the name
            const match = completedMatches[0] || playerMatches[0];
            const side = Object.keys(match.players || {}).find(k => {
                const p = match.players?.[k];
                const id = p?.username ?? p?.fullName ?? p?.nickname ?? p?.name ?? null;
                return id === username;
            });
            const playerObj = side ? match.players?.[side] : null;
            if (playerObj)
            {
                PlayerName = playerObj.nickname ? (playerObj.nickname !== "Guest" ? playerObj.nickname : playerObj.fullName ? playerObj.fullName : playerObj.username ? playerObj.username : username) : username;
            } else {
                PlayerName = username || "";
            }
        } else {
            PlayerName = username;
        }
        let MP = completedMatches.length; // Matches Played
        let MW = 0; // Matches Won
        let L = 0; // Matches Lost
        let FP = 0; // Frames Played
        let FW = 0; // Frames Won
        let BF = 0; // Breaks (for example, total 'breaks.in')
        
        playerMatches.forEach(match => {
            // Find which side the player was on ('a' or 'h')
            const side = Object.keys(match.players || {}).find(k => {
                const p = match.players?.[k];
                const id = p?.username ?? p?.fullName ?? p?.nickname ?? p?.name ?? null;
                return id === username;
            });
            const results = (side && match.results && match.results[side]) ? match.results[side] : {};

            // Example logic for MW/L (needs real win/loss logic, here just placeholder)
            // If results.fw > results of opponent, count as win
            const opponentSide = side === 'a' ? 'h' : side === 'h' ? 'a' : null;
            const opponentResults = opponentSide && match.results && match.results[opponentSide] ? match.results[opponentSide] : {};
            if (match.info && match.info.status === "Complete") 
            {
                if ((results.fw || 0) > (opponentResults.fw || 0)) MW++;
                else if ((results.fw || 0) < (opponentResults.fw || 0)) L++;
            }

            FP += (results.fw || 0) + (opponentResults.fw || 0);
            FW += (results.fw || 0);
            BF += results.bf || 0;
        });

        // Frame Win Percentage
        const FPercent = FP > 0 ? ((FW / FP) * 100).toFixed(1) + "%" : "0%";

        return {
            player: PlayerName,
            MP,
            MW,
            L,
            FP,
            FW,
            FPercent,
            BF
        };
    });

    // Sort leaderboard by MW, FW, etc. (example: MW descending, then FW descending)
    leaderboard.sort((a, b) => b.MW - a.MW || b.FW - a.FW);

    // Add rank
    leaderboard.forEach((entry, idx) => entry.rank = idx + 1);

    console.log("Leaderboard: ", leaderboard);
    return leaderboard;
}


function CreateRoundsData(_matches) {
    const tournamentRounds = {};
    if (!Array.isArray(_matches)) return tournamentRounds;

    // Build per-round arrays preserving order of _matches
    const roundMap = new Map(); // key = normalizedRaw, value = { raw, numeric|null, arr: [] }

    _matches.forEach((m) => {
        const rawVal = getMatchRound(m);
        const normalizedRaw = (rawVal == null || String(rawVal).trim() === "") ? "" : String(rawVal).trim();
        const numeric = (/^\d+$/.test(normalizedRaw)) ? parseInt(normalizedRaw, 10) : null;

        if (!roundMap.has(normalizedRaw)) {
            roundMap.set(normalizedRaw, { raw: normalizedRaw, numeric, arr: [] });
        }
        const rd = roundMap.get(normalizedRaw);
        rd.arr.push({
            matchIndex: rd.arr.length,
            match: m
        });
    });

    // Sort rounds by numeric when available, otherwise by locale string
    const sortedRounds = Array.from(roundMap.values()).sort((a, b) => {
        if (a.numeric != null && b.numeric != null) return a.numeric - b.numeric;
        if (a.numeric != null && b.numeric == null) return -1;
        if (a.numeric == null && b.numeric != null) return 1;
        return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Populate tournamentRounds object with arrays and compute preceding info
    sortedRounds.forEach((rd, idx) => {
        // choose key: numeric when available else raw string (empty string allowed for unclassified)
        const key = rd.numeric != null ? rd.numeric : rd.raw;
        tournamentRounds[key] = rd.arr.map(obj => Object.assign({}, obj)); // shallow copy

        // if not the first round, compute precedingRound and precedingMatches for each match
        if (idx > 0) {
            const prev = sortedRounds[idx - 1];
            const prevKey = prev.numeric != null ? prev.numeric : prev.raw;
            const prevCount = (prev.arr || []).length;

            tournamentRounds[key].forEach((matchObj) => {
                const j = matchObj.matchIndex;
                const a = j * 2;
                const b = j * 2 + 1;
                if (prevCount === 0) {
                    matchObj.precedingRound = prevKey;
                    matchObj.precedingMatches = [];
                    return;
                }
                const idxA = Math.min(a, prevCount - 1);
                const idxB = Math.min(b, prevCount - 1);
                const pairs = idxA === idxB ? [idxA] : [idxA, idxB];
                matchObj.precedingRound = prevKey;
                matchObj.precedingMatches = pairs;
            });
        }
    });

    // Asynchronously attempt to auto-populate winners from preceding completed matches.
    // This runs in background (fire-and-forget) so CreateRoundsData stays synchronous.
    (async () => {
        try {
            const updates = []; // { matchId, side, playerObj, newPlayersObj (after change) }

            const getIdOf = (p) => p?.username ?? p?.fullName ?? p?.nickname ?? p?.name ?? null;

            // Iterate rounds (preserving sorted order)
            for (let r = 1; r < sortedRounds.length; r++) {
                const curr = sortedRounds[r];
                const prev = sortedRounds[r - 1];
                const currKey = curr.numeric != null ? curr.numeric : curr.raw;
                const prevKey = prev.numeric != null ? prev.numeric : prev.raw;
                const prevArr = tournamentRounds[prevKey] || [];
                const currArr = tournamentRounds[currKey] || [];

                for (const matchObj of currArr) {
                    const currMatch = matchObj.match;
                    if (!matchObj.precedingMatches || matchObj.precedingMatches.length === 0) continue;

                    // map preceding index 0 -> 'h', 1 -> 'a'
                    for (let pIndex = 0; pIndex < matchObj.precedingMatches.length; pIndex++) {
                        const side = pIndex === 0 ? 'h' : 'a';
                        const prevIdx = matchObj.precedingMatches[pIndex];
                        const prevObj = prevArr[prevIdx];
                        if (!prevObj || !prevObj.match) continue;

                        const prevMatch = prevObj.match;
                        if (!prevMatch.info || (prevMatch.info.status || "") !== "Complete") continue;

                        // Determine winner of prevMatch by comparing results.fw
                        const ra = (prevMatch.results && prevMatch.results.a) ? (prevMatch.results.a.fw || 0) : 0;
                        const rh = (prevMatch.results && prevMatch.results.h) ? (prevMatch.results.h.fw || 0) : 0;
                        if (ra === rh) continue; // no winner or draw

                        const winnerSide = ra > rh ? 'a' : 'h';
                        const winnerPlayer = prevMatch.players ? prevMatch.players[winnerSide] : null;
                        if (!winnerPlayer) continue;

                        // Current slot value and identity check
                        currMatch.players = currMatch.players || {};
                        const currentPlayer = currMatch.players[side] || null;

                        const currId = getIdOf(currentPlayer);
                        const winnerId = getIdOf(winnerPlayer);

                        // If current is already the winner -> do nothing
                        if (currId && winnerId && currId === winnerId) continue;

                        // If current is non-null but different -> do nothing
                        if (currentPlayer && (!currId || currId !== winnerId)) continue;

                        // Otherwise current is null, set it to winner and persist
                        const newPlayers = Object.assign({}, currMatch.players);
                        newPlayers[side] = clonePlayer(winnerPlayer);

                        updates.push({ matchId: currMatch.id, newPlayers, matchRef: currMatch, side, winnerId });
                        // Only assign the first applicable preceding completed match for this side.
                        break;
                    }
                }
            }

            if (updates.length === 0) return;

            // Persist sequentially to avoid race conditions and refresh at end
            for (const u of updates) {
                try {
                    await saveMatchPlayers(u.matchId, u.newPlayers);
                } catch (e) {
                    console.error('Failed to auto-assign winner to match', u.matchId, e);
                }
            }

            // Refresh entire UI/flow once after updates
            await Start();
        } catch (e) {
            console.error('Error in auto-assigning preceding winners', e);
        }
    })();

    return tournamentRounds;
}
    
function CreateTournamentVisualization(tournamentRounds) 
{
    const row = document.querySelector('#tournament-visualization .card-body .row');
    if (!row) return;
    row.innerHTML = '';

    const keys = Object.keys(tournamentRounds || {});
    if (keys.length === 0) return;

    // numeric-aware sort of round keys
    keys.sort((a, b) => {
        const na = /^\d+$/.test(String(a)) ? parseInt(a, 10) : Number.POSITIVE_INFINITY;
        const nb = /^\d+$/.test(String(b)) ? parseInt(b, 10) : Number.POSITIVE_INFINITY;
        if (na !== nb) return na - nb;
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    });

    // Precompute left/right halves per round (right half is for mirror column).
    const splits = new Map();
    keys.forEach((k, idx) => {
        const arr = Array.isArray(tournamentRounds[k]) ? tournamentRounds[k] : [];
        if (idx === keys.length - 1) {
            // Last round: do not split
            splits.set(k, { left: arr, right: [] });
        } else {
            const half = Math.ceil(arr.length / 2); // left gets first half, right gets second half
            splits.set(k, { left: arr.slice(0, half), right: arr.slice(half) });
        }
    });

    // Build ordered columns: left side ascending, then mirrored right side descending (excluding last)
    const columns = [];
    keys.forEach(k => {
        const { left } = splits.get(k) || { left: [] };
        columns.push({ label: k, items: left, extraClass: 'bracket-left' });
    });
    for (let i = keys.length - 2; i >= 0; i--) {
        const k = keys[i];
        const { right } = splits.get(k) || { right: [] };
        columns.push({ label: k, items: right, extraClass: 'bracket-right' });
    }

    // Distribute 12-grid width across all columns with preference to final round column
    const totalCols = Math.max(1, columns.length);
    const baseSize = Math.floor(12 / totalCols);
    let remainder = 12 % totalCols;

    // Final round column index is the last "left" column
    const finalColIndex = Math.max(0, Math.min(totalCols - 1, keys.length - 1));

    // Priority order: final column first, then expand outward (left, right, left, right, ...)
    const order = [finalColIndex];
    for (let d = 1; order.length < totalCols; d++) {
        const left = finalColIndex - d;
        const right = finalColIndex + d;
        if (left >= 0) order.push(left);
        if (right < totalCols) order.push(right);
    }

    // Assign remainder (+1) starting with the final round column
    const bonus = new Array(totalCols).fill(0);
    for (let i = 0; i < order.length && remainder > 0; i++) {
        bonus[order[i]] = 1;
        remainder--;
    }

    const sizeForIndex = (idx) => {
        const b = bonus[idx] || 0;
        return Math.max(1, Math.min(12, baseSize + b));
    };

    // Helper to create a match-mini card (accepts the original item obj so we can attach metadata)
    const createMatchMini = (itemObj, roundKey) => {
        const match = itemObj && itemObj.match ? itemObj.match : itemObj;
        const matchIndex = (typeof itemObj.matchIndex !== 'undefined') ? itemObj.matchIndex : null;
        const card = document.createElement('div');
        card.className = 'card match-mini';
        // Attach metadata for arrow drawing
        if (match && match.id) card.dataset.matchId = match.id;
        if (matchIndex != null) card.dataset.matchIndex = String(matchIndex);
        if (typeof itemObj.precedingRound !== 'undefined') card.dataset.precedingRound = String(itemObj.precedingRound);
        if (Array.isArray(itemObj.precedingMatches)) card.dataset.precedingMatches = JSON.stringify(itemObj.precedingMatches);
        card.dataset.round = String(roundKey ?? '');
        card.dataset.status = (match && match.info && match.info.status) ? match.info.status : '';

        // Add classes based on status / players:
        const status = (match && match.info && match.info.status) ? match.info.status : "";
        if (status === "Complete") {
            card.classList.add('match-complete');
        } else {
            // not complete: if both players present, mark as active
            const pA = match && match.players && match.players.a && match.players.a.username;
            const pH = match && match.players && match.players.h && match.players.h.username;
            if (pA != null && pH != null) {
                card.classList.add('match-active');
            }
        }

        // Compute frame wins for both sides (numeric) to mark winner cells when complete
        const fwA = Number((match && match.results && match.results.a && match.results.a.fw) ?? 0) || 0;
        const fwH = Number((match && match.results && match.results.h && match.results.h.fw) ?? 0) || 0;
        const winnerSide = (status === "Complete" && fwA !== fwH) ? (fwA > fwH ? 'a' : 'h') : null;

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        const mkRow = (side) => {
            const tr = document.createElement('tr');
            const tdPlayer = document.createElement('td');
            tdPlayer.className = 'match-player';
            const p = match && match.players && match.players[side];
            var pName = null;
            if (p)
            {
                pName = p.nickname ? p.nickname === 'Guest' ? null : p.nickname : null;
                if (!pName)
                {
                    pName = p.fullName ? p.fullName : p.username ? p.username : 'null';
                }
            }
            
            tdPlayer.textContent = pName ? pName : '-';

            const tdScore = document.createElement('td');
            tdScore.className = 'match-score';
            const score = match && match.results && match.results[side] && typeof match.results[side].fw !== 'undefined'
                ? String(match.results[side].fw)
                : '0';
            tdScore.textContent = score;

            // If match is complete and this side is the winner, add 'cell-win' to the player's td(s)
            if (winnerSide && winnerSide === side) 
            {
                tdScore.classList.add('cell-win');
            }

            tr.appendChild(tdPlayer);
            tr.appendChild(tdScore);
            return tr;
        };

        tbody.appendChild(mkRow('h'));
        tbody.appendChild(mkRow('a'));
        table.appendChild(tbody);
        card.appendChild(table);
        return card;
    };

    const renderColumn = (labelKey, items, extraClass, colSize) => {
        const colDiv = document.createElement('div');
        colSize = Math.max(1, Math.min(12, colSize | 0));
        colDiv.className = `col-${colSize} col-tournamentVisualization${extraClass ? ' ' + extraClass : ''}`;

        const header = document.createElement('div');
        header.className = 'round-header';
        header.textContent = roundLabelFromValue(labelKey);
        colDiv.appendChild(header);

        items.forEach(obj => {
            // pass the original obj (so we can read precedingMatches, matchIndex, etc)
            const el = createMatchMini(obj, labelKey);
            colDiv.appendChild(el);
        });

        row.appendChild(colDiv);
    };

    // Render columns with width distribution
    columns.forEach((col, idx) => {
        renderColumn(col.label, col.items, col.extraClass, sizeForIndex(idx));
    });

    // After DOM insertion, draw arrows
    // Delay briefly to ensure layout finalized
    setTimeout(() => {
        DrawTournamentProgressionArrows();
    }, 60);
}

function DrawTournamentProgressionArrows ()
{
    // Guard: leader-line library must exist
    if (typeof LeaderLine === 'undefined') {
        // nothing to do if leaderline not available
        console.warn('LeaderLine library is not loaded');
        return;
    }

    // Remove previous lines if any
    try {
        if (window._tournamentLeaderLines && Array.isArray(window._tournamentLeaderLines)) {
            window._tournamentLeaderLines.forEach(l => {
                try { l.remove(); } catch (e) { /* ignore */ }
            });
        }
    } catch (e) {
        console.error('Error clearing previous leader lines', e);
    }
    window._tournamentLeaderLines = [];

    // Find all destination match elements that declare precedingMatches
    const allMatches = Array.from(document.querySelectorAll('.match-mini'));
    if (allMatches.length === 0) return;

    // Helper to find element by round key and matchIndex
    const findMatchElement = (roundKey, matchIndex) => {
        // roundKey may be number or string; use stringified form
        const rk = String(roundKey ?? '');
        return document.querySelector(`.match-mini[data-round="${rk}"][data-match-index="${String(matchIndex)}"]`);
    };

    // Helper: determine whether an element is in left or right bracket column
    const getBracketSideFor = (el) => {
        if (!el) return null;
        const col = el.closest('.col-tournamentVisualization');
        if (!col) return null;
        if (col.classList.contains('bracket-right')) return 'right';
        if (col.classList.contains('bracket-left')) return 'left';
        return null;
    };

    // map socket -> anchor options for leader-line pointAnchor
    const anchorForSocket = (socket) => {
        switch ((socket || '').toLowerCase()) {
            case 'left': return { x: '-2%', y: '50%' };
            case 'right': return { x: '102%', y: '50%' };
            default: return { x: '50%', y: '50%' };
        }
    };

    const createdLines = [];

    allMatches.forEach(destEl => {
        const rawPrevRound = destEl.dataset.precedingRound;
        const rawPrevMatches = destEl.dataset.precedingMatches;
        if (!rawPrevRound || !rawPrevMatches) return;

        let prevMatches;
        try {
            prevMatches = JSON.parse(rawPrevMatches);
            if (!Array.isArray(prevMatches)) return;
        } catch (e) {
            return;
        }

        prevMatches.forEach(pmIdx => {
            const sourceEl = findMatchElement(rawPrevRound, pmIdx);
            if (!sourceEl) return;

            // compute sockets based on column bracket side primarily (mirror logic)
            const srcBracket = getBracketSideFor(sourceEl);
            const dstBracket = getBracketSideFor(destEl);

            let startSocket = 'right';
            let endSocket = 'left';

            // If both source and destination are in the right-side (mirrored) columns,
            // invert sockets so arrows go from left of source to right of destination.
            if (srcBracket === 'right' && dstBracket === 'right') {
                startSocket = 'left';
                endSocket = 'right';
            } else {
                // otherwise, decide left/right based on horizontal geometry only
                const sRect = sourceEl.getBoundingClientRect();
                const dRect = destEl.getBoundingClientRect();

                // If source is entirely to the left of destination, arrow goes right->left (source right -> dest left)
                if (sRect.right <= dRect.left) {
                    startSocket = 'right';
                    endSocket = 'left';
                } else {
                    // otherwise point from left side of source to right side of destination
                    startSocket = 'left';
                    endSocket = 'right';
                }
            }

            // Style: color depending on completion of source match (green if complete, gray otherwise)
            const srcStatus = (sourceEl.dataset.status || '').toLowerCase();
            const color = srcStatus === 'complete' ? 'rgb(229, 21, 119)' : 'rgb(2, 200, 237)';

            // Determine anchor points consistent with sockets
            const startAnchorOpts = anchorForSocket(startSocket);
            const endAnchorOpts = anchorForSocket(endSocket);

            // Create the leader line using a smooth path ("fluid").
            // If fluid not supported in fallback, use "arc".
            try {
                const line = new LeaderLine(
                    LeaderLine.pointAnchor(sourceEl, startAnchorOpts),
                    LeaderLine.pointAnchor(destEl, endAnchorOpts),
                    {
                        startSocket,
                        endSocket,
                        color,
                        size: 1.6,
                        path: 'fluid',        // smooth curved path
                        startPlug: 'disc',
                        endPlug: 'arrow1',
                        // tighten the curve a bit for better visuals
                        startPlugSize: 2,
                        endPlugSize: 2,
                        dash: { animation: true }
                    }
                );

                createdLines.push(line);
            } catch (e) {
                // fallback simpler constructor if pointAnchor or 'fluid' isn't available
                try {
                    const line = new LeaderLine(sourceEl, destEl, {
                        startSocket,
                        endSocket,
                        color,
                        size: 1.6,
                        path: 'arc', // smooth curved fallback
                        startPlug: 'disc',
                        endPlug: 'arrow1'
                    });
                    createdLines.push(line);
                } catch (ex) {
                    // ignore failures for a particular connection
                }
            }
        });
    });

    // store globally so we can remove later
    window._tournamentLeaderLines = createdLines;

    // on resize/scroll update positions (debounced)
    if (window._tournamentLeaderLinesResizeHandler) {
        window.removeEventListener('resize', window._tournamentLeaderLinesResizeHandler);
        window.removeEventListener('scroll', window._tournamentLeaderLinesResizeHandler, true);
        clearTimeout(window._tournamentLeaderLinesResizeTimer);
    }

    window._tournamentLeaderLinesResizeTimer = null;
    window._tournamentLeaderLinesResizeHandler = () => {
        if (window._tournamentLeaderLinesResizeTimer) clearTimeout(window._tournamentLeaderLinesResizeTimer);
        window._tournamentLeaderLinesResizeTimer = setTimeout(() => {
            try {
                (window._tournamentLeaderLines || []).forEach(l => {
                    try { l.position(); } catch (e) { /* ignore */ }
                });
            } catch (e) { /* ignore */ }
        }, 80);
    };

    window.addEventListener('resize', window._tournamentLeaderLinesResizeHandler);
    window.addEventListener('scroll', window._tournamentLeaderLinesResizeHandler, true);
}


// Shared selection state across UI parts
let activeSelection = null; // { type: 'eligible'|'match', el, player?, matchId?, side? }

// Persist selected round per tournament
const SELECTED_ROUND_KEY = (tid) => `tournament:${tid}:selectedRound`;
function saveSelectedRoundRaw(raw) {
    const tid = GetTournamentID();
    if (!tid) return;
    const key = SELECTED_ROUND_KEY(tid);
    if (raw == null) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    } else {
        sessionStorage.setItem(key, String(raw));
        localStorage.setItem(key, String(raw));
    }
}
function loadSelectedRoundRaw() {
    const tid = GetTournamentID();
    if (!tid) return null;
    const key = SELECTED_ROUND_KEY(tid);
    return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? null;
}

// Helpers
function displayName(p) {
    if (!p) return "";
    var pName = p.nickname ? p.nickname === 'Guest' ? null : p.nickname : null;
    if (!pName)
    {
        pName = p.fullName ? p.fullName : p.username ? p.username : 'null';
    }
    return pName;
}
function clonePlayer(p) {
    return p ? JSON.parse(JSON.stringify(p)) : null;
}
function clearActiveSelection() {
    if (activeSelection?.el) {
        activeSelection.el.classList.remove('is-active', 'btn-active');
    }
    activeSelection = null;
}
function setActiveSelection(sel) {
    if (activeSelection?.el && activeSelection.el !== sel.el) {
        activeSelection.el.classList.remove('is-active', 'btn-active');
    }
    activeSelection = sel;
    if (activeSelection?.el) activeSelection.el.classList.add('is-active', 'btn-active');
}
async function saveMatchPlayers(matchId, players) {
    try {
        const { error } = await supabase.from('tbl_matches').update({ players }).eq('id', matchId);
        if (error) 
        {
            console.error('Failed to save match players', error);
        } else 
        {
            await Start(); // Refresh entire UI for simplicity
        }
    } catch (e) {
        console.error('Exception saving match players', e);
    }
}
async function saveMatchResults(matchId, results) {
    try {
        const { error } = await supabase.from('tbl_matches').update({ results }).eq('id', matchId);
        if (error) 
        {
            console.error('Failed to save match results', error);
        } else 
        {
            await Start(); // Refresh entire UI for simplicity
        }
    } catch (e) {
        console.error('Exception saving match results', e);
    }
}
async function saveMatchInfo(matchId, info) {
    try {
        const { error } = await supabase.from('tbl_matches').update({ info }).eq('id', matchId);
        if (error) {
            console.error('Failed to save match info', error);
        } else {
            await Start(); // Refresh entire UI for simplicity
        }
    } catch (e) {
        console.error('Exception saving match info', e);
    }
}
function parseFw(val) {
    if (val === "" || val == null) return null;
    const n = parseInt(String(val).replace(/[^\d-]/g, ''), 10);
    return isNaN(n) ? null : Math.max(0, n);
}
function debounce(fn, wait = 400) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}
function buildPlayersIndex(tournament, matches) {
    const byUsername = new Map();
    const byDisplay = new Map();
    // Seed from matches
    (matches || []).forEach(m => {
        if (!m || !m.players) return;
        ['a','h'].forEach(side => {
            const p = m.players[side];
            if (!p) return;
            const uname = p.username || p.fullName || p.nickname || p.name;
            if (!uname) return;
            if (!byUsername.has(uname)) byUsername.set(uname, clonePlayer(p));
            const disp = displayName(p);
            if (disp && !byDisplay.has(disp)) byDisplay.set(disp, clonePlayer(p));
        });
    });
    // Ensure tournament usernames exist at least with username only
    (tournament?.players || []).forEach(uname => {
        if (!byUsername.has(uname)) {
            const p = { id: null, username: uname };
            byUsername.set(uname, p);
            if (!byDisplay.has(uname)) byDisplay.set(uname, p);
        }
    });
    return { byUsername, byDisplay };
}

// Round helpers and UI
function getMatchRound(match) {
    // Try common locations for round info
    return match?.round ?? match?.info?.round ?? match?.stage ?? match?.meta?.round ?? null;
}
function roundLabelFromValue(val) {
    if (val == null || String(val).trim() === "") return "Unclassified";
    const raw = String(val).trim();
    // If purely numeric, format as "Round N", else keep as-is
    if (/^\d+$/.test(raw)) return `Round ${parseInt(raw, 10)}`;
    return raw;
}
function UpdateRoundsButtons(matches, playersIndex) {
    const container = document.getElementById("rounds-buttons");
    if (!container) return;

    const roundSet = new Set();
    (matches || []).forEach(m => {
        const r = getMatchRound(m);
        if (r == null || String(r).trim() === "") roundSet.add("Unclassified");
        else roundSet.add(String(r).trim());
    });
    if (roundSet.size === 0) roundSet.add("Unclassified");

    const rounds = Array.from(roundSet).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    container.innerHTML = "";
    rounds.forEach(val => {
        const btn = document.createElement("button");
        btn.className = "btn-standard";
        btn.textContent = roundLabelFromValue(val);
        // Store the raw value for future filtering logic
        btn.dataset.round = val === "Unclassified" ? "" : val;

        btn.addEventListener('click', () => {
            const currentActive = container.querySelector('button.is-active');

            // Toggle off if clicking the already-active round (show all matches)
            if (currentActive === btn) {
                btn.classList.remove('is-active', 'btn-active');
                saveSelectedRoundRaw(null);
                UpdateRoundsMatchesUI(matches, playersIndex); // show all matches
                return;
            }

            // Activate this button and filter
            if (currentActive) currentActive.classList.remove('is-active', 'btn-active');
            btn.classList.add('is-active', 'btn-active');

            const raw = btn.dataset.round || "";
            saveSelectedRoundRaw(raw);
            const filtered = (matches || []).filter(m => {
                const r = getMatchRound(m);
                const rRaw = (r == null || String(r).trim() === "") ? "" : String(r).trim();
                return rRaw === raw;
            });

            UpdateRoundsMatchesUI(filtered, playersIndex);
        });

        container.appendChild(btn);
    });

    // Restore previously selected round (if any)
    const savedRaw = loadSelectedRoundRaw();
    if (savedRaw != null) {
        const toActivate = Array.from(container.querySelectorAll('button'))
            .find(b => (b.dataset.round ?? "") === (savedRaw ?? ""));
        if (toActivate) {
            toActivate.classList.add('is-active', 'btn-active');
            const raw = toActivate.dataset.round || "";
            const filtered = (matches || []).filter(m => {
                const r = getMatchRound(m);
                const rRaw = (r == null || String(r).trim() === "") ? "" : String(r).trim();
                return rRaw === raw;
            });
            UpdateRoundsMatchesUI(filtered, playersIndex);
            return;
        } else {
            // Saved round no longer exists; clear it
            saveSelectedRoundRaw(null);
        }
    }
    // Default: show all
    UpdateRoundsMatchesUI(matches, playersIndex);
}

function UpdateUI(tournament, matches, leaderboard)
{
    const playersIndex = buildPlayersIndex(tournament, matches);
    UpdateLeaderboardUI(leaderboard);
    UpdateEligiblePlayersUI(tournament, matches, leaderboard, playersIndex);
    UpdateRoundsButtons(matches, playersIndex);
    // Do not call UpdateRoundsMatchesUI here; UpdateRoundsButtons applies persisted filter or shows all.
}

function UpdateLeaderboardUI (leaderboard)
{
    const tbody = document.querySelector("#tournament-data .table-ranking tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    // Row colors
    const rowColorA = "rgb(59, 60, 87)"; // primary row color
    const rowColorB = "rgb(36, 36, 65)"; // alternate row color

    leaderboard.forEach((entry, idx) => {
        const tr = document.createElement("tr");
        tr.style.backgroundColor = (idx % 2 === 0) ? rowColorA : rowColorB;
        tr.innerHTML = `
            <td>${entry.rank}</td>
            <td>${entry.player}</td>
            <td>${entry.MP}</td>
            <td>${entry.MW}</td>
            <td>${entry.L}</td>
            <td>${entry.FP}</td>
            <td>${entry.FW}</td>
            <td>${entry.FPercent}</td>
            <td>${entry.BF}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Wire "Randomize" button to shuffle eligible players order and update tournament.players in DB
(function wireRandomizeEligibleButton() {
    const btn = Array.from(document.querySelectorAll('button.btn-standard'))
        .find(b => (b.textContent || '').trim().toLowerCase() === 'randomize');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    const shuffle = (arr) => {
        const a = Array.isArray(arr) ? arr.slice() : [];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    btn.addEventListener('click', async (ev) => {
        ev?.preventDefault?.();

        // Ensure we have the latest data
        const t = tournament;
        const m = matches;
        let lb = leaderboard;

        if (!t || !Array.isArray(m)) {
            console.warn('Cannot randomize eligible players: tournament or matches missing');
            return;
        }

        // If leaderboard not available, compute it
        if (!Array.isArray(lb)) {
            lb = CompileTournamentData(t, m) || [];
        }

        // Shuffle a copy of the leaderboard so other UIs (ranking) remain intact
        const shuffledLeaderboard = shuffle(lb);

        // Build players index for resolving usernames/display names
        const playersIndex = buildPlayersIndex(t, m);

        // Construct new players list for tournament.players using usernames only
        const newPlayers = shuffledLeaderboard.map(entry => {
            const disp = entry.player;
            // Prefer lookup by display -> player object with username
            const byDisp = playersIndex.byDisplay.get(disp);
            if (byDisp && byDisp.username) return byDisp.username;

            // If the display string actually is a username present in byUsername map
            if (playersIndex.byUsername.has(disp)) return disp;

            // Try to match by comparing known player objects' displayName
            for (const [uname, pobj] of playersIndex.byUsername.entries()) {
                if (displayName(pobj) === disp || pobj.fullName === disp || pobj.nickname === disp) {
                    return uname;
                }
            }

            // Fallback: coerce to string (best-effort username)
            return String(disp || '');
        });
        
        UpdateEligiblePlayersUI(tournament, matches, leaderboard, playersIndex);

        // Persist to DB
        try {
            btn.disabled = true;
            // Use tournament id if available, otherwise try GetTournamentID()
            const tid = t?.id ?? GetTournamentID();
            if (!tid) {
                throw new Error('No tournament id available to persist players');
            }

            console.log('Persisting randomized players to DB:', newPlayers);

            const response = await supabase
                .from('tbl_tournaments')
                .update({ players: newPlayers })
                .eq('id', tid)
                .select('*');

            if (response.error) {
                console.error('Failed to update tournament players', response.error);
                alert('Could not save randomized players. See console for details.');
                // revert UI by reloading current tournament/matches
                await Start();
                return;
            } else 
            {
                console.log('Successfully updated tournament players', response.data);
            }

            // Refresh local tournament and UI
            tournament = response.data || await GetTournament(tid);
            matches = await GetTournamentMatches(tid);
            leaderboard = CompileTournamentData(tournament, matches);
            UpdateUI(tournament, matches, leaderboard);
            // ensure selection cleared
            clearActiveSelection();
        } finally {
            btn.disabled = false;
            await Start();
        }
    });
})();



function UpdateEligiblePlayersUI (tournament, matches, leaderboard, playersIndex)
{
    const cardBody = document.querySelector("#tournament-players .card-body");
    if (!cardBody) return;

    const eligiblePlayers = leaderboard.filter(entry => entry.L < (tournament?.multiLife ?? 0));

    cardBody.innerHTML = "";

    eligiblePlayers.forEach((entry) => {
        const btn = document.createElement("button");
        btn.className = "btn-standard btn-select-player";
        const livesLeft = (tournament?.multiLife ?? 0) - entry.L;
        btn.innerHTML = `${entry.player} <sup>${livesLeft}</sup>`;

        // Resolve a player object by display name
        const resolved = playersIndex.byDisplay.get(entry.player) || { username: entry.player };
        if (resolved.username) btn.dataset.username = resolved.username;

        btn.addEventListener('click', () => {
            // If this eligible is already active, deactivate it
            if (activeSelection?.type === 'eligible' && activeSelection.el === btn) {
                clearActiveSelection();
                return;
            }
            setActiveSelection({ type: 'eligible', el: btn, player: resolved });
        });

        cardBody.appendChild(btn);
    });
}

function UpdateRoundsMatchesUI (matches, playersIndex)
{
    const row = document.getElementById("grp-matches");
    if (!row) return;

    row.innerHTML = "";

    const columns = [[], [], [], []];
    matches.forEach((match, idx) => {
        columns[idx % 4].push(match);
    });

    const matchIndex = new Map(matches.map(m => [m.id, m]));

    const onMatchPlayerClick = async (matchId, side, btn) => {
        const match = matchIndex.get(matchId);
        if (!match) return;
        match.players = match.players || {};
        const currentPlayer = match.players[side] || null;

        // No active selection yet: select this match player
        if (!activeSelection) {
            setActiveSelection({ type: 'match', el: btn, matchId, side, player: currentPlayer });
            return;
        }

        // If clicking the same active match button, remove player from match
        if (activeSelection.type === 'match' && activeSelection.el === btn) {
            match.players[side] = null;
            await saveMatchPlayers(matchId, match.players);
            btn.textContent = side === null ? '-' : side === 'a' ? 'Player A' : side === 'h' ? 'Player H' : '?';
            clearActiveSelection();
            return;
        }

        // If an eligible player is active, replace this spot with that player
        if (activeSelection.type === 'eligible') {
            const newPlayer = activeSelection.player ? clonePlayer(activeSelection.player) : null;
            // If same player, no-op
            if (newPlayer && currentPlayer && (newPlayer.username || '') === (currentPlayer.username || '')) {
                clearActiveSelection();
                return;
            }
            match.players[side] = newPlayer;
            await saveMatchPlayers(matchId, match.players);
            btn.textContent = displayName(newPlayer) || (side === null ? '-' : side === 'a' ? 'Player A' : side === 'h' ? 'Player H' : '?');
            clearActiveSelection();
            return;
        }

        // Active is a match player: swap players between two match slots
        if (activeSelection.type === 'match') {
            const aMatchId = activeSelection.matchId;
            const aSide = activeSelection.side;
            const aBtn = activeSelection.el;
            const matchA = matchIndex.get(aMatchId);
            const matchB = match;

            if (!matchA) {
                clearActiveSelection();
                return;
            }

            const playerA = matchA.players?.[aSide] || null;
            const playerB = matchB.players?.[side] || null;

            // Perform swap
            matchA.players = matchA.players || {};
            matchB.players = matchB.players || {};
            matchA.players[aSide] = playerB ? clonePlayer(playerB) : null;
            matchB.players[side] = playerA ? clonePlayer(playerA) : null;

            // Persist both
            await saveMatchPlayers(aMatchId, matchA.players);
            await saveMatchPlayers(matchId, matchB.players);

            // Update UI labels
            aBtn.textContent = displayName(matchA.players[aSide]) || (aSide === null ? '-' : aSide === 'a' ? 'Player A' : aSide === 'h' ? 'Player H' : '?');
            btn.textContent = displayName(matchB.players[side]) || (side === null ? '-' : side === 'a' ? 'Player A' : side === 'h' ? 'Player H' : '?');

            clearActiveSelection();
            return;
        }
    };

    columns.forEach(colMatches => {
        const colDiv = document.createElement("div");
        colDiv.className = "col-md-3";
        colMatches.forEach(match => {
            const card = document.createElement("div");
            card.className = "card component-match-editing";

            const cardTitle = document.createElement("div");
            cardTitle.className = "card-title";
            cardTitle.innerHTML = `<a href="https://thediveclub.org/matches/scoreboard.html?matchID=${match.id}">${match.id}</a>`;
            card.appendChild(cardTitle);

            const table = document.createElement("table");
            const tbody = document.createElement("tbody");

            // Home player ('h')
            const trH = document.createElement("tr");
            const tdPlayerH = document.createElement("td");
            tdPlayerH.className = "match-player";
            const btnH = document.createElement("button");
            btnH.className = "btn-standard btn-select-player";
            btnH.textContent = match.players && match.players.h ? displayName(match.players.h) : "-";
            btnH.dataset.matchId = match.id;
            btnH.dataset.side = 'h';
            btnH.addEventListener('click', () => onMatchPlayerClick(match.id, 'h', btnH));
            tdPlayerH.appendChild(btnH);

            const tdScoreH = document.createElement("td");
            tdScoreH.className = "match-score";
            const inputH = document.createElement("input");
            inputH.type = "text";
            inputH.className = "form-control";
            inputH.placeholder = "-";
            inputH.value = match.results && match.results.h ? match.results.h.fw || "0" : "";
            tdScoreH.appendChild(inputH);

            trH.appendChild(tdPlayerH);
            trH.appendChild(tdScoreH);

            // Away player ('a')
            const trA = document.createElement("tr");
            const tdPlayerA = document.createElement("td");
            tdPlayerA.className = "match-player";
            const btnA = document.createElement("button");
            btnA.className = "btn-standard btn-select-player";
            btnA.textContent = match.players && match.players.a ? displayName(match.players.a) : "-";
            btnA.dataset.matchId = match.id;
            btnA.dataset.side = 'a';
            btnA.addEventListener('click', () => onMatchPlayerClick(match.id, 'a', btnA));
            tdPlayerA.appendChild(btnA);

            const tdScoreA = document.createElement("td");
            tdScoreA.className = "match-score";
            const inputA = document.createElement("input");
            inputA.type = "text";
            inputA.className = "form-control";
            inputA.placeholder = "-";
            inputA.value = match.results && match.results.a ? match.results.a.fw || "0" : "";
            tdScoreA.appendChild(inputA);

            trA.appendChild(tdPlayerA);
            trA.appendChild(tdScoreA);

            tbody.appendChild(trH);
            tbody.appendChild(trA);
            table.appendChild(tbody);
            card.appendChild(table);

            // Persist score changes to DB (results.[a|h].fw)
            const ensureResults = () => {
                match.results = match.results || {};
                match.results.h = match.results.h || {};
                match.results.a = match.results.a || {};
            };
            const persistFw = async (side, val) => {
                ensureResults();
                match.results[side].fw = parseFw(val);
                await saveMatchResults(match.id, match.results);
            };
            const debouncedPersistH = debounce(v => persistFw('h', v), 400);
            const debouncedPersistA = debounce(v => persistFw('a', v), 400);

            inputH.addEventListener('input', e => debouncedPersistH(e.target.value));
            inputH.addEventListener('change', e => persistFw('h', e.target.value));

            inputA.addEventListener('input', e => debouncedPersistA(e.target.value));
            inputA.addEventListener('change', e => persistFw('a', e.target.value));

            // Start/End (reopen) match button with status-aware label and behavior
            const btnStartEnd = document.createElement("button");
            const isComplete = (match?.info?.status || "") === "Complete";
            if (isComplete)
            {
                btnStartEnd.className = "btn-standard";
            } else 
            {    
                btnStartEnd.className = "btn-standard btn-active";
            }
            btnStartEnd.textContent = isComplete ? "Reopen Match" : "End Match";
            btnStartEnd.addEventListener('click', async () => {
                try {
                    btnStartEnd.disabled = true;
                    match.info = match.info || {};
                    const currentlyComplete = (match.info.status || "") === "Complete";
                    match.info.status = currentlyComplete ? "Live" : "Complete";
                    await saveMatchInfo(match.id, match.info);
                } catch (e) {
                    console.error('Failed to toggle match status', e);
                    btnStartEnd.disabled = false;
                }
            });
            card.appendChild(btnStartEnd);

            const btnDelete = document.createElement("button");
            btnDelete.className = "btn-standard btn-warning";
            btnDelete.textContent = "Delete Match";
            btnDelete.addEventListener('click', async () => {
                const ok = confirm("Are you sure you want to delete match? This cannot be undone.");
                if (!ok) return;

                try {
                    btnDelete.disabled = true;
                    const tournamentID = GetTournamentID();
                    if (!tournamentID) {
                        alert('No tournament ID found');
                        btnDelete.disabled = false;
                        return;
                    }

                    const { error } = await supabase.from('tbl_matches').delete().eq('id', match.id);
                    if (error) {
                        console.error('Failed to delete match', error);
                        alert('Could not delete match. Please try again.');
                        btnDelete.disabled = false;
                        return;
                    } else
                    {
                        Start(); // Refresh entire UI for simplicity
                    }

                    clearActiveSelection();
                    const { raw } = getActiveRoundSelection();

                    const tournament = await GetTournament(tournamentID);
                    const updatedMatches = await GetTournamentMatches(tournamentID);
                    const leaderboard = CompileTournamentData(tournament, updatedMatches);
                    UpdateUI(tournament, updatedMatches, leaderboard);

                    const container = document.getElementById('rounds-buttons');
                    if (container) {
                        const toActivate = Array.from(container.querySelectorAll('button'))
                            .find(b => (b.dataset.round ?? "") === (raw ?? ""));
                        if (toActivate && !toActivate.classList.contains('is-active')) {
                            toActivate.click();
                        }
                    }
                } catch (e) {
                    console.error('Exception deleting match', e);
                    alert('Unexpected error deleting match.');
                    btnDelete.disabled = false;
                }
            });
            card.appendChild(btnDelete);

            colDiv.appendChild(card);
        });
        row.appendChild(colDiv);
    });
}
// Add Round: create a new match with next round number for this tournament
(function wireAddRoundButton() {
    const btn = document.getElementById('btn-add-round');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    btn.addEventListener('click', async () => {
        try {
            const tournamentID = GetTournamentID();
            if (!tournamentID) {
                alert('No tournament ID found');
                return;
            }

            // Get existing matches to compute next round number
            const existing = await GetTournamentMatches(tournamentID);
            let maxRound = 0;
            (existing || []).forEach(m => {
                const r = getMatchRound(m);
                const n = parseInt(String(r ?? '').trim(), 10);
                if (!isNaN(n)) maxRound = Math.max(maxRound, n);
            });
            const nextRound = maxRound + 1;

            // Build a minimal new match payload
            const newMatch = {
                info: { round: nextRound, status: 'Live' },
                competitions: { tournamentID },
                players: { a: null, h: null },
                results: {
                    a: { bf: 0, fw: 0, gb: 0, rf: 0, breaks: { in: 0, dry: 0, scr: 0 } },
                    h: { bf: 0, fw: 0, gb: 0, rf: 0, breaks: { in: 0, dry: 0, scr: 0 } }
                },
                settings: null,
                time: null,
                history: null
            };

            const { data, error } = await supabase.from('tbl_matches').insert(newMatch).select('*').single();
            if (error) {
                console.error('Failed to add round/match', error);
                alert('Could not create a new round. Please try again.');
                return;
            } else 
            {
                Start();
            }
        } catch (e) {
            console.error('Exception creating new round', e);
            alert('Unexpected error creating new round.');
        }
    });
})();

// Helper: read currently selected round from the round filter buttons
function getActiveRoundSelection() {
    const container = document.getElementById('rounds-buttons');
    if (!container) return { btn: null, raw: null, value: null };
    const btn = container.querySelector('button.is-active');
    if (!btn) return { btn: null, raw: null, value: null };
    const raw = btn.dataset.round ?? "";
    const value = raw === "" ? null : (/^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
    return { btn, raw, value };
}

// Wire "Add Match" button
(function wireAddMatchButton() {
    const btn =
        document.getElementById('btn-add-match') ||
        Array.from(document.querySelectorAll('button.btn-tool, button.btn-standard'))
            .find(b => (b.textContent || '').trim().toLowerCase() === 'add match');

    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';

    btn.addEventListener('click', async () => {
        try {
            const tournamentID = GetTournamentID();
            if (!tournamentID) {
                alert('No tournament ID found');
                return;
            }

            const { raw, value } = getActiveRoundSelection();
            if (raw == null) {
                alert('Please select a round first.');
                return;
            }

            const newMatch = {
                info: { round: value, status: 'New' },
                competitions: { tournamentID },
                players: { a: null, h: null },
                results: {
                    a: { bf: 0, fw: 0, gb: 0, rf: 0, breaks: { in: 0, dry: 0, scr: 0 } },
                    h: { bf: 0, fw: 0, gb: 0, rf: 0, breaks: { in: 0, dry: 0, scr: 0 } }
                },
                settings: null,
                time: null,
                history: null
            };

            const { data, error } = await supabase.from('tbl_matches').insert(newMatch).select('*').single();
            if (error) {
                console.error('Failed to add match', error);
                alert('Could not create a new match. Please try again.');
                return;
            } else 
            {
                Start();
            }

            const tournament = await GetTournament(tournamentID);
            const updatedMatches = await GetTournamentMatches(tournamentID);
            const leaderboard = CompileTournamentData(tournament, updatedMatches);
            UpdateUI(tournament, updatedMatches, leaderboard);

            // Re-apply previously selected round filter (if any)
            const container = document.getElementById('rounds-buttons');
            if (container) {
                const toActivate = Array.from(container.querySelectorAll('button'))
                    .find(b => (b.dataset.round ?? "") === (raw ?? ""));
                if (toActivate && !toActivate.classList.contains('is-active')) {
                    toActivate.click();
                }
            }
        } catch (e) {
            console.error('Exception creating new match', e);
            alert('Unexpected error creating new match.');
        }
    });
})();