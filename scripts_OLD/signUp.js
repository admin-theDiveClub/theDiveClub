const debugging = true;

document.getElementById('btn_signUp').addEventListener('click', () => 
{
    SignUp();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        SignUp();
    }
});
    
async function SignUp()
{
    const credentials_db = 
    {
        email: document.getElementById('inp_username').value,
        password: document.getElementById('inp_password').value,
    }
    const credentials_player = 
    { 
        username: document.getElementById('inp_username').value,
        name: document.getElementById('inp_name').value,
        surname: document.getElementById('inp_surname').value,
        nickname: document.getElementById('inp_nickname').value
    };
    var confirmedPassword = document.getElementById('inp_confirmPassword').value;
    var valid = dataValid(credentials_db, confirmedPassword, credentials_player);

    if (valid != true)
    {
        Output_SignUpResponse(false, valid);
        return;
    } else
    {
        var newUser = await Register_DB(credentials_db);
        if (debugging)
        {
            console.log(newUser);
        }    

        if (newUser.user)
        {
            
            var newPlayer = await CreatePlayer(credentials_player);
            if (debugging)
            {
                console.log(newPlayer);
            }

            Output_SignUpResponse(true, 'User created successfully! Your username is: ' + newUser.user.email + '. And your player ID is: ' + newPlayer.id);    
        }
    }  
}

function dataValid (_creds_db, _confirmedPassword, _creds_player)
{
    // Remove all red borders before validation
    document.querySelectorAll('.input-field').forEach(field => {
        field.style.border = 'none';
    });

    var errorMessage = "";
    var valid = true;
    if (_creds_db.password != _confirmedPassword)
    {
        valid = false;
        errorMessage += "Passwords do not match.\n";
        document.getElementById('inp_password').closest('.input-field').style.border = '1px solid red';
        document.getElementById('inp_confirmPassword').closest('.input-field').style.border = '1px solid red';
    }

    if (_creds_db.email == "")
    {
        valid = false;
        errorMessage += "Email field is empty.\n";
        document.getElementById('inp_username').closest('.input-field').style.border = '1px solid red';
    }

    if (_creds_db.password == "")
    {
        valid = false;
        errorMessage += "Password field is empty.\n";
        document.getElementById('inp_password').closest('.input-field').style.border = '1px solid red';
    }

    if (_creds_player.username == "")
    {
        valid = false;
        errorMessage += "Username field is empty.\n";
        document.getElementById('inp_username').closest('.input-field').style.border = '1px solid red';
    }

    if (_creds_player.name == "")
    {
        valid = false;
        errorMessage += "Name field is empty.\n";
        document.getElementById('inp_name').closest('.input-field').style.border = '1px solid red';
    }

    if (_creds_player.surname == "")
    {
        valid = false;
        errorMessage += "Surname field is empty.\n";
        document.getElementById('inp_surname').closest('.input-field').style.border = '1px solid red';
    }

    if (valid)
    {
        return true;
    } else 
    {
        return errorMessage;
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
        document.getElementById('btn_signUp').style.display = 'none';
        document.getElementById('btn_Home').style.display = 'block';
    }
    document.getElementById('grp-output').style.display = 'block';
    document.getElementById('outputMessage').textContent = _message;
}