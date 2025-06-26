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
        if (homeContainer?.style) {
            homeContainer.style.setProperty('display', 'none', 'important');
        }
        const awayContainer = document.getElementById('player-away-container');
        if (awayContainer?.style) {
            awayContainer.style.setProperty('display', 'none', 'important');
        }
        console.error('No match data found.');
        return;
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'ArrowLeft') {
        const homeExt = document.getElementById('player-home-extension');
        if (homeExt) {
            homeExt.style.display = (homeExt.style.display === 'none' || homeExt.style.display === '') ? 'block' : 'none';
        }
    }
    if (event.key === 'ArrowRight') {
        const awayExt = document.getElementById('player-away-extension');
        if (awayExt) {
            awayExt.style.display = (awayExt.style.display === 'none' || awayExt.style.display === '') ? 'block' : 'none';
        }
    }
});

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
    const response = await supabase.from('tbl_matches_new').select('*').eq('id', _matchID);
    if (response.error)
    {
      return null;
    } else 
    {
      return response.data[0];
    }
}

function UpdateProfiles (match)
{
    if (!match || !match.players) return;

    // Home player
    const homePlayer = match.players.home;
    if (homePlayer) {
        const homePP = document.getElementById('player-home-pp');
        const homeName = document.getElementById('player-home-name');
        if (homePP) homePP.src = homePlayer.pp || '../resources/images/img_Player_9x16_alpha.png';
        if (homeName) homeName.textContent = homePlayer.fullName || '';
    }

    // Away player
    const awayPlayer = match.players.away;
    if (awayPlayer) {
        const awayPP = document.getElementById('player-away-pp');
        const awayName = document.getElementById('player-away-name');
        if (awayPP) awayPP.src = awayPlayer.pp || '../resources/images/img_Player_9x16_alpha.png';
        if (awayName) awayName.textContent = awayPlayer.fullName || '';
    }
}