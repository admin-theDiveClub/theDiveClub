//Player Scores Input Cards
const e_card_H = document.getElementById('ctrl-score-H');
const e_player_pp_H = document.getElementById('player-pp-H');
const e_player_dn_H = document.getElementById('player-dn-H');
const e_ctrl_score_H_score = document.getElementById('ctrl-score-H-score');
const e_ctrl_score_H_score_bf = document.getElementById('ctrl-score-H-special-bf');
const e_ctrl_score_H_score_rf = document.getElementById('ctrl-score-H-special-rf');
const e_ctrl_score_H_score_gb = document.getElementById('ctrl-score-H-special-gb');
const e_ctrl_score_H_point = document.getElementById('ctrl-score-H-point');
const e_ctrl_score_H_break_input = document.getElementById('ctrl-score-H-break-input');
const e_ctrl_score_H_break_dry = document.getElementById('ctrl-score-H-break-dry');
const e_ctrl_score_H_break_in = document.getElementById('ctrl-score-H-break-in');
const e_ctrl_score_H_break_scr = document.getElementById('ctrl-score-H-break-scr');
const e_ctrl_score_H_break_foul = document.getElementById('ctrl-score-H-break-foul');
const e_ctrl_H = 
{
    e_card: e_card_H, 
    e_player_pp: e_player_pp_H,
    e_player_dn: e_player_dn_H,
    e_ctrl_score: e_ctrl_score_H_score,
    e_ctrl_score_bf: e_ctrl_score_H_score_bf,
    e_ctrl_score_rf: e_ctrl_score_H_score_rf,
    e_ctrl_score_gb: e_ctrl_score_H_score_gb,
    e_ctrl_score_point: e_ctrl_score_H_point,
    e_ctrl_score_break_input: e_ctrl_score_H_break_input,
    e_ctrl_score_break_dry: e_ctrl_score_H_break_dry,
    e_ctrl_score_break_in: e_ctrl_score_H_break_in,
    e_ctrl_score_break_scr: e_ctrl_score_H_break_scr,
    e_ctrl_score_break_foul: e_ctrl_score_H_break_foul
};

const e_card_A = document.getElementById('ctrl-score-A');
const e_player_pp_A = document.getElementById('player-pp-A');
const e_player_dn_A = document.getElementById('player-dn-A');
const e_ctrl_score_A_score = document.getElementById('ctrl-score-A-score');
const e_ctrl_score_A_score_bf = document.getElementById('ctrl-score-A-special-bf');
const e_ctrl_score_A_score_rf = document.getElementById('ctrl-score-A-special-rf');
const e_ctrl_score_A_score_gb = document.getElementById('ctrl-score-A-special-gb');
const e_ctrl_score_A_point = document.getElementById('ctrl-score-A-point');
const e_ctrl_score_A_break_input = document.getElementById('ctrl-score-A-break-input');
const e_ctrl_score_A_break_dry = document.getElementById('ctrl-score-A-break-dry');
const e_ctrl_score_A_break_in = document.getElementById('ctrl-score-A-break-in');
const e_ctrl_score_A_break_scr = document.getElementById('ctrl-score-A-break-scr');
const e_ctrl_score_A_break_foul = document.getElementById('ctrl-score-A-break-foul');
const e_ctrl_A = 
{
    e_card: e_card_A,
    e_player_pp: e_player_pp_A,
    e_player_dn: e_player_dn_A,
    e_ctrl_score: e_ctrl_score_A_score,
    e_ctrl_score_bf: e_ctrl_score_A_score_bf,
    e_ctrl_score_rf: e_ctrl_score_A_score_rf,
    e_ctrl_score_gb: e_ctrl_score_A_score_gb,
    e_ctrl_score_point: e_ctrl_score_A_point,
    e_ctrl_score_break_input: e_ctrl_score_A_break_input,
    e_ctrl_score_break_dry: e_ctrl_score_A_break_dry,
    e_ctrl_score_break_in: e_ctrl_score_A_break_in,
    e_ctrl_score_break_scr: e_ctrl_score_A_break_scr,
    e_ctrl_score_break_foul: e_ctrl_score_A_break_foul
};

