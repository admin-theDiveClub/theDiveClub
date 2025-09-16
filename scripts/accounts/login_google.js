const googleLoginObserver = new MutationObserver(() => 
{
    const btn = document.querySelector('#btn-login-google');
    if (btn) 
    {
        googleLoginObserver.disconnect();
        document.getElementById('btn-login-google').addEventListener('click', () => 
        {
            SignInWithGoogle();
        });
    }
});
googleLoginObserver.observe(document.body, { childList: true, subtree: true });
    
//Sign in using email and password (credentials)
async function SignInWithGoogle()
{
    //Sign in using email and password
    const signInResponse = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: 
        {
            redirectTo: `../accounts/profile.html`
        }
    });
}

