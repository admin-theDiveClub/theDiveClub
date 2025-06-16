// Add an event listener for the 'click' event
document.getElementById('btn-match-create').addEventListener('click', () => 
{
    var match = 
    {
        player_H: document.getElementById('player_H').value,
        player_A: document.getElementById('player_A').value,
    }
    CreateMatch(match);
});

async function CreateMatch (_match)
{
    const response = await supabase.from('tbl_matches').insert({
        player_H: _match.player_H,
        player_A: _match.player_A,
    }).select();

    console.log(response.data[0].id);

    if (response.error) {
        console.error('Error creating match:', response.error.message);
        alert('Failed to create match. Please try again.');
    } else {
        alert('Match created successfully!');        
        sessionStorage.setItem('frameStartTime', 0);
        window.location.href = "../TopDeadCenter/scorecard.html?matchID=" + response.data[0].id;
    }
}
// Add event listeners for the 'click' events of the account find buttons
document.getElementById('btn-account-find-H').addEventListener('click', async () => {
    const playerH = document.getElementById('player_H').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerH);

    const buttonH = document.getElementById('btn-account-find-H');
    if (response.data.length > 0) {
        buttonH.classList.remove('btn-primary', 'btn-warning');
        buttonH.classList.add('btn-success');
        buttonH.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
    } else {
        buttonH.classList.remove('btn-primary', 'btn-success');
        buttonH.classList.add('btn-warning');
        buttonH.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
    }
});

document.getElementById('btn-account-find-A').addEventListener('click', async () => {
    const playerA = document.getElementById('player_A').value;
    const response = await supabase.from('tbl_players').select('username').eq('username', playerA);

    const buttonA = document.getElementById('btn-account-find-A');
    if (response.data.length > 0) {
        buttonA.classList.remove('btn-primary', 'btn-warning');
        buttonA.classList.add('btn-success');
        buttonA.innerHTML = '<i class="bi bi-check-circle"></i> Account Found';
    } else {
        buttonA.classList.remove('btn-primary', 'btn-success');
        buttonA.classList.add('btn-warning');
        buttonA.innerHTML = '<i class="bi bi-x-circle"></i> Account Not Found';
    }
});

// Add event listeners to undo button class changes when input values are modified
document.getElementById('player_H').addEventListener('input', () => {
    const buttonH = document.getElementById('btn-account-find-H');
    buttonH.classList.remove('btn-success', 'btn-warning');
    buttonH.classList.add('btn-primary');
    buttonH.innerHTML = '<i class="bi bi-search"></i> Find Account';
});

document.getElementById('player_A').addEventListener('input', () => {
    const buttonA = document.getElementById('btn-account-find-A');
    buttonA.classList.remove('btn-success', 'btn-warning');
    buttonA.classList.add('btn-primary');
    buttonA.innerHTML = '<i class="bi bi-search"></i> Find Account';
});
