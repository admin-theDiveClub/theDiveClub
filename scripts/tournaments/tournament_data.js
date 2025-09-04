import { UpdateTournamentMatch } from "../tournaments/tournament_UI_control.js";

var tournamentID = null;
var tournament = null;
var tournamentMatches = null;

Start ();

async function Start ()
{
    tournamentID = GetTournamentID();
    console.log('Source: Tournament ID', tournamentID);
    if (tournamentID)
    {
        tournament = await GetTournament(tournamentID);
        console.log('Source: Tournament Data', tournament);
        await PopulatePlayerInfo(tournament.players);
        if (tournament)
        {
            tournamentMatches = await GetTournamentMatches(tournamentID);
            console.log('Source: Tournament Matches', tournamentMatches);
            SubscribeToUpdates(tournamentID);
            CompileTournamentLog(GetConfirmedPlayers(tournamentPlayers), tournamentMatches);
            CompileTournamentRounds(tournamentMatches);
        }
    }    
}

function GetTournamentID()
{
    var t_ID = new URLSearchParams(window.location.search).get('tournamentID');
    if (!t_ID)
    {
        t_ID = localStorage.getItem('tournamentID') || sessionStorage.getItem('tournamentID') || null;
    }

    if (t_ID)
    {
        sessionStorage.setItem('tournamentID', t_ID);
        localStorage.setItem('tournamentID', t_ID);
        return t_ID;
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

async function SubscribeToUpdates (_tournamentID)
{
    const subscriptionResponse_tournament = await SubscribeToTournamentUpdates(_tournamentID);
    //console.log('Source: Subscription Response Tournaments', subscriptionResponse_tournament);

    const subscriptionResponse_tournamentMatches = await SubscribeToTournamentMatchesUpdates(_tournamentID);
    //console.log('Source: Subscription Response Tournament Matches', subscriptionResponse_tournamentMatches);
}

async function SubscribeToTournamentUpdates (_tournamentID)
{
  const channels = supabase.channel('custom-update-channel')
  .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tbl_tournaments', filter: `id=eq.${_tournamentID}` },
      (payload) => 
      {
        OnPayloadReceived_tournament(payload.new);
      }
  )
  .subscribe();
  return channels;
}

async function SubscribeToTournamentMatchesUpdates (_tournamentID)
{
    const channels = supabase
        .channel('realtime:tbl_matches')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_matches' }, (payload) => 
        {
            if (payload.new.competitions && payload.new.competitions.tournamentID === _tournamentID)
            {
                OnPayloadReceived_tournamentMatches(payload.new);
            }
        })
        .subscribe();
    return channels;
}

function OnPayloadReceived_tournament (_tournament)
{
    console.log('Tournament Data Updated:', _tournament);
    // Update the UI or perform any necessary actions with the new tournament data
}

function OnPayloadReceived_tournamentMatches (_match)
{
    console.log('Tournament Match Data Updated:', _match);
    UpdateTournamentMatch(_match);
}

var tournamentPlayers =
{
    0: 
    {
        "username": null,
        "displayName": null,
        "confirmed": false,
        "playerProfile": null
    }
};

async function PopulatePlayerInfo (t_players)
{
    if (!t_players || t_players.length === 0)
    {
        console.log('No players to populate.');
        return;
    }

    // collect unique, non-empty usernames
    const usernames = [...new Set(t_players.map(p => p && p.username).filter(Boolean))];

    // fetch all profiles in one call
    const profiles = await GetPlayerProfiles(usernames);
    const profileMap = {};
    if (profiles && profiles.length)
    {
        profiles.forEach(p => {
            if (p && p.username) profileMap[p.username] = p;
        });
    }

    // update player entries by comparing with fetched profiles
    for (let i = 0; i < t_players.length; i++)
    {
        const player = t_players[i] || {};
        const uname = player.username;
        const playerInfo = uname ? profileMap[uname] : null;

        if (playerInfo)
        {
            t_players[i].username = playerInfo.username;
            let displayName = playerInfo.username;
            if (playerInfo.nickname && playerInfo.nickname !== "Guest")
            {
                displayName = playerInfo.nickname;
            }
            else
            {
                displayName = playerInfo.fullName || playerInfo.name || playerInfo.username;
            }
            t_players[i].displayName = displayName;
            // preserve the original confirmed flag from the incoming player object
            t_players[i].confirmed = player.confirmed;
            t_players[i].playerProfile = playerInfo;
        }
        else
        {
            // no profile found — preserve what we have or fall back
            t_players[i].username = player.username;
            t_players[i].displayName = player.username;
            t_players[i].confirmed = player.confirmed;
            t_players[i].playerProfile = null;
        }
    }

    console.log('Player Information Populated:', t_players);
    tournamentPlayers = t_players;
}

