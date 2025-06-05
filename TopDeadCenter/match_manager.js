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

    BuildChart(match);
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
}

// Prepare data for the chart
var allPoints = [];

function BuildChart (match)
{
  var chartData = BuildChartData(match);
  console.log('Chart data built:', chartData);
  BuildChartO(chartData);
}

function BuildChartData(match) 
{
  const scorecard = match.scorecard;
  const chartPoints = [];
  const runningScores = { H: 0, A: 0 };
  const runningApples = { H: 0, A: 0 };

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
      winner = match.player_H;
      
      if (scorecard.H[i] == 'A')
      {
        runningApples.H++;
      }
    } else if (scorecard.A[i] != 0)
    {
      runningScores.A++;
      winner = match.player_A;
      
      if (scorecard.A[i] == 'A')
      {
        runningApples.A++;
      }
    }

    var newChartPoint = 
    {
      winner: winner,
      time: match.timing.slice(0, i + 1).reduce((acc, curr) => acc + curr, 0), // Sum of all times up to the current frame
      frameTime: match.timing[i] || 0, // Save timing[i] as frameTime
      scores: { H: runningScores.H, A: runningScores.A },
      apples: { H: runningApples.H, A: runningApples.A }
    };
    
    chartPoints.push(newChartPoint);
  }

  // End Point
  const endPoint = 
  {
    winner: null,
    time: Math.floor((new Date(match.endTime) - new Date(match.startTime)) / 1000), // Calculate difference in seconds
    frameTime: 0, // Add frameTime property
    scores: runningScores,
    apples: runningApples
  };
  chartPoints.push(endPoint);

  return chartPoints;
}


//Build the Chart
function BuildChartO(chartPoints) {
  const ctx = document.getElementById('timelineChart').getContext('2d');
  const points = [];
  const highlightPoints = [];

  chartPoints.forEach((point, index) => {
    const y = index === 0 ? 0 : point.time / 60;
    const x = point.winner === match.player_H ? -1 : point.winner === match.player_A ? 1 : 0;

    points.push({ x: 0, y });
    points.push({ x, y, raw: { ...point } });
    points.push({ x: 0, y });

    highlightPoints.push({
      x,
      y,
      raw: { ...point }
    });
  });

  const labelPlugin = {
    id: 'frameLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      const fontSize = window.innerWidth < 768 ? 10 : 14;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#eee';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      chart.data.datasets[2].data.forEach((pt, i) => {
        const meta = chart.getDatasetMeta(2);
        const pos = meta.data[i]?.getProps(['x', 'y'], true);
        const label = pt.raw?.frameTime ? `${Math.round(pt.raw.frameTime / 60)}m` : ''; // label = frame time in minutes
        if (pos && label) {
          const offset = 32;
          const isLeft = pt.x < 0;
          ctx.fillText(label, pos.x + (isLeft ? -offset : offset), pos.y);
        }
      });

      ctx.restore();
    }
  };

  new Chart(ctx, {
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
          pointRadius: 12,
          pointBackgroundColor: 'transparent',
          pointBorderColor: '#fff',
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
      layout: { padding: 20 },
      indexAxis: 'y',
      scales: {
        x: {
          type: 'linear',
          min: -2,
          max: 2,
          ticks: {
            color: '#ccc',
            callback: val =>
              val === -1 ? match.player_H : val === 1 ? match.player_A : '',
            stepSize: 1,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: { size: window.innerWidth < 768 ? 12 : 16 }
          },
          grid: {
            color: '#444',
            drawOnChartArea: true
          }
        },
        y: {
          type: 'linear',
          beginAtZero: true,
          reverse: true,
          suggestedMax: Math.max(...chartPoints.map(p => p.time)) / 60,
          ticks: {
            color: '#ccc',
            callback: value => {
              const hours = Math.floor(value / 60);
              const minutes = Math.round(value % 60);
              return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            }
          },
          grid: {
            color: '#333'
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
                    ? match.player_H
                    : match.result_A > match.result_H
                    ? match.player_A
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
