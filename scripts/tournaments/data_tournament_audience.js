var _tournament = null;
var _matches = null;
var _leaderboard = null;

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
            _tournament = tournament;
            const matches = await GetTournamentMatches(tournamentID);
            if (matches) 
            {
                console.log("Matches: ", matches);
                _matches = matches;
                _leaderboard = CompileTournamentData(tournament, matches);
                UpdateUI(_tournament, _matches, _leaderboard);
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

function UpdateUI(tournament, matches, leaderboard)
{
    CreateTournamentVisualization(matches);
}

function CreateTournamentVisualization (matches)
{
    const container = document.getElementById('tournamentVisualization');
    if (!container) return;

    // Helpers
    const displayName = (p) => p?.nickname || p?.fullName || p?.username || p?.name || '';
    const roundKey = (m) =>
        m?.info?.round ?? m?.round ?? m?.info?.roundNumber ?? m?.stage?.round ?? m?.competitions?.round ?? 'Round 1';
    const roundOrder = (rk) => {
        if (typeof rk === 'number') return rk;
        const s = String(rk).toLowerCase();
        const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(n)) return n;
        if (s.includes('quarter')) return 4;
        if (s.includes('semi')) return 5;
        if (s.includes('final')) return 6;
        return 1000;
    };

    // Group matches by round
    const roundsMap = new Map();
    (matches || []).forEach((m) => {
        const key = roundKey(m);
        if (!roundsMap.has(key)) roundsMap.set(key, []);
        roundsMap.get(key).push(m);
    });
    const rounds = Array.from(roundsMap.entries())
        .map(([key, list]) => ({ key, list, order: roundOrder(key) }))
        .sort((a, b) => a.order - b.order);

    // Build layout
    container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'row';
    container.appendChild(row);

    // Determine column width
    const cols = Math.max(1, rounds.length);
    const lg = Math.max(2, Math.floor(12 / cols)); // keep at least col-lg-2
    const colClass = `col-lg-${lg} col-md-6 col-sm-12`;

    rounds.forEach((r) => {
        const col = document.createElement('div');
        col.className = colClass;

        // Optional round header
        const header = document.createElement('div');
        header.className = 'mb-2 text-center fw-bold';
        header.textContent = String(r.key);
        col.appendChild(header);

        // Matches in this round
        r.list.forEach((match) => {
            // Robustly resolve side keys to avoid duplicating a player when the other side is null
            const playersObj = match?.players || {};
            const playerKeys = Object.keys(playersObj);

            // Prefer explicit 'h'/'home' and 'a'/'away' keys, otherwise pick first non-null as home and next non-null as away
            const homeKey =
                playerKeys.find(k => k === 'h' || k === 'home') ||
                playerKeys.find(k => playersObj[k]); // first truthy value
            const awayKey =
                playerKeys.find(k => k === 'a' || k === 'away') ||
                playerKeys.find(k => playersObj[k] && k !== homeKey) || null;

            const pH = homeKey ? playersObj[homeKey] : null;
            const pA = awayKey ? playersObj[awayKey] : null;

            // Resolve matching results for the chosen keys (fallbacks for different naming)
            const resultsObj = match?.results || {};
            const rH =
                (homeKey && resultsObj[homeKey]) ||
                resultsObj.home ||
                resultsObj.h ||
                {};
            const rA =
                (awayKey && resultsObj[awayKey]) ||
                resultsObj.away ||
                resultsObj.a ||
                {};

            const nameH = displayName(pH) || 'Player H';
            const nameA = displayName(pA) || 'Player A';
            const scoreH = typeof rH.fw === 'number' ? rH.fw : 0;
            const scoreA = typeof rA.fw === 'number' ? rA.fw : 0;

            // Card
            const card = document.createElement('div');
            const status = match?.info?.status;
            card.className = 'card mb-3' + (status === 'Complete' ? ' card-match-ended' : status === 'Live' ? ' card-match-live' : '');

            const table = document.createElement('table');
            table.className = 'w-100';
            const tbody = document.createElement('tbody');

            const trH = document.createElement('tr');
            const tdHName = document.createElement('td');
            tdHName.className = 'match-player';
            tdHName.textContent = nameH;
            const tdHScore = document.createElement('td');
            tdHScore.className = 'match-score text-end';
            tdHScore.textContent = String(scoreH);
            trH.appendChild(tdHName);
            trH.appendChild(tdHScore);

            const trA = document.createElement('tr');
            const tdAName = document.createElement('td');
            tdAName.className = 'match-player';
            tdAName.textContent = nameA;
            const tdAScore = document.createElement('td');
            tdAScore.className = 'match-score text-end';
            tdAScore.textContent = String(scoreA);
            trA.appendChild(tdAName);
            trA.appendChild(tdAScore);

            tbody.appendChild(trH);
            tbody.appendChild(trA);
            table.appendChild(tbody);
            card.appendChild(table);
            col.appendChild(card);
        });

        row.appendChild(col);
    });
}

