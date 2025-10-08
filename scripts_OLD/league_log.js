//Get League ID from local storage / url
//Get All Players for league
//Get All Tournaments (Rounds) for league
//Get All Matches for tournaments
//Build log data from matches
//Display log data

//log: [players]
var log = [];

BuildLog();

async function BuildLog ()
{
    const leagueID = GetLeagueID();
    console.log('League ID:', leagueID);

    const league = await GetLeague(leagueID);
    document.getElementById('league-name').textContent = league.name;
    console.log('League Details:', league);

    var leaguePlayers = league.players;
    console.log('League Players:', leaguePlayers);
    log = await CreateLogObjects(leaguePlayers);
    console.log('Log:', log);

    const leagueMatches = await GetLeagueMatches(leagueID);
    console.log('League Matches:', leagueMatches);

    log = PopulateLogData(log, leagueMatches);
    console.log('Populated Log:', log);

    PopulateTable(log);

    const leagueRounds = await GetLeagueRounds(leagueID);
    console.log('League Rounds:', leagueRounds);
    PopulateLeagueRoundsMatches(leagueRounds, leagueMatches);
    console.log('Populated League Rounds Matches:', leagueRounds);
    PopulateRoundsTables(leagueRounds);
}

function GetLeagueID()
{
    var leagueID = new URLSearchParams(window.location.search).get('leagueID');
    if (!leagueID)
    {
        leagueID = localStorage.getItem('leagueID');
    }
    localStorage.setItem('leagueID', leagueID);
    return leagueID;
}

async function GetLeague (_leagueID)
{
    const response = await supabase.from('tbl_leagues').select('*').eq('id', _leagueID);
    return response.data[0];
}

async function CreateLogObjects (_playersUserNames)
{
    var logObjects = [];
    for (var i = 0; i < _playersUserNames.length; i++)
    {
        var logObject = 
        {
            id: null,
            userName: _playersUserNames[i],
            fullName: await GetPlayerName(_playersUserNames[i]),
            rank: null,
            frames_p: 0,
            frames_w: 0,
            frames_l: 0,
            frames_rate: 0,
            bf: 0,
            lags_rate: 0,
            pts: 0
        };
        logObjects.push(logObject);
    }
    return logObjects;
}

async function GetPlayerName (_playerUserName)
{
    const response = await supabase.from('tbl_players').select('name, surname').eq('username', _playerUserName);
    var fullName = '';
    if (response.data[0].name)
    {
        fullName += response.data[0].name;
    }
    if (response.data[0].surname)
    {
        fullName += " " + response.data[0].surname;
    } else 
    {
        fullName += ' *';
    }
    return fullName;
}

const leagueMatches = null;

async function GetLeagueMatches (_leagueID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('competitions->>leagueID', _leagueID);
    return response.data;
}

function PopulateLogData (_log, _leagueMatches)
{
    if (!_log) return _log;

    const byUser = new Map(_log.map(p => [p.userName, p]));
    const matchesArr = Array.isArray(_leagueMatches) ? _leagueMatches : [];

    // helper to compute total frames in a match
    const totalFramesInMatch = (m) => {
        const aFw = m?.results?.a?.fw ?? 0;
        const hFw = m?.results?.h?.fw ?? 0;
        const sum = aFw + hFw;
        if (sum > 0) return sum;
        const hist = m?.history;
        if (Array.isArray(hist)) return hist.length;
        if (hist && typeof hist === 'object') return Object.keys(hist).length;
        return 0;
    };

    // helper to normalize lagWinner to side key 'a' | 'h'
    const lagWinnerSide = (m) => {
        const lw = m?.settings?.lagWinner;
        if (!lw) return undefined;
        if (lw === 'home') return 'h';
        if (lw === 'away') return 'a';
        if (lw === 'a' || lw === 'h') return lw;
        return undefined;
    };

    for (const match of matchesArr) {
        if (!match?.players) continue;
        const totalFrames = totalFramesInMatch(match);
        const lagSide = lagWinnerSide(match);

        for (const side of ['a', 'h']) {
            const user = match.players[side]?.username;
            if (!user) continue;
            const entry = byUser.get(user);
            if (!entry) continue;

            const sideResults = match.results?.[side] ?? {};
            const fw = sideResults.fw ?? 0;
            const bf = sideResults.bf ?? 0;

            entry.frames_p += totalFrames;
            entry.frames_w += fw;
            entry.bf += bf;

            entry.__matches = (entry.__matches || 0) + 1;
            if (lagSide && side === lagSide) {
                entry.__lagsWon = (entry.__lagsWon || 0) + 1;
            }
        }
    }

    for (const entry of _log) {
        const matches = entry.__matches || 0;
        const lagsWon = entry.__lagsWon || 0;

        entry.frames_l = Math.max(0, entry.frames_p - entry.frames_w);
        entry.frames_rate = entry.frames_p ? (entry.frames_w / entry.frames_p) : 0;
        entry.lags_rate = matches ? (lagsWon / matches) : 0;
        entry.pts = entry.frames_w + entry.bf;

        delete entry.__matches;
        delete entry.__lagsWon;
    }

    // Rank by pts, then frames_w, then bf, then lags_rate (dense ranking)
    const sorted = [._log].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.frames_w !== a.frames_w) return b.frames_w - a.frames_w;
        if (b.bf !== a.bf) return b.bf - a.bf;
        if (b.lags_rate !== a.lags_rate) return b.lags_rate - a.lags_rate;
        return 0;
    });
    let rank = 0;
    let prev = {};
    for (const e of sorted) {
        if (
            prev.pts !== e.pts ||
            prev.frames_w !== e.frames_w ||
            prev.bf !== e.bf ||
            prev.lags_rate !== e.lags_rate
        ) {
            rank += 1;
            prev = {
                pts: e.pts,
                frames_w: e.frames_w,
                bf: e.bf,
                lags_rate: e.lags_rate
            };
        }
        e.rank = rank;
    }

    // Re-order _log based on rank
    _log.sort((a, b) => a.rank - b.rank);

    return _log;
}

