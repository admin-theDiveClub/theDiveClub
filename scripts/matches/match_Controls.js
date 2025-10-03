const buttons_liveFrame = 
[
    gid("ctrl-score-H-special-bf"),
    gid("ctrl-score-H-special-rf"),
    gid("ctrl-score-H-special-gb"),
    gid("ctrl-score-H-point"),

    gid("ctrl-score-H-break-dry"),
    gid("ctrl-score-H-break-in"),
    gid("ctrl-score-H-break-scr"),
    gid("ctrl-score-H-break-foul"),

    gid("ctrl-score-A-special-bf"),
    gid("ctrl-score-A-special-rf"),
    gid("ctrl-score-A-special-gb"),
    gid("ctrl-score-A-point"),

    gid("ctrl-score-A-break-dry"),
    gid("ctrl-score-A-break-in"),
    gid("ctrl-score-A-break-scr"),
    gid("ctrl-score-A-break-foul"),
];

function gid (id)
{
    return document.getElementById(id);
}


var match = null;

export function UpdateMatchControls (_match)
{
    match = _match;    
    ResetBreakButtons();
    UpdateLiveFrameButtons();
}

export function _liveFrameIndex ()
{
    const liveFrameIndex = match.history ? match.history.length - 1 : null;
    return liveFrameIndex;
}

function GetLiveFrame ()
{
    const liveFrameIndex = _liveFrameIndex();
    var liveFrame = null;
    if (match.history && match.history.length > 0)
    {
        liveFrame = match.history[liveFrameIndex];
    } else 
    {
        var newFrame = _newFrame();
        if (!match.history) match.history = [];
        match.history.push(newFrame);
        liveFrame = newFrame;
    }
    return liveFrame;
}

import { OnPayloadReceived } from "./match_data.js";
import { SetFrameStartTime } from "./match_Timer.js";

export async function UpdateFrame (frameIndex, frameData)
{
    if (frameData == null)
    {
        match.history.splice(frameIndex, 1);
        if (match.history.length == 1)
        {
            match.history[0]["break-player"] = match.settings.lagWinner;
        }
    } else 
    {
        match.history[frameIndex] = frameData;

        if (frameIndex == _liveFrameIndex() && (frameData["winner-player"] || frameData["winner-result"]))
        {
            var newFrame = _newFrame();
            match.history.push(newFrame);
        }
    }

    match.results = UpdateMatchResults(match);
    const response = await supabase.from('tbl_matches').update(match).eq('id', match.id);
    if (response.error)
    {
        alert("Error Updating Match Frame: " + response.error.message);
        console.error("Error Updating Match Frame: ", response.error);
    } else 
    {
        OnPayloadReceived(match);
        SetFrameStartTime();
    }
}

function UpdateMatchResults (match)
{
    var newResults = 
    {
        "a": 
        {
            "bf": 0,
            "fw": 0,
            "gb": 0,
            "rf": 0,
            "breaks": 
            {
                "in": 0,
                "dry": 0,
                "scr": 0,
                "foul": 0
            }
        },
        "h": 
        {
            "bf": 0,
            "fw": 0,
            "gb": 0,
            "rf": 0,
            "breaks": 
            {
                "in": 0,
                "dry": 0,
                "scr": 0,
                "foul": 0
            }
        }
    }

    const history = match.history;
    for (let i = 0; i < history.length; i++)
    {
        const frame = history[i];
        const breakPlayer = frame["break-player"];
        const breakEvent = frame["break-event"];
        const winnerPlayer = frame["winner-player"];
        const winnerResult = frame["winner-result"];

        if (breakPlayer && breakEvent)
        {
            newResults[breakPlayer].breaks[breakEvent] ++;
        }

        var winType = null;
        switch (winnerResult)
        {
            case 1:
                winType = "fw";
                break;
            case "A":
                winType = "bf";
                break;
            case "C":
                winType = "rf";
                break;
            case "G":
                winType = "gb";
                break;
            default:
                winType = null;
        }
        if (winType)
        {
            newResults[winnerPlayer][winType] ++;
            if (winnerResult != 1)
            {
                newResults[winnerPlayer].fw ++;
            }
        }
    }

    return newResults;
}

function GetEmptyFrame ()
{
    var emptyFrame =
    {
        duration: null,
        "break-player": null,
        "break-event": null,
        "winner-player": null,
        "winner-result": null
    }
    return emptyFrame;
}

function _newFrame ()
{
    const lagType = match.settings ? match.settings.lagType ? match.settings.lagType : null : null;
    const lagWinner =  match.settings ? match.settings.lagWinner ? match.settings.lagWinner : null : null;
    const history = match.history ? match.history : [];

    var newFrame = GetEmptyFrame();
    newFrame["break-player"] = _newFrameBreakPlayer(lagType, lagWinner, history);

    return newFrame;
}

