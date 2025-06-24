var match = null;

export async function UpdateMatchTimingGraph(updatedMatch) 
{
    match = updatedMatch; // Declare match as a local variable
    //console.log('Match Timing Graph: Updated match data', match);

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

    const timing = match.history["frames-duration"] || [];
    const framesWinner = match.history["frames-winner"] || [];
    for (let i = 0; i < timing.length; i++) {
        const frameTime = timing[i] / 60; // Convert seconds to minutes
        const winner = framesWinner[i] === "away" ? -1 : 1;

        xValues.push(winner); // Frame winner (-1 or 1)
        yValues.push(elapsedTime + frameTime / 2); // Center the bar vertically
        barWidths.push(frameTime); // Width based on frame time in minutes

        // Determine color based on frame winner
        const frameResult = match.history["frames-result"][i];
        if (frameResult === "C") {
            colors.push('rgba(0, 255, 0, 0.25)'); // Green for reverseApples
        } else if (frameResult === "A" || frameResult === "G") {
            colors.push('rgba(255, 255, 0, 0.25)'); // Yellow for apples and Golden Breaks
        } else {
            colors.push(winner === -1 ? 'rgba(0, 186, 245, 0.25)' : 'rgba(234, 0, 103, 0.25)'); // Away: Blue, Home: Red
        }

        elapsedTime += frameTime; // Increment elapsed time
    }

    return { xValues, yValues, barWidths, colors };
}

async function BuildBarGraph(match) {
    const graphData = PrepareBarGraphData(match);
    const screenMode = GetScreenMode(); // Use GetScreenMode once
    const isVertical = screenMode === 'mobile'; // Determine if vertical layout is needed

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
        width: graphData.barWidths, // Bar widths
        text: match.history["frames-duration"].map((time, index) => {
            const runningScoreH = match.history["frames-result"]
                .slice(0, index + 1)
                .filter((result, i) => result === 1 && match.history["frames-winner"][i] === "home").length;

            const runningScoreA = match.history["frames-result"]
                .slice(0, index + 1)
                .filter((result, i) => result === 1 && match.history["frames-winner"][i] === "away").length;

            const minutes = Math.floor(time / 60);
            const seconds = time % 60;

            const label = `${minutes}'${seconds} <br><b>(${runningScoreH}-${runningScoreA})</b>`;
            return label; // Running score labels
        }),
        textposition: 'inside', // Position labels inside the bars
        textfont: {
            color: 'white', // Set label color to white
            family: 'Segoe UI', // Use Segoe UI font
        },
        hoverinfo: 'none', // Disable tooltips on hover
    };

    const offset = 0.15;
    const breakLabelsTrace = {
        x: isVertical 
            ? graphData.xValues.map((value, index) => match.history["breaks-player"][index] === "away" ? -offset : offset) // Position based on breaks-player
            : graphData.yValues.map((value, index) => graphData.yValues[index]), // Offset vertically for horizontal mode
        y: isVertical 
            ? graphData.yValues.map((value, index) => graphData.yValues[index]) // Offset vertically for vertical mode
            : graphData.xValues.map((value, index) => match.history["breaks-player"][index] === "away" ? -offset : offset), // Position based on breaks-player
        mode: 'text+markers',
        text: match.history["breaks-event"].map((event, index) => {
            const eventLabel = event === 0 ? "scratch" : event === 1 ? "dry" : "in";
            return ` ${eventLabel} `; // Add padding to the text
        }),
        textfont: {
            color: 'rgba(255, 255, 255, 0.8)', // Slightly transparent white
            family: 'Segoe UI', // Use Segoe UI font
            size: 12, // Font size for labels
        },
        marker: {
            color: 'rgba(0, 0, 0, 0.25)', // Semi-transparent black background
            size: 24, // Marker size for background
            symbol: 'circle', // Rounded corners
        },
        hoverinfo: 'none', // Disable tooltips on hover
    };

    const layout = {
        xaxis: {
            tickfont: { color: '#ccc', family: 'Segoe UI' }, // Use Segoe UI font for x-axis
            gridcolor: '#444',
            tickvals: isVertical ? [1, -1] : undefined, // Reverse order for vertical mode
            ticktext: isVertical ? [match.players.away.fullName, match.players.home.fullName] : undefined, // Home on left, Away on right
            tickmode: isVertical ? 'array' : undefined,
            fixedrange: true, // Prevent zooming on x-axis
        },
        yaxis: {
            tickfont: { color: '#ccc', family: 'Segoe UI' }, // Use Segoe UI font for y-axis
            gridcolor: '#444',
            tickvals: isVertical ? undefined : [1, -1],
            ticktext: isVertical ? undefined : [match.players.home.fullName, match.players.away.fullName],
            tickmode: isVertical ? undefined : 'array',
            automargin: true, // Allow word-wrap for player names
            fixedrange: true, // Prevent zooming on y-axis
        },
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        showlegend: false,
        margin: screenMode === 'mobile'
            ? { l: 50, r: 50, t: 0, b: 100 } // Portrait (small screens)
            : screenMode === 'tablet'
            ? { l: 100, r: 25, t: 0, b: 100 } // Landscape (medium screens)
            : { l: 100, r: 50, t: 0, b: 100 }, // Desktop (large screens)
    };

    const config = {
        displayModeBar: false, // Hide the Plotly toolbar
        responsive: true, // Prevent zoom by making the graph responsive
        scrollZoom: false, // Disable scroll zoom
    };

    await Plotly.newPlot('timelineChart', [trace, breakLabelsTrace], layout, config);
}