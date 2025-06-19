var match = 
{
  id: "fcd35f2c-2eaa-41fb-9933-0288f7a2f6e0",
  tournamentID: null,
  player_H: "yuvannaidoo@gmail.com",
  player_A: "Junaid Ali",
  lag: "Away",
  result_H: 9,
  result_A: 8,
  apples_H: 0,
  apples_A: 0,
  scorecard: {
    A: [0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0],
    H: [1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1]
  },
  winCondition: 9,
  status: "New",
  verified: false,
  table: 2,
  timing: [942, 635, 608, 605, 840, 510, 553, 719, 647, 415, 591, 822, 561, 634, 906],
  startTime: "2025-05-19T17:09:25.789+00:00",
  endTime: null
}

window.addEventListener('resize', () => 
{
  isVertical = window.innerWidth < 665; // Vertical if screen size is small (sm), otherwise horizontal

  // Update chart container height based on orientation
  const chartContainer = document.getElementById('timeline-chart');
  chartContainer.style.height = isVertical ? '85vh' : '80vh';

  chartContainer.style.height = window.innerWidth > 1024 ? '35vh' : (isVertical ? '85vh' : '80vh');

  BuildBarGraph(match);
  UI_UpdateMatchSummary();
});

Initialize();

async function Initialize()
{
  var matchID = GetMatchID();
  var matchData = await GetMatch(matchID);
  if (matchData)
  {
    console.log('Match found:', matchData);
    match = matchData;
    var subscription = await SubscribeToUpdates(matchID);
    console.log('Subscribed to match updates:', subscription);
    
    await PopulatePlayerData(match);    
    await UI_UpdatePlayerProfiles();
    
    UI_UpdateScores();
    UI_UpdateMatchSummary();
    UpdateLagUI();
    UpdateWinConditionUI();   
    UpdateTimerUI(); 
    
    
    BuildBarGraph(match);
  }
}

function UpdateTimerUI ()
{
  if (!match.startTime) {
    document.getElementById('match-time-start').textContent = "Not Started.";
    document.getElementById('btn-timer-startMatch').disabled = false;
    document.getElementById('frame-time-start').textContent = "Frame Start Time: Not Started.";
    document.getElementById('match-time-end').textContent = "Match End Time: Not Started.";
  } else {
    document.getElementById('match-time-start').textContent = `Match Start Time: ${new Date(match.startTime).toLocaleString()}`;
    const startButton = document.getElementById('btn-timer-startMatch');
    startButton.disabled = true;
    startButton.textContent = "Match Started";
    startButton.classList.remove('btn-info');
    startButton.classList.add('btn-success');

    const frameStartTime = localStorage.getItem('frameStartTime') || sessionStorage.getItem('frameStartTime');
    document.getElementById('frame-time-start').textContent = frameStartTime 
      ? `Frame Start Time: ${new Date(frameStartTime).toLocaleString()}` 
      : "Frame Start Time: Not Started.";

    if (match.endTime && !window.location.href.includes("scoreboard.html")) {
      window.location.href = "../TopDeadCenter/scoreboard.html?matchID=" + match.id;
    }

    document.getElementById('match-time-end').textContent = match.endTime 
      ? `Match End Time: ${new Date(match.endTime).toLocaleString()}` 
      : "Match End Time: Ongoing.";
  }
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
      (payload) => 
      {
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
  console.log('Change received!', payload.new);
  match = payload.new;

  // Update player profiles if necessary
  if (match.player_A !== players.A.username || match.player_H !== players.H.username) {
    await PopulatePlayerData(match);
    await UI_UpdatePlayerProfiles();
  }

  // Update the bar graph with new data
  BuildBarGraph(match);

  // Update other UI elements
  UI_UpdateScores();
  UI_UpdateMatchSummary();
  UpdateWinConditionUI();

}


let isVertical = window.innerWidth < 665; // Vertical if screen size is small (sm), otherwise horizontal

// Update chart container height based on orientation
const chartContainer = document.getElementById('timeline-chart');
chartContainer.style.height = isVertical ? '85vh' : '80vh';

if (window.innerHeight > 750) {
  // If screen is large enough, set chart container height to 80vh
  chartContainer.style.height = '35vh';
}



/*
To Do:
- Update UI with match data
- Add match controls
  - Lag (Home/Away)
  - Timer (Start/Continue, Pause, Restart Frame, End Match, Restart Match)
  - Free Play, Race To/Best of, Fixed Frame Count
- Add final scores to chart and prep chart for screenshot output
- Connect buttons to match controls
*/


/* PLAYERS */
//Get Player Profiles
var players = 
{
  H:
  {
    anonymous: true,
    id: null,
    username: null,
    name: null,
    nickname: null    
  },
  A:
  {
    anonymous: true,
    id: null,
    username: null,
    name: null,
    nickname: null    
  }
}

async function PopulatePlayerData (match)
{
  response_H = await GetPlayerProfiles(match.player_H);
  if (response_H)
  {
    players.H.anonymous = false;
    players.H.id = response_H.id;
    players.H.username = response_H.username;
    players.H.name = response_H.surname ? `${response_H.name} ${response_H.surname}` : response_H.name;
    players.H.nickname = response_H.nickname;
  } else 
  {
    players.H.name = match.player_H;
    players.H.username = match.player_H;
  }

  response_A = await GetPlayerProfiles(match.player_A);
  if (response_A)
  {
    players.A.anonymous = false;
    players.A.id = response_A.id;
    players.A.username = response_A.username;
    players.A.name = response_A.surname ? `${response_A.name} ${response_A.surname}` : response_A.name;
    players.A.nickname = response_A.nickname;
  } else
  {
    players.A.name = match.player_A;
    players.A.username = match.player_A;
  }

  console.log("Players:", players);
}

async function GetPlayerProfiles(playerID)
{  
  var response = null;

  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(playerID)) 
  {
    response = await supabase.from('tbl_players').select('*').eq('id', playerID);
  } 
  else 
  {
    response = await supabase.from('tbl_players').select('*').eq('username', playerID);
  }

  return response.data[0];
}


