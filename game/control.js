//Mark game instance as active
//Controls
//When complete, a single function to update all submittions for this round with correct results
//Compile leaderboard and store in game data
    //then update main leaderboard in game

var data = 
{
    gameID: "",
    round: 0,
    game: {},
    gameData: {},
    characterNames: [],
    playerTurn: 0,
    users: {}
};

Initialize();

async function Initialize ()
{
    //Game ID
    var gameID = GetGameID();
    if (gameID)
    {
        //Round
        var round = new URLSearchParams(window.location.search).get('round');
        //Game
        var game = await GetGame(gameID);
        if (game.id)
        {
            //Game Data
            var gameData = await GetGameData(game.id, round);
            //Users
            var gameUsers = await GetUsers(game.id, round);
            //Update Data
            data = 
            {
                gameID: game.id,
                round: round,
                game: game,
                gameData: gameData,
                characterNames: [], // Initialize characterNames as an empty array
                users: gameUsers
            }
            console.log(data);
            
            await UpdateCalculatedFields();
            InitializeUI();
        }
    }
}

function GetGameID() 
{
    var gameID = new URLSearchParams(window.location.search).get('gameID');
    if (!gameID) 
    {
        gameID = localStorage.getItem('gameID')||sessionStorage.getItem('gameID');
    }
    if (gameID)
    {
        localStorage.setItem('gameID', gameID);
        sessionStorage.setItem('gameID', gameID);
        return gameID;
    } else 
    {
        return null;
    }
}

async function GetGame (_gameID)
{
    const response = await supabase.from('tbl_games').select('*').eq('id', _gameID);
    if (response.error)
    {
        return response.error.message;
    } else 
    {
        return response.data[0];
    }
}

async function GetGameData (_gameID, _round)
{
    const response = await supabase.from('tbl_game_data').select('*').eq('gameID', _gameID).eq('round', _round);
    if (response.error)
    {
        return response.error.message;
    } else 
    {
        return response.data[0];
    }
}

async function GetUsers (_gameID, _round)
{
    const response = await supabase.from('tbl_game_users').select('*').eq('gameID', _gameID).eq('round', _round);
    if (response.error)
    {
        return response.error.message;
    } else 
    {
        return response.data;
    }
}

async function UpdateCalculatedFields() 
{
    await UpdateCharacterNames();
    UpdateScores();
    UpdateRanking();
    await SaveResults();
    CalculatePlayerTurn();

    //TEMP
    InitializeUI();
}

async function UpdateCharacterNames() 
{
    for (var i = 0; i < data.gameData.characters.length; i++) 
    {
        const response = await supabase.from('tbl_players').select('name, surname, nickname').eq('id', data.gameData.characters[i]);
        if (response.error) 
        {
            console.log(response.error.message);
        } 
        else 
        {
            var allNames = response.data[0];
            var fullName = allNames.name || "";
            if (allNames.nickname) 
            {
                fullName += " " + allNames.nickname;
            } 
            else if (allNames.surname) 
            {
                fullName += " " + allNames.surname;
            }
            data.characterNames.push(fullName);
        }
    }
}

function UpdateScores() 
{
    var scores = [];
    for (var i = 0; i < data.gameData.characters.length; i++) 
    {
        var score = data.gameData.startLives;
        for (var j = 0; j < data.gameData.results.history[i].length; j++) 
        {
            if (data.gameData.results.history[i][j] === "*") 
            {
                score++;
            } 
            else 
            {
                score += data.gameData.results.history[i][j];
            }
        }
        scores.push(score);
    }
    data.gameData.results.scores = scores;
}

