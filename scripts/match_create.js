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

    console.log(response);
}