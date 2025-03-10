PopulateUI();

async function PopulateUI ()
{
    var username = localStorage.getItem('username');
    if (username == null)
    {
        //window.location.href = 'login.html';
    } else 
    {
        document.getElementById('txt_nT_coordinatorName').textContent = username;

        const response_getPlayer = await supabase.from('tbl_players').select('*').eq('username', username);        
        var playerInfo = response_getPlayer.data[0];

        if (error) 
        {
            console.error('Error fetching players:', error);
        } else 
        {
            console.log('Players fetched successfully:', playerInfo);
            document.getElementById('txt_nT_coordinatorID').textContent = playerInfo.id;
        }
    }
}

document.getElementById('btn_submit_newTournament').addEventListener('click', () => 
{
    var tournamentData = GetNewTournamentData();
    var newTournamentInfo = InsertNewTournament(tournamentData);
});

function GetNewTournamentData()
{
    const tournamentData = 
    {
        name: document.getElementById('txt_nT_name').value,
        date: document.getElementById('txt_nT_date').value,
        time: document.getElementById('txt_nT_time').value,
        location: document.getElementById('txt_nT_location').value,
        coordinatorID: localStorage.getItem('userID'),
        maxEntries: document.getElementById('txt_nT_maxEntries').value,
        description: document.getElementById('txt_nT_description').value
    };

    return tournamentData;
}

async function InsertNewTournament (_data)
{
    const response = await supabase.from('tbl_tournaments').insert(_data).select();

    if (response.error) 
    {
        console.error('Error inserting new tournament:', response.error);
        return null;
    } else 
    {
        console.log('New tournament created', response.data);
        document.getElementById('txt_nT_id').innerText = response.data[0].id;

        var tournamentEntryLink = "https://www.thediveclub.org/tournaments/entry.html?tournamentID=" + response.data[0].id;
        document.getElementById('txt_nT_link').innerText = tournamentEntryLink;

        var tournamentID = response.data[0].id;
        return tournamentID;
    } 
}