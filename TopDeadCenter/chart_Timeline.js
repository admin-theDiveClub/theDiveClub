const ctx = document.getElementById('timelineChart').getContext('2d');

const matchData = {
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
  timing: [942, 635, 608, 605, 840, 510, 553, 719, 647, 415, 591, 822, 561, 634, 906],
  startTime: "2025-05-19T17:09:25.789+00:00",
  endTime: null
};

const points = [];
const highlightPoints = [];

matchData.scorecard.A.forEach((score, index) => {
  const y = index + 1; // Frame number
  const x = score === 1 ? 1 : score === 0 ? -1 : 0; // Player A scores
  const frameTime = matchData.timing[index] || 0;

  points.push({ x: 0, y });
  points.push({
    x,
    y,
    raw: {
      frameTime,
      runningScoreA: matchData.result_A,
      runningScoreH: matchData.result_H
    }
  });
  points.push({ x: 0, y });

  highlightPoints.push({
    x,
    y,
    raw: {
      frameTime,
      runningScoreA: matchData.result_A,
      runningScoreH: matchData.result_H
    }
  });
});

// Plugin to draw persistent frame time labels at the tips
const labelPlugin = {
  id: 'frameLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    const fontSize = window.innerWidth < 768 ? 12 : 16;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = '#eee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets[2].data.forEach(pt => {
      const meta = chart.getDatasetMeta(2);
      const index = chart.data.datasets[2].data.indexOf(pt);
      const pos = meta.data[index]?.getProps(['x', 'y'], true);
      const label = pt.raw?.frameTime ? `${Math.ceil(pt.raw.frameTime / 60)}m` : pt.raw.frameTime; // Show frame time
      if (pos) {
        const offset = 36;
        const isLeft = pt.x < 0;
        ctx.fillText(label, pos.x + (isLeft ? -offset : offset), pos.y);
      }
    });

    ctx.restore();
  }
};

const timelineChart = new Chart(ctx, {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'Frame Spikes',
        data: points,
        borderColor: '#aaa',
        borderWidth: 2, // Reduce line thickness
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
          callback: val => val === -1 ? matchData.player_H : val === 1 ? matchData.player_A : '',
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
        suggestedMax: matchData.scorecard.A.length,
        ticks: {
          color: '#ccc',
          callback: value => `${value} Frame`,
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
            return `Frame ${index + 1}`; // Display frame number as the heading
          },
          label: ctx => {
            const raw = ctx.raw?.raw;
            if (!raw) return '';
            const frameTime = raw.frameTime ? `${Math.ceil(raw.frameTime / 60)}m` : '-';
            const runningScore = `Score: ${raw.runningScoreH} - ${raw.runningScoreA}`;
            return [
              `Frame Time: ${frameTime}`,
              runningScore
            ]; // Return an array for multi-line labels
          }
        },
        titleFont: { size: 20 }, // Increase title font size
        bodyFont: { size: 16 },  // Increase body font size
      },
      legend: {
        display: false
      }
    }
  },
  plugins: [labelPlugin]
});