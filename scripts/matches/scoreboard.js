Start ();

async function Start ()
{
    const matchID = _matchID();
    if (matchID)
    {
        const match = await _match(matchID);
        matchRef = match;
        console.log(match);

        if (match)
        {
            const players = match.players;
            playerH = await _playerProfile(players.h.username);
            playerA = await _playerProfile(players.a.username);

            PopulateHeadToHeadPlayerInfo(playerH, playerA);
            PopulateMatchSummary(match);
            PopulateMatchScorecard(match);

            gid('component-loading-overlay').style.display = 'none';
        }
    }
}

var playerH, playerA;
var matchRef;

function _matchID () 
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
    window.location.href = "/matches/create.html";
    return null;
  }
}

async function _match (matchID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('id', matchID).single();
    if (response.error)
    {
        console.log("Error Getting Match:", response.error.message);
        return null;
    } else 
    {  
        const match = response.data;
        const subResponse = await SubscribeToUpdates(matchID);
        if (subResponse.error)
        {
            console.log("Error Subscribing to Updates:", subResponse.error.message);
        }
        return match;
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
        //console.log('Source: Change Received!', payload.new);
        OnPayloadReceived(payload.new);
      }
  )
  .subscribe();
  return channels;
}

async function OnPayloadReceived (match)
{
    if (match)
    {
        PopulateHeadToHeadPlayerInfo(playerH, playerA);
        PopulateMatchSummary(match);
        PopulateMatchScorecard(match);

        gid('component-loading-overlay').style.display = 'none';
    }
}

async function _playerProfile (username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
    if (response.error)
    {
        console.log("Error Getting Player Profile:", response.error.message);
        const profile = {username: username, displayName: username};
        return profile;
    } else 
    {  
        const playerProfile = response.data;
        var displayName = playerProfile.nickname || playerProfile.name || playerProfile.username;
        playerProfile.displayName = displayName;
        return playerProfile;
    }
}

function gid (id)
{
    return document.getElementById(id);
}

function PopulateHeadToHeadPlayerInfo (profileH, profileA)
{
    if (profileH.pp)
    {
        gid('teamH_icon').src = profileH.pp;
    }

    if (profileA.pp)
    {
        gid('teamA_icon').src = profileA.pp;
    }

    gid('teamH_name').innerText = profileH.displayName;
    gid('teamA_name').innerText = profileA.displayName;
}

