Start ();

async function Start ()
{
    const userProfile = await _userProfile();
    console.log("User Profile:", userProfile);

    if (userProfile)
    {
        PopulateUserProfile(userProfile);
        var matches = await _userMatches(userProfile.username);

        if (matches && matches.length > 0)
        {
            matches = await GetStrippedMatches(matches, userProfile.username);
            if (matches)
            {
                _matches = matches;
                PopulateMatchesTable(_matches, 0);

                const stats = GetUserStats(_matches, userProfile.username);
                PopulateUserStats(stats);
            }
        }        

        const leagues = await _userLeagues(userProfile);
        if (leagues && leagues.length > 0)
        {
            PopulateLeaguesTable(leagues);
        }
        console.log("User Leagues:", leagues);

        const tournaments = await _userTournaments(userProfile);
        if (tournaments && tournaments.length > 0)
        {
            PopulateTournamentsTable(tournaments);
        }
        console.log("User Tournaments:", tournaments);

        gid("component-loading-overlay").style.display = "none";
    }
}

var _matches = null;

async function _userProfile ()
{
    var username = new URLSearchParams(window.location.search).get('username');
    if (username) 
    {        
        const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
        if (response.error)
        {
            alert("Error Getting User Profile: " + response.error.message);
            window.location.href = "/index.html";
            return null;
        } else 
        {
            return response.data;
        }
    }

    const s_userProfile = localStorage.getItem("userProfile") || sessionStorage.getItem("userProfile");
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    if (!userProfile)
    {
        alert("Error Getting User Profile: User profile not found");
        window.location.href = "/index.html";
    }
    return userProfile;
}

function PopulateUserProfile (userProfile)
{
    gid("user-pp").src = userProfile.pp ? userProfile.pp : "/resources/icons/icon_player.svg";
    const displayName = userProfile.nickname ? userProfile.nickname : (userProfile.name ? userProfile.name : userProfile.username);
    gid("user-displayName").textContent = displayName;
    gid("user-name").textContent = userProfile.name + (userProfile.surname ? (" " + userProfile.surname) : "");
    gid("user-username").textContent = userProfile.username;
}

async function _userMatches (username)
{
    const response = await supabase
        .from('tbl_matches')
        .select('*')
        .or(`players->h->>username.eq."${username}",players->a->>username.eq."${username}"`)
        .order('createdAt', { ascending: false });

    if (response.data)
    {
        return response.data;
    } else 
    {
        return null;
    }
}

async function GetStrippedMatches (matches, username)
{
    //Get all opponents
    var allOpponents = [];
    for (let i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        var opponent_un = null;

        if (match.players.h.username === username)
        {
            opponent_un = match.players.a.username;
        } else if (match.players.a.username === username)
        {
            opponent_un = match.players.h.username;
        }

        if (opponent_un && !allOpponents.includes(opponent_un))
        {
            allOpponents.push(opponent_un);
        }
    }

    //Get All Profiles with @ in username
    var checkOpponents = allOpponents.filter(opponent_un => opponent_un.includes('@'));
    const response = await supabase.from('tbl_players').select('*').in('username', checkOpponents);
    var profilesFound = null;
    if (!response.error)
    {
        profilesFound = response.data.length > 0 ? response.data : null;
    } 

    //Prep Opponents Data
    var opponentsData = [];
    for (let i = 0; i < allOpponents.length; i++)
    {
        const opponent_un = allOpponents[i];
        const profile = (profilesFound ? profilesFound.find(profile => profile.username === opponent_un) : null);
        var strippedProfile = null;
        var displayName = opponent_un;
        var pp = null;
        var name = null;

        if (profile)
        {
            displayName = profile.nickname ? profile.nickname : (profile.name ? profile.name : displayName);
            pp = profile.pp ? profile.pp : null;
            name = profile.name ? profile.name : null;
            if (profile.surname)
            {
                name = name ? (name + " " + profile.surname) : profile.surname;
            }
        } else 
        {
            displayName = opponent_un.split('@')[0];
        }

        var opponentProfile = {username: opponent_un, displayName: displayName, pp: pp, name: name};
        opponentsData.push(opponentProfile);
    }

    //Strip Match Data
    var strippedMatches = [];
    for (let i = 0; i < matches.length; i++)
    {
        const match = matches[i];

        const opponent_un = (match.players.h.username === username) ? match.players.a.username : match.players.h.username;
        const opponentProfile = opponentsData.find(opponent => opponent.username === opponent_un);
        const userSide = (match.players.h.username === username) ? 'h' : 'a';

        const results = match.results ? match.results : {h: 0, a: 0};
        const userResults = results[userSide];
        const opponentResults = (userSide === 'h') ? results.a : results.h;

        var startTime = match.createdAt;
        startTime = match.time && match.time.start ? match.time.start : startTime;

        var status = (match.info && match.info.status) ? match.info.status.toLowerCase() : "new";
        status = status.charAt(0).toUpperCase() + status.slice(1); 

        var strippedMatch = 
        {
            id: match.id,
            startTime: startTime,
            status: status,
            opponent: opponentProfile,
            userResults: userResults,
            opponentResults: opponentResults,
            history: match.history ? match.history : []
        };
        strippedMatches.push(strippedMatch);
    }

    if (strippedMatches.length > 0)
    {
        //Sort by startTime desc
        strippedMatches.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        return strippedMatches;
    } else 
    {
        return null;
    }
}

