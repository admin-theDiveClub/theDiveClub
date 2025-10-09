Start ();

async function Start ()
{
    const userProfile = await _userProfile();
    console.log("User Profile:", userProfile);
}

async function _userProfile ()
{
    var username = new URLSearchParams(window.location.search).get('username');
    if (username) 
    {        
        const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
        if (response.error)
        {
            alert("Error Getting User Profile: " + response.error.message);
            window.location.href = "/index.html";
            return null;
        } else 
        {
            return response.data;
        }
    }

    const s_userProfile = localStorage.getItem("userProfile") || sessionStorage.getItem("userProfile");
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    return userProfile;
}