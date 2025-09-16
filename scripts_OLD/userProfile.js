var userProfile = null;

document.addEventListener('sessionRestored', Start_UP());

async function Start_UP ()
{
    var user = await GetUser();
    if (user)
    {
        var player = await GetPlayer(user.email);
        if (player)
        {
            userProfile = player;
        }
    }

    if (userProfile)
    {
        PopulateUserInfoUI();
    } else 
    {
        console.log("No user profile found.");
        window.location.href = "../accounts/login.html";
    }

    var profilePic = await GetPlayerProfilePic(userProfile.id);

    PopulateUserMatchesTable ();

    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.transition = 'opacity 0.5s';
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    }
}

async function GetUser ()
{
    var response = await supabase.auth.getSession();
    var session = response.data.session;
    if (session)
    {
        return session.user;
    } else 
    {
        var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
        if (session)
        {
            return session.user;
        }
    }

    return null;
}

async function GetPlayer (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    return response.data[0];
}

async function GetPlayerProfilePic (_username)
{
    const r = await supabase.storage.from('bucket-profile-pics').getPublicUrl(_username);
    if (r.data && r.data.publicUrl) 
    {
        const imgElement = document.querySelector('.profile-pic');
        if (imgElement) 
        {
            imgElement.src = r.data.publicUrl;
        }
    }
}

function PopulateUserInfoUI ()
{
    document.getElementById("profile-nickname").textContent = userProfile.nickname || "N/A";
    document.getElementById("profile-name").textContent = userProfile.name + " " + userProfile.surname || "N/A";
    document.getElementById("profile-username").textContent = userProfile.username || "N/A";
    document.getElementById("profile-contact").textContent = userProfile.contact || "N/A";
    document.getElementById("profile-playerID").textContent = userProfile.id || "N/A";
}

async function GetUserMatches() {
    if (!userProfile || !userProfile.username) {
        console.log("User profile or username is not available.");
        return [];
    }    

    const response = await supabase
    .from('tbl_matches')
    .select()
    .or(
        `players->h->>username.eq."${userProfile.username}",players->a->>username.eq."${userProfile.username}"`
    )
    .order('createdAt', { ascending: false }); // or true for oldest first
  

    if (response.error) {
        console.error("Error fetching matches:", response.error);
        return [];
    }

    console.log("User Matches:", response.data);
    return response.data;
}

