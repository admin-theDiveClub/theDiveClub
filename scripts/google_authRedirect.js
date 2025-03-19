var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');

Start();

async function Start ()
{
    if (accessToken)
    {
        var response = await supabase.auth.setSession(accessToken);
        console.log("Session:", response);
    }
}

