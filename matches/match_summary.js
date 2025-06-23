var match = null;

export async function UpdateMatchSummary(updatedMatch) 
{
    match = updatedMatch;
    //console.log('Match Summary: Updated match data', match);

    if (GetScreenMode() === 'mobile')
    {
       BuildmatchTable_Vertical(match);
    } else 
    {
        BuildmatchTable_Horizontal(match);
    }

    BuildMatchSummaryTable(match);
}

function GetScreenMode ()
{
    if (window.innerWidth < 768) 
    {
        return 'mobile';
    } else if (window.innerWidth < 992) 
    {
        return 'tablet';
    } else 
    {
        return 'desktop';
    }
}

window.addEventListener('resize', () => 
{
    if (match) 
    {
        UpdateMatchSummary(match);
    }
});

function BuildmatchTable_Vertical(match) 
{
    // Start building the HTML for the vertical table
    let tableHTML = 
    `
        <table class="table table-bordered" style="font-size: 50%; text-align: center; overflow-wrap: anywhere !important;">
            <thead>
                <tr>
                    <th class="cell-tight">Frame</th>
                    <th class="cell-tight">${match.players.home.fullName || match.players.home.username.split('@')[0] || "Home"}</th>
                    <th class="cell-tight">${match.players.away.fullName || match.players.away.username.split('@')[0] || "Away"}</th>
                    <th class="cell-tight">Frame Duration</th>
                </tr>
            </thead>
            <tbody id="scorecard-table-body">
    `;

    // Initialize variables to track total frames, duration, and frames won
    let totalFrames = match.history["frames-result"].length;
    let totalDuration = 0;
    let framesWonHome = 0;
    let framesWonAway = 0;

    // Loop through each frame to populate the table rows
    for (let i = 0; i < totalFrames; i++) 
    {
        const frameDuration = match.history["frames-duration"][i] || 0;
        totalDuration += frameDuration;

        const frameWinner = match.history["frames-winner"][i];
        const frameResult = match.history["frames-result"][i] || "";
        if (frameWinner === "home") framesWonHome++;
        if (frameWinner === "away") framesWonAway++;

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) {
                case 0: return " (SB)";
                case 1: return " (DB)";
                case 2: return " (BI)";
                default: return event;
            }
        };

        const breakEvent = formatBreakEvent(match.history["breaks-event"][i] || 0);
        const breakPlayer = match.history["breaks-player"][i] || "";        

        // Populate cells for home and away players based on frame winner and break event
        var homeCell = "";
        var awayCell = "";
        if (frameWinner === "home") 
        {
            homeCell += frameResult;
            awayCell += "0";
        } else if (frameWinner === "away") 
        {
            awayCell += frameResult;
            homeCell += "0";
        } 

        if (breakPlayer === "home") {
            homeCell += breakEvent;
        } else if (breakPlayer === "away") 
        {
            awayCell += breakEvent;
        }

        // Format the frame duration for display
        const minutes = Math.floor((frameDuration % 3600) / 60);
        const seconds = frameDuration % 60;
        const formattedDuration = `${minutes}"${seconds}'`;

        // Add the row for the current frame to the table
        tableHTML += 
        `
            <tr>
            <td class="cell-tight">${i + 1}</td>
            <td class="cell-tight">${homeCell}</td>
            <td class="cell-tight">${awayCell}</td>
            <td class="cell-tight">${formattedDuration}</td>
            </tr>
        `;
    }

    // Format the total duration for display
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const seconds = totalDuration % 60;
    const formattedTotalDuration = `${hours}:${minutes}:${seconds}`;

    // Add the summary row to the table
    tableHTML += 
    `
        <tr>
            <td class="cell-tight"><b>${totalFrames}</b></td>
            <td class="cell-tight"><b>${framesWonHome}</b></td>
            <td class="cell-tight"><b>${framesWonAway}</b></td>
            <td class="cell-tight"><b>${formattedTotalDuration}</b></td>
        </tr>
    `;

    // Close the table HTML
    tableHTML += 
    `
            </tbody>
        </table>
    `;

    // Update the DOM with the generated table HTML
    document.getElementById("scorecard-table-body").innerHTML = '';
    document.getElementById("scorecard-table-body").innerHTML = tableHTML;
}

