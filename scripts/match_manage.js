//Get MatchID
//Get Match
//Get Tournament
//Get League
//Get Players

//Subscribe to live updates

//Match Timer

//Update Match ScoreCard
//Update Match Status
//Update Match Result
//Remove Scorecard Update UI

var data =
{
    id: null, 
    match: {},
};
PopulateData();

async function PopulateData ()
{    
    data.id = GetMatchID();
    if (data.id)
    {
        data.match = await GetMatch(data.id);
        if (data.match.id)
        {
            var subResponse = await SubscribeToUpdates(data.id);
            console.log("Subscribing to Updates:", subResponse);
        }
    }    

    console.log(data);
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
        return null;
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
        (payload) => {
        //console.log('Change received!', payload);
        OnPayloadReceived(payload);
        }
    )
    .subscribe();
    return channels;
}


//THIS IS NOT CALLED YET
async function UnsubscribeFromUpdates (channels)
{
    const response = await channels.unsubscribe();
    console.log('Unsubscribed from updates:', response);
    return response;
}

async function OnPayloadReceived (payload)
{
    console.log('Change received!', payload.new);
    //CODE
}