/* UI */
//UI
async function UI_UpdatePlayerProfiles ()
{
  document.getElementById('player-H-nickname').textContent = 
    (players.H.nickname || players.H.name || '') + (match.lag === "Home" ? " *" : "");
  document.getElementById('player-H-name').textContent = players.H.name || players.H.username || 'Unknown Player';

  const r_H = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.H.id);
  if (r_H.data && r_H.data.publicUrl && !r_H.data.publicUrl.endsWith('null')) 
  {
    const imgElement_H = document.getElementById('player-H-pic');
    if (imgElement_H) {
      // Check if the URL returns an image
      const img = new Image();
      img.onload = () => {
        imgElement_H.src = r_H.data.publicUrl;
      };
      img.src = r_H.data.publicUrl;
    }
  }

  document.getElementById('player-A-nickname').textContent = 
  (players.A.nickname || players.A.name || '') + (match.lag === "Away" ? " *" : "");
  document.getElementById('player-A-name').textContent = players.A.name || players.A.username || 'Unknown Player';

  const r_A = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.A.id);
  if (r_A.data && r_A.data.publicUrl && !r_A.data.publicUrl.endsWith('null')) 
  {
    const imgElement_A = document.getElementById('player-A-pic');
    if (imgElement_A) {
      // Check if the URL returns an image
      const img = new Image();
      img.onload = () => {
        imgElement_A.src = r_A.data.publicUrl;
      };
      img.src = r_A.data.publicUrl;
    }
  }
}

function UI_UpdateScores ()
{
  document.getElementById('player-H-score').textContent = match.result_H;
  document.getElementById('player-H-apples').textContent = `A : ${match.apples_H}`;
  document.getElementById('player-H-C+').textContent = `C+ : ${match.reverseApples_H}`;

  document.getElementById('player-A-score').textContent = match.result_A;
  document.getElementById('player-A-apples').textContent = `A : ${match.apples_A}`;
  document.getElementById('player-A-C+').textContent = `C+ : ${match.reverseApples_A}`;

  UpdateLagUI();
}

function UpdateWinConditionUI()
{
  const selectedType = match.type || 'freePlay';
  document.querySelector(`input[name="matchType"][value="${selectedType}"]`).checked = true;

  if (selectedType === 'race') {
    document.getElementById('raceToValue').value = match.winCondition || '';
    updateBestOfFromRaceTo(match.winCondition || '');
  } else if (selectedType === 'fixedCount') {
    document.getElementById('frameCountValue').value = match.winCondition || '';
  }
}

