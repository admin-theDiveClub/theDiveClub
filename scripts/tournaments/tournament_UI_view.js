export function UpdateTournamentUI(tournament, log, rounds, players)
{
    //console.log('UI: Tournament UI Update', tournament, log, rounds, players);
    tournamentRounds = rounds;
    tournamentPlayers = players;

    PopulateLog(log, players);
    PopulateProgressionCharts(rounds);
}

var tournamentRounds = null;
var tournamentPlayers = null;

function PopulateLog (log)
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
            GetPlayerDisplayName(entry.username) ?? '',
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

function PopulateProgressionCharts (rounds)
{       
    PopulateVerticalProgressionChart(rounds);
    PopulateVerticalAltProgressionChart(rounds);
    PopulateHorizontalProgressionChart(rounds);
}

function PopulateVerticalProgressionChart (rounds)
{
    const container = document.getElementById('progressionChart-V');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = 0; j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match);
            e_col.appendChild(e_card);
            match.card = e_card;
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }    
}

function PopulateVerticalAltProgressionChart (rounds)
{
    const container = document.getElementById('progressionChart-V-Alt');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = 0; j < rounds[i].length / 2; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match);
            e_col.appendChild(e_card);
            match.card = e_card;
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }

    for (let i = rounds.length - 1; i > 0; i --)
    {
        const e_row = document.createElement('div');
        e_row.className = 'row';
        for (let j = Math.ceil(rounds[i].length / 2); j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_col = document.createElement('div');
            e_col.className = 'col';
            const e_card = CreateMatchCard(match);
            e_col.appendChild(e_card);
            match.card = e_card;
            e_row.appendChild(e_col);
        }
        container.appendChild(e_row);
    }
}

function PopulateHorizontalProgressionChart (rounds)
{
    const container = document.getElementById('prog-chart-h-container');
    container.innerHTML = '';
    for (let i = 1; i < rounds.length; i ++)
    {
        const e_col = document.createElement('div');
        e_col.className = 'col';
        for (let j = 0; j < rounds[i].length; j ++)
        {
            const match = rounds[i][j].match;
            const e_card = CreateMatchCard(match);
            e_col.appendChild(e_card);
            match.card = e_card;
        }
        container.appendChild(e_col);
    }
    
}

function GetPlayerDisplayName(username)
{
    const player = username;
    if (username)
    {
        for (var i = 0; i < Object.keys(tournamentPlayers).length; i ++)
        {
            var p = tournamentPlayers[i.toString()];
            if (p.username === username)
            {
                return p.displayName;
            }
        }
    } 
    return player;
}

function CreateMatchCard (match)
{
    const e_card = document.createElement('div');
    e_card.className = 'card';
    e_card.id = `match-card-r${match.info.round}-${match.id}`;
    if (match.info.status === 'Complete')
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
    if (match.players && match.players.h && match.players.h.username)
    {
        name_H = GetPlayerDisplayName(match.players.h.username, tournamentPlayers);
    }
    e_td_name_H.textContent = name_H;
    e_td_name_H.classList.add('prog-player');
    const e_td_name_A = document.createElement('td');
    var name_A = '-';
    if (match.players && match.players.a && match.players.a.username)
    {
        name_A = GetPlayerDisplayName(match.players.a.username, tournamentPlayers);
    }
    e_td_name_A.textContent = name_A;
    e_td_name_A.classList.add('prog-player');
    e_tr_names.appendChild(e_td_name_H);
    e_tr_names.appendChild(e_td_name_A);
    e_table.appendChild(e_tr_names);

    const e_tr_scores = document.createElement('tr');

    const e_td_score_H = document.createElement('td');
    var score_H = 0;
    if (match.results && match.results.h)
    {
        score_H = match.results.h.fw;
    }
    e_td_score_H.textContent = score_H;
    e_td_score_H.classList.add('prog-score');

    const e_td_score_A = document.createElement('td');
    var score_A = 0;
    if (match.results && match.results.a)
    {
        score_A = match.results.a.fw;
    }
    e_td_score_A.textContent = score_A;
    e_td_score_A.classList.add('prog-score');

    if (score_H > score_A && match.info.status === 'Complete')
    {
        e_td_score_H.classList.add('prog-winner');
        e_td_name_H.classList.add('prog-winner');
    } else if (score_A > score_H && match.info.status === 'Complete')
    {
        e_td_score_A.classList.add('prog-winner');
        e_td_name_A.classList.add('prog-winner');
    }

    if (match.info.status !== 'Complete')
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
    return e_card;
}

function DrawProgressionArrows (visStructure)
{

}