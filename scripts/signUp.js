document.getElementById('btn_signUp').addEventListener('click', () => 
{
    SignUp();
});
    
//Sign Up (credentials)
async function SignUp()
{
    //Sign in using email and password
    const credentials = 
    { 
        email: document.getElementById('inp_signUp_email').value,
        password: document.getElementById('inp_signUp_password').value, 
        name: document.getElementById('inp_signUp_name').value,
        surname: document.getElementById('inp_signUp_surname').value,
        nickname: document.getElementById('inp_signUp_nickname').value        
    };

    SubmitSignUp(credentials);
}

async function SubmitSignUp(_credentials)
{
    //Sign in using email and password
    var credentials = 
    {
        email: _credentials.email,
        password: _credentials.password
    }
    console.log("SIGNING UP");
    const signUpResponse = await supabase.auth.signUp(credentials);
    console.log(signUpResponse);

    //Compose output
    var response = "";
    if (signUpResponse.error)
    {
        //Failed to sign up
        response = "ERROR: " + signUpResponse.error.message + ". Please try again.";
    } else 
    {
        //Signed up successfully
        var user = signUpResponse.data.user;
        var session = signUpResponse.data.session;

        //Compose output
        response = "Signed up as: " + user.email + "\n";
        response += "Please sign in to continue.";
    }

    //Display output
    if (document.getElementById('txt_signUp_response'))
    {
        document.getElementById('txt_signUp_response').textContent = response;
    } else 
    {
        console.warn(response);
    }

    if (signUpResponse.error)
    {
        console.error('Failed to sign up:', signUpResponse.error);
    } else 
    {
        console.log('Signed up successfully:', signUpResponse.data.user.email);
        CreatePlayer(_credentials);
    }
}

async function CreatePlayer(_credentials)
{
    var playerCredentials = 
    {
        username: _credentials.email,
        name: _credentials.name,
        surname: _credentials.surname,
        nickname: _credentials.nickname
    }
    
    const newPlayerResponse = await supabase.from('tbl_players').insert(playerCredentials).select();
    console.log(newPlayerResponse.data.user.id);
}