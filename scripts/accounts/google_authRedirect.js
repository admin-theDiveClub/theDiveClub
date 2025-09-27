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

            await GetUserProfile(response.data.session.user.email);

            window.location.href = "../accounts/profile.html";
        }
        //console.log("Session: ", response);
    }
}

async function GetUserProfile (username)
{
    var s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    if (s_userProfile)
    {
        var userProfile = JSON.parse(s_userProfile);
        if (userProfile && userProfile.id && userProfile.username && userProfile.username == username)
        {
            if (!userProfile.pp)
            {
                userProfile = await UpdatePlayerProfilePicture(userProfile);
            }
            return userProfile;
        }
    }
     else
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
