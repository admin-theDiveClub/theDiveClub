Start ();

async function Start ()
{
    const tournamentID = GetTournamentID();
    const tournament = await GetTournament(tournamentID);
    const matches = await GetTournamentMatches(tournamentID);
    console.log("Tournament", tournament);
    console.log("Matches", matches);

    await PopulateLeagueDetails(tournament);
    PopulateTable(matches);
}

function GetTournamentID() 
{
    var tournamentID = new URLSearchParams(window.location.search).get('tournamentID');
    if (!tournamentID) 
    {
        tournamentID = localStorage.getItem('tournamentID')||sessionStorage.getItem('tournamentID');
    }
    if (tournamentID)
    {
        localStorage.setItem('tournamentID', tournamentID);
        sessionStorage.setItem('tournamentID', tournamentID);
        return tournamentID;
    } else 
    {
        return null;
    }
}

async function GetTournament (_tournamentID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _tournamentID);
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data[0];
    }
}

async function GetTournamentMatches (_tournamentID)
{
    const response = await supabase.from('tbl_matches').select('*').eq('tournamentID', _tournamentID);
    if (response.error)
    {
        return null;
    } else 
    {
        return response.data;
    }
}

async function PopulateLeagueDetails(_tournament)
{
    const response = await supabase.from('tbl_leagues').select('*').eq('id', _tournament.leagueID);
    const league = response.data[0];
    document.getElementById("leagueName").textContent = league.name || "N/A";
    document.getElementById("startDate").textContent = league.date_start || "N/A";
    document.getElementById("endDate").textContent = league.date_end || "N/A";
    document.getElementById("leagueFormat").textContent = league.format || "N/A";
    const response_co = await supabase.from('tbl_players').select('*').eq('id', league.coordinatorID);
    document.getElementById("leagueCoordinator").textContent = response_co.data[0].name + " " + response_co.data[0].surname;

    // Update the round name element with the tournament name and date
    const time = _tournament.time ? _tournament.time.slice(0, 5) : "N/A"; // Extract only hour and minutes
    document.getElementById("round-name").textContent = `${_tournament.name || "N/A"} (${_tournament.date || "N/A"}, ${time})`;
}

function PopulateTable(_matches) {



    const tableBody = document.querySelector("#tbl-matches tbody");
    tableBody.innerHTML = ""; // Clear existing rows

    _matches.forEach((match, index) => {
        const row = document.createElement("tr");
        row.id = `m_${index}`;

        const homeCell = document.createElement("td");
        const homePlayer = document.createElement("p");
        homePlayer.id = `m_${index}-playerH`;
        homePlayer.textContent = match.player_H;
        homeCell.appendChild(homePlayer);

        const scorecardCell = document.createElement("td");
        const scorecardLink = document.createElement("a");
        scorecardLink.href = `../matches/index.html?matchID=${match.id}`;
        scorecardLink.className = "btn btn-primary";
        scorecardLink.id = `m_${index}-scorecard`;
        scorecardLink.textContent = "Scorecard";
        scorecardCell.appendChild(scorecardLink);

        const awayCell = document.createElement("td");
        const awayPlayer = document.createElement("p");
        awayPlayer.id = `m_${index}-playerA`;
        awayPlayer.textContent = match.player_A;
        awayCell.appendChild(awayPlayer);

        row.appendChild(homeCell);
        row.appendChild(scorecardCell);
        row.appendChild(awayCell);

        tableBody.appendChild(row);
    });
}