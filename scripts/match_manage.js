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
    player_H: "",
    player_A: "",
    scorecard: {},
    score: {},
    scorecardView: 1,
    frameStartTime: sessionStorage.getItem('frameStartTime') || 0,
    timing: [],
    startTime: null
};

if (!data.frameStartTime || data.frameStartTime === "0") {
    data.frameStartTime = null; // Set to null if invalid or zero
    sessionStorage.removeItem('frameStartTime'); // Clear invalid session storage value
}

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

            if (data.match.player_H && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.match.player_H)) 
            {
                data.player_H = await GetPlayerName(data.match.player_H, "ID");
            } else if (data.match.player_H.includes("@")) 
            {
                data.player_H = await GetPlayerName(data.match.player_H, "email");
            } else 
            {
                data.player_H = data.match.player_H;
            }
            
            if (data.match.player_A && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.match.player_A)) 
            {
                data.player_A = await GetPlayerName(data.match.player_A, "ID");
            } else if (data.match.player_A.includes("@")) 
            {
                data.player_A = await GetPlayerName(data.match.player_A, "email");
            } else 
            {
                data.player_A = data.match.player_A;
            }

            data.scorecard = data.match.scorecard;
            data.score = GetCurrentScore(data.scorecard);
            data.timing = data.match.timing || [];
        }
    }    

    console.log("All Data:", data);
    InitializeMatchType();
    SetupInputListeners();
    UpdateUI();
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
    //console.log('Change received!', payload.new);
    data.match = payload.new;
    data.scorecard = data.match.scorecard;
    data.score = GetCurrentScore(data.scorecard);
    console.log("Match Updated, new Data:", data);
    UpdateUI();
    //CODE
}

//Remember: Check tournament status and update match status accordingly. If tournament is not live, match should not be live.

/////////////NEW

async function GetPlayerName (_playerID, mode)
{    
    var response = null;
    if (mode == "ID")
    {
        response = await supabase.from('tbl_players').select('name, surname').eq('id', _playerID);
    } else if (mode == "email")
    {
        response = await supabase.from('tbl_players').select('name, surname').eq('username', _playerID);
    }

    if (response.error)
    {
        return null;
    } else 
    {
        var fullname = response.data[0].name;
        if (response.data[0].surname)
        {
            fullname += " " + response.data[0].surname;
        }
        return fullname;
    }
}

function GetCurrentScore (_scorecard)
{
    var score_H = 0;
    var apples_H = 0;
    var score_A = 0;
    var apples_A = 0;

    for (var i = 0; i < _scorecard.H.length; i++)
    {
        if (_scorecard.H[i] == "A")
        {
            apples_H ++;
            score_H ++;
        } else 
        {
            score_H += _scorecard.H[i];
        }
    }

    for (var i = 0; i < _scorecard.A.length; i++)
    {
        if (_scorecard.A[i] == "A")
        {
            apples_A ++;
            score_A ++;
        } else 
        {
            score_A += _scorecard.A[i];
        }
    }

    var score = 
    {
        H: score_H, 
        H_Apples: apples_H, 
        A: score_A,
        A_Apples: apples_A
    };
    return score;
}

document.getElementById('btn-score-H-1').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.H, 1);
    UpdateScorecard(data.scorecard.A, 0);
    
    UpdateTimeStamps(Date.now());

    UpdateData();
});

document.getElementById('btn-score-H-A').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.H, "A");
    UpdateScorecard(data.scorecard.A, 0);
    
    UpdateTimeStamps(Date.now());

    UpdateData();
});

document.getElementById('btn-score-A-1').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.A, 1);
    UpdateScorecard(data.scorecard.H, 0);
    
    UpdateTimeStamps(Date.now());
    
    UpdateData();
});

document.getElementById('btn-score-A-A').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.A, "A");
    UpdateScorecard(data.scorecard.H, 0);
    
    UpdateTimeStamps(Date.now());
    
    UpdateData();
});

document.getElementById('btn-correction').addEventListener('click', function() 
{
    // Logic to correct the last score entry for both players
    if (data.scorecard.H.length > 0) {
        data.scorecard.H.pop();
    }
    if (data.scorecard.A.length > 0) {
        data.scorecard.A.pop();
    }

    UpdateTimeStamps(null);
    
    UpdateData();
});

