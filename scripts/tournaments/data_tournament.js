const tournament = null;
const matches = null;

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
        const tournament = await GetTournament(tournamentID);
        if (tournament) 
        {
            console.log("Tournament" , tournament);
            const matches = await GetTournamentMatches(tournamentID);
            if (matches) 
            {
                console.log("Matches: ", matches);
                const leaderboard = CompileTournamentData(tournament, matches);
                UpdateUI(tournament, matches, leaderboard);
            }
        }
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
    const response = await supabase.from('tbl_matches').select('*').eq('competitions->>tournamentID', _tournamentID);
    return response.data;
}

function CompileTournamentData(tournament, matches)
{
    const leaderboard = (tournament?.players || []).map((username) => {
        // Find all matches where this player participated
        const playerMatches = (matches || []).filter(match => {
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
                PlayerName = playerObj.nickname ? playerObj.nickname : playerObj.fullName ? playerObj.fullName : playerObj.username ? playerObj.username : username;
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
    return p.nickname || p.fullName || p.name || p.username || "";
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

    leaderboard.forEach(entry => {
        const tr = document.createElement("tr");
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
            btn.textContent = side === 'a' ? 'Player A' : 'Player H';
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
            btn.textContent = displayName(newPlayer) || (side === 'a' ? 'Player A' : 'Player H');
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
            aBtn.textContent = displayName(matchA.players[aSide]) || (aSide === 'a' ? 'Player A' : 'Player H');
            btn.textContent = displayName(matchB.players[side]) || (side === 'a' ? 'Player A' : 'Player H');

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
            btnH.textContent = match.players && match.players.h ? displayName(match.players.h) : "Player H";
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
            btnA.textContent = match.players && match.players.a ? displayName(match.players.a) : "Player A";
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
                info: { round: value, status: 'Live' },
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