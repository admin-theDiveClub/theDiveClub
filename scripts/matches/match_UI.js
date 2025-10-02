//Player Scores Input Cards
const e_ctrl_H = 
{
    e_card: gid('ctrl-score-H'), 
    e_player_pp: gid('player-pp-H'),
    e_player_dn: gid('player-dn-H'),
    e_ctrl_score: gid('ctrl-score-H-score'),
    e_ctrl_score_bf: gid('ctrl-score-H-special-bf'),
    e_ctrl_score_rf: gid('ctrl-score-H-special-rf'),
    e_ctrl_score_gb: gid('ctrl-score-H-special-gb'),
    e_ctrl_score_point: gid('ctrl-score-H-point'),
    e_ctrl_score_break_input: gid('ctrl-score-H-break-input'),
    e_ctrl_score_break_dry: gid('ctrl-score-H-break-dry'),
    e_ctrl_score_break_in: gid('ctrl-score-H-break-in'),
    e_ctrl_score_break_scr: gid('ctrl-score-H-break-scr'),
    e_ctrl_score_break_foul: gid('ctrl-score-H-break-foul')
};
const e_ctrl_A = 
{
    e_card: gid('ctrl-score-A'),
    e_player_pp: gid('player-pp-A'),
    e_player_dn: gid('player-dn-A'),
    e_ctrl_score: gid('ctrl-score-A-score'),
    e_ctrl_score_bf: gid('ctrl-score-A-special-bf'),
    e_ctrl_score_rf: gid('ctrl-score-A-special-rf'),
    e_ctrl_score_gb: gid('ctrl-score-A-special-gb'),
    e_ctrl_score_point: gid('ctrl-score-A-point'),
    e_ctrl_score_break_input: gid('ctrl-score-A-break-input'),
    e_ctrl_score_break_dry: gid('ctrl-score-A-break-dry'),
    e_ctrl_score_break_in: gid('ctrl-score-A-break-in'),
    e_ctrl_score_break_scr: gid('ctrl-score-A-break-scr'),
    e_ctrl_score_break_foul: gid('ctrl-score-A-break-foul')
};

function gid (id)
{
    return document.getElementById(id);
}

var player_H = null;
var player_A = null;

var _match = null;

//Initialize

export async function Initialize_MatchUI(match)
{    
    //console.log("Initializing UI");

    //Populate Player Profiles
    player_H = await PlayerProfile(match.players.h);
    if (!match.results){ match.results = {"h": {}, "a": {}}; }
    await PopulateControlCardPlayerInfo(e_ctrl_H, player_H, match.results.h);

    player_A = await PlayerProfile(match.players.a);
    await PopulateControlCardPlayerInfo(e_ctrl_A, player_A, match.results.a);
}

async function PopulateControlCardPlayerInfo (e, player)
{
    e.e_player_dn.innerText = player.displayName;
    e.e_player_pp.src = '../resources/icons/icon_player.svg';

    if (player.pp) 
    {
        e.e_player_pp.src = player.pp;
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
    } else if (player.username && player.username.includes('@'))
    {
        playerProfile = await supabase.from('tbl_players').select('*').eq('username', player.username).single();
    }

    if (!playerProfile || playerProfile.error)
    {
        //console.log("Error Getting Player Profile:", playerProfile.error.message);
        return {username: player.username, displayName: player.username, name: player.username};
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
            pp: p.pp ? p.pp : null,
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
        PopulateMatchSummary(match, player_H, player_A);
        UpdateMatchSettingsUI(match);

        document.getElementById('component-loading-overlay').style.display = 'none';
    } else 
    {        
        console.log("No match data to populate UI");
    }
}

async function PopulateUI (match)
{
    //console.log("Populating UI");

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
    const advancedBreaking = match.settings && (match.settings.advancedBreaks);
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
        } else if (history[0]['winner-player'] == null)
        {
            return match.settings.lagWinner;
        }

        const lastFrame = history[history.length - 2];
        const winner = lastFrame ? lastFrame['winner-player'] : match.settings.lagWinner;
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
    const mode = window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal';
    PopulateScorecard(match, mode, player_H, player_A);
}

