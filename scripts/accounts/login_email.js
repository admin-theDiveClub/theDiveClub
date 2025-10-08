const emailLoginObserver = new MutationObserver(() => {
    const btn = document.querySelector('#btn-login');
    if (btn) 
    {
        emailLoginObserver.disconnect();
        document.getElementById('btn-login').addEventListener('click', () => 
        {
            const credentials = 
            { 
                email: document.getElementById('login-username').value, 
                password: document.getElementById('login-password').value 
            };

            const sessionPersistance = document.getElementById('login-rememberMe').checked;
            Login(credentials, sessionPersistance);
        });
    }
});
emailLoginObserver.observe(document.body, { childList: true, subtree: true });


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
                        
            window.location.href = '/accounts/profile.html';        
        }
    }
}

function Output_LoginResponse (_message)
{    
    document.getElementById('grp-login-output').style.display = 'block';
    document.getElementById('login-outputMessage').textContent = _message.charAt(0).toUpperCase() + _message.slice(1) + ". Please try again.";
}