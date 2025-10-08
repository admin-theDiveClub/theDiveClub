import { UpdateLeagueUI } from "./league_UI_Control.js";

Initialize ();

async function Initialize ()
{
    const leagueID = _leagueID();
    if (leagueID)
    {
        league = await _league(leagueID);
        if (league)
        {
            //console.log("League Data:", league);
            const players = await _allUserProfiles(league.players);
            if (players)
            {
                log = players;
            }

            const l_matches = await _leagueMatches(leagueID);
            if (l_matches)
            {
                matches = l_matches;
                //console.log("League Matches:", matches);

                const l_rounds = await _leagueRounds(matches);
                if (l_rounds)
                {
                    rounds = l_rounds;
                    //console.log("League Rounds:", rounds);
                }
            }

            if (matches && log)
            {                
                log = PopulateLog(log, matches);
                //console.log("League Log:", log);

                UpdateLeagueUI(league, log, rounds);
            }
        }
    }
}

var league = null;
var log = null;
var matches = null;
var rounds = null;

function _leagueID () 
{
    var leagueID = new URLSearchParams(window.location.search).get('leagueID');
    if (!leagueID) 
    {
        leagueID = localStorage.getItem('leagueID')||sessionStorage.getItem('leagueID');
    }

    if (leagueID)
    {
        localStorage.setItem('leagueID', leagueID);
        sessionStorage.setItem('leagueID', leagueID);
        return leagueID;
    } else 
    {
        alert("No League ID Specified");
        window.location.href = "/index.html";
        return null;
    }
}

async function _league (leagueID)
{
    const response = await supabase.from('tbl_leagues').select('*').eq('id', leagueID).single();
    if (response.error)
    {
        console.log("Error Getting League:", response.error.message);
        return null;
    } else 
    {  
        const league = response.data;
        return league;
    }
}

async function _allUserProfiles (leaguePlayers)
{
    const response = await supabase.from('tbl_players').select('*').in('username', leaguePlayers);
    if (response.error)
    {
        console.log("Error Getting Player Profiles:", response.error.message);
        return null;
    } else 
    {
        const players = response.data;
        var playerProfiles = [];

        for (let i = 0; i < leaguePlayers.length; i++)
        {
            var profile = null;
            const player = players.find(p => p.username === leaguePlayers[i]);

            const stats = 
            {
                MP: 0, MW: 0, FP: 0, FW: 0, FWR: 0, BF: 0, Pts: 0
            }

            if (!player)
            {
                profile = 
                { 
                    username: leaguePlayers[i], 
                    displayName: leaguePlayers[i], 
                    name: leaguePlayers[i],
                    stats: stats 
                };
            } else 
            {
                profile = player;

                const displayName = player.nickname || player.name + (player.surname ? " " + player.surname : "") || player.username;
                profile.displayName = displayName;

                profile.stats = stats;
            }
            playerProfiles.push(profile);
        }

        return playerProfiles;
    }
}

async function _leagueMatches (leagueID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('competitions->>leagueID', leagueID).order('createdAt', { ascending: false });
    if (response.error)
    {
        console.log("Error Getting League Matches:", response.error.message);
        return null;
    } else
    {
        const matches = response.data;
        return matches;
    }
}

async function _leagueRounds (leagueMatches)
{
    var rounds = [];
    for (let i = 0; i < leagueMatches.length; i++)
    {
        const match = leagueMatches[i];
        const tournamentID = match.competitions.tournamentID || null;
        if (!rounds.includes(tournamentID))
        {
            rounds.push(tournamentID);
        }
    }

    const response = await supabase.from('tbl_tournaments').select('*').in('id', rounds).order('date', { ascending: false });
    var roundData = [];
    if (response.error)
    {
        console.log("Error Getting League Rounds:", response.error.message);
        return null;
    } else
    {
        roundData = response.data;
    }
    
    for (let i = 0; i < leagueMatches.length; i++)
    {
        const match = leagueMatches[i];
        const tournamentID = match.competitions.tournamentID || null;
        
        if (tournamentID && roundData.find(r => r.id === tournamentID))
        {
            const round = roundData.find(r => r.id === tournamentID);
            if (!round.matches)
            {
                round.matches = [];
            }
            round.matches.push(match);
        }
    }

    return roundData;
}

function PopulateLog (log, matches)
{
    var l = log;
    var m = matches;

    for (let i = 0; i < m.length; i++)
    {
        const match = m[i];
        const h_player = l.find(p => p.username === match.players.h.username);
        const a_player = l.find(p => p.username === match.players.a.username);
        const results = match.results || null;

        if (h_player && a_player && results)
        {
            h_player.stats.MP ++;
            a_player.stats.MP ++;

            if (results.h.fw > results.a.fw)
            {
                h_player.stats.MW ++;
            } else if (results.a.fw > results.h.fw)
            {
                a_player.stats.MW ++;
            }

            h_player.stats.FP += results.h.fw + results.a.fw || 0;
            a_player.stats.FP += results.a.fw + results.h.fw || 0;

            h_player.stats.FW += results.h.fw || 0;
            a_player.stats.FW += results.a.fw || 0;

            h_player.stats.FWR = (h_player.stats.FW / h_player.stats.FP * 100).toFixed(2) || 0;
            a_player.stats.FWR = (a_player.stats.FW / a_player.stats.FP * 100).toFixed(2) || 0;

            h_player.stats.BF += results.h.bf || 0;
            a_player.stats.BF += results.a.bf || 0;

            //SPL Points Calc
            h_player.stats.Pts += results.h.fw + results.h.bf || 0;
            a_player.stats.Pts += results.a.fw + results.a.bf || 0;
        }
    }

    l.sort((a, b) => b.stats.Pts - a.stats.Pts || b.stats.FW - a.stats.FW || b.stats.FWR - a.stats.FWR || a.stats.BF - b.stats.BF);
    for (let i = 0; i < l.length; i++)
    {
        l[i].stats.Rnk = i + 1;
    }

    return l;
}