document.getElementById('btn-timer-start').addEventListener('click', function() 
{
    data.frameStartTime = Date.now();
    sessionStorage.setItem('frameStartTime', data.frameStartTime);
    console.log("Timer started at:", new Date(data.frameStartTime).toLocaleTimeString());
    UpdateUI();
});

document.getElementById('btn-timer-stop').addEventListener('click', function() 
{
    data.frameStartTime = 0;
    sessionStorage.setItem('frameStartTime', 0);
    console.log("Timer stopped");
    UpdateUI();
});

function UpdateTimeStamps (_new)
{
    if (data.frameStartTime != 0)
    {
        if (_new)
        {
            var frameTime = Math.round((_new - data.frameStartTime) / 1000);
            data.timing.push(frameTime);
            data.frameStartTime = _new;
            sessionStorage.setItem('frameStartTime', data.frameStartTime);
        } else 
        {
            data.timing.pop();
        }
    }    
}

function UpdateData ()
{    
    data.score = GetCurrentScore(data.scorecard);

    var results = 
    {
        result_H: data.score.H,
        result_A: data.score.A,
        apples_H: data.score.H_Apples,
        apples_A: data.score.A_Apples,
        scorecard: data.scorecard,
        lag: data.match.lag,
        timing: data.timing
    };

    PushResults(results);
}

function UpdateScorecard (_player, _score)
{
    _player.push(_score);
}

async function PushResults (_results)
{
    const response = await supabase.from('tbl_matches').update({
        'scorecard': _results.scorecard,
        'result_A': _results.result_A,
        'result_H': _results.result_H,
        'apples_A': _results.apples_A,
        'apples_H': _results.apples_H,
        'lag': _results.lag,
        'timing': _results.timing,
        'winCondition': data.match.winCondition,
    }).eq('id', data.id).select();

    if (response.error)
    {
        console.error("Error updating match results:", response.error.message);
        return null;
    } else 
    {
        UpdateUI();
        return response.data[0];
    }
}

document.getElementById('btn-scorecard-view').addEventListener('click', function() 
{
    data.scorecardView = data.scorecardView === 0 ? 1 : 0;
    UpdateUI();
});

// Initialize match type inputs based on winCondition
function InitializeMatchType() {
    const winCondition = data.match.winCondition;

    if (!winCondition) {
        document.getElementById('freePlay').checked = true;
    } else 
    {
        document.getElementById('raceToBestOf').checked = true;
        document.getElementById('raceToValue').value = winCondition || '';
        document.getElementById('bestOfValue').value = (winCondition * 2 - 1);
    }
}

// Add event listeners for Race To and Best Of inputs
function SetupInputListeners() {
    const raceToInput = document.getElementById('raceToValue');
    const bestOfInput = document.getElementById('bestOfValue');

    raceToInput.addEventListener('input', function () {
        const raceTo = parseInt(raceToInput.value);
        if (!isNaN(raceTo)) {
            bestOfInput.value = (2 * raceTo) - 1;
            data.match.winCondition = raceTo; // Update winCondition
        }
    });

    bestOfInput.addEventListener('input', function () {
        const bestOf = parseInt(bestOfInput.value);
        if (!isNaN(bestOf)) {
            const raceTo = Math.ceil((bestOf + 1) / 2);
            raceToInput.value = raceTo;
            data.match.winCondition = raceTo; // Update winCondition
        }
    });
}