function _newFrameBreakPlayer (lagType, lagWinner, history)
{
    var breakPlayer = null;
    if (lagType === "winner")
    {
        const completedFrameIndex = _liveFrameIndex();
        const completedFrame = history[completedFrameIndex];
        if (completedFrame && completedFrame["winner-player"])
        {
            breakPlayer = completedFrame["winner-player"];
        } else 
        {
            breakPlayer = lagWinner;
        }
    } else if (lagType === "alternate")
    {
        const historyLength = history.length;
        if (historyLength % 2 === 0)
        {
            breakPlayer = lagWinner;
        } else 
        {
            breakPlayer = lagWinner === "h" ? "a" : "h";
        }
    }

    return breakPlayer;
}

WireLiveFrameControls ();

function ResetBreakButtons ()
{
    for (let i = 4; i <= 7; i++)
    {
        if (buttons_liveFrame[i])
        {
            buttons_liveFrame[i].classList.remove('active');
        }
    }

    for (let i = 12; i <= 15; i++)
    {
        if (buttons_liveFrame[i])
        {
            buttons_liveFrame[i].classList.remove('active');
        }
    }

    const liveFrame = GetLiveFrame();
    if (liveFrame && liveFrame["break-event"])
    {
        switch (liveFrame["break-event"])
        {
            case "dry":
                buttons_liveFrame[liveFrame["break-player"] === "h" ? 4 : 12].classList.add('active');
                break;
            case "in":
                buttons_liveFrame[liveFrame["break-player"] === "h" ? 5 : 13].classList.add('active');
                break;
            case "scr":
                buttons_liveFrame[liveFrame["break-player"] === "h" ? 6 : 14].classList.add('active');
                break;
            case "foul":
                buttons_liveFrame[liveFrame["break-player"] === "h" ? 7 : 15].classList.add('active');
                break;
        }
    }
}

function WireLiveFrameControls ()
{
    var allButtonsPresent = true;
    for (let button of buttons_liveFrame)
    {
        if (!button) allButtonsPresent = false;
    }
    if (allButtonsPresent)
    {
        buttons_liveFrame[3].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Point');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "h";
            liveFrame["winner-result"] = 1;

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[0].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H B/F');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "h";
            liveFrame["winner-result"] = "A";
            liveFrame["break-event"] = "in";
            liveFrame["break-player"] = "h";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[1].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H R/F');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "h";
            liveFrame["winner-result"] = "C";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[2].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H GB');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "h";
            liveFrame["winner-result"] = "G";
            liveFrame["break-event"] = "in";
            liveFrame["break-player"] = "h";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[4].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Dry');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "dry";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[4].classList.add('active');
        });

        buttons_liveFrame[5].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break In');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "in";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[5].classList.add('active');
        });

        buttons_liveFrame[6].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Scratch');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "scr";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[6].classList.add('active');
        });

        buttons_liveFrame[7].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Foul');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "foul";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[7].classList.add('active');   
        });


        buttons_liveFrame[11].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Point');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "a";
            liveFrame["winner-result"] = 1;

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[8].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A B/F');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "a";
            liveFrame["winner-result"] = "A";
            liveFrame["break-event"] = "in";
            liveFrame["break-player"] = "a";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[9].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A R/F');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "a";
            liveFrame["winner-result"] = "C";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[10].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A GB');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["winner-player"] = "a";
            liveFrame["winner-result"] = "G";
            liveFrame["break-event"] = "in";
            liveFrame["break-player"] = "a";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[12].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Dry');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "dry";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[12].classList.add('active');
        });

        buttons_liveFrame[13].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break In');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "in";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[13].classList.add('active');
        });

        buttons_liveFrame[14].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Scratch');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "scr";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[14].classList.add('active');
        });

        buttons_liveFrame[15].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Foul');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "foul";

            UpdateFrame(liveFrameIndex, liveFrame);
            ResetBreakButtons();
            buttons_liveFrame[15].classList.add('active');
        });
    } else 
    {
        console.log('Source: Match Controls - Buttons Not Found', buttons_liveFrame);
    }
}

