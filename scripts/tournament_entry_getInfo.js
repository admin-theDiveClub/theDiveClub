//Get Tournament ID
//Get Tournament
//Get Entries
//Populate UI

Start();

async function Start ()
{
    var tournamentID = await GetTournamentID();
    console.log("Tournament ID:", tournamentID);
    var tournament = await GetTournament(tournamentID);
    console.log("Tournament:", tournament);
    var entries = await GetEntries(tournamentID);
    console.log("Entries:", entries);
    var tournamentCoordinator = await GetPlayerName(tournament.coordinatorID);
    console.log("Tournament Coordinator:", tournamentCoordinator);
    PopulateUI(tournament, tournamentCoordinator, entries);
}

async function GetTournamentID ()
{
    var tournamentID = new URLSearchParams(window.location.search).get('tournamentID');
    if (!tournamentID) 
    {
        tournamentID = localStorage.getItem('tournamentID')||sessionStorage.getItem('tournamentID');
    }
    if (tournamentID)
    {
        localStorage.setItem('tournamentID', tournamentID);
        sessionStorage.setItem('tournamentID', tournamentID);
        return tournamentID;
    } else 
    {
        return null;
    }
}

async function GetTournament (_tournamentID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _tournamentID);
    if (response.error)
    {
        return response.error.message;
    } else
    {
        return response.data[0];
    }
}

async function GetEntries (_tournamentID)
{
    const response = await supabase.from('tbl_entries').select('*').eq('tournamentID', _tournamentID);
    if (response.error)
    {
        return response.error.message;
    } else
    {
        return response.data;
    }
}

async function GetPlayerName (_playerID)
{
    const response = await supabase.from('tbl_players').select('name, surname').eq('id', _playerID);
    if (response.error)
    {
        return response.error.message;
    } else
    {
        return response.data[0].name + " " + response.data[0].surname;
    }
}

function PopulateUI (_tournament, _coordinator, _entries)
{
    const tournamentDetailsDiv = document.getElementById('tournamentDetails');
    for (const [key, value] of Object.entries(_tournament)) {
        if (value !== null && key !== 'id' && key !== 'coordinatorID') {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const textElement = document.createElement('p');
            textElement.textContent = `${formattedKey}: ${value}`;
            tournamentDetailsDiv.appendChild(textElement);
        }
    }
    const coordinatorElement = document.createElement('p');
    coordinatorElement.textContent = `Co-ordinator: ${_coordinator}`;
    tournamentDetailsDiv.appendChild(coordinatorElement);

    // Populate tournamentShareCode with _tournament.id
    const shareLinkElement = document.getElementById('tournamentShareLink');
    shareLinkElement.textContent = `Share Link (Copy to clipboard): https://thediveclub.org/tournaments/entry.html?tournamentID=${_tournament.id}`;

    const shareCodeElement = document.getElementById('tournamentShareCode');
    shareCodeElement.textContent = `Share Link (Copy to clipboard): ${_tournament.id}`;

    // Copy the tournament ID to the clipboard
    shareLinkElement.addEventListener('click', () => {
        navigator.clipboard.writeText("https://thediveclub.org/tournaments/entry.html?tournamentID=" + _tournament.id).then(() => 
        {
            shareLinkElement.classList.remove('btn-dark');
            shareLinkElement.classList.add('btn-success');
            shareLinkElement.textContent = `Share Code (Copied to clipboard): https://thediveclub.org/tournaments/entry.html?tournamentID=${_tournament.id}`;

            shareCodeElement.classList.remove('btn-success');
            shareCodeElement.classList.add('btn-dark');
        });
    });    

    // Copy the tournament ID to the clipboard
    shareCodeElement.addEventListener('click', () => {
        navigator.clipboard.writeText(_tournament.id).then(() => 
        {
            shareCodeElement.classList.remove('btn-dark');
            shareCodeElement.classList.add('btn-success');
            shareCodeElement.textContent = `Share Code (Copied to clipboard): ${_tournament.id}`;

            shareLinkElement.classList.remove('btn-success');
            shareLinkElement.classList.add('btn-dark');
        });
    });
}