// Update UI and handle win conditions
function UpdateUI() 
{
    const uiData = 
    {
        player_H: data.player_H,
        player_A: data.player_A,
        score_H: `${data.score.H}`,
        score_A: `${data.score.A}`,
        apples_H: `<i class="bi bi-apple"></i>: ${data.score.H_Apples}`,
        apples_A: `<i class="bi bi-apple"></i>: ${data.score.A_Apples}`,
        frameStartTime: "",
        lastTiming: FormatLastTiming(),
        maxFrames: Math.max(data.scorecard.H.length, data.scorecard.A.length),
        totalTime: FormatTotalTime(),
        averageTime: FormatAverageTime(),
    };

    if (data.match.lag === "Home") {
        uiData.player_H += " *";
    } else if (data.match.lag === "Away") {
        uiData.player_A += " *";
    }

    if (data.frameStartTime === null || data.frameStartTime === 0) {
        uiData.frameStartTime = "Timer Off";
    } else {
        uiData.frameStartTime = "Frame Started at: " + new Date(Number(data.frameStartTime)).toLocaleTimeString();
    }

    UpdatePlayerLabels(uiData);
    UpdateTimers(uiData);
    UpdateScorecardTable(uiData);
    UpdateLagSelector(uiData);
    UpdateBreakIndicators(uiData);

    const matchType = document.querySelector('input[name="matchType"]:checked').value;

    // Check for win condition (skip if freeplay)
    if (matchType !== 'freePlay') 
    {
        const maxScore = Math.max(data.score.H, data.score.A);
        if (maxScore >= data.match.winCondition) 
        {
            const winner = data.score.H > data.score.A ? data.player_H : data.player_A;
            alert(`${winner} wins the match!`);

            data.frameStartTime = 0;
            sessionStorage.setItem('frameStartTime', 0);
            uiData.frameStartTime = "Timer Off";
            UpdateTimers(uiData);
            console.log("Timer stopped");
        }
    }
}

function UpdatePlayerLabels (uiData) 
{
    document.querySelectorAll('[id^="lbl-H-name"]').forEach(el => el.textContent = uiData.player_H);
    document.querySelectorAll('[id^="lbl-A-name"]').forEach(el => el.textContent = uiData.player_A);
    document.querySelectorAll('[id^="lbl-H-score"]').forEach(el => el.innerHTML = uiData.score_H);
    document.querySelectorAll('[id^="lbl-A-score"]').forEach(el => el.innerHTML = uiData.score_A);
    document.querySelectorAll('[id^="lbl-H-apples"]').forEach(el => el.innerHTML = uiData.apples_H);
    document.querySelectorAll('[id^="lbl-A-apples"]').forEach(el => el.innerHTML = uiData.apples_A);
}

function UpdateTimers (uiData) 
{
    const timeFrameStartElement = document.getElementById('time-frame-start');
    if (timeFrameStartElement) 
    {
        timeFrameStartElement.textContent = uiData.frameStartTime;
        const btnTimerStart = document.getElementById('btn-timer-start');
        if (btnTimerStart) 
        {
            if (data.frameStartTime === 0 || data.frameStartTime === null) {
                btnTimerStart.textContent = "Start Frame Timer";
                btnTimerStart.classList.add('btn-success');
                btnTimerStart.classList.remove('btn-warning');
            } else {
                btnTimerStart.textContent = "Re-start Frame Timer";
                btnTimerStart.classList.add('btn-warning');
                btnTimerStart.classList.remove('btn-success');
            }
        }
    }

    const timeFrameLastElement = document.getElementById('time-frame-last');
    if (timeFrameLastElement) 
    {
        timeFrameLastElement.textContent = uiData.lastTiming;
    }
}

function UpdateScorecardTable (uiData) 
{
    const table = document.querySelector('#tbl-scorecard');
    table.innerHTML = '';

    if (data.scorecardView === 0) 
    {
        CreateRowScorecardTable(uiData, table);
    } 
    else 
    {
        CreateColumnScorecardTable(uiData, table);
    }
}

function CreateRowScorecardTable (uiData, table) 
{
    const tableHead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th>Frame:</th>' + Array.from({ length: uiData.maxFrames }, (_, i) => `<th>${i + 1}</th>`).join('') + '<th>Score:</th><th>Apples:</th>';
    tableHead.appendChild(headRow);
    table.appendChild(tableHead);

    const tableBody = document.createElement('tbody');
    const bodyRowH = CreateScoreRow(uiData.player_H, data.scorecard.H, uiData.score_H, uiData.apples_H);
    const bodyRowA = CreateScoreRow(uiData.player_A, data.scorecard.A, uiData.score_A, uiData.apples_A);
    const bodyRowTime = CreateTimeRow(uiData);

    tableBody.appendChild(bodyRowH);
    tableBody.appendChild(bodyRowA);
    tableBody.appendChild(bodyRowTime);
    table.appendChild(tableBody);
}

