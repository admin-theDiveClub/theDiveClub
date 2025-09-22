var match = null;

export async function UpdateMatchTimingGraph(updatedMatch) 
{
    match = updatedMatch;
    BuildBarGraph(match);
}

function GetScreenMode ()
{
    if (window.innerWidth < 768) 
    {
        document.getElementById('timelineChart').style.height = '85vh';
        return 'mobile';
    } else if (window.innerWidth < 992) 
    {
        document.getElementById('timelineChart').style.height = '65vh';
        return 'tablet';
    } else 
    {
        document.getElementById('timelineChart').style.height = '35vh';
        return 'desktop';
    }
}

window.addEventListener('resize', () => 
{
    if (match) 
    {
        BuildBarGraph(match);
    }
});

function PrepareBarGraphData(match) {
    const xValues = [];
    const yValues = [];
    const barWidths = [];
    const colors = [];
    let elapsedTime = 0;

    if (!match || !match.history) {
        return { xValues, yValues, barWidths, colors, historyArr: [] };
    }

    // Convert history object to sorted array
    const historyArr = Object.keys(match.history)
        .filter(k => !isNaN(k) && match.history[k])
        .sort((a, b) => Number(a) - Number(b))
        .map(k => match.history[k])
        .filter(frame => frame); // filter out null/undefined frames

    for (let i = 0; i < historyArr.length; i++) {
        const frame = historyArr[i];
        if (!frame || typeof frame.duration !== 'number') continue;

        const frameTime = frame.duration / 60; // Convert seconds to minutes
        const winner = frame["winner-player"] === "a" ? -1 : 1;

        xValues.push(winner);
        yValues.push(elapsedTime + frameTime / 2);
        barWidths.push(frameTime);

        // Determine color based on frame winner-result
        const frameResult = frame["winner-result"];
        if (frameResult === "C") {
            colors.push('rgba(0, 255, 0, 0.25)');
        } else if (frameResult === "A" || frameResult === "G") {
            colors.push('rgba(255, 255, 0, 0.25)');
        } else {
            colors.push(winner === -1 ? 'rgba(0, 186, 245, 0.25)' : 'rgba(234, 0, 103, 0.25)');
        }

        elapsedTime += frameTime;
    }

    return { xValues, yValues, barWidths, colors, historyArr };
}

async function BuildBarGraph(match) {
    const graphData = PrepareBarGraphData(match);
    const screenMode = GetScreenMode();
    const isVertical = screenMode === 'mobile';

    // For running score
    let runningScoreH = 0;
    let runningScoreA = 0;

    // Swap home/away for vertical mode
    let xVals = graphData.xValues;
    let yVals = graphData.yValues;
    let swapped = false;
    if (isVertical) {
        // Flip the sign of xValues to swap sides
        xVals = graphData.xValues.map(v => -v);
        swapped = true;
    }

    const trace = {
        x: isVertical ? xVals : graphData.yValues,
        y: isVertical ? graphData.yValues : graphData.xValues,
        type: 'bar',
        orientation: isVertical ? 'h' : 'v',
        marker: {
            color: graphData.colors,
            line: {
                color: 'rgba(255, 255, 255, 1)',
                width: 1,
            },
        },
        width: graphData.barWidths,
        text: graphData.historyArr.map((frame, index) => {
            // Running score calculation
            if (frame["winner-result"] === 1) {
                if (frame["winner-player"] === "h") runningScoreH++;
                if (frame["winner-player"] === "a") runningScoreA++;
            }
            const minutes = Math.floor(frame.duration / 60);
            const seconds = frame.duration % 60;
            return `${minutes}'${seconds} <br><b>(${runningScoreH}-${runningScoreA})</b>`;
        }),
        textposition: 'inside',
        textfont: {
            color: 'white',
            family: 'Segoe UI',
        },
        hoverinfo: 'none',
    };

    const offset = 0.15;
    const breakLabelsTrace = {
        x: isVertical 
            ? graphData.xValues.map((value, index) => graphData.historyArr[index]["break-player"] === "a" ? offset : -offset)
            : graphData.yValues.map((value, index) => graphData.yValues[index]),
        y: isVertical 
            ? graphData.yValues.map((value, index) => graphData.yValues[index])
            : graphData.xValues.map((value, index) => graphData.historyArr[index]["break-player"] === "a" ? -offset : offset),
        mode: 'text+markers',
        text: graphData.historyArr.map((frame) => {
            let eventLabel = "";
            if (frame["break-event"] === "scr") eventLabel = "scratch";
            else if (frame["break-event"] === "dry") eventLabel = "dry";
            else if (frame["break-event"] === "in") eventLabel = "in";
            else eventLabel = frame["break-event"];
            return ` ${eventLabel} `;
        }),
        textfont: {
            color: 'rgba(255, 255, 255, 0.8)',
            family: 'Segoe UI',
            size: 12,
        },
        marker: {
            color: 'rgba(0, 0, 0, 0.25)',
            size: 24,
            symbol: 'circle',
        },
        hoverinfo: 'none',
    };

    const layout = {
        xaxis: {
            tickfont: { color: '#ccc', family: 'Segoe UI' },
            gridcolor: '#444',
            tickvals: isVertical ? [1, -1] : undefined,
            ticktext: isVertical
                ? [match.players.a.fullName, match.players.h.fullName] // swapped
                : undefined,
            tickmode: isVertical ? 'array' : undefined,
            fixedrange: true,
        },
        yaxis: {
            tickfont: { color: '#ccc', family: 'Segoe UI' },
            gridcolor: '#444',
            tickvals: isVertical ? undefined : [1, -1],
            ticktext: isVertical
                ? undefined
                : [match.players.h.fullName, match.players.a.fullName],
            tickmode: isVertical ? undefined : 'array',
            automargin: true,
            fixedrange: true,
        },
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        showlegend: false,
        margin: screenMode === 'mobile'
            ? { l: 50, r: 50, t: 0, b: 100 }
            : screenMode === 'tablet'
            ? { l: 100, r: 25, t: 0, b: 100 }
            : { l: 100, r: 50, t: 0, b: 100 },
    };

    const config = {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false,
    };

    await Plotly.newPlot('timelineChart', [trace, breakLabelsTrace], layout, config);
}