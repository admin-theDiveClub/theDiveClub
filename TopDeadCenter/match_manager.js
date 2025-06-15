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

    BuildChart(match);

    UI_UpdateScores();
    UI_UpdateMatchSummary();
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
  //CODE
  match = payload.new;

  //Check Player Profiles for consistency
  if (match.player_A != players.A.username || match.player_H != players.H.username)
  {
    // Update player data if usernames have changed
    await PopulatePlayerData(match);
    await UI_UpdatePlayerProfiles();
  }

  //Update Lag
  console.log(GetCurrentLag());
  
  // Update the chart with new data
  BuildChart(match);
  // Update the UI with new scores
  UI_UpdateScores();
  // Update the match summary
  UI_UpdateMatchSummary();
}

/* CHART */
// Prepare data for the chart
var allPoints = [];

function BuildChart (match)
{
  var chartData = BuildChartData(match);
  BuildChartObject(chartData);
}

function BuildChartData(match) 
{
  const scorecard = match.scorecard;
  const chartPoints = [];
  const runningScores = { H: 0, A: 0 };
  const runningApples = { H: 0, A: 0 };

  // Ensure timing is valid
  const timing = Array.isArray(match.timing) ? match.timing : null;

  // Start Point
  const startPoint = 
  {
    winner: null,
    time: new Date(match.startTime).toLocaleString(), // Format as readable date and time
    frameTime: 0, // Add frameTime property
    scores: runningScores,
    apples: runningApples,
  };
  chartPoints.push(startPoint);

  // Scorecard Points
  for (var i = 0; i < scorecard.H.length; i++) 
  {
    var winner = null;
    if (scorecard.H[i] != 0)
    {
      runningScores.H++; 
      winner = players.H.name || match.player_H;
      
      if (scorecard.H[i] == 'A')
      {
        runningApples.H++;
      }
    } else if (scorecard.A[i] != 0)
    {
      runningScores.A++;
      winner = players.A.name || match.player_A;
      
      if (scorecard.A[i] == 'A')
      {
        runningApples.A++;
      }
    }

    var newChartPoint = 
    {
      winner: winner,
      time: timing ? timing.slice(0, i + 1).reduce((acc, curr) => acc + curr, 0) : i + 1, // Use index if timing is null
      frameTime: timing ? timing[i] || 0 : 0, // Use 0 if timing is null
      scores: { H: runningScores.H, A: runningScores.A },
      apples: { H: runningApples.H, A: runningApples.A }
    };
    
    chartPoints.push(newChartPoint);
  }

  // End Point
  if (match.endTime) {
    const endPoint = 
    {
      winner: null,
      time: timing ? Math.floor((new Date(match.endTime) - new Date(match.startTime)) / 1000) : scorecard.H.length, // Use scorecard length if timing is null
      frameTime: 0, // Add frameTime property
      scores: runningScores,
      apples: runningApples
    };
    chartPoints.push(endPoint);
  }

  return chartPoints;
}

let isVertical = window.innerWidth < 768; // Vertical if screen size is small (sm), otherwise horizontal

// Update chart container height based on orientation
const chartContainer = document.getElementById('timeline-chart');
chartContainer.style.height = isVertical ? '85vh' : '30vh';

//Build the Chart
let timelineChart = null; // Store the chart instance globally

