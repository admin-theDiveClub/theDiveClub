var userProfile = null;

Start ();

async function Start ()
{
    var user = await GetUser();
    console.log("User:", user);
    if (user)
    {
        var player = await GetPlayer(user.email);
        console.log("Player:", player);
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
    console.log("Profile Pic:", profilePic);

    PopulateUserMatchesTable ();
}

async function GetUser ()
{
    var response = await supabase.auth.getSession();
    var session = response.data.session;
    if (session)
    {
        console.log("Session (Auth):", session);
        return session.user;
    } else 
    {
        var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
        if (session)
        {
            console.log("Session (Storage):", session);
            return session.user;
        }
    }

    return null;
}

async function GetPlayer (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    console.log("GetPlayer Response:", response);
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
    .from('tbl_matches_new')
    .select()
    .or(
        `players->home->>username.eq."${userProfile.username}",players->away->>username.eq."${userProfile.username}"`
    )
    .order('created_at', { ascending: false }); // or true for oldest first
  

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
        const getStatusPriority = (match) => {
            if (!match.time.start && match.time.end) return 0; // Complete
            if (!match.time || !match.time.start || !match.time.end) return 2; // New
            if (match.time.start && !match.time.end) return 1; // Active
            if (match.time.end) return 0; // Complete
            return -1; // Fallback
        };

        return getStatusPriority(b) - getStatusPriority(a);
    });

    const tableBody = document.querySelector(".card-component .table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        if (!match.time || !match.time.start) {
            const date = new Date(match.created_at || match.time.start);
            dateCell.textContent = isNaN(date) ? "N/A" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else {
            const date = new Date(match.created_at || match.time.start);
            dateCell.textContent = isNaN(date) ? "N/A" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        row.appendChild(dateCell);

        const opponentCell = document.createElement("td");
        let opponentUsername = match.players.home.username === userProfile.username ? match.players.away.username : match.players.home.username;

        if (opponentUsername && opponentUsername.includes("@")) 
        {
            const opponentResponse = await supabase.from('tbl_players').select('name, surname, nickname').eq('username', opponentUsername);
            const opponent = opponentResponse.data[0];
            if (opponent) {
                opponentCell.textContent = `${opponent.name || "N/A"} ${opponent.surname || "N/A"}`;
            } else {
                opponentCell.textContent = "N/A";
            }
            
        } else 
        {
            const pA = match.players.away;
            const pH = match.players.home;
            opponentUsername = pH.username === userProfile.username ? pA.username || pA.fullName || "N/A" : pH.username || pH.fullName || "N/A";
            opponentCell.textContent = opponentUsername;
        }
        row.appendChild(opponentCell);

        const scoreCell = document.createElement("td");
        if (userProfile.username === match.players.home.username) {
            if (match.results.home.frames === match.results.away.frames) {
            scoreCell.textContent = "Draw: " + match.results.home.frames + "-" + match.results.away.frames;
            } else {
            scoreCell.textContent = (match.results.home.frames > match.results.away.frames ? "Win: " : "Lose: ") + match.results.home.frames + "-" + match.results.away.frames;
            }
        } else if (userProfile.username === match.players.away.username) {
            if (match.results.away.frames === match.results.home.frames) {
            scoreCell.textContent = "Draw: " + match.results.away.frames + "-" + match.results.home.frames;
            } else {
            scoreCell.textContent = (match.results.away.frames > match.results.home.frames ? "Win: " : "Lose: ") + match.results.away.frames + "-" + match.results.home.frames;
            }
        } else {
            scoreCell.textContent = "N/A";
        }
        row.appendChild(scoreCell);

        const typeCell = document.createElement("td");
        const type = match.settings.winType || "To win";
        const winCondition = match.settings.winCondition || "N/A";
        typeCell.textContent = type + ": " + winCondition || "N/A";
        row.appendChild(typeCell);

        const durationCell = document.createElement("td");
        const totalSeconds = match.history["frames-duration"] ? match.history["frames-duration"].reduce((sum, duration) => sum + duration, 0) : "N/A";
        const totalDuration = totalSeconds !== "N/A" ? 
            `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s` : 
            "N/A";
        durationCell.textContent = totalDuration !== "N/A" ? `${totalDuration}` : "N/A";
        row.appendChild(durationCell);

        const statusCell = document.createElement("td");
        if (match.time && match.time.end) {
            statusCell.textContent = "Complete";
        } else if (match.time && match.time.start) {
            statusCell.textContent = "Active";
        } else {
            statusCell.textContent = "New";
        }
        row.appendChild(statusCell);

        const linkCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = `../matches/index.html?matchID=${match.id}`;
        const icon = document.createElement("i");
        icon.className = "bi bi-arrow-right"; // Bootstrap bi right arrow icon
        icon.style.fontSize = "3cap"; // Set the font size
        link.appendChild(icon);
        linkCell.appendChild(link);
        row.appendChild(linkCell);

        tableBody.appendChild(row);
    }
}
