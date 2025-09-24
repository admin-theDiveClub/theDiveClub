/*
Get User from session and match to match players.
    If no user in session and 
    user is not league or tournament coordinator, 
        redirect to scoreboard view.

Get Match ID from URL.
    Get Match Data from supabase using Match ID and subscribe to live updates.

Setup Update call with log information.


*/

Initialize();
function Initialize ()
{
    const session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
    if (session && session.user && session.user.email)
    {
        Start_MatchData();
    } else 
    {
        const matchID = _matchID();
        if (matchID)
        {
            window.location.href = `../matches/scoreboard.html?matchID=${matchID}`;
        } else 
        {
            window.location.href = "../matches/create.html";
        }
    }
}

import { Initialize_MatchUI } from '../matches/match_UI.js';
import { UpdateMatchUI } from '../matches/match_UI.js';

async function Start_MatchData ()
{
    const matchID = _matchID();
    //console.log("Match ID: ", matchID);

    if (matchID)
    {
        const matchRef = await _match(matchID);

        if (matchRef)
        {
            const approvedList = await _matchApprovedList(matchRef);
            //console.log("Approved List: ", approvedList);

            const userID = await _userID();
            //console.log("User ID: ", userID);

            if (userID && approvedList.includes(userID))
            {
                match = matchRef;
                console.log("User Approved to Edit Match:", match);
                await Initialize_MatchUI(match);

                OnPayloadReceived(match);

                const subResponse = await SubscribeToUpdates(matchID);
                if (subResponse.error)
                {
                    console.log("Subscription Error:", subResponse.error.message);
                }
                //console.log("Subscribed to Match Updates:", subResponse);
            } else 
            {
                window.location.href = `../matches/scoreboard.html?matchID=${matchID}`;
            }
        }
    }
}

async function _userID ()
{
    var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
    if (session && session.user && session.user.email)
    {
        const response = await supabase.from('tbl_players').select('id').eq('username', session.user.email).single();
        if (response.data && response.data.id)
        {
            const playerID = response.data.id;
            return playerID;
        } else 
        {
            return null;
        }
    } else 
    {
        return null;
    }
}

function _matchID () 
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
    return null;
  }
}

async function _match (matchID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('id', matchID).single();
    if (response.error)
    {
        console.log("Error Getting Match:", response.error.message);
        return null;
    } else 
    {
        return response.data;
    }
}

async function _matchApprovedList (match)
{
    var approvedListIDs = [];
    if (match.competitions && match.competitions.leagueID)
    {
        const response = await supabase.from('tbl_leagues').select('coordinatorID').eq('id', match.competitions.leagueID).single();
        if (response.data && response.data.coordinatorID)
        {
            approvedListIDs.push(response.data.coordinatorID);
        }
    }

    if (match.competitions && match.competitions.tournamentID)
    {
        const response = await supabase.from('tbl_tournaments').select('coordinatorID').eq('id', match.competitions.tournamentID).single();
        if (response.data && response.data.coordinatorID)
        {
            approvedListIDs.push(response.data.coordinatorID);
        }
    }

    if (match.players && match.players.h)
    {
        if (match.players.h.id)
        {
            approvedListIDs.push(match.players.h.id);
        }
    }

    if (match.players && match.players.a)
    {
        if (match.players.a.id)
        {
            approvedListIDs.push(match.players.a.id);
        }
    }

    return approvedListIDs;
}

async function SubscribeToUpdates (_matchID)
{
  const channels = supabase.channel('custom-update-channel')
  .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tbl_matches', filter: `id=eq.${_matchID}` },
      (payload) => 
      {
        //console.log('Source: Change Received!', payload.new);
        OnPayloadReceived(payload.new);
      }
  )
  .subscribe();
  return channels;
}

var match = null;

function OnPayloadReceived (payload)
{
    UpdateMatchUI(payload);
}