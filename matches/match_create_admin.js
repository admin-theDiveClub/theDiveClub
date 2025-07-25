// Add an event listener for the 'click' event
document.getElementById('btn-match-create').addEventListener('click', () => 
{
    if (player_H_exists && player_A_exists && selectedLeagueID && selectedRoundID) 
    {
        var match = 
        {
            players:
            {
                h: {
                    fullName: document.getElementById('player_H').value,
                    username: document.getElementById('player_H').value
                },
                a: {
                    fullName: document.getElementById('player_A').value,
                    username: document.getElementById('player_A').value
                }
            },
            info: 
            {
                status : "New"
            },
            competitions:
            {
                leagueID: selectedLeagueID,
                tournamentID: selectedRoundID
            }
        }
        console.log('Match object:', match);
        CreateMatch(match);
    } else 
    {
        alert('Please ensure you have selected a league and that both players are part of the league before creating a match.');
    }
    
});

var player_H_exists = false;
var player_A_exists = false;

async function CreateMatch (_match)
{
    console.log('Creating match with players:', _match.players);
    const response = await supabase.from('tbl_matches').insert(_match).select();

    console.log(response.data[0].id);

    if (response.error) {
        console.error('Error creating match:', response.error.message);
        alert('Failed to create match. Please try again.');
    } else {
        alert('Match created successfully!');
        ClearStorage();
        window.location.href = "../matches/index.html?matchID=" + response.data[0].id;
    }
}

function ClearStorage ()
{            
    sessionStorage.setItem('frameStartTime', 0);

    sessionStorage.removeItem('breakRadioSelection-H');
    sessionStorage.removeItem('breakRadioSelection-A');
    sessionStorage.removeItem('frameStartTime');
    sessionStorage.removeItem('frameStartTimes');
    localStorage.removeItem('breakRadioSelection-H');
    localStorage.removeItem('breakRadioSelection-A');
    localStorage.removeItem('frameStartTime');
    localStorage.removeItem('frameStartTimes');
}

// Add event listeners for the 'click' events of the account find buttons
document.getElementById('btn-account-find-H').addEventListener('click', async () => {
    const playerH = document.getElementById('player_H').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerH);

    const player = response.data[0];
    const leagueID = selectedLeagueID;
    var playerExists = false;
    if (player) 
    {
        const response_LeaguePlayers = await supabase.from('tbl_leagues').select('players').eq('id', leagueID);
        const leaguePlayers = response_LeaguePlayers.data[0].players;
        playerExists = leaguePlayers && leaguePlayers.includes(player.username);
        console.log("Player is part of league:", playerExists);
    }

    const buttonH = document.getElementById('btn-account-find-H');
    if (player && playerExists) {
        buttonH.classList.remove('btn-primary', 'btn-warning');
        buttonH.classList.add('btn-success');
        buttonH.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
        player_H_exists = true;
    } else {
        buttonH.classList.remove('btn-primary', 'btn-success');
        buttonH.classList.add('btn-warning');
        buttonH.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
        player_H_exists = false;
    }
});

document.getElementById('btn-account-find-A').addEventListener('click', async () => {
    const playerA = document.getElementById('player_A').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerA);

    const player = response.data[0];
    const leagueID = selectedLeagueID;
    var playerExists = false;
    if (player) 
    {
        const response_LeaguePlayers = await supabase.from('tbl_leagues').select('players').eq('id', leagueID);
        const leaguePlayers = response_LeaguePlayers.data[0].players;
        playerExists = leaguePlayers && leaguePlayers.includes(player.username);
        console.log("Player is part of league:", playerExists);
    }

    const buttonA = document.getElementById('btn-account-find-A');
    if (player && playerExists) {
        buttonA.classList.remove('btn-primary', 'btn-warning');
        buttonA.classList.add('btn-success');
        buttonA.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
        player_A_exists = true;
    } else {
        buttonA.classList.remove('btn-primary', 'btn-success');
        buttonA.classList.add('btn-warning');
        buttonA.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
        player_A_exists = false;
    }
});

// Add event listeners to undo button class changes when input values are modified
document.getElementById('player_H').addEventListener('input', () => {
    const buttonH = document.getElementById('btn-account-find-H');
    buttonH.classList.remove('btn-success', 'btn-warning');
    buttonH.classList.add('btn-primary');
    buttonH.innerHTML = '<i class="bi bi-search"></i> Find Account';
    player_H_exists = false; // Reset existence flag
});

document.getElementById('player_A').addEventListener('input', () => {
    const buttonA = document.getElementById('btn-account-find-A');
    buttonA.classList.remove('btn-success', 'btn-warning');
    buttonA.classList.add('btn-primary');
    buttonA.innerHTML = '<i class="bi bi-search"></i> Find Account';
    player_A_exists = false; // Reset existence flag
});

var userProfile = null;
var leaguePlayers = null;

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

        // Populate the admin leagues if the user is a coordinator
        if (userProfile.id)
        {
            PopulateAdminLeagues(userProfile.id);
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
    
    window.location.href = "../accounts/login.html";
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

var selectedLeagueID = null;
async function PopulateAdminLeagues (coordinatorID)
{
    const response = await supabase.from('tbl_leagues').select('*').eq('coordinatorID', coordinatorID);
    console.log("Admin Leagues Response:", response.data);
    const admin_leagues = response.data;

    const container = document.querySelector('#admin-leagues .d-flex');
    container.innerHTML = '';
    admin_leagues.forEach((league, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-info';
        btn.id = `league-${idx}`;
        btn.textContent = league.name;
        btn.addEventListener('click', () => {
            selectedLeagueID = league.id;
            console.log('Selected league:', league);
            PopulateLeagueRounds(selectedLeagueID);
            ResetLeagueSelection();
            btn.classList.remove('btn-info');
            btn.classList.add('btn-success');
            // Unhide the admin-rounds element when a league is selected
            const adminRounds = document.getElementById('admin-rounds');
            adminRounds.style.display = 'block';
        });
        container.appendChild(btn);
    });
}

var selectedRoundID = null;
async function PopulateLeagueRounds (leagueID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('leagueID', leagueID);
    console.log("League Rounds Response:", response.data);
    const leagueRounds = response.data;
    const container = document.querySelector('#admin-rounds .d-flex');
    container.innerHTML = '';
    leagueRounds.forEach((round, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-warning';
        btn.id = `round-${idx}`;
        btn.textContent = round.name || round.date || `Round ${idx + 1}`;
        // Optionally, add a click handler for each round button
        btn.addEventListener('click', () => {
            // Handle round button click here   
            console.log('Selected round:', round);
            selectedRoundID = round.id;
            ResetRoundSelection();
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
        });
        container.appendChild(btn);
    });
}

function ResetLeagueSelection ()
{
    const leagueButtons = document.querySelectorAll('[id^="league-"]');
    leagueButtons.forEach(btn => {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-info');
    });
}

function ResetRoundSelection ()
{
    const roundButtons = document.querySelectorAll('[id^="round-"]');
    roundButtons.forEach(btn => {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-warning');
    });
}
