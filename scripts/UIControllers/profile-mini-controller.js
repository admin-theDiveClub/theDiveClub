const miniProfileObserver = new MutationObserver(() => 
{
    var allElementsLoaded = true;   

    const e_mini_profile = document.getElementById('mini-profile-container');
    if (!e_mini_profile){allElementsLoaded = false;}

    if (allElementsLoaded) 
    {
        miniProfileObserver.disconnect();
        Initialize_MiniProfile();        
    }
});
miniProfileObserver.observe(document.body, { childList: true, subtree: true });

function Initialize_MiniProfile ()
{
    const btn_close = document.getElementById('btn-close-mini-profile');
    btn_close.addEventListener('click', closeProfileMini);
    document.addEventListener('mousedown', (e) => {
        const e_mini_profile = document.getElementById("mini-profile-container");
        if (e_mini_profile && !e_mini_profile.contains(e.target)) {
            closeProfileMini();
        }
    });
}

function closeProfileMini()
{
    const e_mini_profile = document.getElementById("mini-profile-container");
    e_mini_profile.style.display = "none";
}

export function UpdateMiniProfile(userProfile)
{
    console.log("Updating Mini Profile:", userProfile);
    const e_mini_profile = document.getElementById("mini-profile-container");
    e_mini_profile.style.display = "block";

    const e_pp = document.getElementById("user-mini-profile-pic");
    const e_nickname = document.getElementById("profile-mini-nickname");
    const e_fullname = document.getElementById("profile-mini-fullname");
    const e_username = document.getElementById("profile-mini-username");
    
    if (e_pp) { e_pp.src = userProfile.pp || "/resources/icons/icon_player.svg"; }
    if (e_nickname) { e_nickname.textContent = userProfile.displayName || "No Nickname"; }
    if (e_fullname) { e_fullname.textContent = userProfile.name || "No Full Name"; }
    if (e_username) { e_username.textContent = userProfile.username || "No Username"; }
}