async function PopulateUserMatchesTable() 
{
    const matches = await GetUserMatches();

    matches.sort((a, b) => {
        const getStatusPriority = (match) => 
        {
            if (!match.time) return 2; // New
            if (!match.time.start && match.time.end) return 0; // Complete
            if (!match.time || !match.time.start || !match.time.end) return 2; // New
            if (match.time.start && !match.time.end) return 1; // Active
            if (match.time.end) return 0; // Complete
            return -1; // Fallback
        };

        return getStatusPriority(b) - getStatusPriority(a);
    });

    const tableBody = document.getElementById('tbl-match-history');
    tableBody.innerHTML = ""; // Clear existing rows

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        if (!match.time || !match.time.start) {
            const date = new Date(match.createdAt || match.time.start);
            dateCell.textContent = isNaN(date) ? "N/A" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else {
            const date = new Date(match.createdAt || match.time.start);
            dateCell.textContent = isNaN(date) ? "N/A" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        row.appendChild(dateCell);

        const opponentCell = document.createElement("td");
        let opponent = match.players.h.username === userProfile.username ? match.players.a : match.players.h;
        let opponentUsername = opponent.username || opponent.fullName || "N/A";

        if (opponentUsername && opponentUsername.includes("@")) 
        {
            const opponentResponse = await supabase.from('tbl_players').select('name, surname, nickname').eq('username', opponentUsername);
            if (opponentResponse.data[0])
            {                
                opponent = opponentResponse.data[0];
                opponentCell.textContent = `${opponent.name || "N/A"} ${opponent.surname || "N/A"}`;
            } else 
            {
                opponentCell.textContent = opponent.username ? opponent.username : opponent.fullName || "N/A";
            }
            
        } else 
        {
            const pA = match.players.a;
            const pH = match.players.h;
            opponentUsername = pH.username === userProfile.username ? pA.username || pA.fullName || "N/A" : pH.username || pH.fullName || "N/A";
            opponentCell.textContent = opponentUsername;
        }
        row.appendChild(opponentCell);

        const compCell = document.createElement("td");
        var comp = "-";
        if (match.competitions)
        {
            if (match.competitions.leagueID)
            {
                const r = await supabase.from('tbl_leagues').select('name').eq('id', match.competitions.leagueID);
                comp = r.data[0].name;
            } else if (match.competitions.tournamentID)
            {
                const r = await supabase.from('tbl_tournaments').select('name').eq('id', match.competitions.tournamentID);
                comp = r.data[0].name;
            }
        }
        compCell.textContent = comp;
        row.appendChild(compCell);

        const scoreCell = document.createElement("td");
        if (!match.results || !match.results.h || !match.results.a)
        {
            scoreCell.textContent = "N/A";
        } else 
        {
            if (userProfile.username === match.players.h.username) 
            {
                if (match.results.h.fw === match.results.a.fw) {
                scoreCell.textContent = "Draw: " + match.results.h.fw + "-" + match.results.a.fw;
                } else {
                scoreCell.textContent = (match.results.h.fw > match.results.a.fw ? "Win: " : "Lose: ") + match.results.h.fw + "-" + match.results.a.fw;
                }
            } else if (userProfile.username === match.players.a.username) 
            {
                if (match.results.a.fw === match.results.h.fw) {
                scoreCell.textContent = "Draw: " + match.results.a.fw + "-" + match.results.h.fw;
                } else {
                scoreCell.textContent = (match.results.a.fw > match.results.h.fw ? "Win: " : "Lose: ") + match.results.a.fw + "-" + match.results.h.fw;
                }
            } else 
            {
                scoreCell.textContent = "N/A";
            }
        }        
        row.appendChild(scoreCell);

        const typeCell = document.createElement("td");
        const type = match.settings && match.settings.winType ? match.settings.winType : "";
        const winCondition = match.settings && match.settings.winCondition ? match.settings.winCondition : "";
        typeCell.textContent = type + " " + winCondition;
        row.appendChild(typeCell);

        const durationCell = document.createElement("td");
        let totalSeconds = "N/A";
        if (Array.isArray(match.history) && match.history.length > 0) {
            // If history is an array of frame objects with a "duration" property
            totalSeconds = match.history.reduce((sum, frame) => {
            if (typeof frame === "object" && frame !== null && typeof frame.duration === "number") {
                return sum + frame.duration;
            }
            return sum;
            }, 0);
        }
        const totalDuration = totalSeconds !== "N/A" ? 
            `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s` : 
            "N/A";
        durationCell.textContent = totalDuration !== "N/A" ? `${totalDuration}` : "N/A";
        row.appendChild(durationCell);


        const statusCell = document.createElement("td");
        const status = match.info.status || "New";
        statusCell.textContent = status;
        row.appendChild(statusCell);

        const linkCell = document.createElement("td");
        const link = document.createElement("a");
        if (status === "Complete")
        {
            link.href = `../matches/scoreboard.html?matchID=${match.id}`;
        } else 
        {
            link.href = `../matches/index.html?matchID=${match.id}`;
        }
        const icon = document.createElement("i");
        icon.className = "bi bi-arrow-right"; // Bootstrap bi right arrow icon
        icon.style.fontSize = "3cap"; // Set the font size
        link.appendChild(icon);
        linkCell.appendChild(link);
        row.appendChild(linkCell);

        tableBody.appendChild(row);
    }
}