function UI_UpdateMatchSummary ()
{
  //Update Timer
  const timerListElement = document.getElementById('timer-listFrameTimes');
  timerListElement.innerHTML = ''; // Clear existing content

  if (match.timing && match.timing.length > 0 && match.startTime) 
  {
    document.getElementById('timeline-chart').style.display = 'block';
    const timingText = match.timing.map(time => {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      return `${minutes}'${seconds}`;
    }).join(', ');

    timerListElement.textContent = timingText;const totalMatchTime = match.timing.reduce((acc, curr) => acc + curr, 0);
    const totalHours = Math.floor(totalMatchTime / 3600);
    const totalMinutes = Math.floor((totalMatchTime % 3600) / 60);
    const totalSeconds = totalMatchTime % 60;
  
    document.getElementById('timer-hours').textContent = String(totalHours).padStart(2, '0');
    document.getElementById('timer-minutes').textContent = String(totalMinutes).padStart(2, '0');
    document.getElementById('timer-seconds').textContent = String(totalSeconds).padStart(2, '0');
  } else 
  {
    if (match.startTime) {
      timerListElement.textContent = `Match Started at: ${new Date(match.startTime).toLocaleString()}`;
      document.getElementById('timeline-chart').style.display = 'block';
    } else {
      timerListElement.textContent = 'Match Timer Not Started.';
      document.getElementById('timeline-chart').style.display = 'none';
    }
    document.getElementById('timer-hours').textContent = '00';
    document.getElementById('timer-minutes').textContent = '00';
    document.getElementById('timer-seconds').textContent = '00';
  }

  

  //Scorecard Simple
  const scorecardBody = document.getElementById('scorecard-table-body');
  scorecardBody.innerHTML = ''; // Clear existing rows
  const scorecardHeader = document.querySelector('.table thead tr');
  if (scorecardHeader) {
    scorecardHeader.innerHTML = ''; // Clear the header row as well
  }

  if (window.innerWidth < 665) 
  {
    // Vertical table for small screens
    const headerRow = document.createElement('tr');

    const frameIndexHeader = document.createElement('th');
    frameIndexHeader.className = 'cell-tight';
    frameIndexHeader.textContent = 'Frame';
    headerRow.appendChild(frameIndexHeader);

    const playerHHeader = document.createElement('th');
    playerHHeader.className = 'cell-tight';
    playerHHeader.textContent = (players.H.name || 'Player H') + (match.lag === "Home" ? " *" : "");
    headerRow.appendChild(playerHHeader);

    const playerAHeader = document.createElement('th');
    playerAHeader.className = 'cell-tight';
    playerAHeader.textContent = (players.A.name || 'Player A') + (match.lag === "Away" ? " *" : "");
    headerRow.appendChild(playerAHeader);

    const frameTimeHeader = document.createElement('th');
    frameTimeHeader.className = 'cell-tight';
    frameTimeHeader.textContent = 'Time (min)';
    headerRow.appendChild(frameTimeHeader);

    scorecardBody.appendChild(headerRow);

    const maxFrames = Math.max(match.scorecard.H.length, match.scorecard.A.length);

    for (let i = 0; i < maxFrames; i++) {
      const row = document.createElement('tr');

      const frameIndexCell = document.createElement('td');
      frameIndexCell.className = 'cell-tight';
      frameIndexCell.textContent = i + 1;
      row.appendChild(frameIndexCell);

      const playerHCell = document.createElement('td');
      playerHCell.className = 'cell-tight';
      playerHCell.textContent = match.scorecard.H[i] || '.';
      row.appendChild(playerHCell);

      const playerACell = document.createElement('td');
      playerACell.className = 'cell-tight';
      playerACell.textContent = match.scorecard.A[i] || '.';
      row.appendChild(playerACell);

      const frameTimeCell = document.createElement('td');
      frameTimeCell.className = 'cell-tight';
      frameTimeCell.textContent = match.timing[i] ? (match.timing[i] / 60).toFixed(1) : '-';
      row.appendChild(frameTimeCell);

      scorecardBody.appendChild(row);
    }

    // Add final score row
    const finalScoreRow = document.createElement('tr');

    const finalScoreLabelCell = document.createElement('td');
    finalScoreLabelCell.className = 'cell-tight';
    finalScoreLabelCell.innerHTML = '<b>Score</b>';
    finalScoreRow.appendChild(finalScoreLabelCell);

    const finalScoreHCell = document.createElement('td');
    finalScoreHCell.className = 'cell-tight';
    finalScoreHCell.innerHTML = `<b>${match.result_H}</b>`;
    finalScoreRow.appendChild(finalScoreHCell);

    const finalScoreACell = document.createElement('td');
    finalScoreACell.className = 'cell-tight';
    finalScoreACell.innerHTML = `<b>${match.result_A}</b>`;
    finalScoreRow.appendChild(finalScoreACell);

    const totalTimeCell = document.createElement('td');
    totalTimeCell.className = 'cell-tight';
    const totalTime = match.timing.reduce((acc, curr) => acc + curr, 0); // Sum all timing values
    const totalMinutes = Math.floor(totalTime / 60);
    const totalSeconds = totalTime % 60;
    totalTimeCell.textContent = `${totalMinutes}'${totalSeconds}"`; // Format as minutes and seconds
    finalScoreRow.appendChild(totalTimeCell);

    scorecardBody.appendChild(finalScoreRow);
  } 
  else 
  {
    // Horizontal table for larger screens
    const scorecardHeader = document.querySelector('.table thead tr');
    scorecardHeader.innerHTML = ''; // Clear existing header cells

    const headerCells = ['Player', ...match.scorecard.H.map((_, index) => index + 1)];
    headerCells.forEach(header => {
      const th = document.createElement('th');
      th.className = 'cell-tight';
      th.textContent = header;
      scorecardHeader.appendChild(th);
    });

    const finalScoreHeader = document.createElement('th');
    finalScoreHeader.className = 'cell-tight';
    finalScoreHeader.textContent = 'Final Score';
    scorecardHeader.appendChild(finalScoreHeader);

    ['H', 'A'].forEach(player => {
      const row = document.createElement('tr');
      const playerNameCell = document.createElement('td');
      playerNameCell.className = 'cell-tight';
      playerNameCell.textContent = player === 'H' 
        ? (players.H.name || 'Player H') + (match.lag === "Home" ? " *" : "") 
        : (players.A.name || 'Player A') + (match.lag === "Away" ? " *" : "");
      row.appendChild(playerNameCell);

      match.scorecard[player].forEach(score => {
        const cell = document.createElement('td');
        cell.className = 'cell-tight';
        cell.textContent = score || '.';
        row.appendChild(cell);
      });

      // Add empty cell for frame time
      const finalScoreCell = document.createElement('td');
      finalScoreCell.className = 'cell-tight';
      finalScoreCell.textContent = player === 'H' ? match.result_H : match.result_A;
      row.appendChild(finalScoreCell);

      scorecardBody.appendChild(row);
    });

    // Add frame time row
    const frameTimeRow = document.createElement('tr');
    const frameTimeLabelCell = document.createElement('td');
    frameTimeLabelCell.className = 'cell-tight';
    frameTimeLabelCell.textContent = 'Time (min)';
    frameTimeRow.appendChild(frameTimeLabelCell);

    match.timing.forEach(time => {
      const cell = document.createElement('td');
      cell.className = 'cell-tight';
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      cell.textContent = `${minutes}'${seconds}"`;
      frameTimeRow.appendChild(cell);
    });

    // Add empty cell for alignment
    const totalTimeCell = document.createElement('td');
    totalTimeCell.className = 'cell-tight';
    const totalTime = match.timing.reduce((acc, curr) => acc + curr, 0); // Sum all timing values
    const totalHours = Math.floor(totalTime / 3600);
    const totalMinutes = Math.floor((totalTime % 3600) / 60);
    const totalSeconds = totalTime % 60;
    totalTimeCell.textContent = `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')}`; // Format as hh:mm:ss
    frameTimeRow.appendChild(totalTimeCell);

    scorecardBody.appendChild(frameTimeRow);
  }

  // Update match summary table
  document.getElementById('playerH-name').textContent = 
    (players.H.name || 'Player H') + (match.lag === "Home" ? " *" : "");
  document.getElementById('playerA-name').textContent = 
    (players.A.name || 'Player A') + (match.lag === "Away" ? " *" : "");

  document.getElementById('match-result-playerH').textContent = match.result_H;
  document.getElementById('match-result-playerA').textContent = match.result_A;

  document.getElementById('match-apples-playerH').textContent = match.apples_H;
  document.getElementById('match-apples-playerA').textContent = match.apples_A;

  document.getElementById('match-cplus-playerH').textContent = match.reverseApples_H || 0;
  document.getElementById('match-cplus-playerA').textContent = match.reverseApples_A || 0;

  const winner =
    match.result_H > match.result_A
      ? players.H.name || 'Player H'
      : match.result_A > match.result_H
      ? players.A.name || 'Player A'
      : 'Draw';
  document.getElementById('match-winner').textContent = winner;

  // Update match timing details
  document.getElementById('match-start-time').textContent = new Date(match.startTime).toLocaleString();
  document.getElementById('match-end-time').textContent = match.endTime ? new Date(match.endTime).toLocaleString() : 'Ongoing';

  if (match.endTime) {
    const duration = Math.floor((new Date(match.endTime) - new Date(match.startTime)) / 60000);
    document.getElementById('match-duration').textContent =
      duration > 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration} minutes`;

  } else {
    document.getElementById('match-duration').textContent = 'Ongoing';
    document.getElementById('match-average-frame-time').textContent = 'N/A';
  }
  
  const averageFrameTime = Array.isArray(match.timing) && match.timing.length > 0 
    ? match.timing.reduce((acc, curr) => acc + curr, 0) / match.timing.length 
    : 0;
  document.getElementById('match-average-frame-time').textContent = averageFrameTime > 0 
    ? `${Math.round(averageFrameTime / 60)}m` 
    : 'N/A';
}

//BUTTONS

document.getElementById('btn-player-H-point').addEventListener('click', () => {  UpdateScores(1, 0);  });

document.getElementById('btn-player-H-Apple').addEventListener('click', () => {  UpdateScores('A', 0);  });

document.getElementById('btn-player-H-cplus').addEventListener('click', () => {  UpdateScores('C', 0);  });

document.getElementById('btn-player-A-point').addEventListener('click', () => {  UpdateScores(0, 1);  });

document.getElementById('btn-player-A-Apple').addEventListener('click', () => {  UpdateScores(0, 'A');  });

document.getElementById('btn-player-A-cplus').addEventListener('click', () => {  UpdateScores(0, 'C');  });
  

document.getElementById('btn-timer-startMatch').addEventListener('click', () => 
{
  StartMatchTimer();
});

document.getElementById('btn-timer-endMatch').addEventListener('click', () =>
{
  if (!match.endTime) 
  {
    if (confirm('Are you sure you want to end the match? This cannot be undone.')) 
    {
      EndMatchTimer();
    }
  } else 
  {
    alert('Match has already ended.');
  }  
});    


//Lag functionality
function GetCurrentLag() 
{
  const totalFrames = match.scorecard.H.length;
  if (match.lagType === "Alternate") {
    return match.lag === "Home" 
      ? (totalFrames % 2 === 0 ? "Home" : "Away") 
      : (totalFrames % 2 === 0 ? "Away" : "Home");
  } else if (match.lagType === "Winner") {
    if (totalFrames === 0) {
      return match.lag; // Whoever wins the lag breaks first
    } else {
      const lastFrameWinner = match.scorecard.H[totalFrames - 1] !== 0 ? "Home" : "Away";
      return lastFrameWinner; // Winner of the last frame breaks next
    }
  }

  return null; // Default case if lagType is not set
}

document.querySelectorAll('input[name="lagType"]').forEach((radio) => {
  radio.addEventListener('change', (event) => {
    handleLagTypeChange(event.target.value);
  });
});

function handleLagTypeChange(value) {
  match.lagType = value === "alternateBreak" ? "Alternate" : "Winner";

  // Update the lag UI
  UpdateLagUI();

  // Push the updated lagType to the database
  supabase.from('tbl_matches').update({
    lagType: match.lagType,
  }).eq('id', match.id).select().then(response => {
    console.warn('Lag type updated in database. Response:', response);
  }).catch(error => {
    console.error('Error updating lag type in database:', error);
  });
}

async function UpdateLagUI() 
{
  // Update the selected lag type based on match.lagType
  const lagTypeRadios = document.getElementsByName('lagType');
  lagTypeRadios.forEach(radio => {
    radio.checked = (match.lagType === "Winner" && radio.value === "winnerBreak") || 
                    (match.lagType === "Alternate" && radio.value === "alternateBreak");
  });


  const playerHBreakIndicator = document.getElementById('player-H-break-indicator-container');
  const playerABreakIndicator = document.getElementById('player-A-break-indicator-container');

  const currentLag = GetCurrentLag();

  if (currentLag === "Home") {
    playerHBreakIndicator.style.display = "block";
    playerABreakIndicator.style.display = "none";
  } else if (currentLag === "Away") {
    playerHBreakIndicator.style.display = "none";
    playerABreakIndicator.style.display = "block";
  } else {
    playerHBreakIndicator.style.display = "none";
    playerABreakIndicator.style.display = "none";
  }

  if (match.lag === null) {
    document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
    document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
    document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
    document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
  } else if (currentLag === "Home") {
    document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
    document.getElementById('btn-player-H-cplus').style.display = 'none';
    document.getElementById('btn-player-A-Apple').style.display = 'none';
    document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
  } else if (currentLag === "Away") {
    document.getElementById('btn-player-H-Apple').style.display = 'none';
    document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
    document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
    document.getElementById('btn-player-A-cplus').style.display = 'none';
  }

  const lagSelect = document.getElementById('select-lag');
  lagSelect.innerHTML = ''; // Clear existing options

  const homeOption = document.createElement('option');
  homeOption.value = 'home';
  homeOption.textContent = players.H.name || 'Home';
  lagSelect.appendChild(homeOption);

  const awayOption = document.createElement('option');
  awayOption.value = 'away';
  awayOption.textContent = players.A.name || 'Away';
  lagSelect.appendChild(awayOption);

  lagSelect.value = match.lag === 'Home' ? 'home' : 'away';
  document.getElementById('matchSettingsNav').classList.remove('show');
}

document.getElementById('select-lag').addEventListener('change', async (event) => 
{
  match.lag = event.target.value === 'home' ? 'Home' : 'Away';

  const response = await supabase.from('tbl_matches').update({
    lag: match.lag,
  }).eq('id', match.id).select();

  console.warn('Lag updated in database. Response:', response);
});

//Timer Functions
  //Start Match Timer
  //Start Frame Timer
  //Restart Frame Timer (Frame ended, start new frame)
  //End Match Timer  

function Timer_NextFrame()
{
  // Record frame time
  const frameTime = GetFrameTime();
  if (!Array.isArray(match.timing)) {
    match.timing = [];
  }
  match.timing.push(frameTime);
  console.warn("Timer: Next Frame Started.");

  // Restart frame timer
  SetFrameTimer();
}  

function StartMatchTimer()
{
  match.startTime = new Date().toISOString();
  SetFrameTimer(); // Start frame timer as well
  console.warn('Timer: Match started at:', match.startTime);
  document.getElementById('match-time-start').textContent = `Match Start Time: ${new Date(match.startTime).toLocaleString()}`;
  UpdateTimerUI();
  
  // Push the updated startTime to the database
  PushMatchToDatabase();
  document.getElementById('matchSettingsNav').classList.remove('show');
}

function EndMatchTimer() {
  match.endTime = new Date().toISOString();
  match.status = "Completed"; // Update match status to completed
  console.warn('Timer: Match ended at:', match.endTime);
  document.getElementById('match-time-end').textContent = `Match End Time: ${new Date(match.endTime).toLocaleString()}`;

  // Push the updated endTime to the database
  PushMatchToDatabase();
  document.getElementById('matchSettingsNav').classList.remove('show');
}

function SetFrameTimer()
{
  const frameStartTime = new Date().toISOString();
  localStorage.setItem('frameStartTime', frameStartTime);
  sessionStorage.setItem('frameStartTime', frameStartTime);
  console.log('Timer: Frame timer started at:', frameStartTime);
  document.getElementById('frame-time-start').textContent = `Frame Start Time: ${new Date(frameStartTime).toLocaleString()}`;

  // Store a list of frameStartTimes in local & session storage
  const frameStartTimes = JSON.parse(localStorage.getItem('frameStartTimes') || '[]');
  frameStartTimes.push(frameStartTime);
  localStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
  sessionStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
}

document.getElementById('btn-timer-restartFrameTimer').addEventListener('click', () => 
{
  SetFrameTimer();
});

function GetFrameTime ()
{
  const frameStartTime = localStorage.getItem('frameStartTime') || sessionStorage.getItem('frameStartTime');
  if (frameStartTime) {
    const start = new Date(frameStartTime);
    const now = new Date();
    const duration = Math.floor((now - start) / 1000); // Duration in seconds
    console.log('Frame duration:', duration + ' seconds');
    return duration; // Return time in seconds
  }
  console.log('No frame start time found.');
  return 0; // Default to 0 if no frame start time is set
}

//Update Scores (Button Inputs)
async function UpdateScores (score_H, score_A)
{
  //add scores to match.scorecard
  match.scorecard.H.push(score_H);
  match.scorecard.A.push(score_A);

  //add frame time to match.timing and restart frame timer
  Timer_NextFrame();

  //update match.result_H and match.result_A
  if (score_H == 0)
  {
    match.result_A++;
  } else if (score_A == 0)
  {
    match.result_H++;
  }

  //update apples to match
  if (score_H == 'A')
  {
    match.apples_H++;
  } else if (score_A == 'A')
  {
    match.apples_A++;
  }

  //update reverseApples (C+) to match
  if (score_H == 'C')
  {
    match.reverseApples_H++;
  } else if (score_A == 'C')
  {
    match.reverseApples_A++;
  }

  console.warn('Scores Updated. Updated match:', match);

  //push match to database
  PushMatchToDatabase();

  //Check win condition
  if (match.type !== 'freePlay' && (match.result_H >= match.winCondition || match.result_A >= match.winCondition))
  {
    if (confirm('Match has ended. Do you want to end the match?')) 
    {
      EndMatchTimer();
    } else 
    {
      alert('Match continues. You can end it later.');
    }
  }
}

async function PushMatchToDatabase()
{
  const response = await supabase.from('tbl_matches').update({
    result_H: match.result_H,
    result_A: match.result_A,
    apples_H: match.apples_H,
    apples_A: match.apples_A,
    reverseApples_H: match.reverseApples_H,
    reverseApples_A: match.reverseApples_A,
    scorecard: match.scorecard,
    timing: match.timing,
    startTime: match.startTime,
    endTime: match.endTime
  }).eq('id', match.id).select();
  console.warn('Match pushed to database. Response:', response);
}

// Prepare the data for a bar graph and create the graph using Chart.js
function PrepareBarGraphData(match) {
  const xValues = [];
  const yValues = [];
  const barWidths = [];
  const barHeights = [];
  const colors = [];

  let elapsedTime = 0;

  const timing = match.timing || [];
  const scorecardH = match.scorecard?.H || [];
  for (let i = 0; i < Math.max(timing.length, scorecardH.length); i++) {
    const frameTime = match.timing[i] ? match.timing[i] / 60 : 5; // Convert seconds to minutes or use default size
    const winner = match.scorecard.H[i] == 0
      ? (isVertical ? 1 : -1)
      : match.scorecard.A[i] == 0
      ? (isVertical ? -1 : 1)
      : 0;

    xValues.push(winner); // Frame winner (-1 or 1)
    yValues.push(elapsedTime + frameTime / 2); // Center the bar vertically
    barWidths.push(frameTime); // Width based on frame time in minutes or default size
    barHeights.push(1); // Fixed height for vertical bars

    // Determine color based on score type
    if (match.scorecard.H[i] === 'A' || match.scorecard.A[i] === 'A') {
      colors.push('rgba(230, 161, 0, 0.5)'); // Yellow for "A"
    } else if (match.scorecard.H[i] === 'C' || match.scorecard.A[i] === 'C') {
      colors.push('rgba(0, 255, 0, 0.25)'); // Green for "C"
    } else {
      colors.push('rgba(255, 255, 255, 0.1)'); // Default transparent color
    }

    elapsedTime += frameTime; // Increment elapsed time
  }

  return { xValues, yValues, barWidths, barHeights, colors };
}

async function BuildBarGraph(match) {
  const graphData = PrepareBarGraphData(match);

  const isVertical = window.innerWidth < 665; // Check if screen size is small (sm)

  const trace = {
    x: isVertical ? graphData.xValues : graphData.yValues,
    y: isVertical ? graphData.yValues : graphData.xValues,
    type: 'bar',
    orientation: isVertical ? 'h' : 'v', // Horizontal bars for small screens
    marker: {
      color: graphData.colors, // Use dynamic colors
      line: {
        color: 'rgba(255, 255, 255, 1)', // White borders
        width: 1,
      },
    },
    width: isVertical ? graphData.barWidths : graphData.barWidths, // Correct bar widths for vertical bars
    text: (match.timing || []).map((time, index) => {
      const runningScoreH = match.scorecard.H.slice(0, index + 1).reduce((acc, val) => acc + (val === 1 || val === 'A' || val === 'C' ? 1 : 0), 0);
      const runningScoreA = match.scorecard.A.slice(0, index + 1).reduce((acc, val) => acc + (val === 1 || val === 'A' || val === 'C' ? 1 : 0), 0);
      return `${Math.floor(time / 60)}'${time % 60} <br><b>(${runningScoreH}-${runningScoreA})<b>`; // Running score labels
    }),
    textposition: 'inside', // Position labels inside the bars
    textfont: {
      color: 'white', // Set label color to white
      family: 'Segoe UI', // Use Segoe UI font
    },
    hoverinfo: 'none', // Disable tooltips on hover
  };

  const layout = {
    xaxis: {
      tickfont: { color: '#ccc', family: 'Segoe UI' }, // Use Segoe UI font for x-axis
      gridcolor: '#444',
      tickvals: isVertical ? [1, -1] : undefined, // Reverse order for vertical mode
      ticktext: isVertical ? [players.A.name, players.H.name] : undefined, // Home on left, Away on right
      tickmode: isVertical ? 'array' : undefined,
      fixedrange: true, // Prevent zooming on x-axis
    },
    yaxis: {
      tickfont: { color: '#ccc', family: 'Segoe UI' }, // Use Segoe UI font for y-axis
      gridcolor: '#444',
      tickvals: isVertical ? undefined : [1, -1],
      ticktext: isVertical ? undefined : [players.H.name, players.A.name],
      tickmode: isVertical ? undefined : 'array',
      automargin: true, // Allow word-wrap for player names
      fixedrange: true, // Prevent zooming on y-axis
    },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    margin: window.innerWidth < 665
      ? { l: 50, r: 50, t: 0, b: 100 } // Portrait (small screens)
      : window.innerWidth < 1024
      ? { l: 100, r: 25, t: 0, b: 100 } // Landscape (medium screens)
      : { l: 100, r: 50, t: 0, b: 100 }, // Desktop (large screens)
  };

  const config = {
    displayModeBar: false, // Hide the Plotly toolbar
    responsive: true, // Prevent zoom by making the graph responsive
    scrollZoom: false, // Disable scroll zoom
  };

  const graph = await Plotly.newPlot('timelineChart', [trace], layout, config);
}

