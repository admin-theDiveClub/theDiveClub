/*
On Start:
    - Populate Tournament Data
        - Get the tournament ID from the URL & store in local storage
        - Get the tournament data from the database
        - Display the tournament data

    - Populate Entries
        - Get the entries from the DB
        - Create Buttons in lg_entries with with event: onclick, approveEntry(_entryID)
    - approveEntry(_entryID)
        - Move entry to approvedPlayers

    - Populate Approved Entries
        - Get the approved entries from the database
        - Create Buttons in lg_approvedEntries with with event: onclick, unapproveEntry(_entryIDs)
    - unapproveEntry(_entryID)
        - Mark entry as not approved in DB

    - approveAllEntries()
        - Mark all approved entries as approved in DB

    - Update UI
        - Update the UI with the new data    
*/

var tournamentID;
var tournamentData;
var entries;

Start();

async function Start ()
{
    tournamentID = GetTournamentID();
    tournamentData = await GetTournamentData(tournamentID);
    UpdateUI_TournamentData(tournamentData);
    
    entries = await GetEntries(tournamentID);
    UpdateUI_Entries(entries);
}

function GetTournamentID ()
{
    var url = new URL(window.location.href);
    tournamentID = url.searchParams.get("tournamentID");
    if (tournamentID)
    {
        localStorage.setItem("tournamentID", tournamentID);
        return tournamentID;
    } else 
    {
        tournamentID = localStorage.getItem("tournamentID");        
        if (tournamentID)
        {
            return tournamentID;
        } else 
        {
            return null;
        }
    }
}

async function GetTournamentData(_id)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _id);
    if (response.error)
    {
        console.error(response.error);
        return null;
    } else 
    {
        return response.data[0];
    }
}

async function GetPlayerName(_id)
{
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(_id)) {
        return null;
    }
    const response = await supabase.from('tbl_players').select('name, surname').eq('id', _id);
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0].name + " " + response.data[0].surname;
    }
}

async function UpdateUI_TournamentData (_data)
{
    //Tournament Data
    var coordinatorName = await GetPlayerName(_data.coordinatorID);

    var tournamentDataOutput = "";
    for (const property in _data) 
    {
        if (Object.prototype.hasOwnProperty.call(_data, property)) 
        {
            if (_data[property] != null)
            {
                var propertyName = property.charAt(0).toUpperCase() + property.slice(1);
                if (property == "coordinatorID")
                {
                    tournamentDataOutput += propertyName + ": " + coordinatorName + "\n";
                } else if (property == "id")
                {
                    tournamentDataOutput += "https://thediveclub.org/tournaments/follow.html?tournamentID=" + _data[property] + "\n";
                } else 
                {
                    tournamentDataOutput += property.charAt(0).toUpperCase() + property.slice(1) + ": " + _data[property] + "\n";
                }
            }
        }
    }

    document.getElementById('txt_tournamentData').innerText = tournamentDataOutput; 
}

async function GetEntries (_tournamentID)
{
    const response = await supabase.from('tbl_entries').select('*').eq('tournamentID', _tournamentID).order('created_at', { ascending: true });
    if (response.error)
    {
        console.error(response.error);
        return null;
    } else 
    {
        return response.data;
    }
}

async function UpdateApproval (_entryID)
{
    for (var i = 0; i < entries.length; i++)
    {
        if (entries[i].id == _entryID)
        {
            entries[i].approved = !entries[i].approved;
            var response = await supabase.from('tbl_entries').update({approved: entries[i].approved}).eq('id', entries[i].id).select();
            break;
        }
    }
    UpdateUI_Entries(entries);
}

async function UpdateUI_Entries (_entries)
{
    var lg_entries = document.getElementById('lg_entries');
    var card_approvedEntries = document.getElementById('card_approvedEntries');
    lg_entries.innerHTML = '';
    card_approvedEntries.innerHTML = '';

    for (let i = 0; i < _entries.length; i++)
    {
        var li = document.createElement('li');
        li.className = 'list-group-item';
        var button = document.createElement('button');
        button.innerText = _entries[i].name;        
        button.draggable = true; // Add draggable property
        button.onclick = async function() 
        { 
            await UpdateApproval(_entries[i].id); 
        };

        if (_entries[i].approved)
        {
            button.className = 'btn btn-danger';
            card_approvedEntries.appendChild(button);
        } else 
        {
            button.className = 'btn btn-secondary';
            li.appendChild(button);
            lg_entries.appendChild(li);
        }
    }  
}

async function AddEntry (_tournamentID, _name)
{
    const response = await supabase.from('tbl_entries').insert([{tournamentID: _tournamentID, name: _name}]);
    if (response.error)
    {
        console.error(response.error);
        return null;
    } else 
    {
        return response.data;
    }
}

document.getElementById('btn_addEntry').onclick = async function() 
{
    var entryName = document.getElementById('txt_entryName').value;
    if (entryName) {
        await AddEntry(tournamentID, entryName);
        entries = await GetEntries(tournamentID);
        UpdateUI_Entries(entries);
    }
};

document.addEventListener('DOMContentLoaded', (event) => {
    // Example elements to connect
    const element1 = document.querySelector('.container_tournamentMatch:nth-child(1)');
    const element2 = document.querySelector('.container_tournamentMatch:nth-child(2)');
    const element3 = document.querySelector('.container_tournamentMatch:nth-child(3)');

    // Create lines between elements
    new LeaderLine(element1, element2, {
        color: 'blue',
        size: 4,
        path: 'fluid',
        startPlug: 'behind',
        endPlug: 'arrow3',
        startSocket: 'bottom',
        endSocket: 'top'
    });

    new LeaderLine(element2, element3, {
        color: 'green',
        size: 4,
        path: 'fluid',
        startPlug: 'behind',
        endPlug: 'arrow3',
        startSocket: 'bottom',
        endSocket: 'top'
    });
});

/*
Start: Final = n = 1
Semifinal: n = 2
Quarterfinal: n^2 = 4
Round of 16: n^3 = 8
Round of 32: n^4 = 16
Round of 64: n^5 = 32

CreateFinalmatch ();
var tournamentRounds = 1;

CreateLeadingMatches (_existingMatch, _upDown)
{
    
}

*/