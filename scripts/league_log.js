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
    console.log('League Details:', league);

    var leaguePlayers = league.players;
    console.log('League Players:', leaguePlayers);
    log = await CreateLogObjects(leaguePlayers);
    console.log('Log:', log);

    const leagueMatches = await GetLeagueMatches(leagueID);
    console.log('League Matches:', leagueMatches);

    log = PopulateLogData(log, leagueMatches);
    console.log('Populated Log:', log);
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

    // Rank by pts (dense ranking: ties share the same rank)
    const sorted = [..._log].sort((a, b) => b.pts - a.pts);
    let rank = 0;
    let prevPts = null;
    for (const e of sorted) {
        if (prevPts === null || e.pts !== prevPts) {
            rank += 1;
            prevPts = e.pts;
        }
        e.rank = rank;
    }

    // Re-order _log based on rank
    _log.sort((a, b) => a.rank - b.rank);

    return _log;


    return _log;
}