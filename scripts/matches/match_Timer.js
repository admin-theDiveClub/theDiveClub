/*
SetStartTime
SetEndTime && GetMatchDuration

Restart Frame Timer

*/

var timingData = 
{
    h_durations: [],
    prev_f_startTime: null,
    prev_f_duration: null,
    f_startTime: null,
    f_duration: null
}

var m_timingData =
{
    start: null,
    end: null,
    duration: null,
    limit: null
}

export function UpdateTimingData (match)
{
    m_timingData = match.time ? match.time : {};
    const history = match.history ? match.history : [];

    if (!history || history.length == 0)
    {
        timingData.h_durations = [];
        timingData.prev_f_startTime = null;
        timingData.prev_f_duration = null;
        timingData.f_startTime = m_timingData.start ? m_timingData.start : null;
        return timingData;
    } else 
    {
        var durations = [];
        var prev_duration = null;
        for (let i = 0; i < history.length; i++)
        {
            const frame = history[i];
            if (frame.duration)
            {
                durations.push(frame.duration);
                prev_duration = frame.duration;
            }
        }
        timingData.h_durations = durations;
        timingData.prev_f_duration = prev_duration;
    }

    // console.log(timingData, m_timingData);
    SaveTimingData();
}

LoadTimingData();

function LoadTimingData ()
{
    const s_tData = localStorage.getItem('timingData') || sessionStorage.getItem('timingData');
    timingData = s_tData ? JSON.parse(s_tData) : timingData;

    const s_mData = localStorage.getItem('m_timingData') || sessionStorage.getItem('m_timingData');
    m_timingData = s_mData ? JSON.parse(s_mData) : m_timingData;
}

function SaveTimingData ()
{
    const tData = JSON.stringify(timingData);
    localStorage.setItem('timingData', tData);
    sessionStorage.setItem('timingData', tData);

    const mData = JSON.stringify(m_timingData);
    localStorage.setItem('m_timingData', mData);
    sessionStorage.setItem('m_timingData', mData);

    
    // console.log(timingData, m_timingData);
}

function GetCurrentTime ()
{
    const currentTime = new Date().toISOString();
    // console.log("Current Time:", currentTime);
    return currentTime;
}

export function SetFrameStartTime (time)
{
    timingData.f_startTime = time ? time : GetCurrentTime();

    const d = timingData.h_durations;
    const prevDuration = d && d.length > 0 ? d[d.length - 1] : null;
    timingData.prev_f_duration = prevDuration;
    const startMs = timingData.f_startTime ? new Date(timingData.f_startTime).getTime() : null;
    timingData.prev_f_startTime = (prevDuration != null && startMs != null && !isNaN(startMs))
        ? new Date(startMs - prevDuration).toISOString()
        : null;

    timingData.f_duration = new Date() - timingData.f_startTime;

    SaveTimingData();
}