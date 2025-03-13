/*
Populate scorecard_credentials
    Check for player profiles
        If profile found, 
            then get playerID and populate scorecard_credentials with playerID
            else use playerName and populate scorecard_credentials with playerName

Create scorecard (tbl_scorecards) for new match -> scorecardID recieved + scorecardLink created.
Populate scorecard with scorecard_credentials

Use real-time supabase updates to populate scorecard with scorecard_credentials.

function updateLag("H"/"A")
    when lag is changed, update database with new lag value
    Re-populate scorecard with scorecard_credentials (Break Indicator will be updated across scorecard)

function addScore_Home(score = "0"/"1"/"A"/"Z")
    case score = "0", then         
        scorecard_H += "0"
        scorecard_A += "1";
    case score = "1", then
        scorecard_H += "1"
        scorecard_A += "0";
    case score = "A", then
        scorecard_H += "A"
        scorecard_A += "0";
    case score = "Z", then
        scorecard_H += "0"
        scorecard_A += "A";

    update both scorecard_H and scorecard_A in database with new score
    Re-populate scorecard with scorecard_credentials

function removeScore()
    remove last score from both scorecard_H and scorecard_A in database
    Re-populate scorecard with scorecard_credentials


*/

var _scorecardID = null;
var credentials_scoreCard;

document.getElementById('btn_createNewMatch').addEventListener('click', () => 
{
    var player_H = document.getElementById('inp_player_H').value;
    var player_A = document.getElementById('inp_player_A').value;
    if (player_H != "" && player_A != "")
    {
        CreateNewMatch(player_H, player_A);
    }
});

document.getElementById('btn_addScore_H').addEventListener('click', async () => 
{
    if (_scorecardID != null)
    {
        credentials_scoreCard = await UpdateScore_Home(_scorecardID, "1");
    }
});

document.getElementById('btn_addScore_A').addEventListener('click', async () => 
{
    if (_scorecardID != null)
    {
        credentials_scoreCard = await UpdateScore_Home(_scorecardID, "0");
    }
});

document.getElementById('btn_addApple_H').addEventListener('click', async () => 
{
    if (_scorecardID != null)
    {
        credentials_scoreCard = await UpdateScore_Home(_scorecardID, "A");
    }
});

document.getElementById('btn_addApple_A').addEventListener('click', async () => 
{
    if (_scorecardID != null)
    {
        credentials_scoreCard = await UpdateScore_Home(_scorecardID, "Z");
    }
});

document.getElementById('btn_removeLastScore').addEventListener('click', async () =>
{
    if (_scorecardID != null)
    {
        credentials_scoreCard = await RemoveLastScore();
    }
});

start();

async function start ()
{
    _scorecardID = getScorecardIDFromURL();
    
    if (_scorecardID)
    {
        SubscribeToScoreCard(_scorecardID);
        var r_credentials = await supabase.from('tbl_scorecards').select('*').eq('id', _scorecardID);
        credentials_scoreCard = r_credentials.data[0];
        UpdateUI(credentials_scoreCard);
    }
}

function getScorecardIDFromURL ()
{
    const urlParams = new URLSearchParams(window.location.search);
    var scorecardID = urlParams.get('scorecardID');
    if (scorecardID)
    {
        localStorage.setItem('scorecardID', scorecardID);
        return scorecardID;
    } else if (localStorage.getItem('scorecardID'))
    {
        scorecardID = localStorage.getItem('scorecardID');
        return scorecardID;
    }

    return null;
}

async function CreateNewMatch (_player_H, _player_A)
{
    var playerHProfile = await GetPlayerProfile(_player_H);
    var playerAProfile = await GetPlayerProfile(_player_A);

    if (playerHProfile)
    {
        _player_H = playerHProfile.id;
    }

    if (playerAProfile)
    {
        _player_A = playerAProfile.id;
    }

    var newScorecard = await CreateNewScorecardInDB(_player_H, _player_A);
    _scorecardID = newScorecard.id;
    localStorage.setItem('scorecardID', _scorecardID);

    SubscribeToScoreCard(_scorecardID);
    credentials_scoreCard = newScorecard;
    UpdateUI(credentials_scoreCard);
}

