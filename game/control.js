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
            console.log("All Data", data);
            
            await UpdateCalculatedFields();
            InitializeUI();
        }
    }
}

//GET DATA

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


///////////////////

async function UpdateCalculatedFields() 
{
    await UpdateCharacterNames();
    UpdateScores();
    UpdateRanking();
    CalculatePlayerTurn();

    //TEMP
    InitializeUI();
    RemoveBallsAvailable(data.gameData.results.order);
}

async function UpdateCharacterNames() 
{
    data.characterNames = [];
    for (var i = 0; i < data.gameData.characters.length; i++) 
    {

        if (!data.gameData.characters[i] || typeof data.gameData.characters[i] !== "string" || !/^[0-9a-fA-F-]{36}$/.test(data.gameData.characters[i])) {
            data.characterNames.push(data.gameData.characters[i]);
            continue;
        }
        const response = await supabase.from('tbl_players').select('name, surname, nickname').eq('id', data.gameData.characters[i]);
        if (response.error) 
        {
            data.characterNames.push(data.gameData.characters[i]);
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
        if (!data.gameData.results.history[i])
        {
            data.gameData.results.history[i] = [];
        }
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
    await UpdateCalculatedFields();
    var response = await supabase.from('tbl_game_data').update({'results': data.gameData.results }).eq('gameID', data.gameID).eq('round', data.round).select();

    console.log("Save Result:", response);
    document.getElementById("push-que").innerHTML = "";
    document.getElementById("push-result").textContent = JSON.stringify(response.data[0].results, null, 2);
}

function CalculatePlayerTurn() 
{
    UpdateScores();

    var mostTurns = Math.max(...data.gameData.results.history.map(history => history.length));

    var playersIn = [];

    for (var i = 0; i < data.gameData.characters.length; i++)
    {
        if (data.gameData.results.scores[i] > 0)
        {
            playersIn.push(i);
        }
    }

    
    if (playersIn.length == 1)
    {
        alert("Game Over. Winner: " + data.characterNames[playersIn[0]]);
        const turnIndicator = document.getElementById("turn-indicator");
        turnIndicator.textContent = "Winner";
        turnIndicator.classList.remove("btn-secondary");
        turnIndicator.classList.add("btn-warning");
    }

    console.log("Players In:", playersIn);

    var playerTurn = playersIn[0];

    for (var i = 0; i < playersIn.length; i++) 
    {
        if (data.gameData.results.history[playersIn[i]].length < mostTurns) 
        {
            playerTurn = playersIn[i];
            break;
        }
    }

    data.playerTurn = playerTurn;
    console.warn("Turn:", data.characterNames[data.playerTurn]);
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
        "Update: " + data.characterNames[_playerIndex] + ": " + _score + " (" + _balls + ")";
    pushQueElement.appendChild(updateElement);

    RemoveBallsAvailable(ballsSelected);
    ballsSelected = [];


    //TEMP
    
    CalculatePlayerTurn();
    console.log("Updated (Waiting for Push):", data);   
    
    PopulateCharacters(data.characterNames);
    PopulateScorecard();
    RemoveDeadCharacterCards();
}

function RemoveBallsAvailable (_balls)
{
    for (let i = 0; i < _balls.length; i++) 
    {
        const index = ballsAvailable.indexOf(_balls[i]);
        if (index !== -1) {
            ballsAvailable.splice(index, 1);
        }
        const ballElement = document.getElementById(`b${_balls[i]}`);
        if (ballElement) {
            ballElement.style.display = "none";
        }
    }
}

var ballsSelected = [];
var ballsAvailable = Array.from({ length: 15 }, (_, i) => i + 1);

function AttachBallEventListeners() 
{
    const buttons = document.querySelectorAll(".btn.icon-ball");
    buttons.forEach(button => {
        const ballNumber = parseInt(button.id.replace("b", ""));
        if (!ballsAvailable.includes(ballNumber)) {
            button.style.display = "none";
        } else {
            button.addEventListener("click", function () {
                if (!ballsSelected.includes(ballNumber)) {
                    ballsSelected.push(ballNumber);
                    button.classList.remove("btn-primary");
                    button.classList.add("btn-warning");
                    //console.log("Balls selected:", ballsSelected);
                }
            });
        }
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
    var bTemp = ballsSelected;
    ballsSelected = [];
    await UpdateHistory(data.playerTurn, -1, []);
    ballsSelected = bTemp;
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
        extraLivesInput.value = "1"; // Clear the input field after processing
    } else {
        console.log("Invalid input for extra lives.");
    }
});

document.getElementById("btn-score-RR").addEventListener("click", function() {
    for (var i = 0; i < data.gameData.results.order.length; i++) {
        var ballId = "b" + data.gameData.results.order[i];
        var ballElement = document.getElementById(ballId);
        if (ballElement) {
            ballElement.style.display = "block";
        }
    }

    const ballElements = document.querySelectorAll(".btn.icon-ball");
    ballElements.forEach(ball => {
        ball.classList.remove("btn-warning");
        ball.classList.add("btn-primary");
    });
});

document.getElementById("btn-correction").addEventListener("click", function() {
    ballsSelected = [];
    const ballElements = document.querySelectorAll(".btn.icon-ball");
    ballElements.forEach(ball => {
        ball.classList.remove("btn-warning");
        ball.classList.add("btn-primary");
    });
    console.log("Balls selected cleared:", ballsSelected);
});

/*UI*/
function InitializeUI ()
{
    PopulateCharacters(data.characterNames);
    RemoveDeadCharacterCards();
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
        card.id = `card-P_${i}`;
        
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
                
            }else if (h == 0) 
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
            }

            let totalScore = data.gameData.startLives;
            for (let t = 0; t <= turn; t++) {
                if (data.gameData.results.history[i][t]) {
                    let score = data.gameData.results.history[i][t];
                    if (typeof score === "string" && score.includes("*")) 
                    {
                        score = score.replace("*", "");
                        score = parseInt(score, 10) || 0;
                        score++;
                    }
                    totalScore += parseInt(score, 10) || 0;
                }
            }
            if (totalScore < 1) 
            {
                cell.style.cssText = "color: red !important;";
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
        if (data.gameData.results.scores[i] < 1) 
        {
            livesCell.style.cssText = "color: red !important;";
        }
        livesRow.appendChild(livesCell);
    }

    tbody.appendChild(livesRow);
}

function RemoveDeadCharacterCards ()
{
    for (let i = 0; i < data.characterNames.length; i++) 
    {
        var card = document.getElementById(`card-P_${i}`);
        if (data.gameData.results.scores[i] < 1) 
        {
            card.style.display = "none";
        }
    }
}