var player_H = null;
var player_A = null;

//Initialize

export async function Initialize_MatchUI(match)
{    
    console.log("Initializing UI");

    //Populate Player Profiles
    player_H = await PlayerProfile(match.players.h);
    await PopulateControlCardPlayerInfo(e_ctrl_H, player_H, match.results.h);

    player_A = await PlayerProfile(match.players.a);
    await PopulateControlCardPlayerInfo(e_ctrl_A, player_A, match.results.a);
}

async function PopulateControlCardPlayerInfo (e, player)
{
    e.e_player_dn.innerText = player.displayName;
    e.e_player_pp.src = '../resources/icons/icon_player.svg';

    if (player.id) 
    {
        const r = await supabase.storage.from('bucket-profile-pics').getPublicUrl(player.id);
        if (r && r.data && r.data.publicUrl && !r.data.publicUrl.endsWith('null')) 
        {
            const imgEl = e.e_player_pp;
            if (imgEl) 
            {
                const img = new Image();
                img.onload = () => { imgEl.src = r.data.publicUrl; };
                img.src = r.data.publicUrl;
            }
        }
    }
}

async function PlayerProfile (player)
{
    if (!player || !player.username)
    {
        return {username: 'X', displayName: 'X'};
    }

    var playerProfile = null;
    if (player.id)
    {
        playerProfile = await supabase.from('tbl_players').select('*').eq('id', player.id).single();
    } else if (player.username)
    {
        playerProfile = await supabase.from('tbl_players').select('*').eq('username', player.username).single();
    }

    if (!playerProfile || playerProfile.error)
    {
        //console.log("Error Getting Player Profile:", playerProfile.error.message);
        return {username: player.username, displayName: player.username};
    } else 
    {
        const p = playerProfile.data;
        var displayName = null;
        if (p.nickname)
        {
            displayName = p.nickname;
        } else if (p.name)
        {
            displayName = p.name;
        } else 
        {
            displayName = p.username;
        }

        const playerData =
        {
            id: p.id,
            username: p.username,
            displayName: displayName,
            name: p.name,
            surname: p.surname ? p.surname : null,
        }

        return playerData;
    }   
}

//Update
export async function UpdateMatchUI (match)
{
    //console.log("UI match updated: ", match);
    if (match)
    {
        await PopulateUI(match);
        PrepTimeLineData(match);
    } else 
    {        
        console.log("No match data to populate UI");
    }
}

async function PopulateUI (match)
{
    console.log("Populating UI");

    //Players
    if (match.players.h.username != player_H.username)
    {
        player_H = await PlayerProfile(match.players.h);
        await PopulateControlCardPlayerInfo(e_ctrl_H, player_H);
    }

    if (match.players.a.username != player_A.username)
    {
        player_A = await PlayerProfile(match.players.a);
        await PopulateControlCardPlayerInfo(e_ctrl_A, player_A);
    }

    //Control Cards
    const r = match.results;
    PopulateControlCardResults(e_ctrl_H, r && r.h ? r.h : null);
    PopulateControlCardResults(e_ctrl_A, r && r.a ? r.a : null);

        //Break Indicators
    const breakSide = GetBreakSide(match);
    const advancedBreaking = match.settings && match.settings.advancedBreaks;
    UpdateBreakIndicators(e_ctrl_H, breakSide == 'h', advancedBreaking);
    UpdateBreakIndicators(e_ctrl_A, breakSide == 'a', advancedBreaking);
}

