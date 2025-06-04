const ctx = document.getElementById('timelineChart').getContext('2d');

// Get current match start time as display string
const matchStart = new Date();
const formatMatchTime = (date) => {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const dummyData = [
  { winner: '0', time: 0, label: formatMatchTime(matchStart), runningScoreA: 0, runningScoreB: 0 }
];

let runningScoreA = 0;
let runningScoreB = 0;

// Generate 17 fake frames
for (let i = 0; i < 17; i++) {
  const previousTime = dummyData[dummyData.length - 1].time;
  const newTime = previousTime + Math.floor(Math.random() * 600 + 30); // 30s to 10min
  const winner = Math.random() > 0.5 ? 'A' : 'B';

  if (winner === 'A') {
    runningScoreA++;
  } else {
    runningScoreB++;
  }

  dummyData.push({
    winner,
    time: newTime,
    label: `${Math.round(newTime / 60)}'`,
    runningScoreA,
    runningScoreB
  });
}

const points = [];
const highlightPoints = [];

dummyData.forEach((frame, index) => {
  const y = frame.time / 60;
  const x = frame.winner === 'A' ? 1 : frame.winner === 'B' ? -1 : 0;
  const prevTime = index === 0 ? 0 : dummyData[index - 1].time;
  const frameTime = frame.time - prevTime;

  points.push({ x: 0, y });
  points.push({
    x,
    y,
    raw: {
      ...frame,
      frameTime,
      runningScoreA: frame.runningScoreA,
      runningScoreB: frame.runningScoreB
    }
  });
  points.push({ x: 0, y });

  highlightPoints.push({
    x,
    y,
    raw: {
      ...frame,
      frameTime,
      runningScoreA: frame.runningScoreA,
      runningScoreB: frame.runningScoreB
    }
  });
});

// Plugin to draw persistent frame time labels at the tips
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

    chart.data.datasets[2].data.forEach(pt => {
      const meta = chart.getDatasetMeta(2);
      const index = chart.data.datasets[2].data.indexOf(pt);
      const pos = meta.data[index]?.getProps(['x', 'y'], true);
      const label = pt.raw?.label || '';
      if (pos) {
        const offset = 20;
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
        borderWidth: 4,
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0
      },
      {
        label: 'Frame Dots',
        data: highlightPoints,
        showLine: false,
        pointRadius: 6,
        pointBackgroundColor: d => {
          const w = d.raw?.winner;
          if (w === 'A') return '#3399ff';
          if (w === 'B') return '#ff4444';
          return '#ccc';
        },
        pointBorderColor: '#fff',
        pointBorderWidth: 2
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
          callback: val => val === 1 ? 'Player A' : val === -1 ? 'Player B' : '',
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
        suggestedMax: dummyData[dummyData.length - 1].time / 60,
        ticks: {
          color: '#ccc',
          callback: value => {
            const h = Math.floor(value / 60);
            const m = Math.round(value % 60);
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
          label: ctx => {
            const raw = ctx.raw?.raw;
            if (!raw) return '';
            const formatTime = s => {
              const m = Math.floor(s / 60);
              const sec = String(s % 60).padStart(2, '0');
              return `${m}:${sec}`;
            };
            const frameTime = formatTime(raw.frameTime);
            const elapsedTime = formatTime(raw.time);
            const winner = raw.winner;
            const runningScore = `Score: Player A - ${ctx.raw.runningScoreA}, Player B - ${ctx.raw.runningScoreB}`;
            return `Frame Time: ${frameTime}\nElapsed Time: ${elapsedTime}\nWinner: ${winner}\n${runningScore}`;
          }
        }
      },
      legend: {
        display: false
      }
    }
  },
  plugins: [labelPlugin]
});