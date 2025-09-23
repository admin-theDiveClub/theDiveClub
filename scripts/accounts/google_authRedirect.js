Start();

async function Start ()
{
    var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    if (accessToken)
    {
        var refreshToken = new URLSearchParams(window.location.hash.substring(1)).get('refresh_token');
        var response = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (response.data && response.data.session)
        {
            localStorage.setItem("session", JSON.stringify(response.data.session));
            sessionStorage.setItem("session", JSON.stringify(response.data.session));
            window.location.href = "../accounts/profile.html";
        }
        //console.log("Session: ", response);
    }
}