function GetUserStats (matches)
{
    var stats =
    {
        fp: 0,
        fw: 0,
        mp: 0,
        mw: 0,
        avgDuration: 0,
        bf: 0
    }

    var totalDuration = 0;
    var durationsCount = 0;
    for (let i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        stats.mp ++;
        if (match.status === "Complete")
        {
            if (match.userResults.fw > match.opponentResults.fw)
            {
                stats.mw ++;
            }
        }

        stats.fp += match.userResults.fw + match.opponentResults.fw;
        stats.fw += match.userResults.fw;

        stats.bf += match.userResults.bf ? match.userResults.bf : 0;

        if (!match.history)
        {
            match.history = [];
        }

        for (let j = 0; j < match.history.length; j++)
        {
            const h = match.history[j];
            if (h.duration)
            {
                totalDuration += h.duration;
                durationsCount ++;
            }
        }
    }
    stats.avgDuration = durationsCount > 0 ? (totalDuration / durationsCount).toFixed(2) : 0;

    return stats;
}

function PopulateUserStats (stats)
{
    gid("user-fp").textContent = stats.fp;
    gid("user-fw").textContent = stats.fw;
    const fPercent = stats.fp > 0 ? ((stats.fw / stats.fp) * 100).toFixed(2) : "0.00";
    gid("user-fpercent").textContent = fPercent + "%";

    gid("user-mp").textContent = stats.mp;
    gid("user-mw").textContent = stats.mw;
    const mPercent = stats.mp > 0 ? ((stats.mw / stats.mp) * 100).toFixed(2) : "0.00";
    gid("user-mpercent").textContent = mPercent + "%";
    const avgFrameTime = (() => {
        const avgSec = Number(stats.avgDuration);
        if (!avgSec || avgSec <= 0) return "00:00";
        const hours = Math.floor(avgSec / 3600);
        const minutes = Math.floor((avgSec % 3600) / 60);
        const seconds = Math.floor(avgSec % 60);
        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');
        if (hours === 0) return `${mm}:${ss}`;
        const hh = String(hours).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    })();
    gid("user-avg-frame-time").textContent = avgFrameTime;
    gid("user-bf").textContent = stats.bf;
}

const gid = (id) => document.getElementById(id);