async function GetPlayerProfiles (usernames)
{
    if (!usernames || usernames.length === 0) return [];

    const response = await supabase.from('tbl_players').select('*').in('username', usernames);
    return response.data || [];
}

var tournamentRounds =
{
    /*
    Round0:
    {
        Match0:
        {
            match: null,
        },
        Match1:
        {
            match: null,
        }
    }
    */
    0:
    {
        0:
        {
            match: null,
        },
        1:
        {
            match: null,
        }
    },
    1:
    {
        0:
        {
            match: null,
            precedingRound: 0,
            precedingMatches: [0, 1]
        }
    }
}

function GetConfirmedPlayers (players)
{
    return players.filter(p => p.confirmed);
}

function CompileTournamentLog (players, matches)
{
    const log = players.map(p => {
        const uname = p.username || 'Unknown';
        let MP = 0, MW = 0, ML = 0, FP = 0, FW = 0, BF = 0;

        for (const m of matches || []) {
            if (!m || !m.players) continue;

            let side = null;
            if (m.players.a && m.players.a.username === uname) side = 'a';
            else if (m.players.h && m.players.h.username === uname) side = 'h';
            if (!side) continue;

            const status = m.info && m.info.status;
            if (status !== 'Complete') continue;

            MP++;
            const results = m.results || {};
            const pRes = results[side] || {};
            const oRes = results[side === 'a' ? 'h' : 'a'] || {};

            const pFW = Number(pRes.fw) || 0;
            const oFW = Number(oRes.fw) || 0;
            const pBF = Number(pRes.bf) || 0;

            FP += pFW + oFW;
            FW += pFW;
            BF += pBF;

            if (pFW > oFW) MW++;
            else if (pFW < oFW) ML++;
        }

        const FPercent = FP > 0 ? ((FW / FP) * 100).toFixed(2) : "0.00";

        return {
            username: uname,
            Player: p.displayName,
            MP,
            MW,
            ML,
            FP,
            FW,
            'F%': FPercent,
            'B/F': BF
        };
    });

    // sort by MW desc, then FW desc, then F% desc, then B/F desc, then username
    log.sort((a, b) => {
        const aMW = Number(a.MW) || 0, bMW = Number(b.MW) || 0;
        if (bMW !== aMW) return bMW - aMW;

        const aFW = Number(a.FW) || 0, bFW = Number(b.FW) || 0;
        if (bFW !== aFW) return bFW - aFW;

        const aF = Number(a['F%']) || 0, bF = Number(b['F%']) || 0;
        if (bF !== aF) return bF - aF;

        const aBF = Number(a['B/F']) || 0, bBF = Number(b['B/F']) || 0;
        if (bBF !== aBF) return bBF - aBF;

        return (a.username || '').localeCompare(b.username || '');
    });

    const finalLog = log.map((entry, idx) => ({
        Rank: idx + 1,
        username: entry.username,
        MP: entry.MP,
        MW: entry.MW,
        ML: entry.ML,
        FP: entry.FP,
        FW: entry.FW,
        'F%': entry['F%'],
        'B/F': entry['B/F']
    }));

    console.log('Tournament Log:', finalLog);
    return finalLog;
}

function CompileTournamentRounds (matches)
{
    var allRounds = {};
    
    for (var i = 0; i < matches.length; i++)
    {
        const m_round = matches[i].info?.round || "Unclassified";
        if (!Object.prototype.hasOwnProperty.call(allRounds, m_round)) 
        {
            allRounds[m_round] = {};
        }
        const roundMatchesCount = Object.keys(allRounds[m_round]).length;
        const precedingRound = m_round > 0 ? m_round - 1 : null;
        var precedingMatches = null;
        if (precedingRound)
        {
            precedingMatches = m_round > 0 ? [roundMatchesCount * 2, roundMatchesCount * 2 + 1] : [];
        }

        allRounds[m_round][roundMatchesCount] = 
        {
            match: matches[i],
            precedingRound: precedingRound,
            precedingMatches: precedingMatches
        };
    }

    console.log('Compiled Tournament Rounds:', allRounds);
    UpdateTournamentMatch(allRounds);
    return allRounds;
}