function BuildmatchTable_Horizontal(match) 
{
    // Start building the HTML for the horizontal table
    let tableHTML = 
    `
        <table class="table table-bordered" style="font-size: 50%; text-align: center;">
            <thead>
                <tr>
                    <th class="cell-tight">Frame</th>
    `;

    // Initialize variables to track total frames, duration, and frames won
    let totalFrames = match.history["frames-result"].length;
    let totalDuration = 0;
    let framesWonHome = 0;
    let framesWonAway = 0;

    // Add column headers for each frame
    for (let i = 0; i < totalFrames; i++) 
    {
        tableHTML += `<th class="cell-tight">${i + 1}</th>`;
    }

    // Add the total frames column header
    tableHTML += 
    `
                <th class="cell-tight">Total Frames</th>
            </tr>
        </thead>
        <tbody>
    `;

    // Add the row for the home player
    tableHTML += 
    `
        <tr>
            <td class="cell-tight"><b>${match.players.home.fullName || match.players.home.username || "Home"}</b></td>
    `;

    for (let i = 0; i < totalFrames; i++) 
    {
        const frameResult = match.history["frames-result"][i] || "";
        const frameWinner = match.history["frames-winner"][i];

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) 
            {
                case 0: return " (SB)";
                case 1: return " (DB)";
                case 2: return " (BI)";
                default: return event;
            }
        };

        const breakEvent = formatBreakEvent(match.history["breaks-event"][i] || "");
        const breakPlayer = match.history["breaks-player"][i] || "";
        let cellContent = frameWinner === "home" ? frameResult : "0";
        if (breakPlayer === "home") 
        {
            cellContent += breakEvent;
        }

        // Add the cell for the current frame to the home player row
        tableHTML += `<td class="cell-tight">${cellContent}</td>`;
    }

    // Add the total score cell for the home player
    const homeTotalScore = match.results.home.frames || 0;
    tableHTML += `<td class="cell-tight"><b>${homeTotalScore}</b></td></tr>`;

    // Add the row for the away player
    tableHTML += 
    `
                <tr>
                    <td class="cell-tight"><b>${match.players.away.fullName || match.players.away.username || "Away"}</b></td>
    `;

    for (let i = 0; i < totalFrames; i++) {
        const frameResult = match.history["frames-result"][i] || "";
        const frameWinner = match.history["frames-winner"][i];

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) 
            {
                case 0: return " (SB)";
                case 1: return " (DB)";
                case 2: return " (BI)";
                default: return event;
            }
        };

        const breakEvent = formatBreakEvent(match.history["breaks-event"][i] || 0);
        const breakPlayer = match.history["breaks-player"][i] || "";
        let cellContent = frameWinner === "away" ? frameResult : "0";
        if (breakPlayer === "away") 
        {
            cellContent += breakEvent;
        }

        // Add the cell for the current frame to the away player row
        tableHTML += `<td class="cell-tight">${cellContent}</td>`;
    }

    // Add the total score cell for the away player
    const awayTotalScore = match.results.away.frames || 0;
    tableHTML += `<td class="cell-tight"><b>${awayTotalScore}</b></td></tr>`;

    // Add the row for frame durations
    tableHTML += 
    `
                <tr>
                    <td class="cell-tight">Frame Durations</td>
    `;

    for (let i = 0; i < totalFrames; i++) 
    {
        const frameDuration = match.history["frames-duration"][i] || 0;
        totalDuration += frameDuration;

        // Format the frame duration for display
        const minutes = Math.floor((frameDuration % 3600) / 60);
        const seconds = frameDuration % 60;
        const formattedDuration = `${minutes}"${seconds}'`;

        // Add the cell for the current frame duration
        tableHTML += `<td class="cell-tight">${formattedDuration}</td>`;
    }

    // Format the total duration for display
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const seconds = totalDuration % 60;
    const formattedTotalDuration = `${hours}:${minutes}:${seconds}`;

    // Add the total duration cell
    tableHTML += `<td class="cell-tight"><b>${formattedTotalDuration}</b></td></tr>`;

    // Close the table HTML
    tableHTML += 
    `
            </tbody>
        </table>
    `;

    // Update the DOM with the generated table HTML
    document.getElementById("scorecard-table-body").innerHTML = '';
    document.getElementById("scorecard-table-body").innerHTML = tableHTML;
}

function BuildMatchSummaryTable(match)
{
    let homeBreaksTotal = (match.results.home.breaks.scratch || 0) + 
                          (match.results.home.breaks.dry || 0) + 
                          (match.results.home.breaks.in || 0);

    let awayBreaksTotal = (match.results.away.breaks.scratch || 0) + 
                          (match.results.away.breaks.dry || 0) + 
                          (match.results.away.breaks.in || 0);

    let tableHTML = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th colspan="3" id="playerH-name">${match.players.home.fullName || match.players.home.username.split('@')[0] || "Home Player Name"}</th>
                    <th colspan="1">Player</th>
                    <th colspan="3" id="playerA-name">${match.players.away.fullName || match.players.away.username.split('@')[0] || "Away Player Name"}</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="3" id="framesWon_H">${match.results.home.frames || 0}</td>
                    <td colspan="1">Frames Won</td>
                    <td colspan="3" id="framesWon_A">${match.results.away.frames || 0}</td>
                </tr>
                <tr>
                    <td colspan="3" id="apples_H">${match.results.home.apples || 0}</td>
                    <td colspan="1">Apples</td>
                    <td colspan="3" id="apples_A">${match.results.away.apples || 0}</td>
                </tr>
                <tr>
                    <td colspan="3" id="reverseApples_H">${match.results.home.reverseApples || 0}</td>
                    <td colspan="1">Reverse Apples</td>
                    <td colspan="3" id="reverseApples_A">${match.results.away.reverseApples || 0}</td>
                </tr>
                <tr>
                    <td colspan="3" id="goldenBreaks_H">${match.results.home.goldenBreaks || 0}</td>
                    <td colspan="1">Golden Breaks</td>
                    <td colspan="3" id="goldenBreaks_A">${match.results.away.goldenBreaks || 0}</td>
                </tr>
                <tr>
                    <td>SB</td>
                    <td>DB</td>
                    <td>BI</td>
                    <td>Breaks</td>
                    <td>SB</td>
                    <td>DB</td>
                    <td>BI</td>
                </tr>
                <tr>
                    <td id="breaks_H_SB">${match.results.home.breaks.scratch || 0}</td>
                    <td id="breaks_H_DB">${match.results.home.breaks.dry || 0}</td>
                    <td id="breaks_H_BI">${match.results.home.breaks.in || 0}</td>
                    
                    <td id="breaks_Total">${homeBreaksTotal} | ${awayBreaksTotal}</td>

                    <td id="breaks_A_SB">${match.results.away.breaks.scratch || 0}</td>
                    <td id="breaks_A_DB">${match.results.away.breaks.dry || 0}</td>
                    <td id="breaks_A_BI">${match.results.away.breaks.in || 0}</td>
                </tr>
            </tbody>
        </table>
    `;

    // Update the DOM with the generated table HTML
    document.getElementById("match-summary-table").innerHTML = '';
    document.getElementById("match-summary-table").innerHTML = tableHTML;
}