import { UpdateFrame } from './match_Controls.js';
import { _liveFrameIndex } from './match_Controls.js';

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

        if (index == _liveFrameIndex() - 1)
        {
            const e_button_deleteFrame = document.createElement('button');
            e_button_deleteFrame.innerHTML = '<i class="bi bi-x"></i>';
            e_button_deleteFrame.className = 'btn-delete-frame';
            e_button_deleteFrame.addEventListener('click', () =>
            {
                // Handle delete frame action
                UpdateFrame(index, null);
            });
            e_td.appendChild(e_button_deleteFrame);
        } else if (index == _liveFrameIndex())
        {
            e_td.classList.add('scorecard-frame-live');
        }

        return e_td;
    }

    const e_cell_score = (value, frameIndex) =>
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
                } else if (value == "G" && e_opt.value == "GB")
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

        e_select.addEventListener('change', async () =>
        {
            var newValue = e_select.value;
            switch (newValue)
            {
                case '0':
                    newValue = 0;
                    break;
                case '1':
                    newValue = 1;
                    break;
                case 'B/F':
                    newValue = "A";
                    break;
                case 'R/F':
                    newValue = "C";
                    break;
                case 'GB':
                    newValue = "G";
                    break;
            }

            var frameData = match.history[frameIndex];
            frameData['winner-result'] = newValue;

            if (newValue == 0)
            {
                frameData['winner-player'] = frameData['winner-player'] == 'h' ? 'a' : 'h';
                frameData['winner-result'] = 1;
            }

            if (value == 0 && newValue != 0)
            {
                frameData['winner-player'] = frameData['winner-player'] == 'h' ? 'a' : 'h';
            }

            UpdateFrame(frameIndex, frameData);
        });

        e_td.appendChild(e_select);
        return e_td;
    };

    const e_cell_break = (value, frameIndex, breakPlayer) =>
    {
        const e_td = document.createElement('td');
        const e_select = document.createElement('select');
        e_select.className = 'form-select';
        e_select.setAttribute('aria-label', 'Frame Break Selection');

        if (breakPlayer == 'h')
        {
            e_select.classList.add('color-h');
        } else if (breakPlayer == 'a')
        {
            e_select.classList.add('color-a');
        }

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

        e_select.addEventListener('change', async () =>
        {
            var newValue = e_select.value;
            if (newValue == '')
            {
                newValue = null;
            } else if (newValue == 'scratch')
            {
                newValue = 'scr';
            }
            var frameData = match.history[frameIndex];
            frameData['break-event'] = newValue;
            UpdateFrame(frameIndex, frameData);
        });

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

    var name_h = playerH.name ? playerH.name : playerH.username;
    var name_a = playerA.name ? playerA.name : playerA.username;

    if (match.settings && match.settings.lagWinner)
    {
        if (match.settings.lagWinner == 'h')
        {
            name_h = name_h + " *";
        } else if (match.settings.lagWinner == 'a')
        {
            name_a = name_a + " *";
        }
    }

    const headerCells = 
    [
        e_cell_header('Break', null),
        e_cell_header(name_h, 'var(--color-primary-00)'),
        e_cell_header(name_a, 'var(--color-secondary-00)'),
        e_cell_header('Duration', null)
    ];


    headerCells[1].classList.add('scorecard-player-name');
    headerCells[2].classList.add('scorecard-player-name');

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
            const e_break = e_cell_break(breakEvent, i, frame['break-player'] ? frame['break-player'] : match.settings.lagWinner ? match.settings.lagWinner : null);
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
            const e_score_H = e_cell_score(score_H, i);
            const e_score_A = e_cell_score(score_A, i);
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
        e_totalsH.classList.add('scorecard-totals');
        e_totalsRow.appendChild(e_totalsH);
        const e_totalsA = e_cell_header(totals.fw_a, 'var(--color-secondary-00)');
        e_totalsA.classList.add('scorecard-totals');
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
        e_playerHCell.classList.add('scorecard-player-name');
        e_playerHRow.appendChild(e_playerHCell);

        const e_playerARow = document.createElement('tr');
        const e_playerACell = e_cell_header(playerA.name ? playerA.name : playerA.username, 'var(--color-secondary-00)');
        e_playerACell.classList.add('scorecard-player-name');
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

            const breakEvent = frame['break-event'] ? frame['break-event'] : null;
            const e_break = e_cell_break(breakEvent, i, frame['break-player'] ? frame['break-player'] : match.settings.lagWinner ? match.settings.lagWinner : null);
            e_breakRow.appendChild(e_break);

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
            const e_score_H = e_cell_score(score_H, i);
            e_playerHRow.appendChild(e_score_H);

            const e_score_A = e_cell_score(score_A, i);
            e_playerARow.appendChild(e_score_A);

            const duration = frame.duration ? frame.duration : null;
            const e_duration = e_cell_duration(duration);
            e_durationRow.appendChild(e_duration);
        }

        const e_totalsH = e_cell_header("Totals", null);
        e_headerRow.appendChild(e_totalsH);
        const e_totalsB = e_cell_header('', null);
        e_breakRow.appendChild(e_totalsB);
        const e_totalsScoreH = e_cell_header(totals.fw_h, 'var(--color-primary-00)');
        e_totalsScoreH.classList.add('scorecard-totals');
        e_playerHRow.appendChild(e_totalsScoreH);
        const e_totalsScoreA = e_cell_header(totals.fw_a, 'var(--color-secondary-00)');
        e_totalsScoreA.classList.add('scorecard-totals');
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

    const orientation = window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal';


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

