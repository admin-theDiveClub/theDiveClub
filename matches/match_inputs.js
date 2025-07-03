var match = null;

document.getElementById('btn-player-H-point').addEventListener('click', () => {  UpdateScores(1, 0);  });

document.getElementById('btn-player-H-Apple').addEventListener('click', () => {  UpdateScores('A', 0);  });

document.getElementById('btn-player-H-cplus').addEventListener('click', () => {  UpdateScores('C', 0);  });

document.getElementById('btn-player-A-point').addEventListener('click', () => {  UpdateScores(0, 1);  });

document.getElementById('btn-player-A-Apple').addEventListener('click', () => {  UpdateScores(0, 'A');  });

document.getElementById('btn-player-A-cplus').addEventListener('click', () => {  UpdateScores(0, 'C');  });

document.getElementById('btn-player-H-gb').addEventListener('click', () => { UpdateScores('G', 0); });

document.getElementById('btn-player-A-gb').addEventListener('click', () => { UpdateScores(0, 'G'); });

document.getElementById('btn-timer-startMatch').addEventListener('click', () => 
{
    if (match.time && match.time.start) 
    {
        alert('Match has already started.');
    } else 
    {
        StartMatchTimer();
    }
});

document.getElementById('btn-timer-endMatch').addEventListener('click', async () => 
{
    if (!match.time.end) 
    {
        if (confirm('Are you sure you want to end the match? This cannot be undone.')) 
        {
            await EndMatchTimer();
        }
    } else 
    {
        alert('Match has already ended.');
    }  
});

export async function UpdateMatch(updatedMatch) 
{
    match = updatedMatch;

    if (match && match.time && match.time.end && !window.location.href.includes("scoreboard.html"))
    {
        window.location.href = `../matches/scoreboard.html?matchID=${match.id}`;
    }

    UpdateLagUI();
    UpdateScoresUI();
    IntializeSettingsUI();
}

async function PushUpdatedMatchToDatabase(match) 
{
    if (!match.info) match.info = {};
    match.info.lastUpdated = new Date().toISOString();

    if (!match.info) match.info = {};
    const winCondition = match.settings && match.settings.winCondition;
    console.log('winCondition:', winCondition);
    const hScore = match.results && match.results.h ? match.results.h.fw : 0;
    const aScore = match.results && match.results.a ? match.results.a.fw : 0;

    if ((match.time && match.time.end) || (winCondition && (hScore >= winCondition || aScore >= winCondition))) 
    {
        match.info.status = "Complete";
    } else if ((match.time && match.time.start) || hScore > 0 || aScore > 0) 
    {
        match.info.status = "Live";
    } else 
    {
        match.info.status = "New";
    }

    if (!match || !match.id) {
        console.warn('Match data is incomplete or missing an ID. No updates will be pushed to the database.');
        return;
    }

    if (match.time && match.time.end)
    {
        alert('Match has ended. No further updates can be made.');
        return;
    }

    const response = await supabase.from('tbl_matches').update(match).eq('id', match.id).select();

    console.warn('Updated match pushed to database. Response:', response);

    if (!response.error) {
        UpdateMatch(match);
    }
}

