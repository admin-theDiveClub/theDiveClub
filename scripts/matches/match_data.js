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

import { UpdateMatchControls } from '../matches/match_Controls.js';

import { UpdateTimingData } from './match_Timer.js';

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
            const username = await _username();
            //console.log("User ID: ", userID);

            if (approvedList.includes(userID) || approvedList.includes(username))
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
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    if (userProfile && userProfile.id)
    {
        return userProfile.id;
    } else 
    {
        return null;
    }
}

async function _username ()
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    if (userProfile && userProfile.username)
    {
        return userProfile.username;
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
        const match = response.data;

        if (!match.players)
        {
            match.players =
            {
                h: {"username": null},
                a: {"username": null}
            }
        }
        
        if (!match.settings)
        {
            match.settings =
            {
                winType: null,
                winCondition: null,
                lagWinner: null,
                lagType: null,
                advancedBreaks: false
            }
        }

        if (!match.info)
        {
            match.info =
            {
                status: "new"
            }
        }

        if (!match.history)
        {
            match.history = [];
        }

        return match;
    }
}

async function _matchApprovedList (match)
{
    var approvedList = [];
    if (match.competitions && match.competitions.leagueID)
    {
        const response = await supabase.from('tbl_leagues').select('coordinatorID').eq('id', match.competitions.leagueID).single();
        if (response.data && response.data.coordinatorID)
        {
            approvedList.push(response.data.coordinatorID);
        }
    }

    if (match.competitions && match.competitions.tournamentID)
    {
        const response = await supabase.from('tbl_tournaments').select('coordinatorID').eq('id', match.competitions.tournamentID).single();
        if (response.data && response.data.coordinatorID)
        {
            approvedList.push(response.data.coordinatorID);
        }
    }

    if (match.players && match.players.h)
    {
        if (match.players.h.id)
        {
            approvedList.push(match.players.h.id);
        }

        if (match.players.h.username)
        {
            approvedList.push(match.players.h.username);
        }
    }

    if (match.players && match.players.a)
    {
        if (match.players.a.id)
        {
            approvedList.push(match.players.a.id);
        }

        if (match.players.a.username)
        {
            approvedList.push(match.players.a.username);
        }
    }

    return approvedList;
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

export function OnPayloadReceived (payload)
{
    UpdateMatchUI(payload);
    UpdateMatchControls(payload);
    UpdateTimingData(payload);
}