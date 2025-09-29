
const allButtons = 
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

console.log('Source: Match Controls - Buttons', allButtons);

function gid (id)
{
    return document.getElementById(id);
}

function GetFrameData (frameIndex)
{
    
}

function UpdateFrame (frameIndex, frameData)
{

}