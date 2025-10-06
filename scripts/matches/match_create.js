import { SearchPlayers } from "../supabase/supaBase_db_helpers.js";

const searchBar = document.getElementById('input-search');
const searchResultsContainer = document.getElementById('search-results-container');
const searchResultsTable = document.getElementById('table-search-results');

searchBar.addEventListener('input', async (event) => {
    const searchTerm = event.target.value;

    if (searchTerm.length > 1) {
        const results = await SearchPlayers(searchTerm);
        displaySearchResults(results);
    } else {
        clearSearchResults();
    }
});

function displaySearchResults(results) 
{
    searchResultsContainer.style.display = results.length > 0 ? 'block' : 'none';
    searchResultsTable.innerHTML = '';

    results.forEach(player => 
    {
        const playerRow = document.createElement('tr');
        playerRow.classList.add('search-result');
        playerRow.innerHTML = `
            <td class="td-icon"><img src="${player.pp ? player.pp : '../resources/icons/icon_player.svg'}" alt="${player.name}" class="search-result-icon"></td>
            <td class="td-info">
                <p class="search-result-name">${player.nickname ? player.nickname : player.name} (${player.name ? player.name : ''} ${player.surname ? player.surname : ''})</p>
                <p class="search-result-username">${player.username}</p>
            </td>
        `;

        playerRow.addEventListener('click', () => {
            console.log("Selected player:", player);
            searchBar.value = player.username;
            clearSearchResults();
        });

        searchResultsTable.appendChild(playerRow);
    });
}

clearSearchResults();
function clearSearchResults() 
{
    searchResultsTable.innerHTML = '';
    searchResultsContainer.style.display = 'none';
}

searchBar.addEventListener('blur', () => 
{
    setTimeout(() => {
        clearSearchResults();
    }, 200);
});

document.getElementById('btn-create-match').addEventListener('click', () => 
{
    const opponentName = searchBar.value;
    if (opponentName) {
        // Call the function to create a match
        createMatch(opponentName);
    } else {
        alert('Please select an opponent.');
    }
});

async function createMatch(opponentName)
{
    const user = _user();
    const username = user.username ? user.username : null;
    if (!username)
    {
        alert('You must be logged in to create a match.');
        return;
    } else 
    {
        const players = {"h": {"username": username}, "a": {"username": opponentName}};
        const info = {"status": "new"};
        const settings = {"lagType": "alternate", "advancedBreaks": true, "winType":"race"};
        const time = {"start": new Date().toISOString()};
        const results = {"h": {"fw":0}, "a": {"fw":0}};
        const match = {"players": players, "info": info, "settings": settings, "time": time, "results": results};
        const response = await supabase.from('tbl_matches').insert(match).select().single();
        console.log("Create Match Response:", response);
        if (response.error)
        {
            alert('Error creating match: ' + response.error.message);
            return;
        } else 
        {  
            localStorage.removeItem('matchID');
            localStorage.removeItem('m_timingData');
            localStorage.removeItem('timingData');

            sessionStorage.removeItem('matchID');
            sessionStorage.removeItem('m_timingData');
            sessionStorage.removeItem('timingData');

            alert('Match created successfully!');
            window.location.href = `../matches/index.html?matchID=${response.data.id}`;
        }
    }
}

function _user ()
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    return userProfile ? userProfile : null;
}

Initialize ();

function Initialize ()
{
    const user = _user();
    if (user)
    {
        const displayName = user.nickname ? user.nickname : (user.name ? user.name : (user.username ? user.username : "?"));
        var message = "Welcome back, " + displayName;
        document.getElementById('user-welcome').innerText = message;

        const pp = user.pp ? user.pp : "../resources/icons/icon_player.svg";
        document.getElementById('user-profile-pic').src = pp;

        document.getElementById('component-loading-overlay').style.display = 'none';
    } else 
    {
        alert('Please Log In before creating a match. All matches can be found on your user profile later on.');
        window.location.href = "../index.html";
    }
}