export async function UpdateScores(score_H, score_A) 
{
    if (!match) {
        console.warn('Match data is not initialized.');
        return;
    }

    const currentLag = GetCurrentLag();

    var breakEvent = null;
    if (document.getElementById('advancedBreakRecording') && document.getElementById('advancedBreakRecording').checked) 
    {
        breakEvent = currentLag === "home"
        ? document.querySelector('input[name="player-H-option"]:checked').value
        : document.querySelector('input[name="player-A-option"]:checked').value;
    } 
    
    if (!match.history) {
        match.history = {};
    }

    // Handle array-based history format
    if (match.history) {
        // Determine frame index for array
        // Determine frame index for array or object-based history
        let frameIndex;
        if (Array.isArray(match.history)) {
            frameIndex = match.history.length;
        } else {
            // Object-based: find max numeric key and increment
            const keys = Object.keys(match.history)
            .map(k => parseInt(k))
            .filter(k => !isNaN(k));
            frameIndex = keys.length > 0 ? Math.max(...keys) + 1 : 0;
        }
        console.log('Frame Index:', frameIndex);
        
        // Add frame to array-based history
        const frameData = {
            duration: GetFrameTime(),
            "break-event": getBreakEventString(score_H, score_A, breakEvent),
            "break-player": currentLag,
            "winner-player": getWinnerPlayer(score_H, score_A),
            "winner-result": getWinnerResult(score_H, score_A)
        };
        
        match.history[frameIndex] = frameData;
    } else {
        // Handle object-based history format (existing code)
        // ...existing object-based history code...
    }

    // Update results object
    if (!match.results) {
        match.results = {
            h: { fw: 0, rf: 0, gb: 0, bf: 0, breaks: { in: 0, dry: 0, scr: 0 } },
            a: { fw: 0, rf: 0, gb: 0, bf: 0, breaks: { in: 0, dry: 0, scr: 0 } }
        };
    }

    // Define variables for break event, break player, winner player, and winner result
    const breakEventStr = getBreakEventString(score_H, score_A, breakEvent);
    const breakPlayer = currentLag;
    const winnerPlayer = getWinnerPlayer(score_H, score_A);
    const winnerResult = getWinnerResult(score_H, score_A);

    // Update break stats
    if (breakEventStr && breakPlayer && match.results[breakPlayer] && match.results[breakPlayer].breaks[breakEventStr] !== undefined) {
        match.results[breakPlayer].breaks[breakEventStr]++;
    }

    // Update frame win
    if (winnerPlayer && match.results[winnerPlayer]) {
        match.results[winnerPlayer].fw++;
    }

    // "A" is bf, "G" is gb, "C" is rf
    if (winnerResult === "A" && winnerPlayer && match.results[winnerPlayer]) {
        match.results[winnerPlayer].bf++;
    }
    if (winnerResult === "G" && winnerPlayer && match.results[winnerPlayer]) {
        match.results[winnerPlayer].gb++;
    }
    if (winnerResult === "C" && winnerPlayer && match.results[winnerPlayer]) {
        match.results[winnerPlayer].rf++;
    }

    // Timer and info
    Timer_NextFrame();
    if (!match.info) match.info = {};
    match.info.lastUpdated = new Date().toISOString();

    // Check for match end with null-safe access
    const winCondition = match.settings ? match.settings.winCondition : null;
    if (winCondition && (match.results.h.fw >= winCondition || match.results.a.fw >= winCondition)) {
        const winner = match.results.h.fw >= winCondition
            ? (match.players && match.players.h ? match.players.h.fullName : 'Home Player')
            : (match.players && match.players.a ? match.players.a.fullName : 'Away Player');
        if (confirm(`${winner} has won the match. Would you like to end the match?`)) {
            await EndMatchTimer();
            return;
        }
    }

    await PushUpdatedMatchToDatabase(match);
}

// Helper functions to extract winner data
function getBreakEventString(score_H, score_A, breakEvent) {
    if (score_H === "A" || score_A === "A" || score_H === "G" || score_A === "G") {
        return "in";
    } else if (breakEvent === "BI") {
        return "in";
    } else if (breakEvent === "DB") {
        return "dry";
    } else if (breakEvent === "SB" || breakEvent === "FB") {
        return "scr";
    }
    return null;
}

function getWinnerPlayer(score_H, score_A) {
    if (score_H === 0) return "a";
    if (score_A === 0) return "h";
    return null;
}

function getWinnerResult(score_H, score_A) {
    return score_H === 0 ? score_A : score_H;
}

