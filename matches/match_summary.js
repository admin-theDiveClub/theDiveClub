var match = null;

export async function UpdateMatchSummary(updatedMatch) 
{
    match = updatedMatch;

    if (GetScreenMode() === 'mobile')
    {
       BuildmatchTable_Vertical(match);
    } else 
    {
        BuildmatchTable_Horizontal(match);
    }

    BuildMatchSummaryTable(match);
    BuildMatchInformationTable(match);
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
    // Use "h" and "a" keys
    const homeKey = "h";
    const awayKey = "a";

    let homePlayer = (match && match.players && match.players[homeKey]) || {};
    let awayPlayer = (match && match.players && match.players[awayKey]) || {};

    let homePlayerName = homePlayer.fullName || (homePlayer.username ? homePlayer.username.split('@')[0] : "Player H");
    let awayPlayerName = awayPlayer.fullName || (awayPlayer.username ? awayPlayer.username.split('@')[0] : "Player A");

    if (match && match.settings && match.settings["lagWinner"] === homeKey) {
        homePlayerName += " *";
    } else if (match && match.settings && match.settings["lagWinner"] === awayKey) {
        awayPlayerName += " *";
    }

    let tableHTML = 
    `
        <table class="table table-bordered" style="font-size: 50%; text-align: center; overflow-wrap: anywhere !important;">
            <thead>
                <tr>
                    <th class="cell-tight">Frame</th>
                    <th class="cell-tight">${homePlayerName}</th>
                    <th class="cell-tight">${awayPlayerName}</th>
                    <th class="cell-tight">Frame Duration</th>
                </tr>
            </thead>
            <tbody id="scorecard-table-body">
    `;

    // Prepare frame data
    const frames = match && match.history
        ? Object.keys(match.history)
            .filter(k => !isNaN(Number(k)))
            .sort((a, b) => Number(a) - Number(b))
            .map(k => match.history[k])
        : [];

    let totalFrames = frames.length;
    let totalDuration = 0;
    let framesWonHome = 0;
    let framesWonAway = 0;

    for (let i = 0; i < totalFrames; i++) 
    {
        const frame = frames[i] || {};
        const frameDuration = frame.duration || 0;
        totalDuration += frameDuration;

        const frameWinner = frame["winner-player"];
        const frameResult = frame["winner-result"] || "";
        if (frameWinner === homeKey) framesWonHome++;
        if (frameWinner === awayKey) framesWonAway++;

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) {
                case "scr": return " (SB)";
                case "dry": return " (DB)";
                case "in":  return " (BI)";
                default: return event ? ` (${event})` : "";
            }
        };

        const breakEvent = formatBreakEvent(frame["break-event"]);
        const breakPlayer = frame["break-player"] || "";        

        // Populate cells for home and away players based on frame winner and break event
        var homeCell = "";
        var awayCell = "";
        if (frameWinner === homeKey) 
        {
            homeCell += frameResult;
            awayCell += "0";
        } else if (frameWinner === awayKey) 
        {
            awayCell += frameResult;
            homeCell += "0";
        } else {
            homeCell += "0";
            awayCell += "0";
        }

        if (breakPlayer === homeKey) {
            homeCell += breakEvent;
        } else if (breakPlayer === awayKey) 
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
    const scorecardElem = document.getElementById("scorecard-table-body");
    if (scorecardElem) {
        scorecardElem.innerHTML = '';
        scorecardElem.innerHTML = tableHTML;
    }
}