async function SubscribeToScoreCard (_scorecardID)
{
    const channels = supabase.channel('custom-update-channel')
    .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tbl_scorecards', filter: `id=eq.${_scorecardID}` },
        (payload) => {
        //console.log('Change received!', payload.new);
        credentials_scoreCard = payload.new;        
        UpdateUI(credentials_scoreCard);
        }
    )
    .subscribe();
}

async function GetPlayerProfile (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    if (response.error)
    {
        return null;   
    } else 
    {
        return response.data[0];
    }
}

async function CreateNewScorecardInDB (_playerH, _playerA)
{
    const response = await supabase.from('tbl_scorecards').insert({player_H: _playerH, player_A: _playerA}).select();
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0];
    }
}

async function UpdateScore_Home (_scorecardID, _score)
{
    var r_currentScore = await supabase.from('tbl_scorecards').select('scorecard_H, scorecard_A').eq('id', _scorecardID);
    var currentScore_H = r_currentScore.data[0].scorecard_H;
    var currentScore_A = r_currentScore.data[0].scorecard_A;

    var s_H, s_A;

    switch (_score) 
    {
        case "0":
            s_H = "0";
            s_A = "1";
            break;
        case "1":
            s_H = "1";
            s_A = "0";
            break;
        case "A":
            s_H = "A";
            s_A = "0";
            break;
        case "Z":
            s_H = "0";
            s_A = "A";
            break;
        default:
            s_H = "";
            s_A = "";
            break;
    }

    var newScore_H, newScore_A;

    if (currentScore_H == null || currentScore_A == null)
    {
        newScore_H = s_H;
        newScore_A = s_A;
    } else 
    {
        newScore_H = currentScore_H + s_H;
        newScore_A = currentScore_A + s_A;
    }

    var response = await supabase.from('tbl_scorecards').update({scorecard_H: newScore_H, scorecard_A: newScore_A}).eq('id', _scorecardID).select();
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0];
    }
}

async function RemoveLastScore ()
{
    var r_currentScore = await supabase.from('tbl_scorecards').select('scorecard_H, scorecard_A').eq('id', _scorecardID);
    var currentScore_H = r_currentScore.data[0].scorecard_H;
    var currentScore_A = r_currentScore.data[0].scorecard_A;

    var newScore_H = currentScore_H.slice(0, currentScore_H.length - 1);
    var newScore_A = currentScore_A.slice(0, currentScore_A.length - 1);

    var response = await supabase.from('tbl_scorecards').update({scorecard_H: newScore_H, scorecard_A: newScore_A}).eq('id', _scorecardID).select();
    if (response.error)
    {
        return null;
    } else 
    {
        UpdateUI(response.data[0]);
        return response.data[0];
    }
}

async function GetPlayerName(_id)
{
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(_id)) {
        return null;
    }
    const response = await supabase.from('tbl_players').select('name, surname').eq('id', _id);
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0].name + " " + response.data[0].surname;
    }
}