function PopulateMatchesTable (matches, index)
{
    const e_table = gid("tbl-matches");
    const e_tbody = e_table.querySelector("tbody");
    e_tbody.innerHTML = "";

    const lowerIndex = matches ? (index < matches.length ? index : matches.length - indexShift) : 0;

    gid("matches-pagination").textContent = `${lowerIndex + 1}-${(lowerIndex + indexShift) > matches.length ? matches.length : (lowerIndex + indexShift)} of ${matches.length}`;

    for (let i = lowerIndex; i < lowerIndex + indexShift; i++)
    {  
        if (i < 0 || i >= matches.length) continue;
        const m = matches[i];

        const tr = document.createElement("tr");
        tr.classList.add("match-row");
        const link = m.status === "Complete" ? 'scoreboard' : 'index';
        //tr.onclick = () => { window.location.href = `/matches/${link}.html?matchID=${m.id}`; };
        e_tbody.appendChild(tr);

        const td_status = document.createElement("td");
        td_status.classList.add("match-status-bullet");

        var status = m.status;
        if (status != "Complete" && (m.userResults.fw > 0 || m.opponentResults.fw > 0))
        {
            status = "Live";
        }

        const color = (status === "Complete") ? "var(--color-primary-00)" : (status === "New") ? "var(--color-base-06)" : "var(--color-secondary-00)"; 
        td_status.style.backgroundColor = color;
        tr.appendChild(td_status);

        const td_date = document.createElement("td");
        td_date.classList.add("match-date");
        const date = new Date(m.startTime);
        const e_dateLabel = document.createElement("p");
        e_dateLabel.textContent = date.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' });
        td_date.appendChild(e_dateLabel);
        tr.appendChild(td_date);

        const td_opponent_pp = document.createElement("td");
        td_opponent_pp.classList.add("match-opponent-pp");
        const e_opponent_pp = document.createElement("img");
        e_opponent_pp.src = m.opponent.pp ? m.opponent.pp : "/resources/icons/icon_player.svg";
        e_opponent_pp.alt = '';

        if (m.opponent.username != m.opponent.displayName)
        {
            td_opponent_pp.addEventListener('click', (event) =>
            {
                //window.open(`/accounts/index.html?username=${encodeURIComponent(m.opponent.username)}`, '_blank');
                UpdateMiniProfile(m.opponent);
            });

            td_opponent_pp.style.cursor = "pointer";
            
            td_opponent_pp.addEventListener('mouseenter', () => 
            {
                td_opponent_pp.style.boxShadow = "inset 0 0 12px var(--color-accent-0) !important";
                td_opponent_pp.style.transition = "box-shadow 0.1s ease-in-out";
                td_opponent_pp.style.borderRadius = "0.5rem";
            });
            td_opponent_pp.addEventListener('mouseleave', () => 
            {
                td_opponent_pp.style.boxShadow = "";
            });

            if (m.opponent.pp)
            {
                td_opponent_pp.appendChild(e_opponent_pp);
            }
        }

        tr.appendChild(td_opponent_pp);

        const td_opponent_info = document.createElement("td");
        td_opponent_info.classList.add("match-opponent-info");
        const e_opponent_name = document.createElement("p");
        e_opponent_name.classList.add("match-opponent-displayName");
        e_opponent_name.textContent = m.opponent.displayName;
        td_opponent_info.appendChild(e_opponent_name);
        const e_opponent_username = document.createElement("p");
        e_opponent_username.classList.add("match-opponent-username");
        e_opponent_username.textContent = m.opponent.username;
        td_opponent_info.appendChild(e_opponent_username);
        tr.appendChild(td_opponent_info);

        const td_results = document.createElement("td");
        td_results.classList.add("match-score");
        const e_results = document.createElement("p");
        e_results.id = "match-score";
        e_results.style.display = "flex";
        const className = (m.userResults.fw > m.opponentResults.fw) ? "match-user-fw-win" : (m.userResults.fw < m.opponentResults.fw) ? "match-user-fw-loss" : "match-user-fw-draw";
        e_results.innerHTML = `${m.opponentResults.fw} - <div class="${className}">${m.userResults.fw}</div>`;
        e_results.addEventListener('click', (event) =>
        {
            window.open(`/matches/${link}.html?matchID=${m.id}`, '_blank');
        });
        td_results.appendChild(e_results);
        tr.appendChild(td_results);
    }
}

import { UpdateMiniProfile } from "../UIControllers/profile-mini-controller.js";

var index = 0;
var indexShift = window.innerWidth < 600 ? 5 : 10;

gid('matches-pagination-next').onclick = () =>
{
    if (index + indexShift >= _matches.length) return;
    index += indexShift;
    PopulateMatchesTable(_matches, index);
}

gid('matches-pagination-prev').onclick = () =>
{
    if (index - indexShift < 0) return;
    index -= indexShift;
    PopulateMatchesTable(_matches, index);
}

