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
                console.log("User Matches:", _matches);
                PopulateMatchesTable(_matches, 0);
            }
        }

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

        if (profile)
        {
            displayName = profile.nickname ? profile.nickname : (profile.name ? profile.name : displayName);
            pp = profile.pp ? profile.pp : null;
        } else 
        {
            displayName = opponent_un.split('@')[0];
        }

        var opponentProfile = {username: opponent_un, displayName: displayName, pp: pp};
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
            opponentResults: opponentResults
        };
        strippedMatches.push(strippedMatch);
    }

    if (strippedMatches.length > 0)
    {
        //Sort by createdAt desc
        strippedMatches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return strippedMatches;
    } else 
    {
        return null;
    }
}

const gid = (id) => document.getElementById(id);

function PopulateMatchesTable (matches, index)
{
    const e_table = gid("tbl-matches");
    const e_tbody = e_table.querySelector("tbody");
    e_tbody.innerHTML = "";

    const lowerIndex = index < matches.length ? index : matches.length - indexShift;

    gid("matches-pagination").textContent = `${lowerIndex + 1}-${(lowerIndex + indexShift) > matches.length ? matches.length : (lowerIndex + indexShift)} of ${matches.length}`;

    for (let i = lowerIndex; i < lowerIndex + indexShift; i++)
    {  
        if (i < 0 || i >= matches.length) continue;
        const m = matches[i];

        const tr = document.createElement("tr");
        tr.classList.add("match-row");
        const link = m.status === "Complete" ? 'scoreboard' : 'index';
        // Make the row act like a real link so users can middle-click / open in new tab / use context menu
        tr.style.position = "relative";
        const a = document.createElement("a");
        a.href = `/matches/${link}.html?matchID=${m.id}`;
        a.className = "match-row-link";
        // cover the whole row visually but keep semantics of a link
        a.style.cssText = "position:absolute;inset:0;z-index:1;text-decoration:none;color:inherit;";
        a.setAttribute("aria-label", `Open match ${m.id}`);
        tr.appendChild(a);
        e_tbody.appendChild(tr);

        const td_status = document.createElement("td");
        td_status.classList.add("match-status-bullet");

        var status = m.status;
        if (status != "Complete" && (m.userResults.fw > 0 || m.opponentResults.fw > 0))
        {
            status = "Live";
        }

        const color = (status === "Complete") ? "var(--color-primary-00)" : (status === "New") ? "var(--color-base-06)" : "var(--color-accent-0)"; 
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
        td_opponent_pp.appendChild(e_opponent_pp);
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
        e_results.textContent = `${m.opponentResults.fw} - ${m.userResults.fw}`;
        td_results.appendChild(e_results);
        tr.appendChild(td_results);
    }
}

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
   if (newIndexShift !== indexShift) {
       indexShift = newIndexShift;
       PopulateMatchesTable(_matches, index);
   }
});