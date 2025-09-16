const signOutObserver = new MutationObserver(() => {
    const btn = document.getElementById('btn-signOut');
    if (btn) {
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
    const { error } = await supabase.auth.signOut();
    if (error) 
    {
        console.error('Error signing out:', error.message);
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
}