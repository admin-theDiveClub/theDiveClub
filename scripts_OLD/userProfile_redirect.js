Start ();

async function Start ()
{
    session = JSON.parse(localStorage.getItem('session')) || JSON.parse(sessionStorage.getItem('session'));
    if (session)
    {
        window.location.href = '/accounts/profile.html';
    }
}
