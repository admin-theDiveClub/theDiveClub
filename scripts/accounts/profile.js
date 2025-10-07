Start ();

async function Start ()
{
    const userProfile = _userProfile();
    if (userProfile)
    {
        UpdateProfileInfo(userProfile);
        const username = userProfile.username;
        if (username)
        {
            const userMatches = await _userMatches(username);
            if (userMatches)
            {
                await PopulateMatchesTable(userMatches);


                const leagueIDs = GetAssociatedLeagues(userMatches);
                const leagueDetails = await GetAllLeaguesDetails(leagueIDs);
                if (leagueDetails)
                {
                    PopulateLeaguesTable(leagueDetails);
                }

                const tournamentIDs = GetAssociatedTournaments(userMatches);
                const tournamentDetails = await GetAllTournamentsDetails(tournamentIDs);
                if (tournamentDetails)
                {
                    PopulateTournamentsTable(tournamentDetails);
                }

                const stats_ranked = GetPlayerStats(userMatches);
                PopulateStats(stats_ranked);
            }

            //Loading Done
            document.getElementById("component-loading-overlay").style.display = "none";
        }
    } else
    {
        window.location.href = "../index.html#login";
    }
}

function _userProfile ()
{
    const s_userProfile = localStorage.getItem("userProfile") || sessionStorage.getItem("userProfile");
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    return userProfile;
}

function UpdateProfileInfo (userProfile)
{
    const e_displayName = document.getElementById("user-displayName");
    const e_name = document.getElementById("user-name");
    const e_username = document.getElementById("user-username");
    const e_id = document.getElementById("user-id");
    const e_profilePic = document.getElementById("user-profile-pic");

    e_displayName.textContent = userProfile.displayName || "N/A";
    e_name.textContent = userProfile.name  + " " + (userProfile.surname ? userProfile.surname : "");
    e_username.textContent = userProfile.username || "N/A";
    e_id.textContent = userProfile.id || "N/A";
    if (userProfile.pp)
    {
        e_profilePic.src = userProfile.pp;
    }
}

async function _userMatches (username)
{
    const response = await supabase
        .from('tbl_matches')
        .select('*')
        .or(
            `players->h->>username.eq."${username}",players->a->>username.eq."${username}"`
        )
        .order('createdAt', { ascending: false });

    if (response.data)
    {
        console.log("User Matches Response:", response.data);
        return response.data;
    } else 
    {
        return null;
    }
}

async function PopulateMatchesTable (matches)
{
    document.getElementById("matches-count").textContent = `(${matches.length})`;

    const e_table_matches = document.getElementById("tbl-matches");
    const e_tbody = e_table_matches.querySelector("tbody");
    e_tbody.innerHTML = "";

    for (var i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        const e_tr = document.createElement("tr");
        const e_td_date = document.createElement("td");
        const e_td_opponent = document.createElement("td");
        const e_td_league = document.createElement("td");
        const e_td_tournament = document.createElement("td");
        const e_td_result = document.createElement("td");
        const e_td_link = document.createElement("td");

        const matchDate = match.createdAt ? new Date(match.createdAt).toLocaleDateString() : "N/A";
        e_td_date.textContent = matchDate;

        const username = _userProfile().username;

        var homePlayer = match.players.h.username ? match.players.h.username : "X";
        var awayPlayer = match.players.a.username ? match.players.a.username : "X";

        const score_h = match.results && match.results.h && match.results.h.fw ? match.results.h.fw : '?';
        const score_a = match.results && match.results.a && match.results.a.fw ? match.results.a.fw : '?';

        if (username === homePlayer)
        {
            const opponentName = await GetDisplayName(awayPlayer);
            e_td_opponent.innerHTML = opponentName || "N/A";

            const resultText = `<span class='score-strong'>${score_h}</span> : ${score_a}`;
            e_td_result.innerHTML = resultText;
        } else if (username === awayPlayer)
        {
            const opponentName = await GetDisplayName(homePlayer);
            e_td_opponent.innerHTML = opponentName || "N/A";

            const resultText = `${score_h} : <span class='score-strong'>${score_a}</span>`;
            e_td_result.innerHTML = resultText;
        } else
        {
            e_td_opponent.textContent = "N/A";

            const resultText = "?-?";
            e_td_result.textContent = resultText;
        }

        const leagueID = match.competitions && match.competitions.leagueID ? match.competitions.leagueID : null;
        if (leagueID)
        {
            const link = `../leagues/view.html?leagueID=${leagueID}`;
            e_td_league.innerHTML = `<a href="${link}"><i class="bi bi-link"></i></a>` || "N/A";
        }
        
        const tournamentID = match.competitions && match.competitions.tournamentID ? match.competitions.tournamentID : null;
        if (tournamentID)
        {
            const link = `../tournaments/view.html?tournamentID=${tournamentID}`;
            e_td_tournament.innerHTML = `<a href="${link}"><i class="bi bi-link"></i></a>` || "N/A";
        }

        const matchID = match.id || null;
        var link = matchID ? `../matches/index.html?matchID=${matchID}` : null;
        if (match.info && match.info.status === "Complete")
        {
            e_td_link.classList.add("match-link-complete");
            link = `../matches/scoreboard.html?matchID=${matchID}`;
        }
        
        e_td_link.innerHTML = `<a href="${link}"><i class="bi bi-link"></i></a>` || "N/A";

        e_tr.appendChild(e_td_date);
        e_tr.appendChild(e_td_opponent);
        e_tr.appendChild(e_td_result);
        e_tr.appendChild(e_td_link);
        e_tr.appendChild(e_td_league);
        e_tr.appendChild(e_td_tournament);

        e_tbody.appendChild(e_tr);
    }
}