function PopulateTable (_log)
{

    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Helper to get color class based on rank
    function getRankColor(rank) {
        if (rank >= 1 && rank <= 4) return 'rank-top'; // green
        if (rank === 5) return 'rank-mid'; // purple (custom class, define in CSS)
        if (rank >= 6 && rank <= 8) return 'rank-low'; // red
        return '';
    }

    _log.forEach(player => {
        const tr = document.createElement('tr');
        const colorClass = getRankColor(player.rank);

        tr.innerHTML = `
            <td class="${colorClass}" style="width:24px"></td>
            <td>${String(player.rank).padStart(2, '0')}</td>
            <td>${player.fullName}</td>
            <td>${player.frames_p}</td>
            <td>${player.frames_w}</td>
            <td>${player.frames_l}</td>
            <td>${(player.frames_rate * 100).toFixed(1)}%</td>
            <td>${player.bf}</td>
            <td>${(player.lags_rate * 100).toFixed(1)}%</td>
            <td>${player.pts}</td>
        `;
        tbody.appendChild(tr);
    });
}

const leagueRounds = null;
async function GetLeagueRounds (_leagueID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('leagueID', _leagueID).order('date', { ascending: false });
    return response.data;
}

function PopulateLeagueRoundsMatches (_leagueRounds, _leagueMatches)
{
    if (!Array.isArray(_leagueRounds) || !Array.isArray(_leagueMatches)) return;

    // Build a lookup of tournamentID to matches
    const matchesByTournament = {};
    for (const match of _leagueMatches) {
        const tid = match?.competitions?.tournamentID;
        if (!tid) continue;
        if (!matchesByTournament[tid]) matchesByTournament[tid] = [];
        matchesByTournament[tid].push(match);
    }

    // Attach matches to each round
    for (const round of _leagueRounds) {
        round.matches = matchesByTournament[round.id] || [];
    }
}

function PopulateRoundsTables (_leagueRounds)
{
    const roundsContainer = document.getElementById('rounds-container');
    if (!roundsContainer) return;

    roundsContainer.innerHTML = '';

    _leagueRounds.forEach((round, idx) => {
        const card = document.createElement('div');
        card.className = 'card rounded card-component mb-4';

        // Card Header
        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `<h3>${round.name || `Round ${idx + 1}`}</h3>
            <div style="font-size:0.9em;color:#888;">${round.date} @ ${round.location}</div>`;
        card.appendChild(header);

        // Card Body
        const body = document.createElement('div');
        body.className = 'card-body';

        // Table
        const table = document.createElement('table');
        table.className = 'table';
        table.style.textAlign = 'center';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Home</th>
                    <th>FW</th>
                    <th>B/F</th>
                    <th><b>Pts</b></th>
                    <th>|</th>
                    <th><b>Pts</b></th>
                    <th>B/F</th>
                    <th>FW</th>
                    <th>Away</th>
                </tr>
            </thead>
            <tbody id="round-${idx + 1}-matches"></tbody>
        `;

        // Fill matches
        const tbody = table.querySelector('tbody');
        (round.matches || []).forEach(match => {
            const h = match.players?.h;
            const a = match.players?.a;
            const hFW = match.results?.h?.fw ?? 0;
            const hBF = match.results?.h?.bf ?? 0;
            const hPts = hFW + hBF;
            const aFW = match.results?.a?.fw ?? 0;
            const aBF = match.results?.a?.bf ?? 0;
            const aPts = aFW + aBF;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${h?.fullName || ''}</td>
                <td>${hFW}</td>
                <td>${hBF}</td>
                <td><b>${hPts}</b></td>
                <td>
                    <a href="https://thediveclub.org/matches/scoreboard.html?matchID=${match.id}" target="_blank" style="text-decoration:none;">
                        <i class="bi bi-box-arrow-up-right"></i>
                    </a>
                </td>
                <td><b>${aPts}</b></td>
                <td>${aBF}</td>
                <td>${aFW}</td>
                <td>${a?.fullName || ''}</td>
            `;
            tbody.appendChild(tr);
        });

        body.appendChild(table);
        card.appendChild(body);
        roundsContainer.appendChild(card);
    });
}