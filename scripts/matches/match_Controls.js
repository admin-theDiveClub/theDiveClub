
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
}

export function _liveFrameIndex ()
{
    const liveFrameIndex = match.history.length - 1;
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
        match.history.push(newFrame);
        liveFrame = newFrame;
    }
    return liveFrame;
}

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
    const lagType = match.settings.lagType;
    const lagWinner = match.settings.lagWinner;
    const history = match.history;

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
        console.log("Completed Frame", completedFrame);
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

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[4].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Dry');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "dry";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[5].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break In');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "in";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[6].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Scratch');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "scr";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[7].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - H Break Foul');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "foul";

            UpdateFrame(liveFrameIndex, liveFrame);
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

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[12].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Dry');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "dry";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[13].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break In');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "in";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[14].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Scratch');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "scr";

            UpdateFrame(liveFrameIndex, liveFrame);
        });

        buttons_liveFrame[15].addEventListener('click', () =>
        {
            //console.log('Source: Match Controls - A Break Foul');

            const liveFrameIndex = _liveFrameIndex();
            var liveFrame = GetLiveFrame();

            liveFrame["break-event"] = "foul";

            UpdateFrame(liveFrameIndex, liveFrame);
        });
    } else 
    {
        console.log('Source: Match Controls - Buttons Not Found', buttons_liveFrame);
    }
}

