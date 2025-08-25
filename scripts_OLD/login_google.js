document.getElementById('btn_login_google').addEventListener('click', () => 
{
    SignInWithGoogle();
});
    
//Sign in using email and password (credentials)
async function SignInWithGoogle()
{
    //Sign in using email and password
    const signInResponse = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: 
        {
            redirectTo: `../index.html`
        }
    });
}