window.addEventListener('resize', () =>
{
    const newIndexShift = window.innerWidth < 600 ? 5 : 10;
    if (newIndexShift !== indexShift) 
    {
        indexShift = newIndexShift;
        PopulateMatchesTable(_matches, index);
    }
});

async function _userLeagues (userprofile)
{
    const response_player = await supabase
        .from('tbl_leagues')
        .select('*')
        .contains('players', JSON.stringify([userprofile.username]))
        .order('date_start', { ascending: false });

    if (response_player.error) {
        console.error("Error Getting User Leagues:", response_player.error);
        return null;
    }

    const response_coordinator = await supabase
        .from('tbl_leagues')
        .select('*')
        .eq('coordinatorID', userprofile.id)
        .order('date_start', { ascending: false });

    if (response_coordinator.error) 
    {
        console.error("Error Getting Coordinated Leagues:", response_coordinator.error);
        return null;
    }

    const combinedLeagues = [...response_player.data, ...response_coordinator.data];
    const uniqueLeagues = Array.from(new Set(combinedLeagues.map(league => league.id)))
        .map(id => combinedLeagues.find(league => league.id === id));

    return uniqueLeagues;
}

function PopulateLeaguesTable (leagues)
{
    const e_table = gid("tbl-user-leagues");
    const e_tbody = e_table.querySelector("tbody");
    e_tbody.innerHTML = "";

    for (let i = 0; i < leagues.length; i++)
    {  
        const league = leagues[i];
        const tr = document.createElement("tr");
        tr.classList.add("league-row");
        tr.onclick = () => { window.open(`/leagues/index.html?leagueID=${league.id}`, '_blank'); };
        e_tbody.appendChild(tr);

        // Determine active state: prefer explicit field, otherwise infer from date_end (null => ongoing/active)
        const isActive = (typeof league.active === 'boolean') ? league.active : (league.date_end ? false : true);

        const td_status = document.createElement("td");
        td_status.classList.add("league-status-bullet");
        const color = isActive ? "var(--color-primary-00)" : "var(--color-base-06)"; 
        td_status.style.backgroundColor = color;
        tr.appendChild(td_status);

        const td_dates = document.createElement("td");
        td_dates.classList.add("league-dates");
        const e_date_start = document.createElement("p");
        e_date_start.classList.add("league-date");
        let startDate = league.date_start ? new Date(league.date_start) : null;
        e_date_start.textContent = startDate && !isNaN(startDate) 
            ? startDate.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' }) 
            : "TBD";
        td_dates.appendChild(e_date_start);

        const e_date_end = document.createElement("p");
        e_date_end.classList.add("league-date");
        let endDate = league.date_end ? new Date(league.date_end) : null;
        e_date_end.textContent = endDate && !isNaN(endDate) 
            ? endDate.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' }) 
            : "Ongoing";
        td_dates.appendChild(e_date_end);
        tr.appendChild(td_dates);

        const td_pp = document.createElement("td");
        td_pp.classList.add("league-pp");
        const e_pp = document.createElement("img");
        e_pp.src = league.pp ? league.pp : "/resources/icons/icon_theDiveClub_alpha.svg";
        e_pp.alt = '';
        td_pp.appendChild(e_pp);
        tr.appendChild(td_pp);

        const td_info = document.createElement("td");
        td_info.classList.add("league-info");
        const e_name = document.createElement("p");
        e_name.classList.add("league-name");
        e_name.textContent = league.name || "Unnamed League";
        td_info.appendChild(e_name);
        const e_coordinator = document.createElement("p");
        e_coordinator.classList.add("league-coordinator");
        // JSON may not include coordinatorName; fall back to coordinatorID or blank
        e_coordinator.textContent = league.coordinatorName || league.coordinator || league.coordinatorID || "";
        td_info.appendChild(e_coordinator);
        tr.appendChild(td_info);

        const td_players_count = document.createElement("td");
        td_players_count.classList.add("league-players-count");
        const e_players = document.createElement("p");
        e_players.classList.add("league-players");
        const playersCount = Array.isArray(league.players) ? league.players.length : 0;
        e_players.textContent = `${playersCount} Player${playersCount === 1 ? "" : "s"}`;
        td_players_count.appendChild(e_players);
        tr.appendChild(td_players_count);
    }
}

