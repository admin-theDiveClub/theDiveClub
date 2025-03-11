document.getElementById('btn_submitEntry').addEventListener('click', () => 
{
    const credentials = 
    { 
        tournamentID: localStorage.getItem('tournamentID'),
        email: localStorage.getItem('username'), 
    };

    var response = SubmitEntry(credentials);
});
//adjust for anon entry

Start ();

async function Start ()
{
    var tournamentID = getTournamentIDFromURL();
    var tournamentData = await getTournamentData(tournamentID);
    PopulateTournamentData(tournamentData[0]);
    
    var tournamentEntries = await getTournamentEntries(tournamentID);
    PopulateTournamentEntries(tournamentEntries);
}



function getTournamentIDFromURL ()
{
    const urlParams = new URLSearchParams(window.location.search);
    var tournamentID = urlParams.get('tournamentID');
    if (tournamentID)
    {
        localStorage.setItem('tournamentID', tournamentID);
    } else if (localStorage.getItem('tournamentID'))
    {
        tournamentID = localStorage.getItem('tournamentID');
    }

    return tournamentID;
}

async function getTournamentData (_id)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _id);

    return response.data;
}

async function PopulateTournamentData (_data)
{
    document.getElementById('txt_T_name').textContent = _data.name;

    document.getElementById('txt_T_date').textContent = "Date: " + _data.date;
    document.getElementById('txt_T_time').textContent = "Time: " + _data.time;
    document.getElementById('txt_T_location').textContent = "Location: " +  _data.location;
    document.getElementById('txt_T_maxEntries').textContent = "Max Entries: " +  _data.maxEntries;
    document.getElementById('txt_T_format').textContent = "Format: " +  _data.format;

    var coordinatorName = await getCoordinatorName(_data.coordinatorID);
    document.getElementById('txt_T_coordinatorName').textContent = "Coordinator Contact: " +  coordinatorName;

    document.getElementById('txt_T_description').textContent = "Description: " +  _data.description;    
    document.getElementById('txt_T_id').textContent = _data.id;
}

async function getCoordinatorName (_playerId)
{
    const response = await supabase.from('tbl_players').select('*').eq('id', _playerId);
    var playerName = response.data[0].name + " " + response.data[0].surname + " (" + response.data[0].contact + ")";
    return playerName;
}

async function SubmitEntry (_credentials)
{
    const response = await supabase.from('tbl_entries').insert(_credentials).select();
    if (response.error) 
    {
        console.error('Error inserting new entry:', response.error);
        return null;
    } else 
    {
        console.log('New entry created', response.data);
        return response
    }
}

async function getTournamentEntries (_id)
{
    const response = await supabase.from('tbl_entries').select('*').eq('tournamentID', _id);

    return response.data;
}

function PopulateTournamentEntries (_data)
{
    var entriesList = document.getElementById('list_existingEntries');
    entriesList.innerHTML = '';
    for (var i = 0; i < _data.length; i++)
    {
        var entry = _data[i];
        var listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.id = 'li_entry_' + i;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.textContent = (i + 1) + ": " + entry.email;

        listItem.appendChild(button);
        entriesList.appendChild(listItem);
    }
}