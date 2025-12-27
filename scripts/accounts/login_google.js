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
    // Use the shared Supabase client
    const client = window.supabaseClient;
    if (!client || !client.auth) {
        console.error('Supabase client not initialized. Ensure scripts/supabase/supaBase_client.js is loaded before login_google.js');
        return;
    }
    const signInResponse = await client.auth.signInWithOAuth({
        provider: 'google',
        options: 
        {
            redirectTo: `/accounts/profile.html`
        }
    });
}

