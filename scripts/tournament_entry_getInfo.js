PopulateTournamentInfo();

async function PopulateTournamentInfo ()
{
    var tournamentID = getTournamentIDFromURL();
    var tournamentData = await getTournamentData(tournamentID);
    PopulateTournamentData(tournamentData);

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

    return response.data[0];
}

async function PopulateTournamentData (_data)
{
    document.getElementById('txt_T_name').textContent = _data.name;

    document.getElementById('txt_T_date').textContent = "Date: " + _data.date;
    document.getElementById('txt_T_time').textContent = "Time: " + _data.time;
    document.getElementById('txt_T_location').textContent = "Location: " +  _data.location;
    document.getElementById('txt_T_maxEntries').textContent = "Max Entries: " +  _data.maxEntries;
    document.getElementById('txt_T_format').textContent = "Format: " +  _data.format;

    const r_coordinatorProfile = await supabase.from('tbl_players').select('*').eq('id', _data.coordinatorID);
    var coordinatorProfile = r_coordinatorProfile.data[0];
    document.getElementById('txt_T_coordinatorName').textContent = "Coordinator Contact: " +  coordinatorProfile.name + " " + coordinatorProfile.surname + " (" + coordinatorProfile.contact + ")";

    document.getElementById('txt_T_description').textContent = "Description: " +  _data.description;    
    document.getElementById('txt_T_id').textContent = _data.id;
}

async function getTournamentEntries (_id)
{
    const response = await supabase.from('tbl_entries').select('*').eq('tournamentID', _id).order('created_at', { ascending: true });

    return response.data;
}

async function PopulateTournamentEntries (_data)
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

        var buttonLabel = (i + 1) + ": " + entry.name;
        if (entry.host)
        {
            var response_host = await supabase.from('tbl_players').select('name, surname').eq('id', entry.host);
            var hostName = response_host.data[0].name + " " + response_host.data[0].surname;
            buttonLabel += " (Host: " + hostName + ")";
        }
        button.textContent = buttonLabel;

        listItem.appendChild(button);
        entriesList.appendChild(listItem);
    }
}