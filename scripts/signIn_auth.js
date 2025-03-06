GetUserDetails();

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
        window.history.replaceState({}, document.title, window.location.pathname);
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
    } else 
    {
        username = supabaseAuthResponse.data.user.email;
        return username;
    }
}