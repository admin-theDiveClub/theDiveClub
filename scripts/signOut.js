document.getElementById('btn_signOut').addEventListener('click', () => 
{
    SignOut();
});

async function SignOut() 
{
    const { error } = await supabase.auth.signOut();
    if (error) 
    {
        alert("Error signing out: " + error.message);
        console.error('Error signing out:', error.message);
    } else 
    {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
}