function PopulateMatchSummary(match)
{
    if (!match) return;

    const resH = (match.results && match.results.h) || {};
    const resA = (match.results && match.results.a) || {};

    // Scores / totals
    gid('match-summary-player-h-score').innerText = resH.fw ?? 0;
    gid('match-summary-player-a-score').innerText = resA.fw ?? 0;

    gid('match-summary-player-h-bf').innerText = resH.bf ?? 0;
    gid('match-summary-player-a-bf').innerText = resA.bf ?? 0;

    gid('match-summary-player-h-rf').innerText = resH.rf ?? 0;
    gid('match-summary-player-a-rf').innerText = resA.rf ?? 0;

    gid('match-summary-player-h-gb').innerText = resH.gb ?? 0;
    gid('match-summary-player-a-gb').innerText = resA.gb ?? 0;

    // Breaks breakdown
    const breaksH = resH.breaks || {};
    const breaksA = resA.breaks || {};

    const hDry  = breaksH.dry  ?? 0;
    const hIn   = breaksH.in   ?? 0;
    const hScr  = breaksH.scr  ?? 0;
    const hFoul = breaksH.foul ?? 0;

    const aDry  = breaksA.dry  ?? 0;
    const aIn   = breaksA.in   ?? 0;
    const aScr  = breaksA.scr  ?? 0;
    const aFoul = breaksA.foul ?? 0;

    gid('match-summary-player-h-break-dry').innerText  = hDry;
    gid('match-summary-player-h-break-in').innerText   = hIn;
    gid('match-summary-player-h-break-scr').innerText  = hScr;
    gid('match-summary-player-h-break-foul').innerText = hFoul;

    gid('match-summary-player-a-break-dry').innerText  = aDry;
    gid('match-summary-player-a-break-in').innerText   = aIn;
    gid('match-summary-player-a-break-scr').innerText  = aScr;
    gid('match-summary-player-a-break-foul').innerText = aFoul;

    const totalBreaksH = hDry + hIn + hScr + hFoul;
    const totalBreaksA = aDry + aIn + aScr + aFoul;

    // central "Breaks" cell shows H | A totals
    gid('match-summary-player-h-breaks').innerText = `${totalBreaksH} | ${totalBreaksA}`;

    // Start / End / Duration / Average Frame Time
    const startTime = match.time && (match.time.start || match.time.startTime);
    const endTime = match.time && (match.time.end || match.time.endTime);

    function fmtDate(d) {
        try {
            return new Date(d).toLocaleString();
        } catch (e) {
            return '-';
        }
    }

    function fmtDurationMs(ms) {
        if (!isFinite(ms) || ms <= 0) return '-';
        const totalSec = Math.round(ms / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        if (hrs > 0) return `${hrs}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
        return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }

    gid('match-summary-start-time').innerText = startTime ? fmtDate(startTime) : '-';
    gid('match-summary-end-time').innerText   = endTime   ? fmtDate(endTime)   : '-';

    // Compute match duration (prefer time.start/time.end, fallback to sum of completed history durations)
    let matchDurationMs = null;
    if (startTime && endTime) {
        matchDurationMs = new Date(endTime) - new Date(startTime);
    } else {
        // sum history durations for completed frames
        const durations = (match.history || []).map(h => h.duration).filter(d => Number.isFinite(d)).map(d => d * 1000);
        if (durations.length) matchDurationMs = durations.reduce((a,b) => a + b, 0);
    }
    gid('match-summary-duration').innerText = matchDurationMs ? fmtDurationMs(matchDurationMs) : '-';

    // Average frame time: use sum of completed history durations if available, else use matchDuration / frames
    const completedFrames = ((resH.fw ?? 0) + (resA.fw ?? 0)) || (match.history || []).filter(h => h.winner_player).length;
    let sumFrameMs = 0;
    const historyDurations = (match.history || []).map(h => h.duration).filter(d => Number.isFinite(d)).map(d => d * 1000);
    if (historyDurations.length) {
        sumFrameMs = historyDurations.reduce((a,b) => a + b, 0);
    } else if (matchDurationMs) {
        sumFrameMs = matchDurationMs;
    }

    let avgFrameMs = (completedFrames > 0 && sumFrameMs > 0) ? Math.round(sumFrameMs / completedFrames) : null;
    gid('match-summary-average-frame-time').innerText = avgFrameMs ? fmtDurationMs(avgFrameMs) : '-';

    // Optionally populate player name cells if global profiles are available
    if (typeof playerH !== 'undefined' && playerH && playerH.displayName) {
        gid('match-summary-player-h').innerText = playerH.displayName;
    }
    if (typeof playerA !== 'undefined' && playerA && playerA.displayName) {
        gid('match-summary-player-a').innerText = playerA.displayName;
    }
}

window.addEventListener('resize', () => {
    PopulateMatchScorecard(matchRef);
});

function PopulateMatchScorecard(match)
{
    if (!match) return;
    const table = gid('scorecard-h-table');
    if (!table) return;

    const history = match.history || [];

    // Ignore history entries that do not have a truthy "winner-result"
    const filteredHistory = history.filter(h => h);
    const frameCount = filteredHistory.length;

    // orientation: landscape -> keep table as-is; portrait -> transpose
    const isLandscape = window.innerWidth > window.innerHeight;

    // common helpers
    function playerDisplayName(key, profile) {
        if (profile && profile.displayName) return profile.displayName;
        if (match.players && match.players[key] && match.players[key].username) return match.players[key].username;
        return key === 'h' ? 'Player H' : 'Player A';
    }

    function fmtDurationSeconds(sec) {
        if (!Number.isFinite(sec) || sec === null) return '-';
        const total = Math.max(0, Math.round(sec));
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        if (hrs > 0) {
            return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
        }
        return `${mm}:${ss}`;
    }

    function mapWinnerResult(wres) {
        switch (wres) {
            case 1: return 1;
            case 'A': return 'B/F';
            case 'C': return 'R/F';
            case 'G': return 'GB';
            case 0: return 0;
            default: return wres;
        }
    }

    // build canonical data structure (header array and rows of cells) so we can render either orientation
    const header = ['i'];
    for (let i = 0; i < frameCount; i++) header.push(`F${i + 1}`);
    header.push('Final Score');

    // Build rows as arrays of cell objects: { text: string, classes: [] }
    const rows = [];

    // Breaks row
    const breaksCells = [];
    for (let i = 0; i < frameCount; i++) {
        const frame = filteredHistory[i] || {};
        const breakPlayer = frame['break-player'];
        const breakEvent = frame['break-event'];
        const cell = { text: (breakEvent != null ? String(breakEvent) : ''), classes: [] };
        if (breakPlayer === 'h') cell.classes.push('color-h');
        else if (breakPlayer === 'a') cell.classes.push('color-a');
        breaksCells.push(cell);
    }
    breaksCells.push({ text: '', classes: [] }); // final column for breaks is empty
    rows.push({ label: 'Breaks', cells: breaksCells });

    // Player rows
    function makePlayerRow(playerKey, profile) {
        const cells = [];
        for (let i = 0; i < frameCount; i++) {
            const frame = filteredHistory[i] || {};
            const winner = frame['winner-player'];
            let wres = frame['winner-result'];
            wres = mapWinnerResult(wres);

            const cell = { text: '', classes: [] };
            if (winner === playerKey) {
                cell.text = (wres !== undefined && wres !== null) ? String(wres) : '0';
                cell.classes.push('score-win');
            } else {
                cell.text = '0';
                cell.classes.push('score-lose');
            }
            cells.push(cell);
        }

        const scoreFromResults = match.results && match.results[playerKey] && Number.isFinite(match.results[playerKey].fw) ? match.results[playerKey].fw : null;
        const computedScore = filteredHistory.filter(h => h && h['winner-player'] === playerKey).length;
        cells.push({ text: (scoreFromResults !== null ? String(scoreFromResults) : String(computedScore)), classes: [] });

        return { label: playerDisplayName(playerKey, profile), cells };
    }

    rows.push(makePlayerRow('h', playerH));
    rows.push(makePlayerRow('a', playerA));

    // Duration row
    const durationCells = [];
    let totalDurationSec = 0;
    for (let i = 0; i < frameCount; i++) {
        const frame = filteredHistory[i] || {};
        const durSec = frame.duration;
        const fmt = fmtDurationSeconds(durSec);
        durationCells.push({ text: (fmt === '-' ? '' : fmt), classes: [] });
        totalDurationSec += (durSec ? durSec : 0);
    }
    durationCells.push({ text: fmtDurationSeconds(totalDurationSec), classes: [] });
    rows.push({ label: 'Duration', cells: durationCells });

    // now render based on orientation
    table.innerHTML = '';

    if (isLandscape) {
        // original layout: header -> rows as built
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (let i = 0; i < header.length; i++) {
            const th = document.createElement('th');
            th.innerText = header[i];
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        // Breaks row
        const breaksRow = document.createElement('tr');
        const breaksLabelTd = document.createElement('td');
        breaksLabelTd.innerText = rows[0].label;
        breaksRow.appendChild(breaksLabelTd);
        for (const c of rows[0].cells) {
            const td = document.createElement('td');
            td.innerText = c.text;
            c.classes.forEach(cl => td.classList.add(cl));
            breaksRow.appendChild(td);
        }
        tbody.appendChild(breaksRow);

        // player rows (use class on name cell)
        for (let r = 1; r <= 2; r++) {
            const rowObj = rows[r];
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.innerText = rowObj.label;
            nameTd.classList.add('scorecard-player-name');
            if (r === 1) nameTd.classList.add('color-h');
            else nameTd.classList.add('color-a');
            tr.appendChild(nameTd);

            for (const c of rowObj.cells) {
                const td = document.createElement('td');
                td.innerText = c.text;
                c.classes.forEach(cl => td.classList.add(cl));
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }

        // Duration row
        const durationRow = document.createElement('tr');
        const durationLabelTd = document.createElement('td');
        durationLabelTd.innerText = rows[3].label;
        durationRow.appendChild(durationLabelTd);
        for (const c of rows[3].cells) {
            const td = document.createElement('td');
            td.innerText = c.text;
            durationRow.appendChild(td);
        }
        tbody.appendChild(durationRow);

        table.appendChild(tbody);
    } else 
    {
        //Portrait Mode
        // Build a transposed view: each frame is a row with columns: Frame | Breaks | Player_H | Player_A | Duration
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');

        const thFrame = document.createElement('th');
        thFrame.innerText = 'Frame';
        headRow.appendChild(thFrame);

        const thBreaks = document.createElement('th');
        thBreaks.innerText = 'Breaks';
        headRow.appendChild(thBreaks);

        const thH = document.createElement('th');
        thH.innerText = playerDisplayName('h', playerH);
        thH.classList.add('color-h');
        headRow.appendChild(thH);

        const thA = document.createElement('th');
        thA.innerText = playerDisplayName('a', playerA);
        thA.classList.add('color-a');
        headRow.appendChild(thA);

        const thDur = document.createElement('th');
        thDur.innerText = 'Duration';
        headRow.appendChild(thDur);

        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        // Per-frame rows
        for (let i = 0; i < frameCount; i++) {
            const tr = document.createElement('tr');

            const tdFrame = document.createElement('td');
            tdFrame.innerText = `F${i + 1}`;
            tr.appendChild(tdFrame);

            const breaksCell = rows[0].cells[i] || { text: '', classes: [] };
            const tdBreaks = document.createElement('td');
            tdBreaks.innerText = breaksCell.text;
            breaksCell.classes.forEach(cl => tdBreaks.classList.add(cl));
            tr.appendChild(tdBreaks);

            const hCell = rows[1].cells[i] || { text: '', classes: [] };
            const tdH = document.createElement('td');
            tdH.innerText = hCell.text;
            hCell.classes.forEach(cl => tdH.classList.add(cl));
            tr.appendChild(tdH);

            const aCell = rows[2].cells[i] || { text: '', classes: [] };
            const tdA = document.createElement('td');
            tdA.innerText = aCell.text;
            aCell.classes.forEach(cl => tdA.classList.add(cl));
            tr.appendChild(tdA);

            const durCell = rows[3].cells[i] || { text: '', classes: [] };
            const tdDurCell = document.createElement('td');
            tdDurCell.innerText = durCell.text;
            tr.appendChild(tdDurCell);

            tbody.appendChild(tr);
        }

        // Final totals row (uses the final column cells produced earlier)
        const finalRow = document.createElement('tr');
        const finalLabelTd = document.createElement('td');
        finalLabelTd.innerText = 'Total';
        finalRow.appendChild(finalLabelTd);

        const finalBreaks = rows[0].cells[frameCount] || { text: '', classes: [] };
        const tdFinalBreaks = document.createElement('td');
        tdFinalBreaks.innerText = finalBreaks.text;
        finalBreaks.classes.forEach(cl => tdFinalBreaks.classList.add(cl));
        finalRow.appendChild(tdFinalBreaks);

        const finalH = rows[1].cells[frameCount] || { text: '', classes: [] };
        const tdFinalH = document.createElement('td');
        tdFinalH.innerText = finalH.text;
        finalH.classes.forEach(cl => tdFinalH.classList.add(cl));
        finalRow.appendChild(tdFinalH);

        const finalA = rows[2].cells[frameCount] || { text: '', classes: [] };
        const tdFinalA = document.createElement('td');
        tdFinalA.innerText = finalA.text;
        finalA.classes.forEach(cl => tdFinalA.classList.add(cl));
        finalRow.appendChild(tdFinalA);

        const finalDur = rows[3].cells[frameCount] || { text: '', classes: [] };
        const tdFinalDur = document.createElement('td');
        tdFinalDur.innerText = finalDur.text;
        finalRow.appendChild(tdFinalDur);

        tbody.appendChild(finalRow);
        table.appendChild(tbody);
    }
}