RestoreSession();

async function RestoreSession ()
{
    var response = await supabase.auth.getSession();
    var session = response.data.session;
    if (session)
    {
        localStorage.setItem("session", JSON.stringify(response));
        sessionStorage.setItem("session", JSON.stringify(response));
        console.log("Session:", response);
    } else 
    {
        session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
        if (session)
        {
            var response = await supabase.auth.setSession(session.access_token);
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