document.querySelectorAll('input[name="matchType"]').forEach((radio) => 
{
  radio.addEventListener('change', async (event) => 
  {
    UpdateWinCondition();
  });  
});

document.getElementById('raceToValue').addEventListener('input', async () => 
{
  UpdateWinCondition();
});

document.getElementById('frameCountValue').addEventListener('input', async () => 
{
  UpdateWinCondition();
});

async function UpdateWinCondition() 
{
  const selectedType = document.querySelector('input[name="matchType"]:checked').value;

  if (selectedType === 'freePlay') {
    match.winCondition = null;
  } else if (selectedType === 'race') {
    const raceToValue = parseInt(document.getElementById('raceToValue').value, 10);
    if (!isNaN(raceToValue)) {
      match.winCondition = raceToValue;
    }
  } else if (selectedType === 'fixedCount') {
    const frameCountValue = parseInt(document.getElementById('frameCountValue').value, 10);
    if (!isNaN(frameCountValue)) {
      match.winCondition = frameCountValue;
    }
  }

  console.log('Updated winCondition:', match.winCondition);

  // Push the updated winCondition to the database
  const response = await supabase.from('tbl_matches').update({
    winCondition: match.winCondition,
    type: selectedType,
  }).eq('id', match.id).select();

  console.warn('Win condition pushed to database. Response:', response);
}

