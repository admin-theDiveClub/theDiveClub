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
    CalculatePlayerTurn();

    //TEMP
    InitializeUI();
}

async function UpdateCharacterNames() 
{
    data.characterNames = [];
    for (var i = 0; i < data.gameData.characters.length; i++) 
    {
        const response = await supabase.from('tbl_players').select('name, surname, nickname').eq('id', data.gameData.characters[i]);
        if (response.error) 
        {
            console.log(response.error.message);
            data.characterNames.push(data.gameData.characters[i]);
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
            if (typeof data.gameData.results.history[i][j] === "string" && data.gameData.results.history[i][j].includes("*")) 
            {
                let value = data.gameData.results.history[i][j].replace("*", "");
                score += parseInt(value, 10) || 0;
                score++;
            } else 
            {
                score += parseInt(data.gameData.results.history[i][j], 10) || 0;
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
});

async function SaveResults() 
{
    var response = await supabase.from('tbl_game_data').update({'results': data.gameData.results }).eq('gameID', data.gameID).eq('round', data.round).select();
    console.log("Save Result:", response);
    document.getElementById("push-result").textContent = JSON.stringify(response.data[0].results, null, 2);
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

async function UpdateHistory(_playerIndex, _score, _balls)
{
    data.gameData.results.history[_playerIndex].push(_score);

    if (!data.gameData.results.order) 
    {
        data.gameData.results.order = [];
    }
    data.gameData.results.order.push(...ballsSelected);

    console.log("Updated Results: ", data.characterNames[_playerIndex], _score, _balls);
    const pushQueElement = document.getElementById("push-que");
    const updateElement = document.createElement("p");
    updateElement.textContent = 
        "Update: " + data.characterNames[_playerIndex] + " - " + _score + " (" + _balls + ")";
    pushQueElement.appendChild(updateElement);

    ballsSelected = [];

    //TEMP
    await UpdateCalculatedFields();
    PopulateScorecard();
    console.log("Updated (Waiting for Push):", data);    
}

var ballsSelected = [];

function AttachBallEventListeners() 
{
    const buttons = document.querySelectorAll(".btn.icon-ball");
    buttons.forEach(button => {
        button.addEventListener("click", function () {
            const ballNumber = parseInt(this.id.replace("b", ""));
            if (!ballsSelected.includes(ballNumber)) {
                ballsSelected.push(ballNumber);
                console.log("Ball selected:", ballNumber);
                console.log("Balls selected:", ballsSelected);
            }
        });
    });
}

AttachBallEventListeners();

document.getElementById("btn-score-0").addEventListener("click", async function() 
{
    if (ballsSelected.length == 1)
    {
        if (ballsSelected[0] == 8)
        {
            await UpdateHistory(data.playerTurn, "*", ballsSelected);
        } else
        {
            await UpdateHistory(data.playerTurn, 0, ballsSelected);
        }
    } else if (ballsSelected.length < 1)
    {
        console.log("No balls selected.");
    } else if (ballsSelected.length > 1)
    {
        console.log("Too many balls selected.");
    }
});

document.getElementById("btn-score--1").addEventListener("click", async function() {
    await UpdateHistory(data.playerTurn, -1, []);
});

document.getElementById("btn-score-Foul").addEventListener("click", async function() {
    await UpdateHistory(data.playerTurn, -2, ballsSelected);
});

document.getElementById("btn-extra-lives").addEventListener("click", async function() {
    const extraLivesInput = document.getElementById("extra-lives-input");
    const extraLives = parseInt(extraLivesInput.value, 10);

    if (!isNaN(extraLives) && extraLives > 0) {
        if (ballsSelected.includes(8)) 
        {
            var lives = extraLives + "*";
            await UpdateHistory(data.playerTurn, lives, ballsSelected);
        } else {
            await UpdateHistory(data.playerTurn, extraLives, ballsSelected);
        }
        extraLivesInput.value = ""; // Clear the input field after processing
    } else {
        console.log("Invalid input for extra lives.");
    }
});

document.getElementById("btn-score-RR").addEventListener("click", function() {
    for (var i = 0; i < data.gameData.results.order.length; i++) {
        var ballId = "b" + data.gameData.results.order[i];
        var ballElement = document.getElementById(ballId);
        document.getElementById("scorecard-balls").appendChild(ballElement);
    }
});

document.getElementById("btn-correction").addEventListener("click", function() {
    ballsSelected = [];
    console.log("Balls selected cleared:", ballsSelected);
});

/*UI*/
function InitializeUI ()
{
    PopulateCharacters(data.characterNames);
    PopulateScorecard();
}

function UpdateUI ()
{

}

async function PopulateCharacters (_characters)
{
    var parentElement = document.getElementById("players");
    parentElement.innerHTML = ""; 

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
        cardHeader.classList.add("killers-character-header");
        
        var score = document.createElement("p");
        score.id = `lbl-P_${i}-score`;
        score.textContent = data.gameData.results.scores[i];
        score.classList.add("killers-character-score");
        
        cardBody.appendChild(score);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        parentElement.appendChild(card);

        if (i == data.playerTurn) {
            var turnIndicator = document.createElement("div");
            turnIndicator.className = "btn btn-secondary";
            turnIndicator.id = "turn-indicator";
            turnIndicator.textContent = "TURN";
            cardBody.appendChild(turnIndicator);
        }
    }
}

function PopulateScorecard ()
{
    var table = document.getElementById("tbl-scorecard");
    var thead = table.querySelector("thead");
    var tbody = table.querySelector("tbody");

    // Clear existing content
    thead.innerHTML = "";
    tbody.innerHTML = "";

    // Create headers
    var headerRow = document.createElement("tr");
    var turnHeader = document.createElement("th");
    turnHeader.textContent = "Turn";
    headerRow.appendChild(turnHeader);

    for (var i = 0; i < data.characterNames.length; i++) 
    {
        var characterHeader = document.createElement("th");
        characterHeader.textContent = data.characterNames[i];
        headerRow.appendChild(characterHeader);
    }

    thead.appendChild(headerRow);

    // Create rows
    var startRow = document.createElement("tr");
    var startTurnCell = document.createElement("td");
    startTurnCell.textContent = "Start";
    startRow.appendChild(startTurnCell);

    for (var i = 0; i < data.gameData.characters.length; i++) 
    {
        var startCell = document.createElement("td");
        startCell.textContent = data.gameData.startLives;
        startRow.appendChild(startCell);
    }

    tbody.appendChild(startRow);

    var mostTurns = 0;
    for (var i = 0; i < data.gameData.results.history.length; i++) 
    {
        if (data.gameData.results.history[i].length > mostTurns) 
        {
            mostTurns = data.gameData.results.history[i].length;
        }
    }

    for (var turn = 0; turn < mostTurns; turn++) 
    {
        var row = document.createElement("tr");
        var turnCell = document.createElement("td");
        turnCell.textContent = turn + 1;
        row.appendChild(turnCell);        

        for (var i = 0; i < data.gameData.results.history.length; i++) 
        {
            var cell = document.createElement("td");

            var turnText = "Turn";
            var h = data.gameData.results.history[i][turn];
            if (typeof h === "string" && h.includes("*")) 
            {
                h = h.replace("*", "");
                const remainingText = parseInt(h, 10) || "";
                if (remainingText != "")
                {
                    turnText = "8-Ball (+" + remainingText + ")";
                } else 
                {
                    turnText = "8-Ball";
                }
                
            }
            else if (h == 0) 
            {
                turnText = "Survived";
            } 
            else if (h == -1) 
            {
                turnText = "Miss";
            } 
            else if (h == -2) 
            {
                turnText = "Foul";
            } 
            else if (h > 0) 
            {
                turnText = "+" + h;
            } else 
            {
                cell.textContent = turnText;
                row.appendChild(cell);
                break;
            }

            cell.textContent = turnText;
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    // Create Lives row
    var livesRow = document.createElement("tr");
    var livesHeaderCell = document.createElement("td");
    livesHeaderCell.textContent = "Lives:";
    livesRow.appendChild(livesHeaderCell);

    for (var i = 0; i < data.gameData.results.scores.length; i++) 
    {
        var livesCell = document.createElement("td");
        livesCell.textContent = data.gameData.results.scores[i];
        livesRow.appendChild(livesCell);
    }

    tbody.appendChild(livesRow);
}