function GetCurrentLag() 
{
    // Count frames safely
    let totalFrames = 0;
    if (match && match.history) {
        if (Array.isArray(match.history)) {
            totalFrames = match.history.length;
        } else {
            totalFrames = Object.keys(match.history)
                .filter(key => !isNaN(Number(key)))
                .length;
        }
    }

    const settings = match && match.settings ? match.settings : {};
    const lagType = settings.lagType || null;
    const lagWinner = settings.lagWinner || null;
    
    if (!lagWinner) return null;

    if (lagType === "alternate") {
        if (lagWinner === "home" || lagWinner === "h") {
            return totalFrames % 2 === 0 ? "h" : "a";
        } else {
            return totalFrames % 2 === 0 ? "a" : "h";
        }
    } else if (lagType === "winner") {
        if (totalFrames === 0) {
            return lagWinner === "home" || lagWinner === "h" ? "h" : "a";
        } else {
            // Get last winner from history
            if (Array.isArray(match.history) && match.history.length > 0) {
                const lastFrame = match.history[match.history.length - 1];
                return lastFrame && lastFrame["winner-player"] ? lastFrame["winner-player"] : null;
            } else if (match.history && typeof match.history === "object") {
                // Object-based history: find the highest numeric key
                const numericKeys = Object.keys(match.history)
                    .map(k => parseInt(k))
                    .filter(k => !isNaN(k));
                if (numericKeys.length > 0) {
                    const lastKey = Math.max(...numericKeys).toString();
                    const lastFrame = match.history[lastKey];
                    return lastFrame && lastFrame["winner-player"] ? lastFrame["winner-player"] : null;
                }
            }
        }
    }

    return null;
}

function Timer_NextFrame() 
{
    console.warn("Timer: Next Frame Started.");
    SetFrameTimer();
}  

function StartMatchTimer() 
{
    if (!match.time) match.time = {};
    match.time.start = new Date().toISOString();
    SetFrameTimer();
    console.warn('Timer: Match started at:', match.time.start);
    const startElement = document.getElementById('match-time-start');
    if (startElement) {
        startElement.textContent = `Match Start Time: ${new Date(match.time.start).toLocaleString()}`;
    }
    PushUpdatedMatchToDatabase(match);
}

