//Get League ID from local storage / url
//Get All Players for league
//Get All Tournaments (Rounds) for league
//Get All Matches for tournaments
//Build log data from matches
//Display log data

//log: [players]
var log = [];

BuildLog();
DrawGraph();

async function BuildLog ()
{
    const leagueID = GetLeagueID();
    console.log('League ID:', leagueID);

    const league = await GetLeague(leagueID);
    console.log('League Details:', league);

    var leaguePlayers = league.players;
    log = await CreateLogObjects(leaguePlayers);
    console.log('Log:', log);

    PopulateTable(log);
}

function GetLeagueID()
{
    var leagueID = new URLSearchParams(window.location.search).get('leagueID');
    if (!leagueID)
    {
        leagueID = localStorage.getItem('leagueID');
    }
    localStorage.setItem('leagueID', leagueID);
    return leagueID;
}

async function GetLeague (_leagueID)
{
    const response = await supabase.from('tbl_leagues').select('*').eq('id', _leagueID);
    return response.data[0];
}

async function CreateLogObjects (_playerIDs)
{
    var logObjects = [];
    for (var i = 0; i < _playerIDs.length; i++)
    {
        var logObject = 
        {
            id: _playerIDs[i],
            rank: i + 1,
            name: await GetPlayerName(_playerIDs[i]),
            played: 0,
            won: 0,
            lost: 0,
            apples: 0,
            points: 0,
            history:
            {
                matches: [],
                points: []
            }
        };
        logObjects.push(logObject);
    }
    return logObjects;
}

async function GetPlayerName (_playerID)
{
    const response = await supabase.from('tbl_players').select('name', 'surname').eq('id', _playerID);
    return response.data[0];
}

async function GetPlayerName (_playerID)
{
    const response = await supabase.from('tbl_players').select('name', 'surname').eq('id', _playerID);
    var fullName = '';
    if (response.data[0].name)
    {
        fullName += response.data[0].name;
    }
    if (response.data[0].surname = "")
    {
        fullName += response.data[0].surname;
    } else 
    {
        fullName += ' *';
    }
    return fullName;
}

function PopulateTable (_log)
{
    var tableBody = document.querySelector('table tbody');
    tableBody.innerHTML = '';

    _log.forEach(player => {
        var row = document.createElement('tr');

        var rankCell = document.createElement('td');
        rankCell.textContent = player.rank;
        row.appendChild(rankCell);

        var nameCell = document.createElement('td');
        nameCell.textContent = player.name;
        row.appendChild(nameCell);

        var playedCell = document.createElement('td');
        playedCell.textContent = player.played;
        row.appendChild(playedCell);

        var wonCell = document.createElement('td');
        wonCell.textContent = player.won;
        row.appendChild(wonCell);

        var lostCell = document.createElement('td');
        lostCell.textContent = player.lost;
        row.appendChild(lostCell);

        var applesCell = document.createElement('td');
        applesCell.textContent = player.apples;
        row.appendChild(applesCell);

        var pointsCell = document.createElement('td');
        pointsCell.textContent = player.points;
        row.appendChild(pointsCell);

        tableBody.appendChild(row);
    });
}


function DrawGraph ()
{
    const labels = ["17/05", "24/05", "Round 3", "Round 4", "Round 5", "Round 6", "Round 7"];
    const data = 
    {
        labels: labels,
        datasets: 
        [
            {
                label: 'Player 1',
                data: [7, 7, 10, 7, 7, 7, 4],
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            },

            {
                label: 'Player 2',
                data: [7, 7, 10, 10, 7, 7],
                fill: false,
                borderColor: 'rgb(192, 112, 75)',
                tension: 0.2
            }
        ]    
    };

    const config = 
    {
        type: 'line',
        data: data,
        options: 
        {
            scales: 
            {
                y: 
                {
                    beginAtZero: false,
                    grid: 
                    {
                        display: false
                    }
                },
                x: 
                {
                    grid: 
                    {
                        display: false
                    }
                }
            }
        }
    };

    const ctx = document.getElementById('myChart').getContext('2d');
    if (ctx) {
        const myChart = new Chart(ctx, config);
    } else {
        console.error('Element with ID "myChart" not found.');
    }
}
