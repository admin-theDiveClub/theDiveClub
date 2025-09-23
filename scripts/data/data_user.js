Initialize();

async function Initialize ()
{
    const session = await GetSession();

    if (session && session.user && session.user.email)
    {
        const userProfile = await GetUserProfile(session.user.email);
        if (userProfile)
        {
            Post_Success(userProfile.username);
        } else 
        {
            Post_Anonymous();
        }
    } else 
    {
        Post_Anonymous();
    }
}

function Post_Success (username)
{
    console.log("Session Restored. Welcome back ", username);
    const event = new CustomEvent('sessionRestored');
    window.dispatchEvent(event);
}

function Post_Anonymous ()
{
    console.log("Session Anonymous");
    const event = new CustomEvent('sessionAnonymous');
    window.dispatchEvent(event);
}

async function GetSession ()
{
    var session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
    if (session && session.user && session.user.email)
    {
        return session;
    } else
    {
        const response = await supabase.auth.getSession();
        if (response.data.session)
        {
            localStorage.setItem("session", JSON.stringify(response.data.session));
            sessionStorage.setItem("session", JSON.stringify(response.data.session));
            return response.data.session;
        } else 
        {
            localStorage.removeItem("session");
            sessionStorage.removeItem("session");
            return null;
        }
    }
}

async function GetUserProfile (username)
{
    var userProfile = JSON.parse(localStorage.getItem('userProfile')) || JSON.parse(sessionStorage.getItem('userProfile'));
    if (userProfile && userProfile.id && userProfile.username && userProfile.username == username)
    {
        return userProfile;
    } else
    {
        const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
        if (response.data)
        {
            localStorage.setItem("userProfile", JSON.stringify(response.data));
            sessionStorage.setItem("userProfile", JSON.stringify(response.data));
            return response.data;
        } else
        {
            localStorage.removeItem("userProfile");
            sessionStorage.removeItem("userProfile");
            return null;
        }
    }
}