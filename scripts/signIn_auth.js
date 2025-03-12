GetUserDetails();
CleanUpURL();

GetRefreshToken();

async function GetUserDetails ()
{
    const accessToken = GetAccessTokenFromURL();
    var username;
    if (accessToken)
    {
        username = await SignInWithAccessToken(accessToken);
    } else if (localStorage.getItem('access_token'))
    {
        username = await SignInWithAccessToken(localStorage.getItem('access_token'));
    }

    if (username)
    {
        localStorage.setItem('username', username);

        if (document.getElementById('txt_signInStatus'))
        {
            document.getElementById('txt_signInStatus').textContent = 'Signed in as: ' + username;
        } else 
        {
            console.warn('Signed in as:', username);
        }
    } else 
    {
        if (document.getElementById('txt_signInStatus'))
        {
            document.getElementById('txt_signInStatus').textContent = 'No access token found. Please sign in.';
        } else 
        {
            console.log('No access token found. Please sign in.');
        }
    }
}

function GetAccessTokenFromURL ()
{
    accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    if (accessToken)
    {
        localStorage.setItem('access_token', accessToken);
        return accessToken;
    } else 
    {
        return null;
    }
}

async function SignInWithAccessToken (_accessToken)
{
    const supabaseAuthResponse = await supabase.auth.getUser(_accessToken);

    if (supabaseAuthResponse.error) 
    {
        console.error('Access Token found. Error fetching user details:', supabaseAuthResponse.error);
        Object.keys(localStorage).forEach(key => {
            if (key !== 'tournamentID') {
            localStorage.removeItem(key);
            }
        });
        location.reload();
    } else 
    {
        username = supabaseAuthResponse.data.user.email;
        return username;
    }
}

async function GetRefreshToken ()
{
    const response = await supabase.auth.getSession();
    if (response.error)
    {
        console.error('Error getting session:', response.error);
    } else
    {
        if (response.data.session)
        {
            const refreshToken = response.data.session.refresh_token;
            if (refreshToken)
            {
                localStorage.setItem('refresh_token', refreshToken);
                setInterval(RefreshSession, 1000 * 60 * 45);
            }
        } else 
        {
            console.warn('No session found');
        }        
    }    
}

function CleanUpURL ()
{
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function RefreshSession ()
{
    const refreshToken = localStorage.getItem('refresh_token');
    const response = await supabase.auth.refreshSession({refresh_token: refreshToken});
    if (response.error)
    {
        console.error('Error refreshing session:', response.error);
    } else 
    {
        const newSession = response.data.session;
    }
}