async function EndMatchTimer() 
{
    if (!match.time) match.time = {};
    match.time.end = new Date().toISOString();
    match.info.status = "Complete"; // Set match status to complete
    console.warn('Timer: Match ended at:', match.time.end);
    const endElement = document.getElementById('match-time-end');
    if (endElement) {
        endElement.textContent = `Match End Time: ${new Date(match.time.end).toLocaleString()}`;
    }
    const response = await supabase.from('tbl_matches').update(match).eq('id', match.id).select();
    console.warn('Updated match pushed to database. Response:', response);
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

function GetFrameTime() 
{
    const frameStartTime = localStorage.getItem('frameStartTime') || sessionStorage.getItem('frameStartTime');
    if (frameStartTime) {
        const start = new Date(frameStartTime);
        const now = new Date();
        const duration = Math.floor((now - start) / 1000); // Duration in seconds
        console.log('Frame duration:', duration + ' seconds');
        return duration;
    }
    console.log('No frame start time found.');
    return 0;
}

document.getElementById('btn-timer-restartFrameTimer').addEventListener('click', () => 
{
    SetFrameTimer();
});
document.getElementById('btn-correction').addEventListener('click', async () => 
{
    // Correction for object-based history (remove last frame and recalc results)
    if (!match || !match.history) {
        alert('No match or history to correct.');
        return;
    }
    // Find numeric keys in history
    const frameKeys = Object.keys(match.history)
        .map(k => parseInt(k))
        .filter(k => !isNaN(k));
    if (frameKeys.length === 0) {
        alert('No entries to remove.');
        return;
    }
    const lastFrameKey = Math.max(...frameKeys).toString();

    // Remove last frame
    if (Array.isArray(match.history)) {
        match.history.pop();
    } else {
        delete match.history[lastFrameKey];
    }

    // Remove last frame duration from frames-duration array
    if (Array.isArray(match.history["frames-duration"])) {
        match.history["frames-duration"].pop();
    }

    // Update local/session storage for frameStartTime
    const frameStartTimes = JSON.parse(localStorage.getItem('frameStartTimes') || '[]');
    frameStartTimes.pop();
    localStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
    sessionStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
    const lastFrameStartTime = frameStartTimes[frameStartTimes.length - 1] || null;
    if (lastFrameStartTime) {
        localStorage.setItem('frameStartTime', lastFrameStartTime);
        sessionStorage.setItem('frameStartTime', lastFrameStartTime);
    } else {
        localStorage.removeItem('frameStartTime');
        sessionStorage.removeItem('frameStartTime');
    }

    // Reset results
    match.results = {
        h: { fw: 0, rf: 0, gb: 0, bf: 0, breaks: { in: 0, dry: 0, scr: 0 } },
        a: { fw: 0, rf: 0, gb: 0, bf: 0, breaks: { in: 0, dry: 0, scr: 0 } }
    };

    // Rebuild results from history
    Object.keys(match.history)
        .filter(k => !isNaN(Number(k)))
        .sort((a, b) => Number(a) - Number(b))
        .forEach(frameKey => {
            const frame = match.history[frameKey];
            if (!frame) return;
            // Update break stats
            if (frame["break-event"] && frame["break-player"]) {
                if (match.results[frame["break-player"]]?.breaks[frame["break-event"]] !== undefined) {
                    match.results[frame["break-player"]].breaks[frame["break-event"]]++;
                }
            }
            // Update frame win
            if (frame["winner-player"]) {
                match.results[frame["winner-player"]].fw++;
            }
            // "A" is bf, "G" is gb, "C" is rf
            if (frame["winner-result"] === "A") {
                match.results[frame["winner-player"]].bf++;
            }
            if (frame["winner-result"] === "G") {
                match.results[frame["winner-player"]].gb++;
            }
            if (frame["winner-result"] === "C") {
                match.results[frame["winner-player"]].rf++;
            }
        });

    console.warn('Correction applied. Updated match:', match);

    await PushUpdatedMatchToDatabase(match);
});

function UpdateLagUI ()
{
    const currentLag = GetCurrentLag();
    console.log('Current Lag:', currentLag);
    const playerHBreakInfoContainer = document.getElementById('player-H-BreakInfo-container');
    const playerABreakInfoContainer = document.getElementById('player-A-BreakInfo-container');
    if (currentLag === "h") 
    {
        if (match.settings && match.settings.advancedBreaks) {
            playerHBreakInfoContainer.style.display = "block";
            playerABreakInfoContainer.style.display = "none";
        } else {
            playerHBreakInfoContainer.style.display = "none";
            playerABreakInfoContainer.style.display = "none";
        }
        document.getElementById('player-H-break-indicator-container').style.display = 'inline-block';
        document.getElementById('player-A-break-indicator-container').style.display = 'none';
        document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-H-cplus').style.display = 'none';
        document.getElementById('btn-player-A-Apple').style.display = 'none';
        document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'inline-block';
        document.getElementById('btn-player-A-gb').style.display = 'none';
    } else if (currentLag === "a") 
    {
        if (match.settings && match.settings.advancedBreaks) {
            playerHBreakInfoContainer.style.display = "none";
            playerABreakInfoContainer.style.display = "block";
        } else {
            playerHBreakInfoContainer.style.display = "none";
            playerABreakInfoContainer.style.display = "none";
        }
        document.getElementById('player-H-break-indicator-container').style.display = 'none';
        document.getElementById('player-A-break-indicator-container').style.display = 'inline-block';
        document.getElementById('btn-player-H-Apple').style.display = 'none';
        document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-A-cplus').style.display = 'none';
        document.getElementById('btn-player-A-gb').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'none';
    } else 
    {
        playerABreakInfoContainer.style.display = "none";
        playerHBreakInfoContainer.style.display = "none";
        document.getElementById('player-H-break-indicator-container').style.display = 'none';
        document.getElementById('player-A-break-indicator-container').style.display = 'none';
        document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'inline-block';
        document.getElementById('btn-player-A-gb').style.display = 'inline-block';
    }
}

function UpdateScoresUI ()
{
    if (!match) return;

    // Safely get player data
    const players = match.players || {};
    const playerH = players.h || {};
    const playerA = players.a || {};

    const playerHNicknameElement = document.getElementById('player-H-nickname');
    const playerHNameElement = document.getElementById('player-H-name');
    const playerANicknameElement = document.getElementById('player-A-nickname');
    const playerANameElement = document.getElementById('player-A-name');

    if (playerHNicknameElement) playerHNicknameElement.textContent = playerH.nickname || playerH.fullName || '';
    if (playerHNameElement) playerHNameElement.textContent = playerH.fullName || '';
    if (playerANicknameElement) playerANicknameElement.textContent = playerA.nickname || playerA.fullName || '';
    if (playerANameElement) playerANameElement.textContent = playerA.fullName || '';

    // Safely get results
    const results = match.results || {
        h: { fw: 0, bf: 0, rf: 0 },
        a: { fw: 0, bf: 0, rf: 0 }
    };
    const hRes = results.h || { fw: 0, bf: 0, rf: 0 };
    const aRes = results.a || { fw: 0, bf: 0, rf: 0 };

    // Update score elements safely
    const scoreElements = {
        'player-H-score': hRes.fw ?? 0,
        'player-H-apples': `A : ${hRes.bf ?? 0}`,
        'player-H-C+': `C+ : ${hRes.rf ?? 0}`,
        'player-A-score': aRes.fw ?? 0,
        'player-A-apples': `A : ${aRes.bf ?? 0}`,
        'player-A-C+': `C+ : ${aRes.rf ?? 0}`
    };

    Object.entries(scoreElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    // Timer: total duration of all frames
    let totalDuration = 0;
    if (match.history && Array.isArray(match.history["frames-duration"])) {
        totalDuration = match.history["frames-duration"].reduce((sum, duration) => sum + duration, 0);
    } else if (match.history) {
        // fallback: sum durations from object keys
        totalDuration = Object.values(match.history)
            .filter(f => f && typeof f === "object" && f.duration)
            .reduce((sum, f) => sum + (f.duration || 0), 0);
    }
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const seconds = totalDuration % 60;

    document.getElementById('timer-hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('timer-minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('timer-seconds').textContent = String(seconds).padStart(2, '0');

    // Frame durations list
    let frameDurations = [];
    if (match.history && Array.isArray(match.history["frames-duration"])) {
        frameDurations = match.history["frames-duration"];
    } else if (match.history) {
        // fallback: collect durations from object keys
        frameDurations = Object.values(match.history)
            .filter(f => f && typeof f === "object" && f.duration)
            .map(f => f.duration);
    }
    const formattedDurations = frameDurations.map(duration => {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        return `${mins}'${String(secs).padStart(2, '0')}`;
    });

    document.getElementById('timer-listFrameTimes').textContent = formattedDurations.join(', ');
}

function IntializeSettingsUI ()
{
    const settings = match && match.settings ? match.settings : {};
    
    // Safely update match type
    const matchType = settings.winType || "freePlay";
    const matchTypeElement = document.getElementById(matchType);
    if (matchTypeElement) matchTypeElement.checked = true;

    // Update inputs based on winType
    if (matchType === "race") 
    {
        document.getElementById('raceToValue').value = settings.winCondition || '';
        updateBestOfFromRaceTo(settings.winCondition || '');
    } else if (matchType === "fixed") {
        document.getElementById('frameCountValue').value = settings.winCondition || '';
    }

    // Update the "Advanced Break Recording" checkbox based on settings.advancedBreaks
    const advancedBreakRecordingCheckbox = document.getElementById('advancedBreakRecording');
    if (advancedBreakRecordingCheckbox) {
        advancedBreakRecordingCheckbox.checked = settings.advancedBreaks || false;
    }

    // Update the lag type radio buttons based on settings.lagType
    const lagType = settings.lagType || null;
    // Set lag type radio buttons
    if (lagType === "alternate") {
        document.getElementById("alternateBreak").checked = true;
    } else if (lagType === "winner") {
        document.getElementById("winnerBreak").checked = true;
    } else {
        // If lagType does not exist or is not recognized, check "None"
        document.getElementById("none").checked = true;
    }

    // Update the lag winner dropdown options based on players (support both "h"/"a" and "home"/"away")
    const lagWinnerDropdown = document.getElementById('select-lag');
    if (lagWinnerDropdown) {
        const players = match && match.players ? match.players : {};
        const homePlayer = players.h || {};
        const awayPlayer = players.a || {};
        
        lagWinnerDropdown.innerHTML = 
        `
            <option value="Please select lag winner." disabled>Please select lag winner.</option>
            <option value="h">${homePlayer.fullName || 'Home'}</option>
            <option value="a">${awayPlayer.fullName || 'Away'}</option>
        `;
        lagWinnerDropdown.value = settings.lagWinner || "Please select lag winner.";
    }

    // Safely update time UI
    if (match) 
    {
        const startElement = document.getElementById('match-time-start');
        const endElement = document.getElementById('match-time-end');

        if (match.time && match.time.start) 
        {
            startElement.textContent = `Match Start Time: ${new Date(match.time.start).toLocaleString()}`;
        } else 
        {
            startElement.textContent = "Match Start Time: Timer Not Started.";
        }

        if (match.time && match.time.end) 
        {
            endElement.textContent = `Match End Time: ${new Date(match.time.end).toLocaleString()}`;
        } else {
            endElement.textContent = "Match End Time: Ongoing";
        }
    }

    // Update frame start time UI
    const frameStartTime = localStorage.getItem('frameStartTime') || sessionStorage.getItem('frameStartTime');
    const frameTimeStartElement = document.getElementById('frame-time-start');
    if (frameTimeStartElement) {
        if (match && match.time && match.time.start) {
            if (frameStartTime) {
                frameTimeStartElement.textContent = `Frame Start Time: ${new Date(frameStartTime).toLocaleString()}`;
            } else {
                frameTimeStartElement.textContent = "Frame Start Time: Not Available";
            }
        } else {
            frameTimeStartElement.textContent = "Frame Timer Not Started";
        }
    }
}

document.querySelectorAll('input[name="matchType"]').forEach(radio => {
    radio.addEventListener('change', async (event) => {
        const selectedType = event.target.value;
        if (!match.settings) match.settings = {};
        match.settings.winType = selectedType;

        if (selectedType === "race") {
            const raceToValue = document.getElementById('raceToValue').value;
            match.settings.winCondition = parseInt(raceToValue, 10) || null;
        } else if (selectedType === "fixed") {
            const frameCountValue = document.getElementById('frameCountValue').value;
            match.settings.winCondition = parseInt(frameCountValue, 10) || null;
        } else {
            match.settings.winCondition = null;
        }

        await PushUpdatedMatchToDatabase(match);
    });
});

document.getElementById('raceToValue').addEventListener('input', async (event) => {
    const raceToValue = parseInt(event.target.value, 10);
    if (!isNaN(raceToValue)) {
        if (!match.settings) match.settings = {};
        match.settings.winCondition = raceToValue;
        match.settings.winType = "race";
        document.getElementById('race').checked = true;
        await PushUpdatedMatchToDatabase(match);
    }
});

document.getElementById('bestOfValue').addEventListener('input', async (event) => {
    const bestOfValue = parseInt(event.target.value, 10);
    if (!isNaN(bestOfValue)) {
        let raceTo;
        if (bestOfValue % 2 === 1) {
            raceTo = (bestOfValue + 1) / 2;
        } else {
            raceTo = bestOfValue / 2 + 1;
        }
        if (!match.settings) match.settings = {};
        match.settings.winCondition = raceTo;
        match.settings.winType = "race";
        document.getElementById('race').checked = true;
        document.getElementById('raceToValue').value = raceTo;
        await PushUpdatedMatchToDatabase(match);
    }
});

document.getElementById('frameCountValue').addEventListener('input', async (event) => {
    const frameCountValue = parseInt(event.target.value, 10);
    if (!isNaN(frameCountValue)) {
        if (!match.settings) match.settings = {};
        match.settings.winCondition = frameCountValue;
        match.settings.winType = "fixed";
        document.getElementById('fixedCount').checked = true;
        await PushUpdatedMatchToDatabase(match);
    }
});

document.getElementById('advancedBreakRecording').addEventListener('change', async (event) => 
{
    const isChecked = event.target.checked;
    if (!match.settings) 
    {
        match.settings = {};
    }
    match.settings.advancedBreaks = isChecked;
    await PushUpdatedMatchToDatabase(match);
});

document.querySelectorAll('input[name="lagType"]').forEach(radio => {
    radio.addEventListener('change', async (event) => {
        let selectedLagType = null;
        if (event.target.value === "alternateBreak") {
            selectedLagType = "alternate";
        } else if (event.target.value === "winnerBreak") {
            selectedLagType = "winner";
        } else if (event.target.value === "none") {
            selectedLagType = null;
        }
        if (!match.settings) {
            match.settings = {};
        }
        match.settings.lagType = selectedLagType;
        await PushUpdatedMatchToDatabase(match);
    });
});

document.getElementById('select-lag').addEventListener('change', async (event) => {
    const selectedLagWinner = event.target.value;
    if (!match.settings) {
        match.settings = {};
    }
    match.settings.lagWinner = selectedLagWinner;
    await PushUpdatedMatchToDatabase(match);
});