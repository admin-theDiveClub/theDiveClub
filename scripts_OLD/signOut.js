document.getElementById('btn_signOut').addEventListener('click', () => 
{
    SignOut();
});

async function SignOut() 
{
    await supabase.auth.refreshSession();
    const { error } = await supabase.auth.signOut();
    if (error) 
    {
        console.error('Error signing out:', error.message);
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
}