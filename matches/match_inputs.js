var match = null;

export async function UpdateMatch(updatedMatch) 
{
    match = updatedMatch;
    UpdateLagUI();
    UpdateScoresUI();
}

async function PushUpdatedMatchToDatabase(match) 
{
    match.info = { lastUpdated: new Date().toISOString() };

    if (!match || !match.id) {
        console.warn('Match data is incomplete or missing an ID. No updates will be pushed to the database.');
        return;
    }

    const response = await supabase.from('tbl_matches_new').update(match).eq('id', match.id).select();

    console.warn('Updated match pushed to database. Response:', response);
}

document.getElementById('btn-player-H-point').addEventListener('click', () => {  UpdateScores(1, 0);  });

document.getElementById('btn-player-H-Apple').addEventListener('click', () => {  UpdateScores('A', 0);  });

document.getElementById('btn-player-H-cplus').addEventListener('click', () => {  UpdateScores('C', 0);  });

document.getElementById('btn-player-A-point').addEventListener('click', () => {  UpdateScores(0, 1);  });

document.getElementById('btn-player-A-Apple').addEventListener('click', () => {  UpdateScores(0, 'A');  });

document.getElementById('btn-player-A-cplus').addEventListener('click', () => {  UpdateScores(0, 'C');  });

document.getElementById('btn-player-H-gb').addEventListener('click', () => { UpdateScores('G', 0); });

document.getElementById('btn-player-A-gb').addEventListener('click', () => { UpdateScores(0, 'G'); });

export async function UpdateScores(score_H, score_A) {
    if (!match) {
        console.warn('Match data is not initialized.');
        return;
    }

    const currentLag = GetCurrentLag();
    var breakEvent = currentLag === "home"
        ? document.querySelector('input[name="player-H-option"]:checked').value
        : document.querySelector('input[name="player-A-option"]:checked').value;
        console.log('Current Lag:', currentLag, 'Break Event:', breakEvent);

    if (!match.history) {
        match.history = {
            "breaks-event": [],
            "breaks-player": [],
            "frames-result": [],
            "frames-winner": [],
            "frames-duration": []
        };
    }

    match.history["breaks-player"].push(currentLag);

    if (score_H === "A" || score_A === "A" || score_H === "G" || score_A === "G") 
    {
        match.history["breaks-event"].push(2);
        breakEvent = 'BI';
    } else 
    {
        if (breakEvent === "BI") {
            match.history["breaks-event"].push(2);
        } else if (breakEvent === "DB") {
            match.history["breaks-event"].push(1);
        } else {
            match.history["breaks-event"].push(0);
        }
    }

    if (currentLag === "home") {
        if (breakEvent === "BI") {
            match.results.home.breaks.in++;
        } else if (breakEvent === "DB") {
            match.results.home.breaks.dry++;
        } else {
            match.results.home.breaks.scratch++;
        }
    } else if (currentLag === "away") {
        if (breakEvent === "BI") {
            match.results.away.breaks.in++;
        } else if (breakEvent === "DB") {
            match.results.away.breaks.dry++;
        } else {
            match.results.away.breaks.scratch++;
        }
    }

    if (!match.results) {
        match.results = {
            home: {
                apples: 0,
                breaks: { in: 0, dry: 0, foul: 0, scratch: 0 },
                frames: 0,
                goldenBreaks: 0,
                reverseApples: 0
            },
            away: {
                apples: 0,
                breaks: { in: 0, dry: 0, foul: 0, scratch: 0 },
                frames: 0,
                goldenBreaks: 0,
                reverseApples: 0
            }
        };
    }

    if (score_H === 0) {
        match.results.away.frames++;
        match.history["frames-winner"].push("away");
        match.history["frames-result"].push(score_A);
    } else if (score_A === 0) {
        match.results.home.frames++;
        match.history["frames-winner"].push("home");
        match.history["frames-result"].push(score_H);
    }

    if (score_H === "A") {
        match.results.home.apples++;
    } else if (score_A === "A") {
        match.results.away.apples++;
    }

    if (score_H === "C") {
        match.results.home.reverseApples++;
    } else if (score_A === "C") {
        match.results.away.reverseApples++;
    }

    if (score_H === "G") {
        match.results.home.goldenBreaks++;
    } else if (score_A === "G") {
        match.results.away.goldenBreaks++;
    }

    Timer_NextFrame();

    match.info = { lastUpdated: new Date().toISOString() };

    await PushUpdatedMatchToDatabase(match);
}

