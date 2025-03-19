
//const response = await supabase.from('tbl_entries').insert(_credentials).select();

/*
    Get User from Session / Storage / Auth token
    if user logged in, 
        then Show card_userSignUp & card_hostSignUp
        else Show card_goToLogin
*/

/*
    Submit entry: User
    Sumbit entry: Host
    Submit entry: Anonymous

    Get Tournament ID
    Get User ID + Full Name + username + contact
*/
InitializeUI();

async function InitializeUI ()
{
    var user = await GetUser();
    if (user)
    {
        document.getElementById('card_userSignUp').style.display = 'block';
        document.getElementById('card_hostSignUp').style.display = 'block';
        document.getElementById('card_goToLogin').style.display = 'none';

        var player = await GetPlayer(user.email);
        if (player)
        {
            var fullName = player.name;
            if (player.surname)
            {
                fullName += " " + player.surname;
            }
            fullName += " (" + player.username + ")";
            document.getElementById('loginStatus').innerText = "You are logged in as: " + fullName;
        } else 
        {
            console.log("Player not found.");
        }
    } else 
    {
        document.getElementById('card_goToLogin').style.display = 'block';
        document.getElementById('card_userSignUp').style.display = 'none';
        document.getElementById('card_hostSignUp').style.display = 'none';
    }
}

document.getElementById('btn_signMeUp').addEventListener('click', () => 
{
    SubmitEntry(0);
});

document.getElementById('btn_signUpHost').addEventListener('click', () => 
{
    SubmitEntry(1);
});

document.getElementById('btn_signUpAnonymous').addEventListener('click', () => 
{
    SubmitEntry(2);
});

async function SubmitEntry (_mode)
{
    var credentials = await GetCredentials(_mode);
    if (credentials)
    {
        var tournamentID = GetTournamentID();
        var entries = await GetEntries(tournamentID);
        var isDuplicate = IsDuplicate(credentials, entries);
        if (!isDuplicate)
        {
            response = await PushCredentials(credentials);
            console.log("Entry:", response.name);
            localStorage.setItem('entry', JSON.stringify(credentials));
            //RELOAD PAGE & CHECK LOCAL STORAGE FOR LAST ENTRY, Notify User
            //Or just replace the above with an alert and then reload
            //alert("Entry submitted successfully.");
            location.reload();
        } else 
        {
            console.log(isDuplicate);
        }
    }
}

async function GetCredentials (_mode)
{
    var tournamentID = GetTournamentID();

    if (tournamentID)
    {
        var credentials = null;

        if (_mode == 0 || _mode == 1)
        {
            //Get User            
            var user = await GetUser();
            var username = user.email;
            if (username)
            {
                var player = await GetPlayer(username);
                if (player)
                {
                    user = player;
                }
            }

            if (user)
            {
                if (_mode == 0)
                {
                    credentials =
                    {
                        tournamentID: tournamentID,
                        playerID: user.id,
                        name: user.name + ' ' + user.surname,
                        contact: user.contact,
                        email: user.username,
                        entryType: 'user'
                    };
                } else if (_mode == 1)
                {
                    credentials =
                    {
                        tournamentID: tournamentID,
                        host: user.name + " " + user.surname + " (" + user.username + ")",
                        name: document.getElementById('guestName').value,
                        contact: user.contact,
                        email: user.username,
                        entryType: 'host'
                    };
                }
            }
        } else if (_mode == 2)
        {
            var nameAnon = document.getElementById('name_anon');
            var phoneAnon = document.getElementById('phone_anon');
            var emailAnon = document.getElementById('email_anon');

            var isValid = true;

            if (!nameAnon.value) {
                nameAnon.parentElement.style.border = '2px solid red';
                isValid = false;
            } else {
                nameAnon.parentElement.style.border = '';
            }

            if (!phoneAnon.value) {
                phoneAnon.parentElement.style.border = '2px solid red';
                isValid = false;
            } else {
                phoneAnon.parentElement.style.border = '';
            }

            if (isValid) {
                credentials = {
                    tournamentID: tournamentID,
                    name: nameAnon.value,
                    contact: phoneAnon.value,
                    email: emailAnon.value,
                    entryType: 'anonymous'
                };
            }
        }

        if (credentials)
        {
            return credentials;
        } else
        {
            return null;
        }
    } else
    {
        return null;
    }    
}

function GetTournamentID ()
{
    var tournamentID = localStorage.getItem('tournamentID') || sessionStorage.getItem('tournamentID');
    if (tournamentID)
    {
        return tournamentID;
    } else
    {
        return null;
    }
}

async function GetUser ()
{
    var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
    if (session)
    {
        return session.user;
    } else
    {
        return null;
    }    
}

async function GetPlayer (_username)
{
    const response = await supabase.from('tbl_players').select('*').eq('username', _username);
    return response.data[0];
}

async function PushCredentials (_credentials)
{
    const response = await supabase.from('tbl_entries').insert(_credentials).select();
    if (response.error)
    {
        console.log("SUBMITTION:", response.error.message);
    } else 
    {
        console.log("SUBMITTION:", response.data[0].name);
    }
    return response.data[0];
}

async function GetEntries (_tournamentID)
{
    const response = await supabase.from('tbl_entries').select('playerID, name').eq('tournamentID', _tournamentID).order('createdAt', { ascending: true });
    if (response.error)
    {
        return response.error.message;
    } else
    {
        return response.data;
    }
}

function IsDuplicate (_credentials, _entries)
{
    for (var i = 0; i < _entries.length; i++)
    {
        var entry = _entries[i];

        if (entry.playerID && _credentials.playerID)
        {
            if (entry.playerID == _credentials.playerID)
            {
                alert("You are already registered for this tournament.");
                return "You are already registered for this tournament.";
            }
        }

        if (entry.name == _credentials.name)
        {
            alert("Name is already registered for this tournament");
            return "Name is already registered for this tournament.";
        }
    }
    return false;
}