function UpdateRanking() 
{
    var scores = data.gameData.results.scores;
    var ranking = scores
        .map((score, index) => ({ score, character: data.gameData.characters[index] }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.character);
    data.gameData.results.ranking = ranking;
}

document.getElementById("btn-push").addEventListener("click", async function() 
{
    await SaveResults();
    console.log("Results saved successfully.");
});

async function SaveResults() 
{
    await supabase.from('tbl_game_data').update({'results': data.gameData.results }).eq('gameID', data.gameID).eq('round', data.round).select();
}

function CalculatePlayerTurn() 
{
    var playerTurn = 0;
    if (data.gameData.results.history.length > 0) 
    {
        for (var i = 0; i < data.gameData.characters.length; i++) 
        {
            if (data.gameData.results.history[i].length < data.gameData.results.history[0].length) 
            {
                playerTurn = i;
                break;
            }
        }
    }
    data.playerTurn = playerTurn;
    console.log("Turn:", data.characterNames[data.playerTurn]);
}

async function UpdateHistory(_playerIndex, _score)
{
    data.gameData.results.history[_playerIndex].push(_score);

    //TEMP
    await UpdateCalculatedFields();
    console.log(data.gameData.results);    
}

document.getElementById("btn-score-0").addEventListener("click", async function() {
    await UpdateHistory(data.playerTurn, 0);
});

document.getElementById("btn-score--1").addEventListener("click", async function() {
    await UpdateHistory(data.playerTurn, -1);
});

document.getElementById("btn-score-8").addEventListener("click", async function() {
    await UpdateHistory(data.playerTurn, "*");
});

document.getElementById("btn-score-RR").addEventListener("click", function() {
    for (var i = 0; i < data.gameData.results.order.length; i++) {
        var ballId = "b" + data.gameData.results.order[i];
        var ballElement = document.getElementById(ballId);
        document.getElementById("scorecard-balls").appendChild(ballElement);
    }
});

/*UI*/
function InitializeUI ()
{
    PopulateCharacters(data.characterNames);
}

function UpdateUI ()
{

}

async function PopulateCharacters (_characters)
{
    var parentElement = document.getElementById("players");
    parentElement.innerHTML = "";

    var scorecardTable = document.getElementById("tbl-scorecard").getElementsByTagName('tbody')[0];
    scorecardTable.innerHTML = ""; // Clear the contents of the body before adding new rows    

    
    // Create header row
    var headerRow = scorecardTable.insertRow();
    var cellTurnsHeader = headerRow.insertCell(0);
    cellTurnsHeader.textContent = "Turns";

    for (var k = 0; k < _characters.length; k++) 
    {
        var cellPlayerHeader = headerRow.insertCell(k + 1);
        cellPlayerHeader.textContent = data.characterNames[k];
    }

    // Create start row
    var startRow = scorecardTable.insertRow();
    var cellStartLabel = startRow.insertCell(0);
    cellStartLabel.textContent = "Start";

    for (var k = 0; k < _characters.length; k++) 
    {
        var cellStartValue = startRow.insertCell(k + 1);
        cellStartValue.textContent = data.gameData.startLives;
    }

    

    for (var i = 0; i < _characters.length; i++)
    { 
        //Create Card
        var card = document.createElement("div");
        card.className = "card rounded text-center card-component killers-card-player";
        
        var cardHeader = document.createElement("div");
        cardHeader.className = "card-header";
        cardHeader.id = `lbl-P_${i}-name`;
        cardHeader.textContent = `${i}. ` + _characters[i] || `Player_${i}`;
        
        var cardBody = document.createElement("div");
        cardBody.className = "card-body";
        
        var score = document.createElement("p");
        score.id = `lbl-P_${i}-score`;
        score.textContent = data.gameData.results.scores[i];
        
        cardBody.appendChild(score);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        parentElement.appendChild(card);

        // Create Scorecard Entry
                
    }

    // Create turn rows
    // Clear existing turn rows before adding new ones
    while (scorecardTable.rows.length > 2) {
        scorecardTable.deleteRow(2);
    }

    var maxTurns = Math.max(...data.gameData.results.history.map(history => history.length));
    for (var j = 0; j < maxTurns; j++) {
        var turnRow = scorecardTable.insertRow();
        var cellTurnLabel = turnRow.insertCell(0);
        cellTurnLabel.textContent = `Turn ${j + 1}`;

        for (var k = 0; k < _characters.length; k++) {
            var cellTurnValue = turnRow.insertCell(k + 1);
            if (data.gameData.results.history[k] && data.gameData.results.history[k][j] !== undefined) {
                if (data.gameData.results.history[k][j] == "*") {
                    cellTurnValue.textContent = "8-Ball";
                } else if (data.gameData.results.history[k][j] == 0) {
                    cellTurnValue.textContent = "Survived";
                } else if (data.gameData.results.history[k][j] == -1) {
                    cellTurnValue.textContent = "Lost Life";
                } else {
                    cellTurnValue.textContent = "+" + data.gameData.results.history[k][j];
                }
            } else {
                cellTurnValue.textContent = "Turn";
            }
        }
    }

    for (var i = 0; i < data.gameData.results.order.length; i++) 
    {
        var ballId = "b" + data.gameData.results.order[i];
        var ballElement = document.getElementById(ballId);
        document.getElementById("scorecard-balls").appendChild(ballElement);
    }

    var newRow = scorecardTable.insertRow();
    var cellLives = newRow.insertCell(0);
    cellLives.textContent = "Lives";

    for (var i = 0; i < data.gameData.results.scores.length; i++) {
        var cell = newRow.insertCell(i + 1);
        cell.textContent = data.gameData.results.scores[i];
    }
}