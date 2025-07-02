Initialize();

async function Initialize ()
{
    const matchData = await getMatchData();
    if (matchData)
    {
        console.log('Match Data:', matchData);
        UpdateProfiles(matchData);
    }
    else 
    {
        const homeContainer = document.getElementById('player-home-container');
        const awayContainer = document.getElementById('player-away-container');

        homeContainer.style.setProperty('display', 'none', 'important');
        awayContainer.style.setProperty('display', 'none', 'important');

        console.error('No match data found.');

        return;
    }
}

async function getMatchData() 
{
    const matchID = GetMatchID();
    var match = null;
    if (matchID)
    {
        match = await GetMatch(matchID);
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
        const subResponse = await SubscribeToUpdates(_matchID);
        console.log('Subscription Response:', subResponse);
        UpdateScores(response.data[0]);
        return response.data[0];
    }
}

function UpdateProfiles (match)
{
    if (!match || !match.players) return;

    // Home player
    const homePlayer = match.players.h;
    if (homePlayer) {
        const homePP = document.getElementById('player-home-pp');
        const homeName = document.getElementById('player-home-name');
        if (homePP) homePP.src = homePlayer.pp || '../resources/images/img_Player_9x16_alpha.png';
        homeName.textContent = (homePlayer.fullName ? homePlayer.fullName.split(' ')[0] : '');
    }

    // Away player
    const awayPlayer = match.players.a;
    if (awayPlayer) {
        const awayPP = document.getElementById('player-away-pp');
        const awayName = document.getElementById('player-away-name');
        if (awayPP) awayPP.src = awayPlayer.pp || '../resources/images/img_Player_9x16_alpha.png';
        awayName.textContent = (awayPlayer.fullName ? awayPlayer.fullName.split(' ')[0] : '');
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
    console.log('Payload Received:', payload);
    UpdateScores(payload.new);
}

function UpdateScores (match)
{
    if (!match || !match.results) return;

    const homeScoreElem = document.getElementById('player-home-score');
    const awayScoreElem = document.getElementById('player-away-score');

    const homeScore = match.results.h.fw || 0;
    const awayScore = match.results.a.fw || 0;

    if (homeScoreElem) homeScoreElem.textContent = homeScore.toString();
    if (awayScoreElem) awayScoreElem.textContent = awayScore.toString();
}