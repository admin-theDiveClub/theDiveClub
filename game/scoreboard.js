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
            InitializeUI();

            //Subscribe to updates
            await SubscribeToUpdates(game.id, data.round);
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

async function InitializeUI ()
{
    await UpdateCharacterNames();

    PopulateCharacters(data.characterNames);
    RemoveDeadCharacterCards();
    PopulateScorecard();
    UpdateBallsDown();
}

function UpdateUI ()
{
    UpdateScores();
    UpdateRanking();
    CalculatePlayerTurn();
    PopulateCharacters(data.characterNames);
    RemoveDeadCharacterCards();
    PopulateScorecard();
    UpdateBallsDown();
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
                turnText = "X";
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

async function SubscribeToUpdates (_gameID, _round)
{
    const channels = supabase.channel('custom-update-channel')
    .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tbl_game_data', filter: `gameID=eq.${_gameID}` },
        (payload) => {
        //console.log('Change received!', payload);
        OnPayloadReceived(payload);
        }
    )
    .subscribe();
    console.log("Subscribed to updates", channels);
    return channels;
}

function OnPayloadReceived (_payload)
{
    console.log("Payload Received", _payload);
    data.gameData = _payload.new;
    UpdateUI();
}

function UpdateBallsDown ()
{
    var ballsContainer = document.getElementById("scorecard-balls");
    ballsContainer.innerHTML = ""; // Clear existing buttons

    for (let i = 0; i < data.gameData.results.order.length; i++) {
        let ballButton = document.createElement("button");
        ballButton.className = "btn btn-primary icon-ball";
        ballButton.id = `b${i + 1}`;
        ballButton.textContent = data.gameData.results.order[i];
        ballsContainer.appendChild(ballButton);
    }
}