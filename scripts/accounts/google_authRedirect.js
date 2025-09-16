Start();

async function Start ()
{
    var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    if (accessToken)
    {
        var refreshToken = new URLSearchParams(window.location.hash.substring(1)).get('refresh_token');
        var response = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        //console.log("Session: ", response);
    } else
    {
        response = await supabase.auth.getSession();
        //console.log("Session: ", response);
        sessionStorage.setItem("session", JSON.stringify(response.data.session));
        localStorage.setItem("session", JSON.stringify(response.data.session));
    }
}

