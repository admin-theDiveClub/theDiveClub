var accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');

Start();

async function Start ()
{
    if (accessToken)
    {
        var response = await supabase.auth.setSession(accessToken);
        console.log("Session: ", response);
    }

    if (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'))
    {
        window.location.href = '../tournaments/entry.html?tournamentID=' + (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'));
    }
}