document.getElementById('btn-correction').addEventListener('click', async () => 
{
  if (match.scorecard.H.length > 0 && match.scorecard.A.length > 0 && match.timing.length > 0) {
    // Remove the last entries from scorecard and timing
    match.scorecard.H.pop();
    match.scorecard.A.pop();
    match.timing.pop();

    // Update local and session storage for frameStartTime
    const frameStartTimes = JSON.parse(localStorage.getItem('frameStartTimes') || '[]');
    frameStartTimes.pop(); // Remove the last entry
    localStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
    sessionStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));

    // Update the current frameStartTime to the last entry in frameStartTimes
    const lastFrameStartTime = frameStartTimes[frameStartTimes.length - 1] || null;
    if (lastFrameStartTime) {
      localStorage.setItem('frameStartTime', lastFrameStartTime);
      sessionStorage.setItem('frameStartTime', lastFrameStartTime);
    } else {
      localStorage.removeItem('frameStartTime');
      sessionStorage.removeItem('frameStartTime');
    }

    // Recalculate scores
    match.result_H = match.scorecard.H.filter(score => score === 1 || score === 'A' || score === 'C').length;
    match.result_A = match.scorecard.A.filter(score => score === 1 || score === 'A' || score === 'C').length;

    // Recalculate apples and reverseApples
    match.apples_H = match.scorecard.H.filter(score => score === 'A').length;
    match.apples_A = match.scorecard.A.filter(score => score === 'A').length;
    match.reverseApples_H = match.scorecard.H.filter(score => score === 'C').length;
    match.reverseApples_A = match.scorecard.A.filter(score => score === 'C').length;

    console.warn('Correction applied. Updated match:', match);

    // Push the updated match to the database
    await PushMatchToDatabase();

    // Update the UI
    UI_UpdateScores();
    UI_UpdateMatchSummary();
    BuildBarGraph(match);
  } else {
    alert('No entries to remove.');
  }
});
