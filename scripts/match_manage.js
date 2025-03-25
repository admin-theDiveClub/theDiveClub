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
    scorecardView: 1
};
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

            if (data.match.player_H && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.match.player_H)) {
                data.player_H = await GetPlayerName(data.match.player_H);
            } else 
            {
                data.player_H = data.match.player_H;
            }
            
            if (data.match.player_A && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.match.player_A)) {
                data.player_A = await GetPlayerName(data.match.player_A);
            } else 
            {
                data.player_A = data.match.player_A;
            }

            data.scorecard = data.match.scorecard;
            data.score = GetCurrentScore(data.scorecard);
        }
    }    

    console.log("All Data:", data);
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
        return null;
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

async function GetPlayerName (_playerID)
{
    const response = await supabase.from('tbl_players').select('name, surname').eq('id', _playerID);
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
    
    UpdateData();
});

document.getElementById('btn-score-H-A').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.H, "A");
    UpdateScorecard(data.scorecard.A, 0);
    
    UpdateData();
});

document.getElementById('btn-score-A-1').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.A, 1);
    UpdateScorecard(data.scorecard.H, 0);
    
    UpdateData();
});

document.getElementById('btn-score-A-A').addEventListener('click', function() 
{
    UpdateScorecard(data.scorecard.A, "A");
    UpdateScorecard(data.scorecard.H, 0);
    
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
    
    UpdateData();
});

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
        lag: data.match.lag
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
        'lag': _results.lag
    }).eq('id', data.id).select();

    if (response.error)
    {
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

//Update UI
function UpdateUI() 
{
    // Update player names and scores in the UI
    document.querySelectorAll('[id^="lbl-H-name"]').forEach(el => el.textContent = data.player_H + (data.match.lag === "Home" ? " *" : ""));
    document.querySelectorAll('[id^="lbl-A-name"]').forEach(el => el.textContent = data.player_A + (data.match.lag === "Away" ? " *" : ""));
    document.querySelectorAll('[id^="lbl-H-score"]').forEach(el => el.innerHTML = `${data.score.H}`);
    document.querySelectorAll('[id^="lbl-A-score"]').forEach(el => el.innerHTML = `${data.score.A}`);
    document.querySelectorAll('[id^="lbl-H-apples"]').forEach(el => el.innerHTML = `<i class="bi bi-apple"></i>: ${data.score.H_Apples}`);
    document.querySelectorAll('[id^="lbl-A-apples"]').forEach(el => el.innerHTML = `<i class="bi bi-apple"></i>: ${data.score.A_Apples}`);

    // Determine the maximum number of frames between both players
    const maxFrames = Math.max(data.scorecard.H.length, data.scorecard.A.length);
    
    // Get the scorecard table element
    const table = document.querySelector('#tbl-scorecard');

    // Clear existing table content
    table.innerHTML = '';

    if (data.scorecardView == 0) {
        // Create table head
        const tableHead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.innerHTML = '<th>Frame:</th>';
        for (let i = 1; i <= maxFrames; i++) {
            headRow.innerHTML += `<th>${i}</th>`;
        }
        headRow.innerHTML += '<th>Score:</th><th>Apples:</th>'; // Add Score and Apples columns
        tableHead.appendChild(headRow);
        table.appendChild(tableHead);

        // Create table body
        const tableBody = document.createElement('tbody');
        const bodyRowH = document.createElement('tr');
        const bodyRowA = document.createElement('tr');

        bodyRowH.innerHTML = `<td id="lbl-H-name">${data.player_H + (data.match.lag === "Home" ? " *" : "")}</td>`;
        bodyRowA.innerHTML = `<td id="lbl-A-name">${data.player_A + (data.match.lag === "Away" ? " *" : "")}</td>`;

        for (let i = 0; i < maxFrames; i++) {
            const scoreH = data.scorecard.H[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.H[i]}</span>` : data.scorecard.H[i] || '-';
            const scoreA = data.scorecard.A[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.A[i]}</span>` : data.scorecard.A[i] || '-';
            bodyRowH.innerHTML += `<td>${scoreH}</td>`;
            bodyRowA.innerHTML += `<td>${scoreA}</td>`;
        }

        // Add scores and apples to the new columns
        bodyRowH.innerHTML += `<td style="font-weight: bold;">${data.score.H}</td><td>${data.score.H_Apples}</td>`;
        bodyRowA.innerHTML += `<td style="font-weight: bold;">${data.score.A}</td><td>${data.score.A_Apples}</td>`;

        tableBody.appendChild(bodyRowH);
        tableBody.appendChild(bodyRowA);
        table.appendChild(tableBody);
    } else {
        // Create table head
        const tableHead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.innerHTML = '<th>Frame:</th><th id="lbl-H-name">' + data.player_H + (data.match.lag === "Home" ? " *" : "") + '</th><th id="lbl-A-name">' + data.player_A + (data.match.lag === "Away" ? " *" : "") + '</th>';
        tableHead.appendChild(headRow);
        table.appendChild(tableHead);

        // Create table body
        const tableBody = document.createElement('tbody');

        for (let i = 0; i < maxFrames; i++) {
            const bodyRow = document.createElement('tr');
            if (i === maxFrames - 1) {
                const scoreH = data.scorecard.H[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.H[i]}</span>` : data.scorecard.H[i] || '-';
                const scoreA = data.scorecard.A[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.A[i]}</span>` : data.scorecard.A[i] || '-';
                bodyRow.innerHTML = `<td id="cell-score-final">${i + 1}</td><td id="cell-score-final">${scoreH}</td><td id="cell-score-final">${scoreA}</td>`;
            } else {
                const scoreH = data.scorecard.H[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.H[i]}</span>` : data.scorecard.H[i] || '-';
                const scoreA = data.scorecard.A[i] === "A" ? `<span style="color: rgba(230, 161, 0, 1);">${data.scorecard.A[i]}</span>` : data.scorecard.A[i] || '-';
                bodyRow.innerHTML = `<td>${i + 1}</td><td>${scoreH}</td><td>${scoreA}</td>`;
            }
            tableBody.appendChild(bodyRow);
        }

        // Add row for score at the end
        const scoreRow = document.createElement('tr');
        scoreRow.innerHTML = `<td id="cell-score-final"><b>Score</b></td><td style="font-weight: bold"; id="cell-score-final">${data.score.H}</td><td style="font-weight: bold;" id="cell-score-final">${data.score.A}</td>`;
        tableBody.appendChild(scoreRow);

        // Add row for apples at the end
        const applesRow = document.createElement('tr');
        applesRow.innerHTML = `<td id="cell-apples-final">Apples</td><td id="cell-apples-final">${data.score.H_Apples}</td><td id="cell-apples-final">${data.score.A_Apples}</td>`;
        tableBody.appendChild(applesRow);

        table.appendChild(tableBody);
    }

    // Populate select-lag with player options
    const selectLag = document.getElementById('select-lag');
    selectLag.innerHTML = `
        <option value="0" ${data.match.lag === "Home" ? "selected" : ""}>${data.player_H}</option>
        <option value="1" ${data.match.lag === "Away" ? "selected" : ""}>${data.player_A}</option>
    `;

    // Show break indicator based on lag and scorecard length
    document.querySelectorAll('[id^="lbl-break-indicator-H"]').forEach(el => {
        el.style.display = (data.match.lag === "Home" && data.scorecard.H.length % 2 === 0) || (data.match.lag === "Away" && data.scorecard.A.length % 2 !== 0) ? 'block' : 'none';
    });
    document.querySelectorAll('[id^="lbl-break-indicator-A"]').forEach(el => {
        el.style.display = (data.match.lag === "Away" && data.scorecard.A.length % 2 === 0) || (data.match.lag === "Home" && data.scorecard.H.length % 2 !== 0) ? 'block' : 'none';
    });
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