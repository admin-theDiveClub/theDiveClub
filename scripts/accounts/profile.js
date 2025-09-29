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
            }
            document.getElementById("component-loading-overlay").style.display = "none";
        }
    } else
    {
        window.location.href = "../index.html";
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
        e_tr.appendChild(e_td_league);
        e_tr.appendChild(e_td_tournament);
        e_tr.appendChild(e_td_result);
        e_tr.appendChild(e_td_link);

        e_tbody.appendChild(e_tr);
    }
}

async function GetDisplayName (username)
{
    if (username.includes("@"))
    {
        const response = await supabase.from('tbl_players').select('name,nickname').eq('username', username).single();

        if (response.data)
        {
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