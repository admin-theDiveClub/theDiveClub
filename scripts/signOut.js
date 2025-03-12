document.getElementById('btn_signOut').addEventListener('click', () => 
{
    SignOut();
});

async function SignOut() 
{
    const { error } = await supabase.auth.signOut();
    if (error) 
    {
        console.error('Error signing out:', error.message);
    } else 
    {
        console.log('Successfully signed out');
        localStorage.clear();
        window.location.reload();
    }
}