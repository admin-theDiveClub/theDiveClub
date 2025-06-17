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
        .from('tbl_matches')
        .select('*')
        .or(`player_H.eq.${userProfile.username},player_A.eq.${userProfile.username}`)
        .order('startTime', { ascending: false });

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
    const tableBody = document.querySelector(".card-component .table tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const row = document.createElement("tr");

        const dateCell = document.createElement("td");
        if (!match.startTime) {
            dateCell.textContent = "-";
        } else {
            const date = new Date(match.startTime);
            dateCell.textContent = isNaN(date) ? "N/A" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        row.appendChild(dateCell);

        const opponentCell = document.createElement("td");
        let opponentUsername = match.player_H === userProfile.username ? match.player_A : match.player_H;

        if (opponentUsername && opponentUsername.includes("@")) 
        {
            const opponentResponse = await supabase.from('tbl_players').select('name, surname, nickname').eq('username', opponentUsername);
            const opponent = opponentResponse.data[0];
            console.log("Opponent Data:", opponent);
            if (opponent) {
                opponentCell.textContent = `${opponent.name || "N/A"} ${opponent.surname || "N/A"}`;
            } else {
                opponentCell.textContent = "N/A";
            }
            
        } else {
            opponentCell.textContent = opponentUsername || "N/A";
        }
        row.appendChild(opponentCell);

        const scoreCell = document.createElement("td");
        if (userProfile.username === match.player_H) {
            scoreCell.textContent = (match.result_H > match.result_A ? "Win: " : "Lose: ") + match.result_H + "-" + match.result_A;
        } else if (userProfile.username === match.player_A) {
            scoreCell.textContent = (match.result_A > match.result_H ? "Win: " : "Lose: ") + match.result_A + "-" + match.result_H;
        } else {
            scoreCell.textContent = "N/A";
        }
        row.appendChild(scoreCell);

        const linkCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = `../TopDeadCenter/scorecard.html?matchID=${match.id}`;
        const icon = document.createElement("i");
        icon.className = "bi bi-arrow-right"; // Bootstrap bi right arrow icon
        icon.style.fontSize = "3cap"; // Set the font size
        link.appendChild(icon);
        linkCell.appendChild(link);
        row.appendChild(linkCell);

        tableBody.appendChild(row);
    }
}

var knownOpponents = [];

async function UpdateOpponentNames ()
{

}