function GetCurrentLag() 
{
    const totalFrames = match.history["breaks-player"].length;
    if (match.settings.lagType === "alternate") {
        return match.settings.lagWinner === "home" 
            ? (totalFrames % 2 === 0 ? "home" : "away") 
            : (totalFrames % 2 === 0 ? "away" : "home");
    } else if (match.settings.lagType === "winner") {
        if (totalFrames === 0) {
            return match.settings.lagWinner; // Whoever wins the lag breaks first
        } else {
            const lastBreakPlayer = match.history["breaks-player"][totalFrames - 1];
            return lastBreakPlayer; // Last break player breaks next
        }
    }

    return null; // Default case if lagType is not set
}

function Timer_NextFrame() {
    const frameTime = GetFrameTime();
    if (!Array.isArray(match.history["frames-duration"])) {
        match.history["frames-duration"] = [];
    }
    match.history["frames-duration"].push(frameTime);
    console.warn("Timer: Next Frame Started.");
    SetFrameTimer();
}  

function StartMatchTimer() {
    match.time.start = new Date().toISOString();
    SetFrameTimer();
    console.warn('Timer: Match started at:', match.time.start);
    document.getElementById('match-time-start').textContent = `Match Start Time: ${new Date(match.time.start).toLocaleString()}`;
    PushUpdatedMatchToDatabase(match);
}

function EndMatchTimer() {
    match.time.end = new Date().toISOString();
    match.status = "Complete";
    console.warn('Timer: Match ended at:', match.time.end);
    document.getElementById('match-time-end').textContent = `Match End Time: ${new Date(match.time.end).toLocaleString()}`;
    PushUpdatedMatchToDatabase(match);
}

function SetFrameTimer() {
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

function GetFrameTime() {
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

document.getElementById('btn-timer-restartFrameTimer').addEventListener('click', () => {
    SetFrameTimer();
});

document.getElementById('btn-correction').addEventListener('click', async () => {
    if (
        match.history["frames-result"].length > 0 &&
        match.history["frames-winner"].length > 0 &&
        match.history["frames-duration"].length > 0
    ) {
        // Remove the last entries from history
        match.history["frames-result"].pop();
        match.history["frames-winner"].pop();
        match.history["frames-duration"].pop();

        // Remove the last entries from breaks history
        if (
            match.history["breaks-player"].length > 0 &&
            match.history["breaks-event"].length > 0
        ) {
            const lastBreakPlayer = match.history["breaks-player"].pop();
            const lastBreakEvent = match.history["breaks-event"].pop();

            // Update results based on the removed break event
            if (lastBreakPlayer === "home") {
            if (lastBreakEvent === 2) {
                match.results.home.breaks.in--;
            } else if (lastBreakEvent === 1) {
                match.results.home.breaks.dry--;
            } else {
                match.results.home.breaks.scratch--;
            }
            } else if (lastBreakPlayer === "away") {
            if (lastBreakEvent === 2) {
                match.results.away.breaks.in--;
            } else if (lastBreakEvent === 1) {
                match.results.away.breaks.dry--;
            } else {
                match.results.away.breaks.scratch--;
            }
            }
        }

        // Update local and session storage for frameStartTime
        const frameStartTimes = JSON.parse(localStorage.getItem('frameStartTimes') || '[]');
        frameStartTimes.pop(); // Remove the last entry
        localStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));
        sessionStorage.setItem('frameStartTimes', JSON.stringify(frameStartTimes));

        // Update the current frameStartTime to the last entry in frameStartTimes
        const lastFrameStartTime = frameStartTimes[frameStartTimes.length - 1] || null;
        if (lastFrameStartTime) {
            localStorage.setItem('frameStartTime', lastFrameStartTime);
            sessionStorage.setItem('frameStartTime', lastFrameStartTime);
        } else {
            localStorage.removeItem('frameStartTime');
            sessionStorage.removeItem('frameStartTime');
        }

        // Recalculate results
        match.results.home.frames = match.history["frames-winner"].filter(winner => winner === "home").length;
        match.results.away.frames = match.history["frames-winner"].filter(winner => winner === "away").length;

        match.results.home.apples = match.history["frames-result"].filter(score => score === "A").length;
        match.results.away.apples = match.history["frames-result"].filter(score => score === "A").length;

        match.results.home.reverseApples = match.history["frames-result"].filter(score => score === "C").length;
        match.results.away.reverseApples = match.history["frames-result"].filter(score => score === "C").length;

        match.results.home.goldenBreaks = match.history["frames-result"].filter(score => score === "G").length;
        match.results.away.goldenBreaks = match.history["frames-result"].filter(score => score === "G").length;

        console.warn('Correction applied. Updated match:', match);

        // Push the updated match to the database
        await PushUpdatedMatchToDatabase(match);
    } else {
        alert('No entries to remove.');
    }
});