async function GetDisplayName (username)
{
    if (username.includes("@"))
    {
        if (profilesLoaded.find(p => p.username === username))
        {
            const profile = profilesLoaded.find(p => p.username === username);
            return `<span class='player-strong'>${profile.nickname || profile.name}</span>`;
        }

        const response = await supabase.from('tbl_players').select('name,nickname').eq('username', username).single();

        if (response.data)
        {
            var profile = response.data;
            profile.username = username;
            profilesLoaded.push(profile);
            if (response.data.nickname || response.data.name)
            {
                return `<span class='player-strong'>${response.data.nickname || response.data.name}</span>`;
            } else 
            {
                return username;
            }
        }
    }
    return username;
}

var profilesLoaded = [];

function GetAssociatedLeagues (matches)
{
    var leagueIDs = [];
    for (var i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        if (match.competitions && match.competitions.leagueID)
        {
            const leagueID = match.competitions.leagueID;
            if (!leagueIDs.includes(leagueID))
            {
                leagueIDs.push(leagueID);
            }
        }
    }
    return leagueIDs;
}

async function GetAllLeaguesDetails (leagueIDs)
{
    var leagues = [];
    for (var i = 0; i < leagueIDs.length; i++)
    {
        const leagueID = leagueIDs[i];
        const response = await supabase.from('tbl_leagues').select('*').eq('id', leagueID).single();
        if (response.data)
        {
            leagues.push(response.data);
        }
    }
    return leagues;
}

function PopulateLeaguesTable (leagues)
{

   document.getElementById("leagues-count").textContent = `(${leagues.length})`;

    const e_card_body = document.getElementById("leaguesCardBody");
    e_card_body.innerHTML = "";

    for (var i = 0; i < leagues.length; i++)
    {
        const league = leagues[i];
        const e_div = document.createElement("a");
        e_div.classList.add("component-league-mini");
        const leagueID = league.id || null;
        if (leagueID)
        {
            const link = `../leagues/index.html?leagueID=${leagueID}`;
            e_div.href = link;
        }
        const e_img = document.createElement("img");
        e_img.src = league.pp || "../resources/icon_theDiveClub_alpha.svg";
        const e_name = document.createElement("p");
        e_name.textContent = league.name || "N/A";
        const e_members = document.createElement("p");
        e_members.textContent = league.members && league.members.length ? `0/${league.members.length}` : "0/000";
        e_div.appendChild(e_img);
        e_div.appendChild(e_name);
        e_div.appendChild(e_members);
        e_card_body.appendChild(e_div);
    }
}

function GetAssociatedTournaments (matches)
{
    var tournamentIDs = [];
    for (var i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        if (match.competitions && match.competitions.tournamentID)
        {
            const tournamentID = match.competitions.tournamentID;
            if (!tournamentIDs.includes(tournamentID))
            {
                tournamentIDs.push(tournamentID);
            }
        }
    }
    return tournamentIDs;
}