function BuildChartObject(chartPoints) 
{
  const ctx = document.getElementById('timelineChart').getContext('2d');
  const points = [];
  const highlightPoints = [];
  const borderColors = []; // Array to store border colors for each point

  chartPoints.forEach((point, index) => {
    const axisTime = index === 0 ? 0 : point.time / 60;
    const axisValue = point.winner === players.H.name ? -1 : point.winner === players.A.name ? 1 : 0;

    const x = isVertical ? axisValue : axisTime;
    const y = isVertical ? axisTime : axisValue;

    points.push({ x: isVertical ? 0 : x, y: isVertical ? y : 0 });
    points.push({ x, y, raw: { ...point } });
    points.push({ x: isVertical ? 0 : x, y: isVertical ? y : 0 });

    // Determine color based on scorecard value
    const scoreH = match.scorecard.H[index] || 0;
    const scoreA = match.scorecard.A[index] || 0;
    const borderColor = scoreH === "A" || scoreA === "A"
      ? 'rgba(230, 161, 0, 1)' // Yellow for "A"
      : scoreH === "C" || scoreA === "C"
      ? 'rgba(0, 200, 0, 1)' // Green for "C"
      : '#fff'; // White for others

    highlightPoints.push({ x, y, raw: { ...point } });
    borderColors.push(borderColor); // Add border color to the array
  });

  const labelPlugin = {
    id: 'frameLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      const fontSize = window.innerWidth < 768 ? 16 : 10;
      ctx.font = `${fontSize}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#eee';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      chart.data.datasets[2].data.forEach((pt, i) => {
        const meta = chart.getDatasetMeta(2);
        const pos = meta.data[i]?.getProps(['x', 'y'], true);
        const label = pt.raw?.frameTime ? `${Math.round(pt.raw.frameTime / 60)}m` : '';
        if (pos && label) {
          const offset = 30;
          const offsetX = isVertical ? (pt.x < 0 ? -offset : offset) : 0;
          const offsetY = isVertical ? 0 : (pt.y < 0 ? offset : -offset);
          ctx.fillText(label, pos.x + offsetX, pos.y + offsetY);
        }
      });

      ctx.restore();
    }
  };

  // Destroy the existing chart instance if it exists
  if (timelineChart) {
    timelineChart.destroy();
  }

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Frame Spikes',
          data: points,
          borderColor: '#aaa',
          borderWidth: 2,
          backgroundColor: 'transparent',
          pointRadius: 0,
          tension: 0
        },
        {
          label: 'Frame Dots',
          data: highlightPoints,
          showLine: false,
          pointRadius: 8,
          pointBackgroundColor: 'transparent',
          pointBorderColor: borderColors, // Apply dynamic border colors
          pointBorderWidth: 1
        },
        {
          label: 'Frame Labels',
          data: highlightPoints,
          showLine: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 20, left: 20, right: 20, bottom: 40 }},
      indexAxis: isVertical ? 'y' : 'x',
      scales: {
        x: isVertical
          ? {
              type: 'linear',
              min: -2,
              max: 2,
              ticks: {
                color: '#ccc',
                callback: val =>
                  val === -1 ? players.H.name : val === 1 ? players.A.name : '',
                stepSize: 1,
                autoSkip: false,
                maxRotation: 0,
                minRotation: 0,
                font: { size: window.innerWidth < 768 ? 16 : 12 } // Reduced font size
              },
              grid: {
                color: '#444',
                drawOnChartArea: true
              }
            }
          : {
              type: 'linear',
              beginAtZero: true,
              reverse: false,
              suggestedMax: Math.max(...chartPoints.map(p => p.time)) / 60,
              ticks: {
                color: '#ccc',
                callback: value => {
                  const h = Math.floor(value / 60);
                  const m = Math.round(value % 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                },
                font: { size: window.innerWidth < 768 ? 16 : 12 } // Reduced font size
              },
              grid: {
                color: '#333'
              }
            },
        y: isVertical
          ? {
              type: 'linear',
              beginAtZero: true,
              reverse: true,
              suggestedMax: Math.max(...chartPoints.map(p => p.time)) / 60,
              ticks: {
                color: '#ccc',
                callback: value => {
                  const h = Math.floor(value / 60);
                  const m = Math.round(value % 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                },
                font: { size: window.innerWidth < 768 ? 16 : 12 } // Reduced font size
              },
              grid: {
                color: '#333'
              }
            }
          : {
              type: 'linear',
              min: -2,
              max: 2,
              ticks: {
                color: '#ccc',
                callback: val =>
                  val === -1 ? players.H.name : val === 1 ? players.A.name : '',
                stepSize: 1,
                autoSkip: false,
                maxRotation: 0,
                minRotation: 0,
                font: { size: window.innerWidth < 768 ? 20 : 12 } // Reduced font size
              },
              grid: {
                color: '#444',
                drawOnChartArea: true
              }
            }
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            title: ctx => {
              const index = ctx[0].dataIndex;
              return index === 0
                ? 'Match Start'
                : index === chartPoints.length - 1
                ? 'Match End'
                : `Frame ${index}`;
            },
            label: ctx => {
              const raw = chartPoints[ctx.dataIndex];
              if (!raw) return '';
              if (ctx.dataIndex === 0) {
                return [`Time: ${raw.time}s`];
              }
              if (ctx.dataIndex === chartPoints.length - 1) {
                const finalWinner =
                  match.result_H > match.result_A
                    ? players.H.name
                    : match.result_A > match.result_H
                    ? players.A.name
                    : 'Draw';
                const frameEndTime = new Date(match.endTime).toLocaleString();
                const matchDuration = Math.floor(
                  (new Date(match.endTime) - new Date(match.startTime)) / 60000
                );
                const formattedDuration =
                  matchDuration > 60
                    ? `${Math.floor(matchDuration / 60)}h ${
                        matchDuration % 60
                      }m`
                    : `${matchDuration} minutes`;

                return [
                  `Winner: ${finalWinner}`,
                  `Final Scores: ${match.result_H} - ${match.result_A}`,
                  `Match End Time: ${frameEndTime}`,
                  `Match Duration: ${formattedDuration}`
                ];
              }
              return [
                `Winner: ${raw.winner || '-'}`,
                `Frame Time: ${Math.ceil(raw.frameTime / 60)}m`,
                `Elapsed Time: ${Math.ceil(raw.time / 60)}m`,
                `Scores: ${raw.scores.H} - ${raw.scores.A}`,
                `Apples: ${raw.apples.H} - ${raw.apples.A}`
              ];
            }
          },
          titleFont: { size: 20 },
          bodyFont: { size: 16 }
        },
        legend: {
          display: false
        }
      }
    },
    plugins: [labelPlugin]
  });
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
    (players.H.nickname || players.H.username || 'Anonymous') + (match.lag === "Home" ? " *" : "");
  document.getElementById('player-H-name').textContent = players.H.name || players.H.username || 'Unknown Player';

  const r_H = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.H.id);
  if (r_H.data && r_H.data.publicUrl && !r_H.data.publicUrl.endsWith('null')) 
  {
    const imgElement_H = document.getElementById('player-H-pic');
    if (imgElement_H) {
      imgElement_H.src = r_H.data.publicUrl;
    }
  }

  document.getElementById('player-A-nickname').textContent = 
    (players.A.nickname || players.A.username || 'Anonymous') + (match.lag === "Away" ? " *" : "");
  document.getElementById('player-A-name').textContent = players.A.name || players.A.username || 'Unknown Player';

  const r_A = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.A.id);
  if (r_A.data && r_A.data.publicUrl && !r_A.data.publicUrl.endsWith('null')) 
  {
    const imgElement_A = document.getElementById('player-A-pic');
    if (imgElement_A) {
      imgElement_A.src = r_A.data.publicUrl;
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

function UI_UpdateMatchSummary ()
{
  //Update Timer
  const timerListElement = document.getElementById('timer-listFrameTimes');
  timerListElement.innerHTML = ''; // Clear existing content

  const timingText = match.timing.map(time => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}'${seconds}`;
  }).join(', ');
  timerListElement.textContent = timingText;

  const totalMatchTime = match.timing.reduce((acc, curr) => acc + curr, 0);
  const totalHours = Math.floor(totalMatchTime / 3600);
  const totalMinutes = Math.floor((totalMatchTime % 3600) / 60);
  const totalSeconds = totalMatchTime % 60;

  document.getElementById('timer-hours').textContent = String(totalHours).padStart(2, '0');
  document.getElementById('timer-minutes').textContent = String(totalMinutes).padStart(2, '0');
  document.getElementById('timer-seconds').textContent = String(totalSeconds).padStart(2, '0');

  //Scorecard Simple
  const scorecardBody = document.getElementById('scorecard-table-body');
  scorecardBody.innerHTML = ''; // Clear existing rows
  const scorecardHeader = document.querySelector('.table thead tr');
  if (scorecardHeader) {
    scorecardHeader.innerHTML = ''; // Clear the header row as well
  }

  if (window.innerWidth < 768) 
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
      playerHCell.textContent = match.scorecard.H[i] || '-';
      row.appendChild(playerHCell);

      const playerACell = document.createElement('td');
      playerACell.className = 'cell-tight';
      playerACell.textContent = match.scorecard.A[i] || '-';
      row.appendChild(playerACell);

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

    scorecardBody.appendChild(finalScoreRow);
  } 
  else 
  {
    // Horizontal table for larger screens
    const scorecardHeader = document.querySelector('.table thead tr');
    scorecardHeader.innerHTML = ''; // Clear existing header cells

    const headerCells = ['Player', ...match.scorecard.H.map((_, index) => index + 1), 'Score'];
    headerCells.forEach(header => {
      const th = document.createElement('th');
      th.className = 'cell-tight';
      th.textContent = header;
      scorecardHeader.appendChild(th);
    });

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
        cell.textContent = score || '-';
        row.appendChild(cell);
      });

      // Add final score cell
      const finalScoreCell = document.createElement('td');
      finalScoreCell.className = 'cell-tight';
      finalScoreCell.innerHTML = `<b>${player === 'H' ? match.result_H : match.result_A}</b>`;
      row.appendChild(finalScoreCell);

      scorecardBody.appendChild(row);
    });
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

    const averageFrameTime = match.timing.reduce((acc, curr) => acc + curr, 0) / match.timing.length;
    document.getElementById('match-average-frame-time').textContent = `${Math.round(averageFrameTime / 60)}m`;
  } else {
    document.getElementById('match-duration').textContent = 'Ongoing';
    document.getElementById('match-average-frame-time').textContent = 'N/A';
  }

  const averageFrameTime = match.timing.reduce((acc, curr) => acc + curr, 0) / match.timing.length;
    document.getElementById('match-average-frame-time').textContent = `${Math.round(averageFrameTime / 60)}m`;
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


//Lag functionality
function GetCurrentLag() 
{
  const totalFrames = match.scorecard.H.length;
  return match.lag === "Home" 
    ? (totalFrames % 2 === 0 ? "Home" : "Away") 
    : (totalFrames % 2 === 0 ? "Away" : "Home");
}

function UpdateLagUI() {
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
}

//Timer Functions
  //Start Match Timer
  //Start Frame Timer
  //Restart Frame Timer (Frame ended, start new frame)
  //End Match Timer  

function Timer_NextFrame()
{
  // Record frame time
  const frameTime = GetFrameTime();
  match.timing.push(frameTime);
  console.warn("Timer: Next Frame Started.");

  // Restart frame timer
  SetFrameTimer();
}  

function StartMatchTimer()
{
  match.startTime = new Date().toISOString();
  SetFrameTimer(); // Start frame timer as well
  console.error('Timer: Match started at:', match.startTime);
}

function SetFrameTimer()
{
  const frameStartTime = new Date().toISOString();
  localStorage.setItem('frameStartTime', frameStartTime);
  sessionStorage.setItem('frameStartTime', frameStartTime);
  console.log('Timer: Frame timer started at:', frameStartTime);
}

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