function BuildmatchTable_Horizontal(match) 
{
    const homeKey = "h";
    const awayKey = "a";

    let homePlayer = (match && match.players && match.players[homeKey]) || {};
    let awayPlayer = (match && match.players && match.players[awayKey]) || {};

    let homePlayerName = homePlayer.fullName || (homePlayer.username ? homePlayer.username.split('@')[0] : "Player H");
    let awayPlayerName = awayPlayer.fullName || (awayPlayer.username ? awayPlayer.username.split('@')[0] : "Player A");

    if (match && match.settings && match.settings["lagWinner"] === homeKey) {
        homePlayerName += " *";
    } else if (match && match.settings && match.settings["lagWinner"] === awayKey) {
        awayPlayerName += " *";
    }

    let tableHTML = 
    `
        <table class="table table-bordered" style="font-size: 50%; text-align: center;">
            <thead>
                <tr>
                    <th class="cell-tight">Frame</th>
    `;

    // Prepare frame data
    const frames = match && match.history
        ? Object.keys(match.history)
            .filter(k => !isNaN(Number(k)))
            .sort((a, b) => Number(a) - Number(b))
            .map(k => match.history[k])
        : [];

    let totalFrames = frames.length;
    let totalDuration = 0;

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
            <td class="cell-tight"><b>${homePlayerName}</b></td>
    `;

    for (let i = 0; i < totalFrames; i++) 
    {
        const frame = frames[i] || {};
        const frameResult = frame["winner-result"] || "";
        const frameWinner = frame["winner-player"];

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) 
            {
                case "scr": return " (SB)";
                case "dry": return " (DB)";
                case "in":  return " (BI)";
                default: return event ? ` (${event})` : "";
            }
        };

        const breakEvent = formatBreakEvent(frame["break-event"]);
        const breakPlayer = frame["break-player"] || "";
        let cellContent = frameWinner === homeKey ? frameResult : "0";
        if (breakPlayer === homeKey)
        {
            cellContent += breakEvent;
        }

        // Add the cell for the current frame to the home player row
        tableHTML += `<td class="cell-tight">${cellContent}</td>`;
    }

    // Add the total score cell for the home player
    const homeTotalScore = (match && match.results && match.results[homeKey] && match.results[homeKey].fw) || 0;
    tableHTML += `<td class="cell-tight"><b>${homeTotalScore}</b></td></tr>`;

    // Add the row for the away player
    tableHTML += 
    `
                <tr>
                    <td class="cell-tight"><b>${awayPlayerName}</b></td>
    `;

    for (let i = 0; i < totalFrames; i++) {
        const frame = frames[i] || {};
        const frameResult = frame["winner-result"] || "";
        const frameWinner = frame["winner-player"];

        // Format the break event for display
        const formatBreakEvent = (event) => 
        {
            switch (event) 
            {
                case "scr": return " (SB)";
                case "dry": return " (DB)";
                case "in":  return " (BI)";
                default: return event ? ` (${event})` : "";
            }
        };

        const breakEvent = formatBreakEvent(frame["break-event"]);
        const breakPlayer = frame["break-player"] || "";
        let cellContent = frameWinner === awayKey ? frameResult : "0";
        if (breakPlayer === awayKey) 
        {
            cellContent += breakEvent;
        }

        // Add the cell for the current frame to the away player row
        tableHTML += `<td class="cell-tight">${cellContent}</td>`;
    }

    // Add the total score cell for the away player
    const awayTotalScore = (match && match.results && match.results[awayKey] && match.results[awayKey].fw) || 0;
    tableHTML += `<td class="cell-tight"><b>${awayTotalScore}</b></td></tr>`;

    // Add the row for frame durations
    tableHTML += 
    `
                <tr>
                    <td class="cell-tight">Frame Durations</td>
    `;

    for (let i = 0; i < totalFrames; i++) 
    {
        const frame = frames[i] || {};
        const frameDuration = frame.duration || 0;
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
    const scorecardElem = document.getElementById("scorecard-table-body");
    if (scorecardElem) {
        scorecardElem.innerHTML = '';
        scorecardElem.innerHTML = tableHTML;
    }
}

function BuildMatchSummaryTable(match)
{
    const homeKey = "h";
    const awayKey = "a";

    // Helper to safely access nested properties
    const safe = (obj, path, def = 0) => {
        return path.reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj) ?? def;
    };

    // Defensive: ensure match, match.players, match.results exist
    const players = (match && match.players) ? match.players : {};
    const results = (match && match.results) ? match.results : {};

    let homePlayer = players[homeKey] || {};
    let awayPlayer = players[awayKey] || {};

    let homePlayerName = homePlayer.fullName || (homePlayer.username ? homePlayer.username.split('@')[0] : "Player H");
    let awayPlayerName = awayPlayer.fullName || (awayPlayer.username ? awayPlayer.username.split('@')[0] : "Player A");

    if (match && match.settings && match.settings["lagWinner"] === homeKey) {
        homePlayerName += " *";
    } else if (match && match.settings && match.settings["lagWinner"] === awayKey) {
        awayPlayerName += " *";
    }

    let homeBreaks = safe(results, [homeKey, 'breaks'], { scr: 0, dry: 0, in: 0 });
    let awayBreaks = safe(results, [awayKey, 'breaks'], { scr: 0, dry: 0, in: 0 });

    // Count total breaks for each player using match.history
    let homeBreaksTotal = 0;
    let awayBreaksTotal = 0;
    if (match && match.history) {
        Object.values(match.history).forEach(frame => {
            if (frame && frame["break-player"] === homeKey) homeBreaksTotal++;
            if (frame && frame["break-player"] === awayKey) awayBreaksTotal++;
        });
    }

    let tableHTML = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th colspan="3" id="playerH-name">${homePlayerName}</th>
                    <th colspan="1">Player</th>
                    <th colspan="3" id="playerA-name">${awayPlayerName}</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="3" id="framesWon_H" style="font-weight: 900; font-size: 2cap;">${safe(results, [homeKey, 'fw'])}</td>
                    <td colspan="1">Frames Won</td>
                    <td colspan="3" id="framesWon_A" style="font-weight: 900; font-size: 2cap;">${safe(results, [awayKey, 'fw'])}</td>
                </tr>
                <tr>
                    <td colspan="3" id="apples_H">${safe(results, [homeKey, 'bf'])}</td>
                    <td colspan="1">Apples</td>
                    <td colspan="3" id="apples_A">${safe(results, [awayKey, 'bf'])}</td>
                </tr>
                <tr>
                    <td colspan="3" id="reverseApples_H">${safe(results, [homeKey, 'rf'])}</td>
                    <td colspan="1">Reverse Apples</td>
                    <td colspan="3" id="reverseApples_A">${safe(results, [awayKey, 'rf'])}</td>
                </tr>
                <tr>
                    <td colspan="3" id="goldenBreaks_H">${safe(results, [homeKey, 'gb'])}</td>
                    <td colspan="1">Golden Breaks</td>
                    <td colspan="3" id="goldenBreaks_A">${safe(results, [awayKey, 'gb'])}</td>
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
                    <td id="breaks_H_SB">${homeBreaks.scr || 0}</td>
                    <td id="breaks_H_DB">${homeBreaks.dry || 0}</td>
                    <td id="breaks_H_BI">${homeBreaks.in || 0}</td>
                    
                    <td id="breaks_Total">${homeBreaksTotal} | ${awayBreaksTotal}</td>

                    <td id="breaks_A_SB">${awayBreaks.scr || 0}</td>
                    <td id="breaks_A_DB">${awayBreaks.dry || 0}</td>
                    <td id="breaks_A_BI">${awayBreaks.in || 0}</td>
                </tr>
            </tbody>
        </table>
    `;

    // Update the DOM with the generated table HTML
    const summaryElem = document.getElementById("match-summary-table");
    if (summaryElem) {
        summaryElem.innerHTML = '';
        summaryElem.innerHTML = tableHTML;
    }
}