async function GetAllTournamentsDetails (tournamentIDs)
{
    var tournaments = [];
    for (var i = 0; i < tournamentIDs.length; i++)
    {
        const tournamentID = tournamentIDs[i];
        const response = await supabase.from('tbl_tournaments').select('*').eq('id', tournamentID).single();
        if (response.data)
        {
            tournaments.push(response.data);
        }
    }
    return tournaments;
}

function PopulateTournamentsTable (tournaments)
{
    /*<table id="tbl-tournaments" style="width: 100%;">
        <thead>
            <tr>
                <th>Tournament</th>
                <th>Venue</th>
                <th>Date</th>
                <th>Tournament Link</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Tournament Name</td>
                <td>Test Venue</td>
                <td>01/01/2023</td>
                <td><i class="bi bi-link"></i></td>
            </tr>
        </tbody>
    </table>*/

    document.getElementById("tournaments-count").textContent = `(${tournaments.length})`;

    const e_table_tournaments = document.getElementById("tbl-tournaments");
    const e_tbody = e_table_tournaments.querySelector("tbody");
    e_tbody.innerHTML = "";

    for (var i = 0; i < tournaments.length; i++)
    {
        const tournament = tournaments[i];
        const e_tr = document.createElement("tr");
        const e_td_name = document.createElement("td");
        const e_td_venue = document.createElement("td");
        const e_td_date = document.createElement("td");
        const e_td_link = document.createElement("td");
        e_td_name.textContent = tournament.name || "N/A";
        e_td_venue.textContent = tournament.location || "N/A";
        const tournamentDate = tournament.date ? new Date(tournament.date).toLocaleDateString() : "N/A";
        e_td_date.textContent = tournamentDate;
        const tournamentID = tournament.id || null;
        const link = tournamentID ? `../tournaments/view.html?tournamentID=${tournamentID}` : null;
        e_td_link.innerHTML = `<a href="${link}"><i class="bi bi-link"></i></a>` || "N/A";

        e_tr.appendChild(e_td_name);
        e_tr.appendChild(e_td_venue);
        e_tr.appendChild(e_td_date);
        e_tr.appendChild(e_td_link);
        e_tbody.appendChild(e_tr);
    }
}

function GetPlayerStats (matches)
{
    var stats_ranked = 
    {
        mp: 0,
        mw: 0,
        mwr: 0,

        fp: 0,
        fw: 0,
        fwr: 0,

        tavg: 0,
        b_in: 0,
        bf: 0,
    }

    var stats_social =
    {
        mp: 0,
        mw: 0,
        mwr: 0,

        fp: 0,
        fw: 0,
        fwr: 0,

        tavg: 0,
        b_in: 0,
        bf: 0,
    }

    for (var i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        const ranked = match.competitions && (match.competitions.leagueID || match.competitions.tournamentID) ? true : false;
        if (ranked) stats_ranked.mp++;
        stats_social.mp++;
        const username = _userProfile().username;
        const homePlayer = match.players.h.username ? match.players.h.username : "X";
        const awayPlayer = match.players.a.username ? match.players.a.username : "X";
        const score_h = match.results && match.results.h && match.results.h.fw ? match.results.h.fw : 0;
        const score_a = match.results && match.results.a && match.results.a.fw ? match.results.a.fw : 0;
        if (ranked) stats_ranked.fp += score_h + score_a;
        stats_social.fp += score_h + score_a;
        var playerSide = null;
        if (username === homePlayer)
        {
            playerSide = "h";
            if (ranked) stats_ranked.fw += score_h;
            stats_social.fw += score_h;
            if (score_h > score_a && match.info && match.info.status === "Complete")
            {
                if (ranked) stats_ranked.mw++;
                stats_social.mw++;
            }
        } else if (username === awayPlayer)
        {
            playerSide = "a";
            if (ranked) stats_ranked.fw += score_a;
            stats_social.fw += score_a;
            if (score_a > score_h && match.info && match.info.status === "Complete")
            {
                if (ranked) stats_ranked.mw++;
                stats_social.mw++;
            }
        }

        if (ranked) stats_ranked.mwr = stats_ranked.mp ? ((stats_ranked.mw / stats_ranked.mp) * 100).toFixed(2) : 0;
        stats_social.mwr = stats_social.mp ? ((stats_social.mw / stats_social.mp) * 100).toFixed(2) : 0;
        if (ranked) stats_ranked.fwr = stats_ranked.fp ? ((stats_ranked.fw / stats_ranked.fp) * 100).toFixed(2) : 0;
        stats_social.fwr = stats_social.fp ? ((stats_social.fw / stats_social.fp) * 100).toFixed(2) : 0;

        if (match.history && match.history.length > 0)
        {
            var totalDuration = 0;
            var totalBreaksIn = 0;
            var totalBF = 0;
            for (var j = 0; j < match.history.length; j++)
            {
                const historyEntry = match.history[j];
                if (historyEntry.duration)
                {
                    totalDuration += historyEntry.duration;
                }
                
                if (historyEntry['break-event'])
                {
                    if (historyEntry['break-event'] === "in")
                    {
                        totalBreaksIn++;
                    }
                }

                if (historyEntry['winner-player'] == playerSide)
                {
                    if (historyEntry['winner-result'] == 'A')
                    {
                        totalBF++;
                    }
                }
            }
            if (ranked) stats_ranked.tavg = match.history.length ? (totalDuration / match.history.length).toFixed(2) / 60 : 0;
            stats_social.tavg = match.history.length ? (totalDuration / match.history.length).toFixed(2) / 60 : 0;
            if (ranked) stats_ranked.b_in += totalBreaksIn;
            stats_social.b_in += totalBreaksIn;
            if (ranked) stats_ranked.bf += totalBF;
            stats_social.bf += totalBF;
        }
    }

    return {stats_ranked, stats_social};
}