function UpdateLiveFrameButtons ()
{
    //0 1 2 , 8 9 10
    for (let i = 0; i <= 2; i++)
    {
        const button = buttons_liveFrame[i];
        if (button)
        {
            button.disabled = false;
        }
    }

    for (let i = 8; i <= 10; i++)
    {
        const button = buttons_liveFrame[i];
        if (button)
        {
            button.disabled = false;
        }
    }

    const lf = GetLiveFrame();
    if (lf["break-player"] == "h")
    {
        buttons_liveFrame[8].disabled = true;
        buttons_liveFrame[10].disabled = true;
        buttons_liveFrame[1].disabled = true;
    } else if (lf["break-player"] == "a")
    {
        buttons_liveFrame[0].disabled = true;
        buttons_liveFrame[2].disabled = true;
        buttons_liveFrame[9].disabled = true;
    }

    if (lf["break-event"] == "in")
    {
        if (lf["break-player"] == "h")
        {
            buttons_liveFrame[9].disabled = true;
        } else if (lf["break-player"] == "a")
        {
            buttons_liveFrame[1].disabled = true;
        }
    }

    if (lf["break-event"] && (lf["break-event"] != "in"))
    {                
        buttons_liveFrame[0].disabled = true;
        buttons_liveFrame[2].disabled = true;
        buttons_liveFrame[8].disabled = true;
        buttons_liveFrame[10].disabled = true;
    }
}

const controls_settings = 
[
    gid("win-type-select"),

    gid("win-type-race-settings"),
    gid("input-race-to"),
    gid("input-best-of"),

    gid("win-type-fixed-settings"),
    gid("input-fixed-frames"),

    gid("lag-winner-select"),
    gid("lag-type-select"),

    gid("advanced-break-toggle")
]

import { UpdateMatchUI } from "./match_UI.js";

WireMatchSettingsControls ();

function WireMatchSettingsControls ()
{
    var allControlsPresent = true;
    for (let control of controls_settings)
    {
        if (!control) allControlsPresent = false;
    }

    if (allControlsPresent)
    {
        controls_settings[0].addEventListener('change', (event) =>
        {
            const newSettings = match.settings;
            newSettings.winType = event.target.value;
            UpdateMatchSettings(newSettings);
        });

        controls_settings[2].addEventListener('change', (event) =>
        {
            const newSettings = match.settings;
            newSettings.winCondition = parseInt(event.target.value);
            UpdateMatchSettings(newSettings);
        });

        controls_settings[3].addEventListener('change', (event) =>
        {
            const bestOf = parseInt(event.target.value);
            var raceTo = Math.ceil((bestOf + 1) / 2);
            controls_settings[2].value = raceTo;
        });

        controls_settings[5].addEventListener('change', (event) =>
        {
            const newSettings = match.settings;
            newSettings.winCondition = parseInt(event.target.value);
            UpdateMatchSettings(newSettings);
        });

        controls_settings[6].addEventListener('change', async (event) =>
        {
            const newSettings = match.settings;
            newSettings.lagWinner = event.target.value == "" ? null : event.target.value;
            newSettings.lagType = match.settings.lagType == "" ? null : match.settings.lagType;
            const history = match.history ? match.history : [];

            for (let i = 0; i < history.length; i++)
            {
                if (!newSettings.lagWinner && !newSettings.lagType)
                {
                    history[i]["break-player"] = null;
                } else if (newSettings.lagType === "alternate" || !newSettings.lagType)
                {
                    if (i % 2 === 0)
                    {
                        history[i]["break-player"] = newSettings.lagWinner;
                    } else 
                    {
                        history[i]["break-player"] = newSettings.lagWinner === "h" ? "a" : "h";
                    }
                } else if (newSettings.lagType === "winner")
                {
                    if (i == 0)
                    {
                        history[i]["break-player"] = newSettings.lagWinner;
                    } else 
                    {
                        const prevFrame = history[i - 1];
                        history[i]["break-player"] = prevFrame ? prevFrame["break-player"] : newSettings.lagWinner;
                    }
                }
            }

            match.history = history;
            match.settings = newSettings;

            const response = await supabase.from('tbl_matches').update(match).eq('id', match.id).select().single();
            if (response.error)
            {
                alert("Error Updating Match Frame: " + response.error.message);
                console.error("Error Updating Match Frame: ", response.error);
            } else 
            {
                UpdateMatchUI(response.data);
            }

            UpdateMatchSettings(newSettings);
        });

        controls_settings[7].addEventListener('change', (event) =>
        {
            const newSettings = match.settings;
            newSettings.lagType = event.target.value;
            UpdateMatchSettings(newSettings);
        });

        controls_settings[8].addEventListener('change', (event) =>
        {
            const newSettings = match.settings;
            newSettings.advancedBreaks = event.target.checked;
            UpdateMatchSettings(newSettings);
        });
    }
}

async function UpdateMatchSettings (newSettings)
{
    var tempMatch = match;
    tempMatch.settings = newSettings;
    const response = await supabase.from('tbl_matches').update(tempMatch).eq('id', tempMatch.id);

    if (response.error)
    {
        alert("Error Updating Match Settings: " + response.error.message);
        console.error("Error Updating Match Settings: ", response.error);
    } else 
    {
        OnPayloadReceived(match);
    }
}