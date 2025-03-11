function getTournamentID() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('tournamentID');
}

// Example usage:
const tournamentID = getTournamentID();
console.log(tournamentID);
localStorage.setItem('tournamentID', tournamentID);