function PopulateMatchSummary(match, playerH, playerA)
{
    var matchSummary =
    {
        playerH: playerH.name ? playerH.name : playerH.displayName,
        playerA: playerA.name ? playerA.name : playerA.displayName,
        scoreH: match.results && match.results.h ? match.results.h.fw : 0,
        scoreA: match.results && match.results.a ? match.results.a.fw : 0,
        bfH: match.results && match.results.h ? match.results.h.bf : 0,
        bfA: match.results && match.results.a ? match.results.a.bf : 0,
        gbH: match.results && match.results.h ? match.results.h.gb : 0,
        gbA: match.results && match.results.a ? match.results.a.gb : 0,
        rfH: match.results && match.results.h ? match.results.h.rf : 0,
        rfA: match.results && match.results.a ? match.results.a.rf : 0,
        startTime: match.time && match.time.start ? new Date(match.time.start) : null,
        endTime: match.time && match.time.end ? new Date(match.time.end) : null,
        matchDuration: null,
        averageFrameDuration: null,
    }

    if (match.settings && match.settings.lagWinner)
    {
        if (match.settings.lagWinner == 'h')
        {
            matchSummary.playerH = matchSummary.playerH + " *";
        } else if (match.settings.lagWinner == 'a')
        {
            matchSummary.playerA = matchSummary.playerA + " *";
        }
    }

    const history = match.history ? match.history : null;
    if (history)
    {
        let totalDuration = 0;
        let averageFrameDuration = 0;

        for (let i = 0; i < history.length; i++)
        {
            const frame = history[i];
            if (frame.duration)
            {
                totalDuration += frame.duration;
            }
        }

        matchSummary.matchDuration = totalDuration;
        matchSummary.averageFrameDuration =  totalDuration / history.length;
    }

    // compute break stats per side
    const breaks = { h: { dry: 0, in: 0, scr: 0, foul: 0, total: 0 }, a: { dry: 0, in: 0, scr: 0, foul: 0, total: 0 } };
    const settings = match.settings || {};
    const lagWinner = settings.lagWinner;
    const lagType = settings.lagType;

    if (lagWinner && lagType)
    {
        let breaker = lagWinner;
        for (let i = 0; i < history.length; i++) {
            if (lagType === 'alternate') {
                breaker = (i % 2 === 0) ? lagWinner : (lagWinner === 'h' ? 'a' : 'h');
            } else if (lagType === 'winner') {
                breaker = (i === 0) ? lagWinner : (history[i - 1]['winner-player'] || history[i - 1].winner || breaker);
            }
            const evRaw = history[i]['break-event'];
            const ev = evRaw === 'scratch' ? 'scr' : evRaw;
            if ((ev === 'dry' || ev === 'in' || ev === 'scr' || ev === 'foul') && (breaker === 'h' || breaker === 'a')) {
                breaks[breaker][ev]++;
            }
            breaks[breaker].total++;
        }
    }
    
    matchSummary.breaks = breaks;

    // helpers
    const gid = (id) => document.getElementById(id);
    const fmtDate = (d) => d ? d.toLocaleString() : '-';
    const fmtDur = (s) => {
        if (s == null || isNaN(s)) return '-';
        const total = Math.floor(Number(s));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const sec = total % 60;
        return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
    };

    // names and scores
    gid('match-summary-player-h').innerText = matchSummary.playerH;
    gid('match-summary-player-a').innerText = matchSummary.playerA;
    gid('match-summary-player-h-score').innerText = matchSummary.scoreH ?? 0;
    gid('match-summary-player-a-score').innerText = matchSummary.scoreA ?? 0;
    gid('match-summary-player-h-bf').innerText = matchSummary.bfH ?? 0;
    gid('match-summary-player-a-bf').innerText = matchSummary.bfA ?? 0;
    gid('match-summary-player-h-rf').innerText = matchSummary.rfH ?? 0;
    gid('match-summary-player-a-rf').innerText = matchSummary.rfA ?? 0;
    gid('match-summary-player-h-gb').innerText = matchSummary.gbH ?? 0;
    gid('match-summary-player-a-gb').innerText = matchSummary.gbA ?? 0;

    // breaks
    gid('match-summary-player-h-break-dry').innerText = breaks.h.dry;
    gid('match-summary-player-h-break-in').innerText = breaks.h.in;
    gid('match-summary-player-h-break-scr').innerText = breaks.h.scr;
    gid('match-summary-player-h-break-foul').innerText = breaks.h.foul;
    gid('match-summary-player-a-break-dry').innerText = breaks.a.dry;
    gid('match-summary-player-a-break-in').innerText = breaks.a.in;
    gid('match-summary-player-a-break-scr').innerText = breaks.a.scr;
    gid('match-summary-player-a-break-foul').innerText = breaks.a.foul;
    gid('match-summary-player-h-breaks').innerText = `${breaks.h.total} | ${breaks.a.total}`;

    // times
    gid('match-summary-start-time').innerText = fmtDate(matchSummary.startTime);
    gid('match-summary-end-time').innerText = fmtDate(matchSummary.endTime);
    gid('match-summary-duration').innerText = fmtDur(matchSummary.matchDuration);
    gid('match-summary-average-frame-time').innerText = fmtDur(matchSummary.averageFrameDuration);

    return matchSummary;
}

