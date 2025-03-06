/*
DOM ELEMENTS:
- btn_signIn_email
- inp_signIn_email
- inp_signIn_password
- txt_signIn_response
*/

//Load on page ready
document.getElementById('btn_signIn_email').addEventListener('click', () => 
{
    //Get credentials from input fields
    const credentials = 
    { 
        email: document.getElementById('inp_signIn_email').value, 
        password: document.getElementById('inp_signIn_password').value 
    };

    //Call SignIn function
    SignIn(credentials);
});

//Sign in using email and password (credentials)
async function SignIn(_credentials)
{
    //Sign in using email and password
    const signInResponse = await supabase.auth.signInWithPassword(_credentials);

    //Compose output
    var response = "";
    if (signInResponse.error)
    {
        //Failed to sign in
        response = "ERROR: " + signInResponse.error.message + ". Please try again.";
    } else 
    {
        //Signed in successfully
        var user = signInResponse.data.user;
        var session = signInResponse.data.session;

        //Compose output
        response = "Signed in as: " + user.email + "\n";
        response += ". Authentication token saved to local storage." + "\n";
        response += "You can navigate the site an you will remain signed in.";

        //Save username to local storage
        localStorage.setItem('username', user.email);

        //Save access token to local storage
        localStorage.setItem('access_token', session.access_token);
    }

    //Display output
    if (document.getElementById('txt_signIn_response'))
    {
        document.getElementById('txt_signIn_response').textContent = response;
    } else 
    {
        console.warn(response);
    }
}