document.getElementById('btn_submitPersonalEntry').addEventListener('click', () => 
{
    SubmitPersonalEntry();
});

document.getElementById('btn_submitHostEntry').addEventListener('click', () =>
{   
    SubmitHostEntry();
});

var credentials = 
{
    tournamentID: localStorage.getItem('tournamentID'),
    playerID: null,
    email: null,
    name: null,
    contact: null,
    host: null
};

//Submittion: User Logged In, Self Submition
async function SubmitPersonalEntry ()
{
    var username = localStorage.getItem('username');
    var userProfile = await GetUserProfile(username);

    if (userProfile)
    {
        credentials.playerID = userProfile.id;
        credentials.email = userProfile.username;
        credentials.name = userProfile.name + " " + userProfile.surname;
        credentials.contact = userProfile.contact;

        var submittionResponse = await PushEntryToDatabase(credentials);
        console.log(submittionResponse);
    } else 
    {
        console.error('Error: User not logged in.');
    } 
}

async function SubmitHostEntry ()
{
    var hostProfile;
    if (localStorage.getItem('username'))
    {
        hostProfile = await GetUserProfile(localStorage.getItem('username'));
    } else 
    {
        hostProfile = await GetUserProfile(document.getElementById('inp_T_entry_host').value);
    }

    if (hostProfile == null)
    {
        document.getElementById('txt_T_entry_host_response').textContent = "Error: Host profile not found.";
        console.log("Error: Host profile not found.");
    } else 
    {
        credentials.host = hostProfile.id;
        credentials.email = hostProfile.username;
        credentials.contact = hostProfile.contact;
        credentials.name = document.getElementById('inp_T_entry_guestName').value;

        var submittionResponse = await PushEntryToDatabase(credentials);
        var output = submittionResponse;
        if (submittionResponse.id)
        {            
            output = submittionResponse.name + " has been added to the tournament. Host: " + hostProfile.name + " " + hostProfile.surname + " ('" + hostProfile.username + "')";
        }
        document.getElementById('txt_T_entry_host_response').textContent = output;
        console.log(output);
    }    
}

async function SubmitGuestEntry ()
{

}

async function GetUserProfile (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);

    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0];
    }
}

async function PushEntryToDatabase (_credentials)
{
    console.log(credentials);
    var duplicate = await DuplicateSubmition(_credentials);
    if (duplicate == false)
    {
        const response = await supabase.from('tbl_entries').insert(_credentials).select();

        if (response.error) 
        {
            return response.error.message;
        } else 
        {
            return response.data[0];
        }
    } else 
    {
        return duplicate;
    }
    
}

async function DuplicateSubmition (_credentials)
{
    const r_entries = await supabase.from('tbl_entries').select('*').eq('tournamentID', _credentials.tournamentID);
    var entries = r_entries.data;

    for (var i = 0; i < entries.length; i++)
    {
        if (entries[i].playerID && _credentials.playerID)
        {
            if (entries[i].playerID == _credentials.playerID)
            {
                return "You are already signed up for this tournament. Time of submittion: " + entries[i].created_at;
            }
        }        

        if ((entries[i].email == _credentials.email) && (entries[i].name == _credentials.name))
        {
            var r_hostProfile = await supabase.from('tbl_players').select('*').eq('id', entries[i].host);
            var hostProfile = r_hostProfile.data[0];
            return "Player is already signed up for this tournament. Entry details: " + entries[i].name + " (" + entries[i].email + "). Time of submittion: " + entries[i].created_at + ". Host: " + hostProfile.name + " " + hostProfile.surname + " ('" + hostProfile.username + "')";
        }
    }

    return false;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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



