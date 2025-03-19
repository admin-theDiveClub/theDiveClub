document.getElementById('btn_login').addEventListener('click', () => 
{
    const credentials = 
    { 
        email: document.getElementById('username').value, 
        password: document.getElementById('password').value 
    };

    var sessionPersistance = document.getElementById('rememberMe').checked;
    var login = Login(credentials, sessionPersistance);
});

async function Login (_credentials, _persistance)
{
    const response = await supabase.auth.signInWithPassword(_credentials);
    if (response.error)
    {
        console.log(response.error.message);
        Output_LoginResponse(response.error.message);
        return response.error.message;
    } else 
    {
        if (response.data.session)
        {
            var session = JSON.stringify(response.data.session);
            if (_persistance)
            {
                localStorage.setItem('supabase_session', session);
            } else 
            {
                sessionStorage.setItem('supabase_session', session);
            }

            if (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'))
            {
                window.location.href = '../tournaments/entry.html?tournamentID=' + (sessionStorage.getItem('tournamentID') || localStorage.getItem('tournamentID'));
            } else 
            {
                window.location.href = '../index.html';
            }           
        }
    }
}

function Output_LoginResponse (_message)
{    
    document.getElementById('grp_output').style.display = 'block';
    document.getElementById('outputMessage').textContent = _message.charAt(0).toUpperCase() + _message.slice(1) + ". Please try again.";
}