function PopulateControlCardResults (e, results)
{
    if (!results)
    {
        e.e_ctrl_score.innerText = '0';
    } else 
    {
        e.e_ctrl_score.innerText = results.fw ? results.fw : '0';
        var specialsTotal = 0;
        if (results.bf)
        {
            specialsTotal += results.bf;
        }
        if (results.gb)
        {
            specialsTotal += results.gb;
        }
        if (specialsTotal > 0)
        {
            e.e_ctrl_score.innerHTML = `${e.e_ctrl_score.innerText}<sup>(${specialsTotal})</sup>`;
        }
    }
}

function GetBreakSide (match)
{
    if (!match || !match.settings || !match.settings.lagWinner || !match.settings.lagType)
    {
        return null;
    }

    const lagType = match.settings.lagType;

    if (lagType == 'alternate')
    {
        const results = match.results;
        if (!results || !results.h || !results.a)
        {
            return null;
        }

        const totalFrames = results.h.fw + results.a.fw;
        if (totalFrames % 2 == 0)
        {
            return match.settings.lagWinner;
        } else 
        {
            return match.settings.lagWinner == 'h' ? 'a' : 'h';
        }
    } else if (lagType == 'winner')
    {
        const history = match.history;
        if (!history || history.length == 0)
        {
            return match.settings.lagWinner;
        }

        const lastFrame = history[history.length - 1];
        const winner = lastFrame.winner;
        if (!winner)
        {
            return match.settings.lagWinner;
        } else 
        {
            return winner;
        }
    }
}

function UpdateBreakIndicators(e_ctrl, breaking, advancedBreaking)
{
    if (breaking)
    {
        e_ctrl.e_ctrl_score_break_input.style.display = 'flex';
        if (advancedBreaking)
        {
            e_ctrl.e_ctrl_score_break_dry.style.display = 'block';
            e_ctrl.e_ctrl_score_break_in.style.display = 'block';
            e_ctrl.e_ctrl_score_break_scr.style.display = 'block';
            e_ctrl.e_ctrl_score_break_foul.style.display = 'block';
        } else 
        {
            e_ctrl.e_ctrl_score_break_dry.style.display = 'none';
            e_ctrl.e_ctrl_score_break_in.style.display = 'none';
            e_ctrl.e_ctrl_score_break_scr.style.display = 'none';
            e_ctrl.e_ctrl_score_break_foul.style.display = 'none';
        }
    } else
    {
        e_ctrl.e_ctrl_score_break_input.style.display = 'none';
    }
}

function PrepTimeLineData (match)
{
    if (!match || !match.history || match.history.length == 0)
    {
        return null;
    }

    var historyMeta = 
    {
        totalFrames: match.history.length,
        totalPoints: {h: 0, a: 0},
        totalDuration: 0,
    }

    for (var i = 0; i < match.history.length; i++)
    {
        const frame = match.history[i];
        if (frame.duration && frame.duration > 0)
        {
            historyMeta.totalDuration += frame.duration;
        }
        if (frame['winner-player'] == 'h')
        {
            historyMeta.totalPoints.h ++;
        } else if (frame['winner-player'] == 'a')
        {
            historyMeta.totalPoints.a ++;
        }
    }

    console.log(match.history, player_H, player_A, historyMeta);

    DrawMatchTimeLine(match.history, player_H, player_A, historyMeta);
}

