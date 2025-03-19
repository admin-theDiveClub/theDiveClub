RestoreSession();

async function RestoreSession ()
{
    var response = await supabase.auth.getSession();
    var session = response.data.session;
    if (session)
    {
        localStorage.setItem("session", JSON.stringify(session));
        sessionStorage.setItem("session", JSON.stringify(session));
        console.log("Session:", session);
        //Create Player Profile if none exists
        var newPlayer = await CreatePlayerProfile(session.user);
        if (newPlayer)
        {
            console.log("Player:", newPlayer);
        }
    } else 
    {
        session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
        if (session)
        {
            var response = await supabase.auth.refreshSession();
            if (response.error)
            {
                console.log("Session: ", response.error.message);
            }
            else
            {
                console.log("Session: ", response);
            }
        }
    }
}

async function CreatePlayerProfile (_user)
{
    console.log(_user);
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
    } else 
    {
        console.log("Player Profile Exists:", player);

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