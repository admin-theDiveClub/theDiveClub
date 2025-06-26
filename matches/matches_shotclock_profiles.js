Initialize();

async function Initialize ()
{
    const matchData = await getMatchData();
    if (matchData)
    {
        console.log('Match Data:', matchData);
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