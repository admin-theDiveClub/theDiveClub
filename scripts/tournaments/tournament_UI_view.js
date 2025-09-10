export function UpdateTournamentUI(tournament, log, rounds, players)
{
    //console.log('UI: Tournament UI Update', tournament, log, rounds, players);
    tournamentRounds = rounds;
    PopulateLog(log, players);
    PopulateProgressionCharts(rounds, players);
}

var tournamentRounds = null;

function PopulateLog (log, players)
{
    const tbody = document.getElementById('tournament-standings');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(log)) return;

    log.forEach(entry => {
        const tr = document.createElement('tr');
        const fPct = entry['F%'] != null ? String(entry['F%']).replace('%', '') + '%' : '';
        const cols = [
            entry.Rank ?? '',
            GetPlayerDisplayName(entry.username, players) ?? '',
            entry.MP ?? '',
            entry.MW ?? '',
            entry.ML ?? '',
            entry.FP ?? '',
            entry.FW ?? '',
            fPct,
            entry['B/F'] ?? ''
        ];

        cols.forEach(value => {
            const td = document.createElement('td');
            td.textContent = value;
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function PopulateProgressionCharts (rounds, players)
{
    var visualizationStructure = {};

    // Get only the number of rounds
    const roundsLength = Object.keys(rounds).length;

    //Transform Data
    //Create Main visualization Structure
    for (var i = 1; i < roundsLength + 1; i ++)
    {
        visualizationStructure[i] = {round: i, part: 0};
    }
    for (var i = roundsLength; i < roundsLength * 2; i ++)
    {
        visualizationStructure[i] = {round: 2 * roundsLength - i, part: 1};
    }

    //Populate Visualization Structure
    for (var i = 1; i < roundsLength + 1; i ++)
    {
        if (i < roundsLength)
        {
            var r_matches_0 = [];
            var r_matches_1 = [];
            const r_matches_length = Object.keys(rounds[i.toString()]).length;

            for (var j = 0; j < r_matches_length; j ++)
            {
                var match = rounds[i.toString()][j.toString()];
                if (j < r_matches_length / 2)
                {
                    r_matches_0.push(match);
                }
                else
                {
                    r_matches_1.push(match);
                }
            }

            visualizationStructure[i] = r_matches_0;
            visualizationStructure[roundsLength * 2 - i] = r_matches_1;
        } else 
        {
            var r_matches = [];
            const r_matches_length = Object.keys(rounds[i.toString()]).length;

            for (var j = 0; j < r_matches_length; j ++)
            {
                var match = rounds[i.toString()][j.toString()];
                r_matches.push(match);
            }

            visualizationStructure[i] = r_matches;
        }        
    }
    
    PopulateVerticalProgressionChart(visualizationStructure, players);

}

function PopulateVerticalProgressionChart (visualizationStructure, players)
{
    const container = document.getElementById('progressionChart-V');
    container.innerHTML = '';
    for (const round in visualizationStructure)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (const match of visualizationStructure[round])
        {
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = document.createElement('div');
            e_card.className = 'card';
            e_card.id = `match-card-r${match.match.info.round}-${match.match.id}`;
            if (match.match.info.status === 'Complete')
            {
                e_card.classList.add('card-completed');
            } else 
            {
                e_card.classList.add('card-new');
            }
            const e_table = document.createElement('table');

            const e_tr_names = document.createElement('tr');
            const e_td_name_H = document.createElement('td');
            var name_H = '-';
            if (match.match.players && match.match.players.h && match.match.players.h.username)
            {
                name_H = GetPlayerDisplayName(match.match.players.h.username, players);
            }
            e_td_name_H.textContent = name_H;
            e_td_name_H.classList.add('prog-player');
            const e_td_name_A = document.createElement('td');
            var name_A = '-';
            if (match.match.players && match.match.players.a && match.match.players.a.username)
            {
                name_A = GetPlayerDisplayName(match.match.players.a.username, players);
            }
            e_td_name_A.textContent = name_A;
            e_td_name_A.classList.add('prog-player');
            e_tr_names.appendChild(e_td_name_H);
            e_tr_names.appendChild(e_td_name_A);
            e_table.appendChild(e_tr_names);

            const e_tr_scores = document.createElement('tr');

            const e_td_score_H = document.createElement('td');
            var score_H = 0;
            if (match.match.results && match.match.results.h)
            {
                score_H = match.match.results.h.fw;
            }
            e_td_score_H.textContent = score_H;
            e_td_score_H.classList.add('prog-score');

            const e_td_score_A = document.createElement('td');
            var score_A = 0;
            if (match.match.results && match.match.results.a)
            {
                score_A = match.match.results.a.fw;
            }
            e_td_score_A.textContent = score_A;
            e_td_score_A.classList.add('prog-score');

            if (score_H > score_A && match.match.info.status === 'Complete')
            {
                e_td_score_H.classList.add('prog-winner');
                e_td_name_H.classList.add('prog-winner');
            } else if (score_A > score_H && match.match.info.status === 'Complete')
            {
                e_td_score_A.classList.add('prog-winner');
                e_td_name_A.classList.add('prog-winner');
            }

            if (match.match.info.status !== 'Complete')
            {
                if (name_H !== '-' || name_A !== '-' || score_H !== 0 || score_A !== 0)
                {
                    e_card.classList.remove('card-new');
                    e_card.classList.add('card-live');
                }
            }

            e_tr_scores.appendChild(e_td_score_H);
            e_tr_scores.appendChild(e_td_score_A);
            e_table.appendChild(e_tr_scores);

            e_card.appendChild(e_table);
            e_col.appendChild(e_card);
            match.card = e_card;
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }
    console.error('UI: Tournament Progression Structure', visualizationStructure);
    DrawProgressionArrows(visualizationStructure);
}

function GetPlayerDisplayName(username, players)
{
    const player = username;
    if (username)
    {
        for (var i = 0; i < Object.keys(players).length; i ++)
        {
            var p = players[i.toString()];
            if (p.username === username)
            {
                return p.displayName;
            }
        }
    } 
    return player;
}

function DrawProgressionArrows (visStructure)
{

}

function PopulateHorizontalProgressionChart (rounds)
{

}