const debugging = true;

document.getElementById('btn_signUp').addEventListener('click', () => 
{
    SignUp();
});
    
async function SignUp()
{
    const credentials_db = 
    {
        email: document.getElementById('inp_username').value,
        password: document.getElementById('inp_password').value,
    }

    var confirmedPassword = document.getElementById('inp_confirmPassword').value;
    
    var newUser = await Register_DB(credentials_db);
    if (debugging)
    {
        console.log(newUser);
    }    

    if (newUser.user)
    {
        const credentials_player = 
        { 
            username: document.getElementById('inp_username').value,
            name: document.getElementById('inp_name').value,
            surname: document.getElementById('inp_surname').value,
            nickname: document.getElementById('inp_nickname').value        
        };
        var newPlayer = await CreatePlayer(credentials_player);
        if (debugging)
        {
            console.log(newPlayer);
        }

        Output_SignUpResponse(true, 'User created successfully! Your username is: ' + newUser.user.email + '. And your player ID is: ' + newPlayer.id);    
    }
}

function matchPasswords(_p0, _p1)
{
    if (_p0 === _p1)
    {
        return true;
    } else 
    {
        return false;
    }
}

async function Register_DB (_credentials)
{
    const response = await supabase.auth.signUp(_credentials);
    if (response.error)
    {
        Output_SignUpResponse(false, response.error.message);
        return response.error.message;
    } else 
    {
        return response.data;
    }
}

async function CreatePlayer(_credentials)
{    
    const response = await supabase.from('tbl_players').insert(_credentials).select();
    if (response.error)
    {
        Output_SignUpResponse(false, response.error.message);
        return response.error.message;
    } else 
    {
        return response.data[0];
    }
}

function Output_SignUpResponse (_success, _message)
{
    if (_success)
    {
        document.getElementById('grp_inputs').style.display = 'none';
        document.getElementById('grp_buttons').style.display = 'none';
        document.getElementById('btn_Home').style.display = 'block';
    }
    document.getElementById('grp_output').style.display = 'block';
    document.getElementById('outputMessage').textContent = _message;
}