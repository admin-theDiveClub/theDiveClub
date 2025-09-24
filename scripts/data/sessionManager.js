Initialize();

async function Initialize ()
{
    const session = await GetSession();

    if (session && session.user && session.user.email)
    {
        const userProfile = await GetUserProfile(session.user.email);
        if (userProfile)
        {
            Post_Success(userProfile);
        } else 
        {
            Post_Anonymous();
        }
    } else 
    {
        Post_Anonymous();
    }
}

var sessionEvent = null;

function Post_Success (userProfile)
{
    console.log("Session Restored. Welcome back ", userProfile.username);
    sessionEvent = new CustomEvent('sessionRestored', { detail: { userProfile } });
    window.dispatchEvent(sessionEvent);
}

function Post_Anonymous ()
{
    console.log("Session Anonymous");
    sessionEvent = new CustomEvent('sessionAnonymous');
    window.dispatchEvent(sessionEvent);
}

async function GetSession ()
{
    var s_session = localStorage.getItem('session') || sessionStorage.getItem('session');
    if (!s_session)
    {
        return null;
    }
    var session = JSON.parse(s_session);
    if (session && session.user && session.user.email)
    {
        return session;
    } else
    {
        const response = await supabase.auth.getSession();
        if (response.data.session)
        {
            localStorage.setItem("session", JSON.stringify(response.data.session));
            sessionStorage.setItem("session", JSON.stringify(response.data.session));
            return response.data.session;
        } else 
        {
            localStorage.removeItem("session");
            sessionStorage.removeItem("session");
            return null;
        }
    }
}

async function GetUserProfile (username)
{
    var userProfile = JSON.parse(localStorage.getItem('userProfile')) || JSON.parse(sessionStorage.getItem('userProfile'));
    if (userProfile && userProfile.id && userProfile.username && userProfile.username == username)
    {
        if (!userProfile.pp)
        {
            userProfile = await UpdatePlayerProfilePicture(userProfile);
        }
        return userProfile;
    } else
    {
        const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
        userProfile = response.data;

        if (userProfile && userProfile.id)
        {
            userProfile = await UpdatePlayerProfilePicture(userProfile);

            localStorage.setItem("userProfile", JSON.stringify(userProfile));
            sessionStorage.setItem("userProfile", JSON.stringify(userProfile));

            return userProfile;
        } else
        {
            localStorage.removeItem("userProfile");
            sessionStorage.removeItem("userProfile");
            return null;
        }
    }
}

async function UpdatePlayerProfilePicture(userProfile)
{
    if (!userProfile || !userProfile.id) return userProfile;

    if (!userProfile.pp)
    {
        try 
        {
            const { data, error } = await supabase.storage.from('bucket-profile-pics').download(userProfile.id);
            if (error) 
            {
                // File not found or inaccessible
                return userProfile;
            }

            const { data: pub } = supabase.storage.from('bucket-profile-pics').getPublicUrl(userProfile.id);
            const publicUrl = pub?.publicUrl;

            const finalUrl = publicUrl || URL.createObjectURL(data);

            userProfile.pp = finalUrl;
            localStorage.setItem("userProfile", JSON.stringify(userProfile));
            sessionStorage.setItem("userProfile", JSON.stringify(userProfile));
            
            return userProfile;
        } catch (err) 
        {
            console.error('Error loading profile picture:', err);
            return userProfile;
        }
    }    
}

window.addEventListener('sessionSignOut', async () =>
{
    console.log("Signing Out...");
    const { error } = await supabase.auth.signOut();
    if (error) 
    {
        console.error('Error signing out:', error.message);
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
});