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
        window.location.href = "../matches/index.html?matchID=" + response.data[0].id;
    }
}