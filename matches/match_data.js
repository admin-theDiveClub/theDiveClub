var match = 
{
    id: null,
    leagueID: null,
    tournamentID: null,
    time: 
    {
        end: null,
        start: null
    },
    players: 
    {
        away: 
        {
            id: null,
            fullName: null,
            username: null
        },
        home: 
        {
            id: null,
            fullName: null,
            username: null
        }
    },
    settings: 
    {
        lagType: null,
        ruleSet: null,
        winType: null,
        lagWinner: null,
        winCondition: null
    },
    results: 
    {
        away: 
        {
            apples: 0,
            breaks: 
            {
                in: 0,
                dry: 0,
                foul: 0,
                scratch: 0
            },
            frames: 0,
            goldenBreaks: 0,
            reverseApples: 0
        },
        home: 
        {
            apples: 0,
            breaks: 
            {
                in: 0,
                dry: 0,
                foul: 0,
                scratch: 0
            },
            frames: 0,
            goldenBreaks: 0,
            reverseApples: 0
        }
    },
    history: 
    {
        "breaks-event": [],
        "breaks-player": [],
        "frames-result": [],
        "frames-winner": [],
        "frames-duration": []
    },
    info: null
};

import { UpdateMatchSummary } from "../matches/match_summary.js";
import { UpdateMatchTimingGraph } from "../matches/match_timingGraph.js";
import { UpdateMatch } from "../matches/match_inputs.js";

Initialize();

async function Initialize()
{
    match = await getMatchData();    
    await UpdateMatchPlayers(match);
    await UpdateMatch(match);

    console.log('Source: Match', match);

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
    const response = await supabase.from('tbl_matches_new').select('*').eq('id', _matchID);
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
      { event: 'UPDATE', schema: 'public', table: 'tbl_matches_new', filter: `id=eq.${_matchID}` },
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

async function UpdateMatchPlayers (match)
{
    const response = await supabase.from('tbl_players').select('*').in('username', [match.players.home.username, match.players.away.username]);
    if (response.error)
    {
        console.error('Error fetching player data:', response.error);
        return;
    }

    const players = response.data;

    // Step 1: Find the player data for the home player using their username
    const homePlayerData = players.find(player => player.username === match.players.home.username);

    // Step 2: Check if the player data exists and extract the name, otherwise fallback to existing fullName or username
    const homePlayerName = homePlayerData 
        ? `${homePlayerData.name}${homePlayerData.surname ? ' ' + homePlayerData.surname : ''}` 
        : match.players.home.fullName || match.players.home.username;

    // Step 3: Assign the resolved name to the home player's fullName property in the match object
    match.players.home.fullName = homePlayerName;
    match.players.home.id = homePlayerData?.id || match.players.home.id || null;
    match.players.home.nickname = homePlayerData?.nickname || match.players.home.nickname || null;

    // Step 1: Find the player data for the home player using their username
    const awayPlayerData = players.find(player => player.username === match.players.away.username);

    // Step 2: Check if the player data exists and extract the name, otherwise fallback to existing fullName or username
    const awayPlayerName = awayPlayerData 
        ? `${awayPlayerData.name}${awayPlayerData.surname ? ' ' + awayPlayerData.surname : ''}` 
        : match.players.away.fullName || match.players.away.username;

    // Step 3: Assign the resolved name to the away player's fullName property in the match object
    match.players.away.fullName = awayPlayerName;
    match.players.away.id = awayPlayerData?.id || match.players.away.id || null;
    match.players.away.nickname = awayPlayerData?.nickname || match.players.away.nickname || null;

    if (match.players.home.id) {
        const r_H = await supabase.storage.from('bucket-profile-pics').getPublicUrl(match.players.home.id);
        if (r_H.data && r_H.data.publicUrl && !r_H.data.publicUrl.endsWith('null')) {
            const imgElement_H = document.getElementById('player-H-pic');
            if (imgElement_H) {
                const img = new Image();
                img.onload = () => {
                    imgElement_H.src = r_H.data.publicUrl;
                };
                img.src = r_H.data.publicUrl;
            }
            match.players.home.pp = r_H.data.publicUrl;
        }
    }

    if (match.players.away.id) {
        const r_A = await supabase.storage.from('bucket-profile-pics').getPublicUrl(match.players.away.id);
        if (r_A.data && r_A.data.publicUrl && !r_A.data.publicUrl.endsWith('null')) {
            const imgElement_A = document.getElementById('player-A-pic');
            if (imgElement_A) {
                const img = new Image();
                img.onload = () => {
                    imgElement_A.src = r_A.data.publicUrl;
                };
                img.src = r_A.data.publicUrl;
            }
            match.players.away.pp = r_A.data.publicUrl;
        }
    }
}