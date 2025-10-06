// /c:/REPOS/theDiveClub/scripts/charts/chart_line.js
// Exported function to draw a match timeline using Chart.js
// Usage: import { DrawMatchTimeLine } from './chart_line.js';

function ensureCanvas(container, id) {
    let canvas = container.querySelector('canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        if (id) canvas.id = id;
        container.style.position = container.style.position || 'relative';
        container.appendChild(canvas);
    }
    return canvas;
}

function destroyChartIfAny(canvas) {
    if (!canvas) return;
    const c = canvas._chart;
    if (c && typeof c.destroy === 'function') {
        try { c.destroy(); } catch (e) { /* ignore */ }
    }
    canvas._chart = null;
}

function formatDuration(sec) {
    if (sec == null || isNaN(sec)) return '?';
    const total = Math.floor(Number(sec));
    const h = Math.floor(total / 3600);
    const rem = total % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function pointColorsFromHistory(breaksArray, pointsArray, color) {
    if (!Array.isArray(breaksArray) || !Array.isArray(pointsArray)) {
        return { background: color, border: color };
    }
    const bg = pointsArray.map(p => p ? color : 'black');
    const border = breaksArray.map(b => b ? color : 'white');
    return { background: bg, border: border };
}

function buildSeriesFromHistory(history, mode = 'default') {
    const times = [0];
    const scoreH = [0];
    const scoreA = [0];
    const frameWinsH = [0];
    const frameWinsA = [0];
    const breaksH = [];
    const breaksA = [];

    let t = 0, h = 0, a = 0;
    for (const f of history) {
        t += f.duration || 60;
        const winner = f['winner-player'];
        if (winner === 'h') h++; else if (winner === 'a') a++;
        frameWinsH.push(winner === 'h' ? 1 : 0);
        frameWinsA.push(winner === 'a' ? 1 : 0);
        times.push(t / 60);
        if (mode === 'default') 
        {
            scoreH.push(h);
            scoreA.push(a);
        } else if (mode === 'base_h')
        {
            scoreH.push(0);
            scoreA.push(a - h);
        } else if (mode === 'base_a')
        {
            scoreH.push(h - a);
            scoreA.push(0);
        }
        breaksH.push(f['break-player'] === 'h' ? 1 : 0);
        breaksA.push(f['break-player'] === 'a' ? 1 : 0);
    }

    const pointsH = times.map((time, i) => ({ x: time, y: scoreH[i] }));
    const pointsA = times.map((time, i) => ({ x: time, y: scoreA[i] }));

    return {
        times, scoreH, scoreA, frameWinsH, frameWinsA, breaksH, breaksA, pointsH, pointsA
    };
}

function createChartConfig({ pointsH, pointsA, scoreH, scoreA, pColH, pColA, player_H, player_A, history, mode, orientation }) {
    const lastIndex = scoreH.length - 1;
    const hWinning = scoreH[lastIndex] > scoreA[lastIndex];
    const aWinning = scoreA[lastIndex] > scoreH[lastIndex];

    // const isVertical = orientation === 'vertical';
    const isVertical = false;

    // If vertical, swap x/y on the points so x becomes score and y becomes time
    const dsPointsH = isVertical ? pointsH.map(p => ({ x: p.y, y: p.x })) : pointsH;
    const dsPointsA = isVertical ? pointsA.map(p => ({ x: p.y, y: p.x })) : pointsA;

    const stepSizeForTime = 1;

    const xScaleForTime = {
        type: 'linear',
        title: { display: false, text: 'Time (min)' },
        beginAtZero: true,
        ticks: { display: true, padding: 6, stepSize: stepSizeForTime },
        grid: { drawBorder: false, offset: true }
    };

    const xScaleForScore = {
        type: 'linear',
        title: { display: false, text: 'Score' },
        beginAtZero: true,
        precision: 0,
        ticks: { display: true, padding: 6, stepSize: 1 },
        grid: { drawBorder: false }
    };

    const yScaleForTime = {
        type: 'linear',
        title: { display: false, text: 'Time (min)' },
        beginAtZero: true,
        ticks: { display: true, padding: 6, stepSize: stepSizeForTime },
        grid: { drawBorder: false, offset: true }
    };

    const yScaleForScore = {
        title: { display: false, text: 'Running Score' },
        type: 'linear',
        beginAtZero: true,
        precision: 0,
        ticks: { display: true, padding: 6 },
        grid: { drawBorder: false }
    };

    // Choose scales depending on orientation
    const scales = isVertical
        ? { x: xScaleForScore, y: yScaleForTime }
        : { x: xScaleForTime, y: yScaleForScore };

    return {
        type: 'line',
        data: {
            datasets: [
                {
                    label: (player_H && player_H.displayName) || 'H',
                    data: dsPointsH,
                    borderColor: 'rgba(229,21,119,0.5)',
                    backgroundColor: 'rgba(229,21,119,0.5)',
                    fill: (mode == 'default') ? (hWinning ? false : true) : false,
                    tension: 0.25,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: pColH.background,
                    pointBorderColor: pColH.border,
                    pointBorderWidth: 1,
                    order: hWinning ? 2 : 1
                },
                {
                    label: (player_A && player_A.displayName) || 'A',
                    data: dsPointsA,
                    borderColor: 'rgba(2,200,237,0.5)',
                    backgroundColor: 'rgba(2,200,237,0.5)',
                    fill: (mode == 'default') ? (aWinning ? false : true) : false,
                    tension: 0.25,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: pColA.background,
                    pointBorderColor: pColA.border,
                    pointBorderWidth: 1,
                    order: aWinning ? 2 : 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 16, right: 32, top: 16, bottom: 16 } },
            plugins: {
                legend: { display: true },
                tooltip: {
                    displayColors: false,
                    mode: 'nearest',
                    intersect: true,
                    callbacks: {
                        title: (items) => {
                            if (!items || items.length === 0) return '';
                            const idx = items[0].dataIndex;
                            return idx > 0 ? `Frame: ${idx}` : 'Start';
                        },
                        label: (item) => {
                            const di = item.dataIndex - 1;
                            if (di < 0 || !history || !history[di]) return '';
                            const frame = history[di];
                            const idx = item.dataIndex;
                            const nameH = (player_H && player_H.displayName) || 'H';
                            const nameA = (player_A && player_A.displayName) || 'A';
                            const runH = scoreH[idx] || 0;
                            const runA = scoreA[idx] || 0;
                            const scoreLine = `${nameH} | ${runH} : ${runA} | ${nameA}`;
                            const durationLine = `Duration: ${formatDuration(frame.duration)}`;
                            return [scoreLine, durationLine];
                        }
                    }
                }
            },
            scales,
            elements: {
                point: {
                    radius: 6,
                    hoverRadius: 12,
                    borderColor: '#ffffff',
                    borderWidth: 1
                }
            }
        }
    };
}

export function DrawMatchTimeLine(history, player_H, player_A, mode, orientation) {
    if (!history || history.length === 0) return null;

    const timelineContainerH = document.getElementById('timeline_h');

    if (orientation === 'vertical') 
    {
        timelineContainerH.style.height = '80vh';
    } else 
    {
        timelineContainerH.style.height = '60vh';
    }

    if (!timelineContainerH) return null;

    const {
        scoreH, scoreA, frameWinsH, frameWinsA, breaksH, breaksA, pointsH, pointsA
    } = buildSeriesFromHistory(history, mode);

    const canvas = ensureCanvas(timelineContainerH, 'chart-timeline');
    destroyChartIfAny(canvas);

    const colorH = 'rgba(229,21,119,0.5)';
    const colorA = 'rgba(2,200,237,0.5)';

    const pColH = pointColorsFromHistory(breaksH, frameWinsH, colorH);
    const pColA = pointColorsFromHistory(breaksA, frameWinsA, colorA);

    const ctx = canvas.getContext('2d');

    const config = createChartConfig({
        pointsH, pointsA, scoreH, scoreA, pColH, pColA, player_H, player_A, history, mode, orientation
    });

    // Create Chart.js instance (expects Chart to be available globally)
    canvas._chart = new Chart(ctx, config);

    return canvas._chart;
}