function UpdateLagUI ()
{
    const currentLag = GetCurrentLag();
    const playerHBreakInfoContainer = document.getElementById('player-H-BreakInfo-container');
    const playerABreakInfoContainer = document.getElementById('player-A-BreakInfo-container');
    if (currentLag === "home") {
        playerHBreakInfoContainer.style.display = "block";
        playerABreakInfoContainer.style.display = "none";
        document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-H-cplus').style.display = 'none';
        document.getElementById('btn-player-A-Apple').style.display = 'none';
        document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'inline-block';
        document.getElementById('btn-player-A-gb').style.display = 'none';
    } else if (currentLag === "away") {
        playerHBreakInfoContainer.style.display = "none";
        playerABreakInfoContainer.style.display = "block";
        document.getElementById('btn-player-H-Apple').style.display = 'none';
        document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-A-cplus').style.display = 'none';
        document.getElementById('btn-player-A-gb').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'none';
    } else {
        playerHBreakInfoContainer.style.display = "none";
        playerABreakInfoContainer.style.display = "none";
        document.getElementById('btn-player-H-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-H-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-A-Apple').style.display = 'inline-block';
        document.getElementById('btn-player-A-cplus').style.display = 'inline-block';
        document.getElementById('btn-player-H-gb').style.display = 'inline-block';
    }
}

function UpdateScoresUI ()
{
    const playerHNicknameElement = document.getElementById('player-H-nickname');
    const playerHNameElement = document.getElementById('player-H-name');
    const playerANicknameElement = document.getElementById('player-A-nickname');
    const playerANameElement = document.getElementById('player-A-name');

    if (match && match.players) {
        playerHNicknameElement.textContent = match.players.home.nickname || match.players.home.fullName || '';
        playerHNameElement.textContent = match.players.home.fullName || '_fullName';
        playerANicknameElement.textContent = match.players.away.nickname || match.players.away.fullName || '_nickname';
        playerANameElement.textContent = match.players.away.fullName || '_fullName';
    }

    const playerHScoreElement = document.getElementById('player-H-score');
    const playerHApplesElement = document.getElementById('player-H-apples');
    const playerHCPlusElement = document.getElementById('player-H-C+');
    const playerHBreakIndicatorElement = document.getElementById('player-H-break-indicator-container');

    const playerAScoreElement = document.getElementById('player-A-score');
    const playerAApplesElement = document.getElementById('player-A-apples');
    const playerACPlusElement = document.getElementById('player-A-C+');
    const playerABreakIndicatorElement = document.getElementById('player-A-break-indicator-container');

    if (match && match.results) {
        playerHScoreElement.textContent = match.results.home.frames;
        playerHApplesElement.textContent = `A : ${match.results.home.apples}`;
        playerHCPlusElement.textContent = `C+ : ${match.results.home.reverseApples}`;
        playerHBreakIndicatorElement.style.display = GetCurrentLag() === "home" ? "block" : "none";

        playerAScoreElement.textContent = match.results.away.frames;
        playerAApplesElement.textContent = `A : ${match.results.away.apples}`;
        playerACPlusElement.textContent = `C+ : ${match.results.away.reverseApples}`;
        playerABreakIndicatorElement.style.display = GetCurrentLag() === "away" ? "block" : "none";
    }
}
