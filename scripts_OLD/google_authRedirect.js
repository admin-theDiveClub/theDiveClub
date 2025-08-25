Start();

async function Start ()
{
    var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    if (accessToken)
    {
        var response = await supabase.auth.setSession(accessToken);
        console.log("Session: ", response);
    } else
    {
        response = await supabase.auth.getSession();
        console.log("Session: ", response);
        sessionStorage.setItem("session", JSON.stringify(response.data.session));
        localStorage.setItem("session", JSON.stringify(response.data.session));
    }
}