function UpdateMatchSettingsUI (match)
{
    const s = match && match.settings ? match.settings : {};
    const gid = (id) => document.getElementById(id);

    // Win Type
    const winTypeEl = gid('win-type-select');
    if (winTypeEl) 
    {
        for (const opt of winTypeEl.options)
        {
            if (opt.value === s.winType)
            {
                opt.selected = true;
            } else 
            {
                opt.selected = false;
            }
        }

        if (s.winType === 'freeplay') 
        {
            gid('win-type-race-settings').style.display = 'none';
            gid('win-type-fixed-settings').style.display = 'none';
        } else if (s.winType === 'race') 
        {
            gid('win-type-race-settings').style.display = 'block';
            gid('win-type-fixed-settings').style.display = 'none';

            gid('input-race-to').value = s.winCondition || '';
            gid('input-best-of').value = s.winCondition ? (s.winCondition * 2 - 1) : '';
        } else if (s.winType === 'fixed') 
        {
            gid('win-type-race-settings').style.display = 'none';
            gid('win-type-fixed-settings').style.display = 'block';
            gid('input-fixed-frames').value = s.winCondition || '';
        }
    }

    // Lag Winner (update option labels to player names and select value)
    const optH = gid('lag-winner-h');
    const optA = gid('lag-winner-a');
    const h = player_H;
    const a = player_A;
    const displayName = (p) => p.displayName ? p.displayName : p.username ? p.username : null;
    if (optH) optH.textContent = displayName(h) ? displayName(h) : 'Player H';
    if (optA) optA.textContent = displayName(a) ? displayName(a) : 'Player A';

    const lw = s.lagWinner;
    for (const opt of gid('lag-winner-select').options)
    {
        if (opt.value === lw)
        {
            opt.selected = true;
        } else 
        {
            opt.selected = false;
        }
    }

    // Lag Type
    for (const opt of gid('lag-type-select').options)
    {
        if (opt.value === s.lagType)
        {
            opt.selected = true;
        } else 
        {
            opt.selected = false;
        }
    }

    // Advanced Break Recording
    const advToggle = gid('advanced-break-toggle');
    if (advToggle) 
    {
        advToggle.checked = s.advancedBreaks;
    }
}