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

Initialize();

async function Initialize()
{
    match = await getMatchData();    
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
}