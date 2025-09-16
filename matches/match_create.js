// Add an event listener for the 'click' event
document.getElementById('btn-match-create').addEventListener('click', () => 
{
    var match = 
    {
        players:
        {
            h: userProfile,
            a: {
                fullName: document.getElementById('player_A').value,
                username: document.getElementById('player_A').value
            }
        },
        info: 
        {
            status : "New"
        }
    }
    CreateMatch(match);
});

async function CreateMatch (_match)
{
    console.log('Creating match with players:', _match.players);
    const response = await supabase.from('tbl_matches').insert(
        {
            players: _match.players,
            info: _match.info
        }
    ).select();

    console.log(response.data[0].id);

    if (response.error) {
        console.error('Error creating match:', response.error.message);
        alert('Failed to create match. Please try again.');
    } else {
        alert('Match created successfully!');        
        sessionStorage.setItem('frameStartTime', 0);

        sessionStorage.removeItem('breakRadioSelection-H');
        sessionStorage.removeItem('breakRadioSelection-A');
        sessionStorage.removeItem('frameStartTime');
        sessionStorage.removeItem('frameStartTimes');
        localStorage.removeItem('breakRadioSelection-H');
        localStorage.removeItem('breakRadioSelection-A');
        localStorage.removeItem('frameStartTime');
        localStorage.removeItem('frameStartTimes');

        window.location.href = "../matches/index.html?matchID=" + response.data[0].id;
    }
}

// Add event listeners for the 'click' events of the account find buttons
document.getElementById('btn-account-find-H').addEventListener('click', async () => {
    const playerH = document.getElementById('player_H').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerH);

    const buttonH = document.getElementById('btn-account-find-H');
    if (response.data.length > 0) {
        buttonH.classList.remove('btn-primary', 'btn-warning');
        buttonH.classList.add('btn-success');
        buttonH.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
    } else {
        buttonH.classList.remove('btn-primary', 'btn-success');
        buttonH.classList.add('btn-warning');
        buttonH.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
    }
});

document.getElementById('btn-account-find-A').addEventListener('click', async () => {
    const playerA = document.getElementById('player_A').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerA);

    const buttonA = document.getElementById('btn-account-find-A');
    if (response.data.length > 0) {
        buttonA.classList.remove('btn-primary', 'btn-warning');
        buttonA.classList.add('btn-success');
        buttonA.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
    } else {
        buttonA.classList.remove('btn-primary', 'btn-success');
        buttonA.classList.add('btn-warning');
        buttonA.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
    }
});

// Add event listeners to undo button class changes when input values are modified
document.getElementById('player_H').addEventListener('input', () => {
    const buttonH = document.getElementById('btn-account-find-H');
    buttonH.classList.remove('btn-success', 'btn-warning');
    buttonH.classList.add('btn-primary');
    buttonH.innerHTML = '<i class="bi bi-search"></i> Find Account';
});

document.getElementById('player_A').addEventListener('input', () => {
    const buttonA = document.getElementById('btn-account-find-A');
    buttonA.classList.remove('btn-success', 'btn-warning');
    buttonA.classList.add('btn-primary');
    buttonA.innerHTML = '<i class="bi bi-search"></i> Find Account';
});

var userProfile = null;

Start();

async function Start() 
{
    var user = await GetUser();
    console.log("User:", user);
    if (user) {
        var player = await GetPlayer(user.email);
        console.log("Player:", player);
        if (player) {
            userProfile = player;
            PopulateUserUI();
        }
    }
}

function PopulateUserUI ()
{
    if (userProfile) {
        // Update the Player H nickname heading if available
        if (userProfile.nickname) {
            document.getElementById('player-H-nickname').textContent = userProfile.nickname;
        } else if (userProfile.name) {
            document.getElementById('player-H-nickname').textContent = userProfile.name;
        }
        // Update the username paragraph
        const usernameParagraphs = document.querySelectorAll('#player-H-username');
        if (usernameParagraphs.length > 0) {
            usernameParagraphs[0].textContent = `You are logged in as: ${userProfile.username}`;
        }
        // Optionally update the profile picture
        const imgElement = document.getElementById('player-H-pic');
        if (imgElement && userProfile.username) {
            GetPlayerProfilePic(userProfile.id);
        }

        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.transition = 'opacity 0.5s';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }
}

async function GetUser() {
    var response = await supabase.auth.getSession();
    var session = response.data.session;
    if (session) {
        console.log("Session (Auth):", session);
        return session.user;
    } else {
        var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
        if (session) {
            console.log("Session (Storage):", session);
            return session.user;
        }
    }
    
    alert('You must be logged in to create a match. Redirecting to home page.');
    window.location.href = "..";
    return null;
}

async function GetPlayer(_username) {
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    console.log("GetPlayer Response:", response);
    return response.data[0];
}

async function GetPlayerProfilePic(_username) 
{
    const r = await supabase.storage.from('bucket-profile-pics').getPublicUrl(_username);
    if (r.data && r.data.publicUrl) {
        const imgElement = document.getElementById('player-H-pic');
        if (imgElement) {
            imgElement.src = r.data.publicUrl;
        }
    }
}
