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