async function UpdateUI (_credentials)
{
    document.getElementById('txt_newMatch_response').textContent = _scorecardID;

    var playerName_H = await GetPlayerName(_credentials.player_H);
    var playerName_A = await GetPlayerName(_credentials.player_A);

    if (playerName_H == null)
    {
        playerName_H = _credentials.player_H;
    }

    if (playerName_A == null)
    {
        playerName_A = _credentials.player_A;
    }

    document.getElementById('player_H_name').textContent = playerName_H;
    document.getElementById('player_A_name').textContent = playerName_A;

    var scorecard_H = _credentials.scorecard_H;
    var score_H = 0;

    var scorecard_A = _credentials.scorecard_A;
    var score_A = 0;

    if (scorecard_H != null)
    {
        for (var i = 0; i < scorecard_H.length; i++)
        {
            if (scorecard_H[i] == "1" || scorecard_H[i] == "A")
            {
                score_H++;
            }
    
            if (scorecard_A[i] == "1" || scorecard_A[i] == "A")
            {
                score_A++;
            }
        }
    }
    

    document.getElementById('txt_score_H').textContent = score_H;
    document.getElementById('txt_score_A').textContent = score_A;

    //Rebuild Table
        //Headers
    var tr = document.getElementById('scoreCard_header');
    tr.innerHTML = '';
    var th = document.createElement('th');
    th.textContent = 'Players';
    tr.appendChild(th);

    if (scorecard_H != null)
    {
        for (var i = 0; i < scorecard_H.length; i++)
        {
            th = document.createElement('th');
            th.textContent = "Frame " + (i + 1);
            tr.appendChild(th);
        }
    }    

    var tr = document.getElementById('scoreCard_header');
    var th = document.createElement('th');
    th.textContent = 'Scores';

    var div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'flex-end';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-danger';
    btn.id = 'btn_removeLastScore';
    btn.textContent = '-';
    btn.addEventListener('click', () => {
        RemoveLastScore();
    });

    div.appendChild(btn);
    th.appendChild(div);
    tr.appendChild(th);

    // Home Player
    tr = document.getElementById('scoreCard_row_H');
    tr.innerHTML = '';
    var td = document.createElement('td');
    td.textContent = playerName_H;
    tr.appendChild(td);

    
    if (scorecard_H != null)
    {
        for (var i = 0; i < scorecard_H.length; i++)
        {
            td = document.createElement('td');
            td.textContent = scorecard_H[i];
            if (scorecard_H[i] == "A") {
                td.style.backgroundColor = 'gold';
            }
            tr.appendChild(td);
        }
    }      

    // Away Player
    tr = document.getElementById('scoreCard_row_A');
    tr.innerHTML = '';
    td = document.createElement('td');
    td.textContent = playerName_A;
    tr.appendChild(td);

    if (scorecard_H != null)
    {
        for (var i = 0; i < scorecard_A.length; i++)
        {
            td = document.createElement('td');
            td.textContent = scorecard_A[i];
            if (scorecard_A[i] == "A") {
                td.style.backgroundColor = 'gold';
            }
            tr.appendChild(td);
        }
    }    

    // Scores
    tr = document.getElementById('scoreCard_row_H');
    td = document.createElement('td');
    td.textContent = score_H;
    tr.appendChild(td);

    tr = document.getElementById('scoreCard_row_A');
    td = document.createElement('td');
    td.textContent = score_A;
    tr.appendChild(td);
}
/*
document.getElementById('player_search').addEventListener('input', handlePlayerSearch);

async function handlePlayerSearch(event) {
    const searchValue = event.target.value;
    const players = await fetchPlayers(searchValue);
    if (!players) return;
    updateUIWithPlayers(players);
}

async function fetchPlayers(searchValue) {
    const response = await supabase.from('tbl_players').select('*').or(`name.ilike.%${searchValue}%,surname.ilike.%${searchValue}%,username.ilike.%${searchValue}%`);
    if (response.error) {
        console.error('Error fetching players:', response.error);
        return null;
    }
    return response.data;
}

function updateUIWithPlayers(players) {
    const playersList = document.getElementById('players_list');
    playersList.innerHTML = '';
    players.forEach(player => {
        const button = createPlayerButton(player);
        playersList.appendChild(button);
    });
}

function createPlayerButton(player) {
    const button = document.createElement('button');
    button.textContent = `${player.name} ${player.surname}`;
    button.className = 'list-group-item list-group-item-action';
    button.addEventListener('click', () => handlePlayerSelection(player));
    return button;
}

async function handlePlayerSelection(player) {
    console.log(`Player selected: ${player.name} ${player.surname}`);
    document.getElementById('players_list').innerHTML = '';
    const scorecards = await fetchPlayerScorecards(player.id);
    if (!scorecards) return;
    updateUIWithScorecards(scorecards);
}

async function fetchPlayerScorecards(playerId) {
    const response = await supabase.from('tbl_scorecards').select('*').or(`player_H.eq.${playerId},player_A.eq.${playerId}`);
    if (response.error) {
        console.error('Error fetching player scorecards:', response.error);
        return null;
    }
    return response.data;
}

function updateUIWithScorecards(scorecards) {
    const scorecardList_Player = document.getElementById('scorecardList_Player');
    scorecardList_Player.innerHTML = '';
    scorecards.forEach(scorecard => {
        const scorecardButton = createScorecardButton(scorecard);
        scorecardList_Player.appendChild(scorecardButton);
    });
}

function createScorecardButton(scorecard) {
    const button = document.createElement('button');
    button.textContent = `Scorecard ID: ${scorecard.id}`;
    button.className = 'list-group-item list-group-item-action';
    button.addEventListener('click', () => handleScorecardSelection(scorecard.id));
    return button;
}

function handleScorecardSelection(scorecardId) {
    console.log(`Scorecard selected: ${scorecardId}`);
    window.location.href = `${window.location.pathname}?scorecardID=${scorecardId}`;
}*/