function DrawMatchTimeLine (history, player_H, player_A, historyMeta) 
{
    const timelineContainerH = document.getElementById('timeline_h');
    if (!timelineContainerH || !history || history.length === 0) return;

    // build series
    const times = [0];
    const scoreH = [0];
    const scoreA = [0];
    const frameWinsH = [0];
    const frameWinsA = [0];
    const breaksH = [];
    const breaksA = [];
    let t = 0, h = 0, a = 0;
    for (const f of history) {
        t += f.duration || 0;
        const winner = f['winner-player'];
        if (winner === 'h') h++; else if (winner === 'a') a++;
        if (winner === 'h') frameWinsH.push(1); else frameWinsH.push(0);
        if (winner === 'a') frameWinsA.push(1); else frameWinsA.push(0);
        times.push(t);
        scoreH.push(h);
        // keep A negative like original to visually separate on same chart
        scoreA.push(a);
        breaksH.push(f['break-player'] === 'h' ? 1 : 0);
        breaksA.push(f['break-player'] === 'a' ? 1 : 0);
    }

    // ensure a canvas element exists inside container and return it
    function ensureCanvas(container, id) {
        let canvas = container.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            if (id) canvas.id = id;
            container.style.position = 'relative';
            container.appendChild(canvas);
        }
        return canvas;
    }

    // destroy previous chart if present helper
    function destroyChartIfAny(canvas) {
        if (canvas && canvas._chart) {
            try { canvas._chart.destroy(); } catch (e) { /* ignore */ }
            canvas._chart = null;
        }
    }

    // build point color arrays from breaks array
    function pointColorsFromHistory(breaksArray, pointsArray, color) {
        if (!Array.isArray(breaksArray)) return color;
        const bg = pointsArray.map(b => b ? color : 'black');
        const border = breaksArray.map(b => b ? color : 'white');
        return { background: bg, border: border };
    }

    // prepare points as {x,y} so linear x axis positions correctly
    const pointsH = times.map((time, i) => ({ x: time, y: scoreH[i] }));
    const pointsA = times.map((time, i) => ({ x: time, y: scoreA[i] }));

    // canvas (single chart in timeline_h)
    const canvas = ensureCanvas(timelineContainerH, 'chart-timeline');
    destroyChartIfAny(canvas);

    // colors
    const colorH = 'rgba(229,21,119,0.6)';
    const colorA = 'rgba(2,200,237,0.6)';

    const pColH = pointColorsFromHistory(breaksH, frameWinsH, colorH);
    const pColA = pointColorsFromHistory(breaksA, frameWinsA, colorA);

    const ctx = canvas.getContext('2d');
    canvas._chart = new Chart(ctx, {
        type: 'line',
        data: {
            // note: when using objects {x,y} the labels array is unnecessary for linear x
            datasets: [
                {
                    label: (player_H && player_H.displayName) || 'H',
                    data: pointsH,
                    borderColor: colorH,
                    backgroundColor: colorH,
                    fill: scoreH[scoreH.length - 1] < scoreA[scoreA.length - 1], // fill if H is winning
                    tension: 0.2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: pColH.background,
                    pointBorderColor: pColH.border,
                    pointBorderWidth: 1,
                    zIndex: scoreH[scoreH.length - 1] < scoreA[scoreA.length - 1] ? 1 : 2 // keep on top if winning
                },
                {
                    label: (player_A && player_A.displayName) || 'A',
                    data: pointsA,
                    borderColor: colorA,
                    backgroundColor: colorA,
                    fill: scoreA[scoreA.length - 1] < scoreH[scoreH.length - 1], // fill if A is winning
                    tension: 0.2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: pColA.background,
                    pointBorderColor: pColA.border,
                    pointBorderWidth: 1,
                    zIndex: scoreH[scoreH.length - 1] > scoreA[scoreA.length - 1] ? 1 : 2 // keep on top if winning
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { left: 0, right: 0, top: 0, bottom: 0 } },
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: false, text: 'Time (min)' },
                    beginAtZero: true,
                    ticks: { display: false, padding: 6 },
                    grid: { drawBorder: false, offset: true }
                },
                y: {
                    title: { display: false, text: 'Running Score' },
                    beginAtZero: true,
                    precision: 0,
                    ticks: { display: false, padding: 6 },
                    grid: { drawBorder: false }
                }
            },
            elements: {
                point: {
                    radius: 6,
                    hoverRadius: 8,
                    borderColor: '#ffffff',
                    borderWidth: 1
                }
            }
        }
    });

    return canvas._chart;
}