async function _userTournaments (userprofile)
{
    const response_player = await supabase
        .from('tbl_tournaments')
        .select('*')
        .contains('players', JSON.stringify([{ username: userprofile.username }]))
        .order('date', { ascending: false });

    if (response_player.error) {
        console.error("Error Getting User Leagues:", response_player.error);
        return null;
    }

    const response_coordinator = await supabase
        .from('tbl_tournaments')
        .select('*')
        .eq('coordinatorID', userprofile.id)
        .order('date', { ascending: false });

    if (response_coordinator.error) 
    {
        console.error("Error Getting Coordinated Leagues:", response_coordinator.error);
        return null;
    }

    const combinedLeagues = [...response_player.data, ...response_coordinator.data];
    const uniqueLeagues = Array.from(new Set(combinedLeagues.map(league => league.id)))
        .map(id => combinedLeagues.find(league => league.id === id));

    return uniqueLeagues;
}

function PopulateTournamentsTable (tournaments, userId)
{
    const e_table = gid("tbl-user-tournaments");
    const e_tbody = e_table.querySelector("tbody");
    e_tbody.innerHTML = "";

    for (let i = 0; i < tournaments.length; i++)
    {
        const tournament = tournaments[i];
        if (tournament.leagueID) continue; // Skip tournaments that are part of a league
        const tr = document.createElement("tr");
        tr.classList.add("tournament-row");
        tr.onclick = () => 
        { 
            window.open(`/tournaments/index.html?tournamentID=${tournament.id}`, '_blank');
        };
        e_tbody.appendChild(tr);

        // Determine active state: prefer explicit status, otherwise infer from date (future => active)
        const statusText = tournament.status ? String(tournament.status).toLowerCase() : null;
        const isActive = statusText ? (statusText === "live" || statusText === "active") : (tournament.date ? (new Date(tournament.date) >= new Date()) : true);

        const td_status = document.createElement("td");
        td_status.classList.add("tournament-status-bullet");
        td_status.style.backgroundColor = isActive ? "var(--color-primary-00)" : "var(--color-base-06)";
        tr.appendChild(td_status);

        const td_start = document.createElement("td");
        td_start.classList.add("tournament-start");

        // Build date/time display
        let startDate = null;
        if (tournament.date && tournament.time) {
            const iso = `${tournament.date}T${tournament.time}`;
            startDate = new Date(iso);
            if (isNaN(startDate)) startDate = new Date(tournament.date);
        } else if (tournament.date) {
            startDate = new Date(tournament.date);
        }

        const e_date = document.createElement("p");
        e_date.classList.add("tournament-date");
        e_date.textContent = startDate && !isNaN(startDate)
            ? startDate.toLocaleDateString(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' })
            : "TBD";
        td_start.appendChild(e_date);

        const e_time = document.createElement("p");
        e_time.classList.add("tournament-date");
        e_time.textContent = startDate && !isNaN(startDate)
            ? startDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : (tournament.time ? tournament.time : "TBD");
        td_start.appendChild(e_time);

        tr.appendChild(td_start);

        const td_info = document.createElement("td");
        td_info.classList.add("tournament-info");
        const e_name = document.createElement("p");
        e_name.classList.add("tournament-name");
        e_name.textContent = tournament.name || "Unnamed Tournament";
        td_info.appendChild(e_name);
        const e_coordinator = document.createElement("p");
        e_coordinator.classList.add("tournament-coordinator");
        e_coordinator.textContent = tournament.coordinatorName || tournament.coordinator || tournament.coordinatorID || "";
        td_info.appendChild(e_coordinator);
        tr.appendChild(td_info);

        const td_players_count = document.createElement("td");
        td_players_count.classList.add("tournament-players-count");
        const e_players = document.createElement("p");
        e_players.classList.add("tournament-players");
        const playersCount = Array.isArray(tournament.players) ? tournament.players.length : 0;
        e_players.textContent = `${playersCount} Player${playersCount === 1 ? "" : "s"}`;
        td_players_count.appendChild(e_players);
        tr.appendChild(td_players_count);
    }
}