function CreateColumnScorecardTable (uiData, table) 
{
    const tableHead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.innerHTML = `<th>Frame:</th><th>${uiData.player_H}</th><th>${uiData.player_A}</th><th>Time</th>`;
    tableHead.appendChild(headRow);
    table.appendChild(tableHead);

    const tableBody = document.createElement('tbody');
    for (let i = 0; i < uiData.maxFrames; i++) 
    {
        const bodyRow = document.createElement('tr');
        const scoreH = FormatScore(data.scorecard.H[i]);
        const scoreA = FormatScore(data.scorecard.A[i]);
        const time = data.timing[i] ? `${Math.ceil(data.timing[i] / 60)} min` : '-';
        bodyRow.innerHTML = `<td>${i + 1}</td><td>${scoreH}</td><td>${scoreA}</td><td>${time}</td>`;
        tableBody.appendChild(bodyRow);
    }

    const scoreRow = document.createElement('tr');
    scoreRow.innerHTML = `<td><b>Score</b></td><td>${uiData.score_H}</td><td>${uiData.score_A}</td><td>Total: ${uiData.totalTime}</td>`;
    tableBody.appendChild(scoreRow);

    const applesRow = document.createElement('tr');
    applesRow.innerHTML = `<td>Apples</td><td>${uiData.apples_H}</td><td>${uiData.apples_A}</td><td>Avg: ${uiData.averageTime}</td>`;
    tableBody.appendChild(applesRow);

    table.appendChild(tableBody);
}

function UpdateLagSelector (uiData) 
{
    const selectLag = document.getElementById('select-lag');
    selectLag.innerHTML = `
        <option value="" disabled ${!data.match.lag ? "selected" : ""}>Select Lag</option>
        <option value="0" ${data.match.lag === "Home" ? "selected" : ""}>${uiData.player_H}</option>
        <option value="1" ${data.match.lag === "Away" ? "selected" : ""}>${uiData.player_A}</option>
    `;
}

function UpdateBreakIndicators (uiData) 
{
    document.querySelectorAll('[id^="lbl-break-indicator-H"]').forEach(el => 
    {
        el.style.display = (data.match.lag === "Home" && data.scorecard.H.length % 2 === 0) || (data.match.lag === "Away" && data.scorecard.A.length % 2 !== 0) ? 'block' : 'none';
    });
    document.querySelectorAll('[id^="lbl-break-indicator-A"]').forEach(el => 
    {
        el.style.display = (data.match.lag === "Away" && data.scorecard.A.length % 2 === 0) || (data.match.lag === "Home" && data.scorecard.H.length % 2 !== 0) ? 'block' : 'none';
    });
}

function CreateScoreRow (playerName, scorecard, totalScore, apples) 
{
    const row = document.createElement('tr');
    row.innerHTML = `<td>${playerName}</td>` + scorecard.map(score => `<td>${FormatScore(score)}</td>`).join('') + `<td>${totalScore}</td><td>${apples}</td>`;
    return row;
}

function CreateTimeRow (uiData) 
{
    const row = document.createElement('tr');
    row.innerHTML = '<td>Time:</td>' + data.timing.map(time => `<td>${Math.ceil(time / 60)} min</td>`).join('') + `<td>Total: ${uiData.totalTime}</td><td>Avg: ${uiData.averageTime}</td>`;
    return row;
}

function FormatScore (score) 
{
    return score === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${score}</span>` : score || '-';
}

function FormatLastTiming () 
{
    const lastTiming = data.timing.length > 0 ? data.timing[data.timing.length - 1] : "No Times";
    return typeof lastTiming === "number" && lastTiming > 60 ? `Last Frame: ${Math.ceil(lastTiming / 60)} min` : `Last Frame: ${lastTiming}`;
}

function FormatTotalTime () 
{
    const totalTime = data.timing.reduce((a, b) => a + b, 0);
    return totalTime > 3600
        ? `${Math.floor(totalTime / 3600)} hr ${Math.floor((totalTime % 3600) / 60)} min`
        : totalTime > 60
        ? `${Math.floor(totalTime / 60)} min`
        : `${totalTime} sec`;
}

function FormatAverageTime () 
{
    return data.timing.length > 0 ? Math.ceil(data.timing.reduce((a, b) => a + b, 0) / data.timing.length / 60) : '-';
}

document.getElementById('select-lag').addEventListener('change', function(event) 
{
    if (event.target.value == "0") {
        data.match.lag = "Home";
    } else  if (event.target.value == "1") {
        data.match.lag = "Away";
    }
    UpdateData();
    console.log("Lag updated:", data.match.lag);
});