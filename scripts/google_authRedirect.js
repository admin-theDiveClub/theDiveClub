

Start();

async function Start ()
{
    var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    if (accessToken)
    {
        var response = await supabase.auth.setSession(accessToken);
        console.log("Session: ", response);
        //Create Player Profile if none exists
        CreatePlayerProfile(response.user);
    }

    if (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'))
    {
        window.location.href = '../tournaments/entry.html?tournamentID=' + (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'));
    }
}

async function CreatePlayerProfile (_user)
{
    var player = await GetPlayer(_user.email);
    if (!player)
    {
        var newPlayer = 
        {
            username: _user.email,
            name: _user.user_metadata.full_name,
        };
        const response = await supabase.from('tbl_players').insert(newPlayer).select();
        if (response.error)
        {
            console.log("Error Creating Player Profile:", response.error.message);
        } else 
        {
            console.log("Player Profile Created:", response.data);
        }
    }
}

async function GetPlayer(_username)
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