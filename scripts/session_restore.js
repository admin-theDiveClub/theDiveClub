RestoreSession();

async function RestoreSession ()
{
    var session = JSON.parse(localStorage.getItem('supabase_session')) || JSON.parse(sessionStorage.getItem('supabase_session'));
    if (session)
    {
        await supabase.auth.setSession(session.access_token);
        var response = await supabase.auth.getSession();
        localStorage.setItem("session", JSON.stringify(response));
        sessionStorage.setItem("session", JSON.stringify(response));
        console.log("Session:", response);
    } else 
    {
        console.log('No session found');
    }
}