function BuildMatchInformationTable(match) {
    // Defensive: check for null/undefined match and properties
    const startElem = document.getElementById("match-start-time");
    const endElem = document.getElementById("match-end-time");
    const durationElem = document.getElementById("match-duration");
    const avgElem = document.getElementById("match-average-frame-time");

    if (!match || !match.time) {
        if (startElem) startElem.textContent = "N/A";
        if (endElem) endElem.textContent = "N/A";
        if (durationElem) durationElem.textContent = "00:00:00";
        if (avgElem) avgElem.textContent = "0\"0'";
        return;
    }

    const startTime = new Date(match.time.start);
    const endTime = new Date(match.time.end);
    // Calculate match duration as the total of all frame durations in history
    const frames = match && match.history
        ? Object.keys(match.history)
            .filter(k => !isNaN(Number(k)))
            .sort((a, b) => Number(a) - Number(b))
            .map(k => match.history[k])
        : [];
    const matchDurationSeconds = frames.reduce((acc, frame) => acc + (frame && frame.duration ? frame.duration : 0), 0);

    const hours = Math.floor(matchDurationSeconds / 3600);
    const minutes = Math.floor((matchDurationSeconds % 3600) / 60);
    const seconds = matchDurationSeconds % 60;
    const formattedMatchDuration = `${hours}:${minutes}:${seconds}`;

    const totalFrames = frames.length;
    const totalFrameDuration = frames.reduce((acc, frame) => acc + (frame && frame.duration ? frame.duration : 0), 0);
    const averageFrameDurationSeconds = totalFrames > 0 ? Math.floor(totalFrameDuration / totalFrames) : 0;

    const avgMinutes = Math.floor((averageFrameDurationSeconds % 3600) / 60);
    const avgSeconds = averageFrameDurationSeconds % 60;
    const formattedAverageFrameDuration = `${avgMinutes}"${avgSeconds}'`;

    if (startElem) startElem.textContent = isNaN(startTime.getTime()) ? "?" : startTime.toLocaleString();
    if (endElem) endElem.textContent = (match.time.end && !isNaN(endTime.getTime())) ? endTime.toLocaleString() : "Ongoing";
    if (durationElem) durationElem.textContent = formattedMatchDuration || "00:00:00";
    if (avgElem) avgElem.textContent = totalFrames > 0 ? formattedAverageFrameDuration : "0\"0'";
}
