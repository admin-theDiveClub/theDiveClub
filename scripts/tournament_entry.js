Start ();

async function Start ()
{
    if (localStorage.getItem('username') && localStorage.getItem('tournamentID'))
    {
        document.getElementById('card_signIn_email').remove();
        document.getElementById('card_signIn_google').remove();
        document.getElementById('card_entry_anonymous').remove();
        //Add in a new card for host submition
    }

    var tournamentID = getTournamentIDFromURL();
    var tournamentData = await getTournamentData(tournamentID);
    PopulateTournamentData(tournamentData[0]);
    
    var tournamentEntries = await getTournamentEntries(tournamentID);
    PopulateTournamentEntries(tournamentEntries);
}

document.getElementById('btn_submitEntry').addEventListener('click', () => 
{
    EnterTournament();
});

async function EnterTournament ()
{
    //Credentials are fetched based on login status
    if (await inputsValid())
    {
        SubmitEntry();
    } else 
    {
        document.getElementById('txt_T_entry_response').textContent = 'Error: Please login or fill in all fields before submitting.';
    }
}

async function inputsValid ()
{
    var username = localStorage.getItem('username');
    var userProfile = await getUserProfile(username);
    if (username && userProfile)
    {
        return true;
    } else 
    {
        if (document.getElementById('inp_T_entry_email').value == '' ||
            document.getElementById('inp_T_entry_name').value == '' ||
            document.getElementById('inp_T_entry_contact').value == '')
        {
            return false;
        } else
        {
            return true;
        }
    }
}

async function duplicateSubmition (_credentials)
{
    //Check if the email already exists in the entries list
    var duplicate = false;
    var entries = null;

    //Get Entries
    const response_Entries = await supabase.from('tbl_entries').select('email').eq('tournamentID', _credentials.tournamentID);
    if (response_Entries.error)
    {
        console.error('Error fetching entries:', response_Entries.error);
    } else 
    {
        entries = response_Entries.data;
        for (var i = 0; i < entries.length; i++)
        {
            if ((entries[i].email == _credentials.email) && (entries[i].name == _credentials.name))
            {
                duplicate = true;
                break;
            }
        }
    }    

    return duplicate;
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

    const coordinatorUsernameResponse = await supabase.from('tbl_players').select('username').eq('id', _data.coordinatorID);
    var cUsername = coordinatorUsernameResponse.data[0].username;
    var cP = await getUserProfile(cUsername);
    document.getElementById('txt_T_coordinatorName').textContent = "Coordinator Contact: " +  cP.name + " " + cP.surname + " (" + cP.contact + ")";

    document.getElementById('txt_T_description').textContent = "Description: " +  _data.description;    
    document.getElementById('txt_T_id').textContent = _data.id;
}

async function SubmitEntry ()
{
    var credentials;

    var username = localStorage.getItem('username');
    var userProfile = await getUserProfile(username);

    if (username && userProfile)
    { 
        credentials =
        { 
            tournamentID: localStorage.getItem('tournamentID'),
            playerID: userProfile.id,
            email: userProfile.username,
            name: userProfile.name + " " + userProfile.surname + " ('" + userProfile.nickname + "')",
            contact: userProfile.contact 
        }; 
    } else 
    {
        credentials =
        { 
            tournamentID: localStorage.getItem('tournamentID'),
            email: document.getElementById('inp_T_entry_email').value,
            name: document.getElementById('inp_T_entry_name').value,
            contact: document.getElementById('inp_T_entry_contact').value 
        };

        var uP = await getUserProfile(document.getElementById('inp_T_entry_email').value);

        
        if (uP.id)
        {
            if (uP.username == credentials.email)
            {
                credentials.playerID = uP.id;
                credentials.name += "->" + uP.name + " " + uP.surname + " ('" + uP.nickname + "')";
            } else 
            {
                credentials.host = uP.id;
            }
        }
    }

    var duplicate = await duplicateSubmition(credentials);

    if (duplicate)
    {
        document.getElementById('txt_T_entry_response').textContent = 'Error: You are already signed up with this email address.';
        return null;
    } else 
    {
        const response = await supabase.from('tbl_entries').insert(credentials).select();

        if (response.error) 
        {
            document.getElementById('txt_T_entry_response').textContent = 'Error inserting new entry: ' + response.error.message;
            return null;
        } else 
        {
            console.log('New entry created', response.data);

            var output = "Entry submitted under: " + response.data[0].email + ". Please quote this email address for future reference.";
            
            if (userProfile)
            {
                output += " Player Profile Found: " + userProfile.name + " " + userProfile.surname + " ('" + userProfile.nickname + "')";
            }
            document.getElementById('txt_T_entry_response').textContent = output;
            //window.location.reload();
            return response
        }
    }    
}

async function getUserProfile (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    var userProfile = null;

    if (response && !response.error)
    {
        userProfile = response.data[0];
    }

    return userProfile;
}

async function getTournamentEntries (_id)
{
    const response = await supabase.from('tbl_entries').select('*').eq('tournamentID', _id).order('created_at', { ascending: true });

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