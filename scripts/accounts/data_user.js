import { Initialize_NavBar } from "../UIControllers/nav-bar_controller.js";

Start ();

async function Start ()
{
    const session = await GetSession();
    if (session)
    {        
        //console.log("Session found:", session);
        const userProfile = await GetUserProfile(session);
        if (userProfile)
        {
            //console.log("User Profile:", userProfile);
            console.log("Welcome back: " + userProfile.displayName);
            Initialize_NavBar();

            if (localStorage.getItem('redirectTo'))
            {
                const redirectTo = localStorage.getItem('redirectTo');
                localStorage.removeItem('redirectTo');
                window.location.href = redirectTo;
            }
        }
    } else 
    {
        console.log("No session found. Anonymous User.");
    }
}

async function GetSession ()
{
    const session = await _session();
    if (session)
    {
        const j_session = JSON.stringify(session);
        if (j_session)
        {
            localStorage.setItem("session", j_session);
            sessionStorage.setItem("session", j_session);
            return session;
        }
    }
}

function _tokens ()
{
    const accessToken = new URLSearchParams(window.location.hash.substring(1)).get('access_token');
    const refreshToken = new URLSearchParams(window.location.hash.substring(1)).get('refresh_token');
    if (accessToken && refreshToken)
    {
        return { accessToken: accessToken, refreshToken: refreshToken };
    } else 
    {
        return null;
    }
}

async function _session ()
{
    var session = null;

    //External Provider Access and Refresh Tokens
    const tokens = _tokens();
    if (tokens)
    {
        const response = await supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
        session = response.data && response.data.session ? response.data.session : null;
        if (session)
        {
            return session;
        }
    }

    //Stored Session
    var s_session = localStorage.getItem('session') || sessionStorage.getItem('session');
    if (s_session)
    {
        const j_session = JSON.parse(s_session);
        if (j_session)
        {
            const response = await supabase.auth.refreshSession();
            session = response.data && response.data.session ? response.data.session : null;
            return session;
        }
    }
}

async function GetUserProfile (session)
{    
    const user = session.user ? session.user : null;
    const username = user && user.email ? user.email : null;

    /*const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const j_userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    if (j_userProfile && j_userProfile.username && j_userProfile.username == username)
    {
        return j_userProfile;
    }*/

    var profile = 
    {
        id: null,
        username: null,
        name: null,
        surname: null,
        nickname: null,
        displayName: null,
        contact: null,
        pp: null
    };
    
    profile.username = username;

    //Identities
    const identities = user && user.identities && user.identities.length > 0 ? user.identities : [];
    for (const identity of identities)
    {
        const data = identity.identity_data ? identity.identity_data : {};
        if (data.name) 
        {
            profile.name = data.name;
            profile.displayName = data.name;
        }
        if (data.surname) profile.surname = data.surname;
        if (data.picture) profile.pp = data.picture;
        if (data.email) profile.contact = data.email;
    }

    //Database Profile
    if (username)
    {
        const response = await supabase.from('tbl_players').select('*').eq('username', username).single();
        const dbProfile = response.data ? response.data : null;
        if (dbProfile)
        {
            profile.id = dbProfile.id;
            profile.username = dbProfile.username;
            profile.name = dbProfile.name;
            profile.surname = dbProfile.surname;
            profile.nickname = dbProfile.nickname;
            profile.contact = dbProfile.contact;
            profile.displayName = dbProfile.nickname || dbProfile.name || profile.displayName || dbProfile.username || "Guest";
            profile.pp = dbProfile.pp || profile.pp || null;

            if (!dbProfile.pp)
            {
                const r_pic = await supabase.storage.from('bucket-profile-pics').getPublicUrl(profile.id);
                if (r_pic.data.publicUrl)
                {
                    try 
                    {
                        const img = new Image();
                        await new Promise((resolve, reject) => 
                        {
                            img.onload = () => resolve();
                            img.onerror = () => reject(new Error('Failed to load profile picture from DB storage.'));
                            img.src = r_pic.data.publicUrl;
                        });
                        profile.pp = r_pic.data.publicUrl;
                    } catch (error)
                    {
                        console.log("Error loading profile picture from DB storage:", error);
                    }
                }

                const updateResponse = await supabase.from('tbl_players').update({ pp: profile.pp }).eq('id', profile.id).select().single();
                console.log("Updated profile picture:", updateResponse);
            }
            

        } else 
        {
            console.log("No DB profile found for:", username);
            const newDBProfile =
            {
                username: profile.username,
                name: profile.name,
                surname: profile.surname,
                nickname: profile.nickname,
                contact: profile.contact,
                pp: profile.pp
            }
            const insertResponse = await supabase.from('tbl_players').insert([newDBProfile]).select().single();
            console.log("Inserted new DB profile:", insertResponse);
            if (insertResponse.data)
            {
                profile.id = insertResponse.data.id;
            }
        }

        if (profile.id)
        {
            const j_profile = JSON.stringify(profile);
            if (j_profile)
            {
                localStorage.setItem("userProfile", j_profile);
                sessionStorage.setItem("userProfile", j_profile);
                return profile;
            } else 
            {
                return null;
            }
        } else 
        {
            return null;
        }
    }
}