function PopulateStats (stats_all)
{
    let stats = stats_all.stats_ranked;
    document.getElementById("ranked-mp").textContent = stats.mp || 0;
    document.getElementById("ranked-mw").textContent = stats.mw || 0;
    document.getElementById("ranked-mp-percentage").textContent = stats.mwr ? `${stats.mwr}%` : "0.0%";
    document.getElementById("ranked-fp-value").textContent = stats.fp || 0;
    document.getElementById("ranked-fw-value").textContent = stats.fw || 0;
    document.getElementById("ranked-fp-percentage-value").textContent = stats.fwr ? `${stats.fwr}%` : "0.0%";
    const tavg_r = Number(stats.tavg) || 0;
    const totalSeconds_r = Math.round(tavg_r * 60);
    const mm_r = String(Math.floor(totalSeconds_r / 60)).padStart(2, '0');
    const ss_r = String(totalSeconds_r % 60).padStart(2, '0');
    document.getElementById("ranked-tavg").textContent = `${mm_r}"${ss_r}"`;
    document.getElementById("ranked-b-in").textContent = stats.b_in || 0;
    document.getElementById("ranked-bf").textContent = stats.bf || 0;

    stats = stats_all.stats_social;
    document.getElementById("unranked-mp").textContent = stats.mp || 0;
    document.getElementById("unranked-mw").textContent = stats.mw || 0;
    document.getElementById("unranked-mp-percentage").textContent = stats.mwr ? `${stats.mwr}%` : "0.0%";
    document.getElementById("unranked-fp-value").textContent = stats.fp || 0;
    document.getElementById("unranked-fw-value").textContent = stats.fw || 0;
    document.getElementById("unranked-fp-percentage-value").textContent = stats.fwr ? `${stats.fwr}%` : "0.0%";
    const tavg = Number(stats.tavg) || 0;
    const totalSeconds = Math.round(tavg * 60);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    document.getElementById("unranked-tavg").textContent = `${mm}"${ss}"`;
    document.getElementById("unranked-b-in").textContent = stats.b_in || 0;
    document.getElementById("unranked-bf").textContent = stats.bf || 0;

    document.getElementById("ranked-percentage").textContent = stats_all.stats_ranked.fwr ? `${stats_all.stats_ranked.fwr}%` : "0.0%";
    document.getElementById("unranked-percentage").textContent = stats_all.stats_social.fwr ? `${stats_all.stats_social.fwr}%` : "0.0%";
}