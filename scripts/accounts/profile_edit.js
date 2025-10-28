function _user ()
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    return userProfile ? userProfile : null;
}

Initialize ();

function Initialize ()
{
    const user = _user();
    if (user)
    {
        const displayName = user.nickname ? user.nickname : (user.name ? user.name : (user.username ? user.username : "?"));
        var message = "Welcome back, " + displayName;
        document.getElementById('user-welcome').innerText = message;

        const pp = user.pp ? user.pp : "/resources/icons/icon_player.svg";
        document.getElementById('user-profile-pic').src = pp;

        PopulateInputs(user);
        WireInputUpdates(user);

        document.getElementById('component-loading-overlay').style.display = 'none';
    } else 
    {
        alert('Please Log In before creating a match. All matches can be found on your user profile later on.');
        window.location.href = "/index.html";
    }
}

function PopulateInputs (user)
{
    document.getElementById('inp_username').value = user.username || '';
    document.getElementById('inp_name').value = user.name || '';
    document.getElementById('inp_surname').value = user.surname || '';
    document.getElementById('inp_nickname').value = user.nickname || '';
    document.getElementById('inp_contact').value = user.contact || '';
    document.getElementById('inp-edit-pp').src = user.pp || '/resources/icons/icon_player.svg';
}

function WireInputUpdates (user)
{
    const inputs = ['inp_username', 'inp_name', 'inp_surname', 'inp_nickname', 'inp_contact'];
    const userValues = {
        inp_username: user.username || '',
        inp_name: user.name || '',
        inp_surname: user.surname || '',
        inp_nickname: user.nickname || '',
        inp_contact: user.contact || ''
    };

    inputs.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        inputElement.addEventListener('change', () => {
            if (inputElement.value !== userValues[inputId]) {
                inputElement.classList.add('value-edited');
            } else {
                inputElement.classList.remove('value-edited');
            }
        });
    });
}

var uploadedPP = null;

function UploadNewPP (file)
{
    if (uploadedPP)
    {
        console.log("Clearing uploaded PP");
        uploadedPP = null;
        document.getElementById("preview-new-pp").src = "/resources/icons/icon_player.svg";
        document.getElementById("icon-upload").classList.remove("bi-x");
        document.getElementById("icon-upload").classList.add("bi-cloud-upload");
        return;
    }

    if (!file) return;
    
    console.log("UploadNewPP called", file);
    const previewImg = document.getElementById('preview-new-pp');
    const reader = new FileReader();
    reader.onload = (event) => {
        previewImg.src = event.target.result;
        document.getElementById("icon-upload").classList.remove("bi-cloud-upload");
        document.getElementById("icon-upload").classList.add("bi-x");
        uploadedPP = file;
    };
    reader.readAsDataURL(file);
}

document.getElementById('btn_submitEdits').addEventListener('click', async () =>
{
    const user = _user();
    const updatedData = CompareInputsToUser(user);
    console.log("Updated data:", updatedData);
    const userID = user.id;

    if (uploadedPP)
    {
        const fileExt = uploadedPP.type.split('/')[1] || 'png';
        const filePath = `${userID}/pp.${fileExt}`;
        
        const { error } = await supabase.storage
            .from('bucket-profile-pics')
            .upload(filePath, uploadedPP, {
            cacheControl: '3600',
            upsert: true,
            contentType: uploadedPP.type,
            });
        if (error) {
            alert("Error uploading profile picture: " + error.message);
            return;
        }
        const { data: publicUrlData } = supabase.storage.from('bucket-profile-pics').getPublicUrl(filePath);
        updatedData.pp = publicUrlData.publicUrl;
        user.pp = publicUrlData.publicUrl;
        console.log("Uploaded new profile picture:", publicUrlData.publicUrl);
    }

    const response = await supabase.from('tbl_players').update(updatedData).eq('id', userID).select().single();
    if (response.error)
    {
        alert("Error updating profile: " + response.error.message);
        return;
    } else 
    {
        alert("Profile updated successfully.");
        localStorage.setItem('userProfile', JSON.stringify(response.data));
        window.location.href = window.location.href;
    }    
});

function CompareInputsToUser (user)
{
    const inputs = ['inp_username', 'inp_name', 'inp_surname', 'inp_nickname', 'inp_contact'];
    const updatedData = {};
    inputs.forEach(inputId => {
        const inputElement = document.getElementById(inputId);
        const field = inputId.replace('inp_', '');
        if (inputElement.value !== user[field]) {
            updatedData[field] = inputElement.value;
        }
    });
    return updatedData;
}