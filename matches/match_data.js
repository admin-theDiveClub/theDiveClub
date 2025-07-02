var match = {
    id: null,
    leagueID: null,
    tournamentID: null,
    time: {
        end: null,
        start: null
    },
    players: {
        away: {
            id: null,
            pp: null,
            fullName: null,
            nickname: null,
            username: null
        },
        home: {
            id: null,
            pp: null,
            fullName: null,
            nickname: null,
            username: null
        }
    },
    settings: {
        lagType: null,
        ruleSet: null,
        winType: null,
        lagWinner: null,
        winCondition: null
    },
    results: {
        away: {
            bf: 0,
            fw: 0,
            gb: 0,
            rf: 0,
            breaks: {
                in: 0,
                dry: 0,
                scr: 0
            }
        },
        home: {
            bf: 0,
            fw: 0,
            gb: 0,
            rf: 0,
            breaks: {
                in: 0,
                dry: 0,
                scr: 0
            }
        }
    },
    history: [],
    info: null
};

import { UpdateMatchSummary } from "../matches/match_summary.js";
import { UpdateMatchTimingGraph } from "../matches/match_timingGraph.js";
import { UpdateMatch } from "../matches/match_inputs.js";

Initialize();

async function Initialize()
{
    match = await getMatchData();    
    console.log('Source: Match', match);
    await UpdateMatchPlayers(match);
    await UpdateMatch(match);

    OnPayloadReceived(match);
}

async function getMatchData() 
{
    const matchID = GetMatchID();
    var match = null;
    if (matchID)
    {
        match = await GetMatch(matchID);
        if (match)
        {
            const subscriptionResponse = await SubscribeToUpdates(matchID);
            console.log('Source: Subscription Response', subscriptionResponse);
        }
    }
    return match;
}

function GetMatchID() 
{
  var matchID = new URLSearchParams(window.location.search).get('matchID');
  if (!matchID) 
  {
    matchID = localStorage.getItem('matchID')||sessionStorage.getItem('matchID');
  }

  if (matchID)
  {
    localStorage.setItem('matchID', matchID);
    sessionStorage.setItem('matchID', matchID);
    return matchID;
  } else 
  {
    window.location.href = "../matches/create.html";
  }
}

async function GetMatch (_matchID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('id', _matchID);
    if (response.error)
    {
      return null;
    } else 
    {
      return response.data[0];
    }
}

async function SubscribeToUpdates (_matchID)
{
  const channels = supabase.channel('custom-update-channel')
  .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tbl_matches', filter: `id=eq.${_matchID}` },
      (payload) => 
      {
        console.log('Source: Change Received!', payload);
        OnPayloadReceived(payload.new);
      }
  )
  .subscribe();
  return channels;
}

async function OnPayloadReceived (payload)
{
    UpdateMatchSummary(payload);
    UpdateMatchTimingGraph(payload);
    UpdateMatch(payload);
}

async function UpdateMatchPlayers(match) {
    // Use new keys: 'a' for away, 'h' for home
    const usernames = [
        match.players.h?.username,
        match.players.a?.username
    ].filter(Boolean);

    if (usernames.length === 0) return;

    const response = await supabase
        .from('tbl_players')
        .select('*')
        .in('username', usernames);

    if (response.error) {
        console.error('Error fetching player data:', response.error);
        return;
    }

    const players = response.data;

    // Home player ('h')
    if (match.players.h) {
        const homePlayerData = players.find(player => player.username === match.players.h.username);

        match.players.h.fullName = homePlayerData
            ? `${homePlayerData.name}${homePlayerData.surname ? ' ' + homePlayerData.surname : ''}`
            : match.players.h.fullName || match.players.h.username;
        match.players.h.id = homePlayerData?.id || match.players.h.id || null;
        match.players.h.nickname = homePlayerData?.nickname || (homePlayerData ? match.players.h.nickname : "Guest") || null;

        if (match.players.h.id) {
            const r_H = await supabase.storage.from('bucket-profile-pics').getPublicUrl(match.players.h.id);
            if (r_H.data && r_H.data.publicUrl && !r_H.data.publicUrl.endsWith('null')) {
                const imgElement_H = document.getElementById('player-H-pic');
                if (imgElement_H) {
                    const img = new Image();
                    img.onload = () => {
                        imgElement_H.src = r_H.data.publicUrl;
                    };
                    img.src = r_H.data.publicUrl;
                }
                match.players.h.pp = r_H.data.publicUrl;
            }
        }
    }

    // Away player ('a')
    if (match.players.a) {
        const awayPlayerData = players.find(player => player.username === match.players.a.username);
        match.players.a.fullName = awayPlayerData
            ? `${awayPlayerData.name}${awayPlayerData.surname ? ' ' + awayPlayerData.surname : ''}`
            : match.players.a.fullName || match.players.a.username;
        match.players.a.id = awayPlayerData?.id || match.players.a.id || null;
        match.players.a.nickname = awayPlayerData?.nickname || (awayPlayerData ? match.players.a.nickname : "Guest") || null;

        if (match.players.a.id) {
            const r_A = await supabase.storage.from('bucket-profile-pics').getPublicUrl(match.players.a.id);
            if (r_A.data && r_A.data.publicUrl && !r_A.data.publicUrl.endsWith('null')) {
                const imgElement_A = document.getElementById('player-A-pic');
                if (imgElement_A) {
                    const img = new Image();
                    img.onload = () => {
                        imgElement_A.src = r_A.data.publicUrl;
                    };
                    img.src = r_A.data.publicUrl;
                }
                match.players.a.pp = r_A.data.publicUrl;
            }
        }
    }

    const playerUpdateResponse = await supabase.from('tbl_matches').update(match).eq('id', match.id).select();
    console.log('Source: Player Update Response', playerUpdateResponse);
}