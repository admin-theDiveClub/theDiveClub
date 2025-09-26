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

var _match = null;

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
        _match = match;
        await PopulateUI(match);
        DrawTimeLine(match);

        UpdateScorecard(match);

        document.getElementById('component-loading-overlay').style.display = 'none';
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

function UpdateScorecard (match)
{
    const mode = window.innerWidth < 768 ? 'vertical' : 'horizontal';
    PopulateScorecard(match, mode, player_H, player_A);
}

function PopulateScorecard (match, mode, playerH, playerA)
{

    const e_cell_header = (text, color) =>
    {
        const e_td = document.createElement('td');
        e_td.className = 'scorecard-header';
        e_td.innerText = text;
        if (color)
        {
            e_td.style.color = color;
        }
        return e_td;
    }

    const e_cell_frame = (index) =>
    {
        const e_td = document.createElement('td');
        e_td.className = 'scorecard-frame';
        e_td.innerText = "F" + (index + 1);
        return e_td;
    }

    const e_cell_score = (value) =>
    {
        const e_td = document.createElement('td');
        const e_select = document.createElement('select');
        e_select.className = 'form-select';
        e_select.setAttribute('aria-label', 'Frame Score Selection');
        const options = ['0', '1', 'B/F', 'R/F', 'GB'];
        for (const opt of options)
        {
            const e_opt = document.createElement('option');
            e_opt.value = opt;
            e_opt.innerText = opt;
            if (opt == value)
            {
                e_opt.selected = true;
            } else 
            {
                if (value == "A" && e_opt.value == "B/F")
                {
                    e_opt.selected = true;
                } else if (value == "C" && e_opt.value == "R/F")
                {
                    e_opt.selected = true;
                }
            }

            if (value != 0)
            {
                e_select.classList.add('score-win');
            } else 
            {
                e_select.classList.add('score-loss');
            }
            e_select.appendChild(e_opt);
        }
        e_td.appendChild(e_select);
        return e_td;
    };

    const e_cell_break = (value) =>
    {
        const e_td = document.createElement('td');
        const e_select = document.createElement('select');
        e_select.className = 'form-select';
        e_select.setAttribute('aria-label', 'Frame Break Selection');
        const options = ['', 'dry', 'in', 'scratch', 'foul'];
        for (const opt of options)
        {
            const e_opt = document.createElement('option');
            e_opt.value = opt;
            e_opt.innerText = opt;
            if (opt == value)
            {
                e_opt.selected = true;
            } else 
            {
                if (value == "scr" && e_opt.value == "scratch")
                {
                    e_opt.selected = true;
                }
            }
            e_select.appendChild(e_opt);
        }
        e_td.appendChild(e_select);
        return e_td;
    };

    const e_cell_duration = (value) =>
    {
        const e_td = document.createElement('td');
        e_td.className = 'scorecard-duration';
        if (value == null || isNaN(value)) {
            e_td.innerText = '?';
        } else {
            const totalSeconds = Math.floor(Number(value));
            const hours = Math.floor(totalSeconds / 3600);
            const remainder = totalSeconds % 3600;
            const mins = Math.floor(remainder / 60);
            const secs = remainder % 60;
            if (hours > 0) {
                e_td.innerHTML = `${hours}<sub>h</sub> ${mins}<sub>m</sub> ${secs}<sub>s</sub>`;
            } else {
                e_td.innerHTML = `${mins}"${secs}'`;
            }
        }
        return e_td;
    };    
    
    var e_scorecardContainer = null;
    if (mode == 'vertical')
    {
        e_scorecardContainer = document.getElementById('scorecard-vertical');
        e_scorecardContainer.style.display = 'block';
        document.getElementById('scorecard-horizontal').style.display = 'none';
    } else if (mode == 'horizontal')
    {
        e_scorecardContainer = document.getElementById('scorecard-horizontal');
        e_scorecardContainer.style.display = 'block';
        document.getElementById('scorecard-vertical').style.display = 'none';
    }

    const headerCells = 
    [
        e_cell_header('Break', null),
        e_cell_header(playerH.name ? playerH.name : playerH.username, 'var(--color-primary-00)'),
        e_cell_header(playerA.name ? playerA.name : playerA.username, 'var(--color-secondary-00)'),
        e_cell_header('Duration', null)
    ];

    const e_table = e_scorecardContainer.querySelector('table');
    e_table.innerHTML = '';

    const history = match.history ? match.history : [];
    const cell_0 = e_cell_header('Frames', null);
    const frameIndexCells = history.map((f, i) => e_cell_frame(i));

    const totals =
    {
        fw_h: 0,
        fw_a: 0,
        duration: 0
    }

    for (let i = 0; i < history.length; i++)
    {
        const frame = history[i];
        if (frame['winner-player'] == 'h')
        {
            totals.fw_h ++;
        } else if (frame['winner-player'] == 'a')
        {
            totals.fw_a ++;
        }
        if (frame.duration)
        {
            totals.duration += frame.duration;
        }
    }

    if (mode == 'vertical')
    {
        const e_headerRow = document.createElement('tr');
        e_headerRow.appendChild(cell_0);
        for (const cell of headerCells)
        {
            e_headerRow.appendChild(cell);
        }
        e_table.appendChild(e_headerRow);

        for (let i = 0; i < history.length; i++)
        {
            const frame = history[i];
            const e_frameRow = document.createElement('tr');
            e_frameRow.appendChild(e_cell_frame(i));            

            const breakEvent = frame['break-event'] ? frame['break-event'] : null;
            const e_break = e_cell_break(breakEvent);
            e_frameRow.appendChild(e_break);

            var score_H = 0;
            var score_A = 0;
            if (frame['winner-player'] == 'h')
            {
                score_H = frame['winner-result'];
                score_A = 0;
            } else if (frame['winner-player'] == 'a')
            {
                score_A = frame['winner-result'];
                score_H = 0;
            }
            const e_score_H = e_cell_score(score_H);
            const e_score_A = e_cell_score(score_A);
            e_frameRow.appendChild(e_score_H);
            e_frameRow.appendChild(e_score_A);

            const duration = frame.duration ? frame.duration : null;
            const e_duration = e_cell_duration(duration);
            e_frameRow.appendChild(e_duration);

            e_table.appendChild(e_frameRow);
        }        

        const e_totalsRow = document.createElement('tr');
        const e_totalsCell = e_cell_header('Totals', null);    
        e_totalsRow.appendChild(e_totalsCell);    
        const e_totalsB = e_cell_header('', null);
        e_totalsRow.appendChild(e_totalsB);
        const e_totalsH = e_cell_header(totals.fw_h, 'var(--color-primary-00)');
        e_totalsRow.appendChild(e_totalsH);
        const e_totalsA = e_cell_header(totals.fw_a, 'var(--color-secondary-00)');
        e_totalsRow.appendChild(e_totalsA);
        const e_totalsD = e_cell_duration(totals.duration);
        e_totalsRow.appendChild(e_totalsD);
        e_table.appendChild(e_totalsRow);
    } else if (mode == 'horizontal')
    {
        const e_headerRow = document.createElement('tr');
        e_headerRow.appendChild(cell_0);
        for (const cell of frameIndexCells)
        {
            e_headerRow.appendChild(cell);
        }
        e_table.appendChild(e_headerRow);

        const e_playerHRow = document.createElement('tr');
        const e_playerHCell = e_cell_header(playerH.name ? playerH.name : playerH.username, 'var(--color-primary-00)');
        e_playerHRow.appendChild(e_playerHCell);

        const e_playerARow = document.createElement('tr');
        const e_playerACell = e_cell_header(playerA.name ? playerA.name : playerA.username, 'var(--color-secondary-00)');
        e_playerARow.appendChild(e_playerACell);

        const e_breakRow = document.createElement('tr');
        const e_breakCell = e_cell_header('Break', null);
        e_breakRow.appendChild(e_breakCell);

        const e_durationRow = document.createElement('tr');
        const e_durationCell = e_cell_header('Duration', null);
        e_durationRow.appendChild(e_durationCell);
        
        e_table.appendChild(e_breakRow);
        e_table.appendChild(e_playerHRow);
        e_table.appendChild(e_playerARow);
        e_table.appendChild(e_durationRow);

        for (let i = 0; i < history.length; i++)
        {
            const frame = history[i];

            var score_H = 0;
            var score_A = 0;
            if (frame['winner-player'] == 'h')
            {
                score_H = frame['winner-result'];
                score_A = 0;
            } else if (frame['winner-player'] == 'a')
            {
                score_A = frame['winner-result'];
                score_H = 0;
            }
            const e_score_H = e_cell_score(score_H);
            e_playerHRow.appendChild(e_score_H);

            const e_score_A = e_cell_score(score_A);
            e_playerARow.appendChild(e_score_A);

            const breakEvent = frame['break-event'] ? frame['break-event'] : null;
            const e_break = e_cell_break(breakEvent);
            e_breakRow.appendChild(e_break);

            const duration = frame.duration ? frame.duration : null;
            const e_duration = e_cell_duration(duration);
            e_durationRow.appendChild(e_duration);
        }

        const e_totalsH = e_cell_header("Totals", null);
        e_headerRow.appendChild(e_totalsH);
        const e_totalsB = e_cell_header('', null);
        e_breakRow.appendChild(e_totalsB);
        const e_totalsScoreH = e_cell_header(totals.fw_h, 'var(--color-primary-00)');
        e_playerHRow.appendChild(e_totalsScoreH);
        const e_totalsScoreA = e_cell_header(totals.fw_a, 'var(--color-secondary-00)');
        e_playerARow.appendChild(e_totalsScoreA);
        const e_totalsD = e_cell_duration(totals.duration);
        e_durationRow.appendChild(e_totalsD);
    }
}

import { DrawMatchTimeLine } from '../charts/chart_line.js';

function DrawTimeLine (match)
{
    if (!match || !match.history || match.history.length == 0)
    {
        return null;
    }

    const orientation = window.innerWidth < 768 ? 'vertical' : 'horizontal';


    const mode = document.querySelector('input[name="chartMode"]:checked')?.value || 'default';
    DrawMatchTimeLine(match.history, player_H, player_A, mode, orientation);
}

document.querySelectorAll('input[name="chartMode"]').forEach((elem) => {
    elem.addEventListener("change", function() 
    {
        DrawTimeLine(_match);
    });
});

window.addEventListener('resize', () =>
{
    if (_match)
    {
        DrawTimeLine(_match);
        UpdateScorecard(_match);
    }
});