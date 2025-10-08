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
    if (!tournamentID || !tournament.id)
    {
        window.location.href = '/tournaments/index.html';
    }
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
    const response = await supabase.from('tbl_entries').select('name').eq('tournamentID', _tournamentID).order('createdAt', { ascending: true });
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
    //Tournament Details
    const tournamentDetailsDiv = document.getElementById('tournamentDetails');
    const table = document.createElement('table');
    for (const [key, value] of Object.entries(_tournament)) {
        if (value !== null && key !== 'id' && key !== 'coordinatorID') {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const row = document.createElement('tr');
            
            const keyCell = document.createElement('td');
            keyCell.textContent = formattedKey + ": ";
            keyCell.className = 'tournamentDetails';
            row.appendChild(keyCell);
            
            const valueCell = document.createElement('td');
            valueCell.textContent = value;
            row.appendChild(valueCell);
            valueCell.className = 'tournamentDetails';
            
            table.appendChild(row);
        }
    }
    tournamentDetailsDiv.appendChild(table);
    const coordinatorRow = document.createElement('tr');
    coordinatorRow.className = 'tournamentDetails';
    
    const coordinatorKeyCell = document.createElement('td');
    coordinatorKeyCell.textContent = 'Co-ordinator:';
    coordinatorKeyCell.className = 'tournamentDetails';
    coordinatorRow.appendChild(coordinatorKeyCell);
    
    const coordinatorValueCell = document.createElement('td');
    coordinatorValueCell.textContent = _coordinator;
    coordinatorValueCell.className = 'tournamentDetails';
    coordinatorRow.appendChild(coordinatorValueCell);
    
    table.appendChild(coordinatorRow);

    //Share Codes
    const shareLinkElement = document.getElementById('tournamentShareLink');
    shareLinkElement.textContent = `Share Link (Copy to clipboard): https://thediveclub.org/tournaments/entry.html?tournamentID=${_tournament.id}`;

    const shareCodeElement = document.getElementById('tournamentShareCode');
    shareCodeElement.textContent = `Share Code (Copy to clipboard): ${_tournament.id}`;

    // Copy the tournament ID to the clipboard
    shareLinkElement.addEventListener('click', () => {
        navigator.clipboard.writeText("https://thediveclub.org/tournaments/entry.html?tournamentID=" + _tournament.id).then(() => 
        {
            shareLinkElement.classList.remove('btn-dark');
            shareLinkElement.classList.add('btn-success');
            shareLinkElement.textContent = `Share Link (Copied to clipboard): https://thediveclub.org/tournaments/entry.html?tournamentID=${_tournament.id}`;

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

    //Entries
    const entriesDiv = document.getElementById('card_entries');
    entriesDiv.innerHTML = '';
    for (let i = 0; i < _entries.length; i++) 
    {
        if (i == _tournament.maxEntries)
        {
            const hrElement = document.createElement('hr');
            entriesDiv.appendChild(hrElement);
            const waitingListElement = document.createElement('p');
            waitingListElement.textContent = 'Waiting List:';
            entriesDiv.appendChild(waitingListElement);
        }

        const entryElement = document.createElement('div');
        entryElement.className = 'btn btn-dark btn-entry';
        entryElement.textContent = _entries[i].name;
        entriesDiv.appendChild(entryElement);
    }
}