const signOutObserver = new MutationObserver(() => {
    const btn = document.getElementById('btn-signOut');
    if (btn) 
    {
        signOutObserver.disconnect();
        document.getElementById('btn-signOut').addEventListener('click', () => 
        {
            SignOut();
        });
    }
});
signOutObserver.observe(document.body, { childList: true, subtree: true });

async function SignOut() 
{
    console.log("Dispatching Sign Out Event...");
    window.dispatchEvent(new CustomEvent('sessionSignOut', {}));
}