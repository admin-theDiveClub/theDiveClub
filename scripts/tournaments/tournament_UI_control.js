import { DB_Update } from '../supabase/supaBase_db_helpers.js';
import { DB_Delete } from '../supabase/supaBase_db_helpers.js';
import { DB_Insert } from '../supabase/supaBase_db_helpers.js';

export function UpdateTournamentUI_Control(_tournament, _tournamentPlayers, _tournamentLog, _tournamentRounds)
{
    UpdateAllUI(_tournament, _tournamentPlayers, _tournamentLog, _tournamentRounds);
}

var tournament = null;
var tournamentRounds = null;
var tournamentLog = null;
var tournamentPlayers = null;

function UpdateAllUI (_tournament, _tournamentPlayers, _tournamentLog, _tournamentRounds)
{
    tournament = _tournament;
    tournamentPlayers = _tournamentPlayers;
    tournamentLog = _tournamentLog;
    tournamentRounds = _tournamentRounds;

    UpdateTournamentInfo(_tournament);
    UpdateEntriesList(_tournamentPlayers);
    UpdateEligiblePlayers(GetConfirmedPlayers(_tournamentPlayers), _tournamentLog, _tournament.multiLife);
    UpdateTournamentRounds(_tournamentRounds);
    UpdateTournamentMatches(_tournamentPlayers, _tournamentRounds);
}

//Tournament Info
async function UpdateTournamentInfo(tournament)
{
    const setText = (id, text, label) => 
    {
        const el = document.getElementById(id);
        if (el) el.textContent = label + ": " + (text ?? '');
    };

    const setInput = (id, value) =>
    {
        const el = document.getElementById(id);
        if (!el) return;
        if ('value' in el) el.value = value ?? '';
        else el.textContent = value ?? '';
    };

    setText('t-info-v-name', tournament.name || '', 'Tournament Name');
    setInput('t-info-name', tournament.name || '');

    setText('t-info-v-max-entries', tournament.maxEntries != null ? String(tournament.maxEntries) : '', 'Max Entries');
    setInput('t-info-max-entries', tournament.maxEntries != null ? String(tournament.maxEntries) : '');

    setText('t-info-v-format', tournament.format || '', 'Format');
    setInput('t-info-format', tournament.format || '');

    // Format date and time safely for display and for the input controls
    let formattedDate = '';
    if (tournament.date) 
    {
        try 
        {
            const [y, m, d] = tournament.date.split('-').map(Number);
            let hours = 0, minutes = 0;
            if (tournament.time) 
            {
                const [hh, mm] = tournament.time.split(':').map(Number);
                hours = hh || 0;
                minutes = mm || 0;
            }
            const dt = new Date(y, m - 1, d, hours, minutes);
            formattedDate = dt.toLocaleDateString();
            setText('t-info-v-time', tournament.time ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', 'Time');

            // Set inputs: date input expects YYYY-MM-DD, time input expects HH:MM
            setInput('t-info-date', tournament.date);
            setInput('t-info-time', tournament.time ? tournament.time.slice(0,5) : '');
        } catch (e) {
            formattedDate = tournament.date;
            setText('t-info-v-time', tournament.time || '', 'Time');
            setInput('t-info-date', tournament.date);
            setInput('t-info-time', tournament.time || '');
        }
    } else 
    {
        setText('t-info-v-time', tournament.time || '', 'Time');
        setInput('t-info-date', '');
        setInput('t-info-time', tournament.time || '');
    }
    setText('t-info-v-date', formattedDate, 'Date');

    setText('t-info-v-location', tournament.location || '', 'Location');
    setInput('t-info-location', tournament.location || '');

    // Try to resolve coordinator name/contact from players list (if available)
    let coordName = '';
    let coordContact = '';
    let coordUsername = '';

    const profile = async (playerID) =>
    {
        const response = await supabase.from('tbl_players').select('*').eq('id', playerID);
        return response.data && response.data[0];
    };

    if (tournament.coordinatorID) {
        const playerProfile = await profile(tournament.coordinatorID);
        if (playerProfile) 
        {
            const fullName = [playerProfile.name, playerProfile.surname].filter(Boolean).join(' ');
            coordUsername = playerProfile.username || coordUsername;
            coordName = fullName || playerProfile.username || playerProfile.nickname || coordName;
            coordContact = playerProfile.contact || playerProfile.username || coordContact;
        }
    } else {
        // fallback to any coordinator fields on tournament object
        coordName = tournament.coordinatorName || '';
        coordContact = tournament.coordinatorContact || '';
        coordUsername = tournament.coordinatorUsername || '';
    }

    setText('t-info-v-coordinator-name', coordName, 'Co-ordinator Name');
    setText('t-info-v-coordinator-contact', coordContact, 'Co-ordinator Contact');

    setInput('t-info-coordinator-name', coordUsername);
    setInput('t-info-coordinator-contact', coordContact);

    setText('t-info-v-description', tournament.description || '', 'Description');
    // the edit description is a contenteditable div, set its textContent/innerHTML
    const descEl = document.getElementById('t-info-description');
    if (descEl) descEl.textContent = tournament.description || '';

    document.getElementById('t-matches-max-entries').value = tournament.maxEntries || 0;
    document.getElementById('t-matches-lives-per-player').value = tournament.multiLife || 1;
}

const editToggleBtn = document.getElementById('t-info-editToggle-btn');
if (editToggleBtn)
{
    editToggleBtn.addEventListener('click', function() 
    {
        const editCard = document.getElementById('t-info-edit');
        const viewCard = document.getElementById('t-info-view');

        if (editCard) {editCard.style.display = 'block';}
        if (viewCard) {viewCard.style.display = 'none';}
    });
}

const editCancelBtn = document.getElementById('t-info-editCancel-btn');
if (editCancelBtn) 
{
    editCancelBtn.addEventListener('click', function() 
    {
        const editCard = document.getElementById('t-info-edit');
        const viewCard = document.getElementById('t-info-view');

        editCard.style.display = "none";
        viewCard.style.display = "block";
    });
}

const editBtn = document.getElementById('t-info-edit-btn');
if (editBtn) 
{
    editBtn.addEventListener('click', async function() 
    {
        const el = id => document.getElementById(id);

        // create/assign a global tournament_new from an existing tournament if present
        const source = tournament;
        const tn = Object.assign({}, source); // shallow clone

        const nameEl = el('t-info-name');
        const maxEl = el('t-info-max-entries');
        const formatEl = el('t-info-format');
        const dateEl = el('t-info-date');
        const timeEl = el('t-info-time');
        const locEl = el('t-info-location');
        const descEl = el('t-info-description');

        var allChanges = [];

        if (nameEl) tn.name = nameEl.value;
        if (tn.name != source.name) allChanges.push({ field: 'name', oldValue: source.name, newValue: tn.name });
        if (maxEl) tn.maxEntries = maxEl.value !== '' ? Number(maxEl.value) : null;
        if (tn.maxEntries != source.maxEntries) allChanges.push({ field: 'maxEntries', oldValue: source.maxEntries, newValue: tn.maxEntries });
        if (formatEl) tn.format = formatEl.value;
        if (tn.format != source.format) allChanges.push({ field: 'format', oldValue: source.format, newValue: tn.format });
        if (dateEl) tn.date = dateEl.value || null;
        if (tn.date != source.date) allChanges.push({ field: 'date', oldValue: source.date, newValue: tn.date });
        if (timeEl) tn.time = timeEl.value || null;
        // normalize time to HH:MM:SS
        if (timeEl) {
            const raw = timeEl.value || '';
            if (raw) {
                const parts = raw.split(':').map(p => Number(p || 0));
                const hh = Math.max(0, Math.min(23, parts[0] || 0));
                const mm = Math.max(0, Math.min(59, parts[1] || 0));
                const ss = Math.max(0, Math.min(59, parts[2] || 0));
                const pad = n => String(n).padStart(2, '0');
                tn.time = `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
            } else {
                tn.time = null;
            }
        }
        if (tn.time != source.time) allChanges.push({ field: 'time', oldValue: source.time, newValue: tn.time });
        if (locEl) tn.location = locEl.value;
        if (tn.location != source.location) allChanges.push({ field: 'location', oldValue: source.location, newValue: tn.location });
        if (descEl) tn.description = descEl.textContent || null;
        if (tn.description != source.description) allChanges.push({ field: 'description', oldValue: source.description, newValue: tn.description });

        // console.log('tournament_new', tn);
        // console.log('allChanges', allChanges);

        if (!Array.isArray(allChanges) || allChanges.length === 0) {
            alert('No changes to save.');
        } else {
            const fmt = v => {
                try {
                    if (v === null) return 'null';
                    if (v === undefined) return 'undefined';
                    if (typeof v === 'object') return JSON.stringify(v);
                    return String(v);
                } catch (e) {
                    return String(v);
                }
            };

            const lines = allChanges.map(c => `${c.field}: ${fmt(c.oldValue)} -> ${fmt(c.newValue)}`);
            const msg = 'The following changes will be applied:\n\n' + lines.join('\n');
            if (confirm(msg + '\n\nApply these changes to the database?')) 
            {
                const response = await DB_Update('tbl_tournaments', tn, tn.id);
                if (response.error) {
                    alert('Failed to push changes: ' + (response.error.message || String(response.error)));
                } else 
                {
                    const editCard = document.getElementById('t-info-edit');
                    const viewCard = document.getElementById('t-info-view');

                    editCard.style.display = "none";
                    viewCard.style.display = "block";
                }
            }
        }
    });
}

(function() {
    const maxEl = document.getElementById('t-matches-max-entries');
    const livesEl = document.getElementById('t-matches-lives-per-player');

    if (!maxEl && !livesEl) return;

    const parseIntOrNull = (v) => {
        if (v === null || v === undefined || String(v).trim() === '') return null;
        const n = parseInt(String(v), 10);
        return Number.isNaN(n) ? null : n;
    };

    const parseIntOrDefault = (v, def) => {
        const n = parseInt(String(v), 10);
        return Number.isNaN(n) ? def : n;
    };

    const pushUpdate = async (updatedFields) => {
        if (!tournament || !tournament.id) return;
        // apply fields to tournament
        Object.keys(updatedFields).forEach(k => { tournament[k] = updatedFields[k]; });

        try {
            const resp = await DB_Update('tbl_tournaments', tournament, tournament.id);
            if (resp && resp.error) {
                console.error('Failed to update tournament:', resp.error);
                alert('Failed to save tournament settings: ' + (resp.error.message || resp.error));
            }
            // Do NOT update any UI here — only persist to the database.
        } catch (e) {
            console.error('Error while updating tournament:', e);
        }
    };

    if (maxEl) {
        maxEl.addEventListener('change', async () => {
            const newVal = parseIntOrNull(maxEl.value);
            const oldVal = (typeof tournament !== 'undefined' && tournament) ? (typeof tournament.maxEntries === 'undefined' ? null : tournament.maxEntries) : null;
            if (oldVal === newVal) return;
            await pushUpdate({ maxEntries: newVal });
        });
    }

    if (livesEl) {
        livesEl.addEventListener('change', async () => {
            const newVal = parseIntOrDefault(livesEl.value, 1);
            const oldVal = (typeof tournament !== 'undefined' && tournament) ? (typeof tournament.multiLife === 'undefined' ? null : tournament.multiLife) : null;
            if (oldVal === newVal) return;
            await pushUpdate({ multiLife: newVal });
        });
    }
})();

//Entries
function UpdateEntriesList(entries)
{
    const table = document.getElementById('tbl-entries');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // clear existing rows
    tbody.innerHTML = '';

    const altRowColor = 'rgba(0,0,0,0.25)';

    //console.log('Entries', entries);
    if (!entries)
    {
        entries = [];
    }

    entries.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.dataset.username = p.username || '';
        tr.style.backgroundColor = (i % 2 === 0) ? altRowColor : '';

        // index cell
        const tdIndex = document.createElement('td');
        tdIndex.textContent = String(i + 1);
        tr.appendChild(tdIndex);

        // name cell (optional avatar + display name + username)
        const tdName = document.createElement('td');
        const nameWrap = document.createElement('div');
        nameWrap.style.display = 'flex';
        nameWrap.style.alignItems = 'center';
        nameWrap.style.gap = '8px';

        if (p.pp) {
            const img = document.createElement('img');
            img.src = p.pp;
            img.alt = '';
            img.width = 28;
            img.height = 28;
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            nameWrap.appendChild(img);
        }

        const txtWrap = document.createElement('div');
        const display = p.displayName || p.username || '';
        const main = document.createElement('div');
        main.textContent = display;
        txtWrap.appendChild(main);

        if (p.username && p.username !== display) {
            const sub = document.createElement('div');
            sub.textContent = p.username;
            sub.style.fontSize = '0.5em';
            sub.style.color = '#666';
            txtWrap.appendChild(sub);
        }

        nameWrap.appendChild(txtWrap);
        tdName.appendChild(nameWrap);
        tr.appendChild(tdName);

        // confirmed checkbox + label cell
        const tdConfirm = document.createElement('td');
        const safeId = `entry-check-${i}-${(p.username || '').replace(/[^a-z0-9_\-]/ig, '_')}`;
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'form-check-input';
        chk.id = safeId;
        chk.checked = !!p.confirmed;
        chk.dataset.username = p.username || '';
        tdConfirm.appendChild(chk);

        // when toggled, update local model and persist only the raw players list to DB
        chk.addEventListener('change', async () => {
            const checked = !!chk.checked;

            // update the in-memory tournamentPlayers entry if present
            if (Array.isArray(tournamentPlayers)) {
            const idx = tournamentPlayers.findIndex(tp =>
                (tp.username && tp.username === (p.username || '')) ||
                (tp.id != null && tp.id == p.id)
            );
            if (idx !== -1) {
                tournamentPlayers[idx].confirmed = checked;
            } else {
                p.confirmed = checked;
            }
            } else {
            p.confirmed = checked;
            }

            // build and push only the raw players list (username + confirmed)
            const rawPlayersList = (Array.isArray(tournamentPlayers) ? tournamentPlayers : [p])
            .map(pp => ({ username: pp.username, confirmed: !!pp.confirmed }));
            if (tournament) tournament.players = rawPlayersList;

            const response = await DB_Update('tbl_tournaments', tournament, tournament.id);
            if (response && response.error) {
            console.error('Failed to update tournament players:', response.error);
            }
        });

        if (p.confirmed) {
            const confirmedList = entries.filter(e => e.confirmed);
            let confirmedIndex = confirmedList.findIndex(cp => (cp.username || cp.id) === (p.username || p.id));
            if (confirmedIndex === -1) confirmedIndex = confirmedList.findIndex(cp => cp === p);
            if (confirmedIndex >= 0) {
                const pos = confirmedIndex + 1;
                const max = (tournament && typeof tournament.maxEntries !== 'undefined' && tournament.maxEntries !== null)
                    ? Number(tournament.maxEntries) : null;
                const labelText = (max !== null && !Number.isNaN(max) && pos > max) ? `! (${pos})` : `#${pos}`;

                const lbl = document.createElement('label');
                lbl.htmlFor = safeId;
                lbl.className = 'form-label tag';
                lbl.textContent = labelText;
                lbl.style.marginLeft = '6px';
                tdConfirm.appendChild(lbl);
            }
        }

        tr.appendChild(tdConfirm);

        // remove button cell
        const tdRemove = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.type = 'button';
        btn.title = 'Remove entry';
        btn.textContent = 'X';
        btn.addEventListener('click', () => {
            tr.remove();
            // renumber remaining rows and labels, reapply zebra striping
            Array.from(tbody.querySelectorAll('tr')).forEach((row, idx) => {
                const firstTd = row.querySelector('td');
                if (firstTd) firstTd.textContent = String(idx + 1);
                const label = row.querySelector('label.tag');
                if (label) label.textContent = `#${idx + 1}`;
                row.style.backgroundColor = (idx % 2 === 1) ? altRowColor : '';
            });
            
            (async () => {
                const uname = tr.dataset.username || '';
                if (!uname || !Array.isArray(tournamentPlayers)) return;

                const idx = tournamentPlayers.findIndex(p => p.username === uname || String(p.id) === uname);
                if (idx !== -1) {
                    tournamentPlayers.splice(idx, 1);

                    // update tournament.players for DB
                    const rawPlayersList = tournamentPlayers.map(p => ({ username: p.username, confirmed: p.confirmed }));
                    if (tournament) tournament.players = rawPlayersList;

                    // persist change
                    const response = await DB_Update('tbl_tournaments', tournament, tournament.id);
                    if (response.error) {
                        console.error('Error updating tournament:', response.error);
                    }
                }
            })();
        });
        tdRemove.appendChild(btn);
        tr.appendChild(tdRemove);

        tbody.appendChild(tr);
    });

    table.dispatchEvent(new CustomEvent('entries-loaded', { detail: { count: entries.length } }));
}

const addEntriesMultiBtn = document.getElementById('add-entries-multi-btn')
if (addEntriesMultiBtn)
{
    addEntriesMultiBtn.addEventListener('click', async function() 
    {
        const ta = document.getElementById('t-input-multiplePlayers');
        console.log(ta.value);

        const lines = (ta.value || '').split(/\r?\n/);
        const newEntriesList = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            const m = trimmed.match(/^[^.]*\.\s*(.*)$/);
            return m ? m[1].trim() : trimmed;
        }).filter(Boolean);

        console.log(newEntriesList);

        for (var i = 0; i < newEntriesList.length; i ++)
        {
            const entry = newEntriesList[i];
            var entryFound = false;
            if (!tournamentPlayers)
            {
                tournamentPlayers = [];
            }
            for (var j = 0; j < tournamentPlayers.length; j ++)
            {
                const player = tournamentPlayers[j];
                if (player.username === entry || player.displayName === entry)
                {
                    entryFound = true;
                    break;
                }
            }
            if (!entryFound)
            {
                const newTournamentPlayer = 
                {
                    username: entry,
                    confirmed: false
                };
                tournamentPlayers.push(newTournamentPlayer);
            }
        }

        var rawPlayersList = tournamentPlayers.map(p => ({ username: p.username, confirmed: p.confirmed }));
        tournament.players = rawPlayersList;
        const response = await DB_Update('tbl_tournaments', tournament, tournament.id);
        if (response.error)
        {
            console.error('Error updating tournament:', response.error);
        }
    });
    
}

(function() {
    const el = document.getElementById('t-input-newEntry');
    if (!el) return;
    el.addEventListener('input', () => 
    { 
        if (el.value == '')
        {
            document.getElementById('searchResults-container').style.display = 'none';
        } else 
        {
            document.getElementById('searchResults-container').style.display = 'block';
            GetPlayerProfiles(el.value);    
        }
    });
    el.addEventListener('focus', () => 
    { 
        if (el.value == '')
        {
            document.getElementById('searchResults-container').style.display = 'none';
        } else 
        {
            document.getElementById('searchResults-container').style.display = 'block';
            GetPlayerProfiles(el.value);    
        }  
    });

    document.getElementById('searchResults-container').addEventListener('click', () => { document.getElementById('searchResults-container').style.display = 'none'; });
})();

async function GetPlayerProfiles(_searchTerm)
{
    const term = String(_searchTerm || '').trim();
    if (!term) return null;

    const pattern = `%${term}%`;
    const orExpr = [
        `username.ilike.${pattern}`,
        `name.ilike.${pattern}`,
        `surname.ilike.${pattern}`,
        `nickname.ilike.${pattern}`,
    ].join(',');

    const response = await supabase
        .from('tbl_players')
        .select('*')
        .or(orExpr)
        .limit(10);

    const container = document.getElementById('searchResults-container');
    if (!container) return null;
    container.innerHTML = '';

    const defaultImg = '../resources/icon_theDiveClub_alpha.svg';

    for (let i = (response.data || []).length - 1; i >= 0; i--) 
    {
        const player = response.data[i];

        // resolve profile pic
        let picUrl = defaultImg;
        try {
            const response_pic = await supabase.storage.from('bucket-profile-pics').getPublicUrl(String(player.id));
            if (response_pic && response_pic.data && response_pic.data.publicUrl && !response_pic.data.publicUrl.endsWith('null')) {
                picUrl = response_pic.data.publicUrl;
            }
        } catch (e) {
            // keep default
        }
        player.pp = picUrl;

        // build result row like the provided example
        const row = document.createElement('div');
        row.className = 'searchResult d-flex align-items-center px-2 py-1';
        row.style.cursor = 'pointer';
        row.dataset.username = player.username || '';

        const img = document.createElement('img');
        img.src = player.pp || defaultImg;
        img.alt = 'Player Icon';
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.objectFit = 'contain';
        row.appendChild(img);

        const infoWrap = document.createElement('div');
        infoWrap.className = 'ms-3 text-truncate';
        infoWrap.style.minWidth = '0';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'fw-semibold me-2';
        const fullName = ((player.name || '') + (player.surname ? (player.name ? ' ' : '') + player.surname : '')).trim();
        const displayName = fullName || player.username || '';
        if (player.nickname) {
            nameSpan.textContent = displayName ? `${displayName} (${player.nickname})` : `(${player.nickname})`;
        } else {
            nameSpan.textContent = displayName;
        }

        const userSpan = document.createElement('span');
        userSpan.textContent = player.username ? `@${player.username}` : '';

        infoWrap.appendChild(nameSpan);
        infoWrap.appendChild(userSpan);
        row.appendChild(infoWrap);

        row.addEventListener('click', () => {
            const input = document.getElementById('t-input-newEntry');
            console.log('Player selected:', player);
            if (input) input.value = player.username || '';
            document.getElementById('searchResults-container').style.display = 'none';
        });

        container.appendChild(row);
    }
    return response.data;
}

const addEntryBtn = document.getElementById('add-entry-btn');
if (addEntryBtn)
{
    addEntryBtn.addEventListener('click', async function()
    {
        const entry = document.getElementById('t-input-newEntry').value.trim();
        if (!entry) return;

        var entryFound = false;
        if (tournamentPlayers)
        {
            for (var j = 0; j < tournamentPlayers.length; j ++)
            {
                const player = tournamentPlayers[j];
                if (player.username === entry || player.displayName === entry)
                {
                    entryFound = true;
                    break;
                }
            }
        } else 
        {
            tournamentPlayers = [];
        }
        if (!entryFound)
        {
            const newTournamentPlayer = 
            {
                username: entry,
                confirmed: false
            };
            tournamentPlayers.push(newTournamentPlayer);
        }

        var rawPlayersList = tournamentPlayers.map(p => ({ username: p.username, confirmed: p.confirmed }));
        tournament.players = rawPlayersList;
        const response = await DB_Update('tbl_tournaments', tournament, tournament.id);
        if (response.error)
        {
            console.error('Error updating tournament:', response.error);
        } else 
        {
            document.getElementById('t-input-newEntry').value = '';
        }
    });
}


//Players
function GetConfirmedPlayers (players)
{
    if (!players || players.length === 0) return [];

    const confirmed = players.filter(p => p && p.confirmed);

    const maxEntries = tournament && tournament.maxEntries !== undefined
        ? Number(tournament.maxEntries)
        : null;

    if (Number.isFinite(maxEntries) && maxEntries >= 0) {
        return confirmed.slice(0, maxEntries);
    }

    return confirmed;
}

function UpdateEligiblePlayers(players, log, multiLife) 
{
    const table = document.getElementById('tbl-eligiblePlayers');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // clear existing rows
    tbody.innerHTML = '';

    const altRowColor = 'rgba(0,0,0,0.25)';
    const maxLives = Number(multiLife) || 1;

    // helper to get ML for a player from log (supports array of entries or object keyed by username)
    const getML = (p) => {
        if (!p || !p.username) return 0;
        if (!log) return 0;
        if (Array.isArray(log)) {
            const entry = log.find(l => String(l.username) === String(p.username));
            return entry && typeof entry.ML !== 'undefined' ? Number(entry.ML) || 0 : 0;
        } else if (typeof log === 'object') {
            const entry = log[String(p.username)];
            return entry && typeof entry.ML !== 'undefined' ? Number(entry.ML) || 0 : 0;
        }
        return 0;
    };

    // only include players where ML < multiLife
    const eligible = (players || []).filter(p => {
        const ml = getML(p);
        return ml < maxLives;
    });

    eligible.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? altRowColor : '';
        tr.dataset.username = p.username || '';
        tr.style.cursor = 'pointer';

        // index
        const tdIndex = document.createElement('td');
        tdIndex.textContent = String(i + 1);
        tr.appendChild(tdIndex);

        // player display name
        const tdPlayer = document.createElement('td');
        tdPlayer.textContent = p.displayName || p.username || '';
        tdPlayer.classList.add('cell-player-swappable');
        tr.appendChild(tdPlayer);

        // lives remaining = multiLife - ML (from log)
        const tdLives = document.createElement('td');
        const ml = getML(p);
        const remaining = Math.max(0, maxLives - ml);
        tdLives.textContent = String(remaining);
        tr.appendChild(tdLives);

        // click to select for swapping: find the corresponding tournamentPlayers entry (by username or id) and call Swap_matchPlayer(player, null)
        tr.addEventListener('click', () => 
        {
            let found = null;
            if (Array.isArray(tournamentPlayers)) 
            {
                found = tournamentPlayers.find(tp => {
                    if (p.username && tp.username === p.username) return true;
                    if (p.id != null && tp.id != null && String(tp.id) === String(p.id)) return true;
                    return false;
                }) || null;
            }
            // pass the tournament player if found, otherwise pass the original player object
            Swap_matchPlayer(found.username || p, null, null, tdPlayer);
        });

        tbody.appendChild(tr);
    });
}

const btn_randomizeEligiblePlayers = document.getElementById('btn-randomize-eligible');
if (btn_randomizeEligiblePlayers)
{
    btn_randomizeEligiblePlayers.addEventListener('click', () =>
    {
        const table = document.getElementById('tbl-eligiblePlayers');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        RandomizeEligiblePlayers (tbody);
    });
}

function RandomizeEligiblePlayers (tableBody)
{
    const e_players = GetConfirmedPlayers(tournamentPlayers);

    // Shuffle eligible players list and rebuild UI
    if (!Array.isArray(e_players) || e_players.length <= 1) return;

    // Fisher–Yates shuffle on a copy
    const shuffled = e_players.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // store for later use (e.g., LoadRound1)
    shuffledList = shuffled;

    // Re-render eligible players table
    UpdateEligiblePlayers(shuffled, tournamentLog, tournament.multiLife);
}

var shuffledList = null;

const btn_load_round1 = document.getElementById('btn-load-round-1');
if (btn_load_round1)
{
    btn_load_round1.addEventListener('click', () =>
    {
        LoadRound1();
    });
}

async function LoadRound1 ()
{
    var playersList = GetConfirmedPlayers(tournamentPlayers);
    if (shuffledList)
    {
        playersList = shuffledList;
    }
    const roundMatches = tournamentRounds[1];
    console.log(playersList, roundMatches);

    for (var i = 0; i < roundMatches.length; i ++)
    {
        var match = roundMatches[i].match;
        if (!match.players)
        {
            match.players = {h: null, a: null};
        } 
        const player_h = playersList[i * 2] || null;
        if (player_h && !match.players.h || !match.players.h.username)
        {
            match.players.h = {username: player_h.username};
        }

        const player_a = playersList[i * 2 + 1] || null;
        if (player_a && !match.players.a || !match.players.a.username)
        {
            match.players.a = {username: player_a.username};
        }
        roundMatches[i].match = match;
    }
    console.log(roundMatches);

    // Persist all updated matches for this round in parallel
    try {
        const items = Array.isArray(roundMatches) ? roundMatches : Object.values(roundMatches || {});
        const updates = items
            .map(x => x && x.match)
            .filter(m => m && m.id)
            .map(m => DB_Update('tbl_matches', m, m.id));

        const results = await Promise.all(updates);
        const failures = results.filter(r => r && r.error);
        if (failures.length) {
            console.error('Some matches failed to update:', failures.map(f => f.error));
        }
    } catch (err) {
        console.error('Failed to update round matches:', err);
    }
}

//Rounds
function UpdateTournamentRounds(rounds)
{
    const table = document.getElementById('tbl-t-rounds');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!rounds || typeof rounds !== 'object') {
        table.dispatchEvent(new CustomEvent('rounds-updated', { detail: { count: 0 } }));
        return;
    }

    const roundKeys = Object.keys(rounds).map(k => Number(k)).filter(n => !Number.isNaN(n)).sort((a,b) => a - b);

    roundKeys.forEach((rnum, idx) => {
        const rk = String(rnum);
        const matchesObj = rounds[rk] || {};
        const matchKeys = Object.keys(matchesObj);
        const total = matchKeys.length;

        let complete = 0;
        for (const mk of matchKeys) {
            const entry = matchesObj[mk];
            const status = entry && entry.match && entry.match.info && entry.match.info.status;
            if (String(status) === 'Complete') complete++;
        }

        const tr = document.createElement('tr');

        const tdRound = document.createElement('td');
        tdRound.textContent = `Round ${rnum}`;
        tr.appendChild(tdRound);

        const tdMatches = document.createElement('td');
        tdMatches.textContent = `${complete} / ${total}`;
        tr.appendChild(tdMatches);

        // add button cell for creating a new match in this round
        const tdAdd = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-success';
        btn.type = 'button';
        btn.title = 'New Match';
        btn.setAttribute('aria-label', 'New Match');
        btn.dataset.round = rk;

        const icon = document.createElement('i');
        icon.className = 'bi bi-plus';
        btn.appendChild(icon);

        btn.addEventListener('click', async () => 
        {
            const newMatch = 
            {
                competitions: 
                {
                    tournamentID: tournament.id
                },
                info: 
                {
                    round: rk,
                    status: 'New'
                },
                players: 
                {
                    h: { username: null },
                    a: { username: null }
                }
            };
            await DB_Insert('tbl_matches', newMatch);
        });

        tdAdd.appendChild(btn);
        tr.appendChild(tdAdd);

        tbody.appendChild(tr);
    });
}

const btnAddRound = document.getElementById('btn-add-round');
if (btnAddRound)
{
    btnAddRound.addEventListener('click', async () => 
    {
        const newMatch = 
        {
            competitions: 
            {
                tournamentID: tournament.id
            },
            info: 
            {
                round: (Object.keys(tournamentRounds || {}).length + 1).toString(),
                status: 'New'
            },
            players: 
            {
                h: { username: null },
                a: { username: null }
            }
        };
        await DB_Insert('tbl_matches', newMatch);
    });
}

function GetPlayerDisplayName(username)
{
    var playerName = username;
    if (username)
    {
        for (var i = 0; i < Object.keys(tournamentPlayers).length; i ++)
        {
            var p = tournamentPlayers[i.toString()];
            if (p.username === username)
            {
                playerName = p.displayName || p.username;
            }
        }
    } 
    return playerName;
}

//Matches
function UpdateTournamentMatches(players, rounds)
{
    const e_table = document.getElementById('tbl-t-matches');
    const e_tbody = e_table.querySelector('tbody');
    e_tbody.innerHTML = '';

    for (var i = 0; i < rounds.length; i ++)
    {
        const round = rounds[i];
        if (round)
        {
            const tr_roundHeader = document.createElement('tr');
            const td_roundHeader = document.createElement('td');
            td_roundHeader.colSpan = 5;
            td_roundHeader.textContent = `Round ${i}`;
            td_roundHeader.className = 'round-header';
            tr_roundHeader.appendChild(td_roundHeader);
            e_tbody.appendChild(tr_roundHeader);

            for (var j = 0; j < round.length; j ++)
            {
                const m_Obj = round[j];
                if (m_Obj && m_Obj.match)
                {
                    const m = m_Obj.match;
                    if (completedMatchesHidden && m.info.status === 'Complete') break;
                    const tr_match = document.createElement('tr');

                    const td_match_status = document.createElement('td');
                    const td_player_h = document.createElement('td');
                    const td_score_h = document.createElement('td');
                    const td_score_a = document.createElement('td');
                    const td_player_a = document.createElement('td');
                    const td_match_link = document.createElement('td');
                    const td_match_delete = document.createElement('td');

                    // status checkbox cell
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.className = 'form-check-input';
                    chk.id = `option-check-${m.id ?? `${i}-${j}`}`;
                    chk.checked = !!(m.info && String(m.info.status) === 'Complete');
                    chk.addEventListener('change', async () => {
                        try {
                            if (!m.info) m.info = {};
                            m.info.status = chk.checked ? 'Complete' : 'New';
                            const resp = await DB_Update('tbl_matches', m, m.id);
                            if (resp && resp.error) console.error('Failed to update match status', resp.error);
                        } catch (err) {
                            console.error('Error updating match status', err);
                        }
                    });
                    td_match_status.appendChild(chk);

                    // player H cell (clickable / swappable)
                    td_player_h.classList.add('cell-player-swappable');
                    td_player_h.textContent = GetPlayerDisplayName((m.players && m.players.h && m.players.h.username) ? m.players.h.username : '---') || '?';
                    td_player_h.style.cursor = 'pointer';
                    td_player_h.addEventListener('click', () => {
                        Swap_matchPlayer((m.players && m.players.h && m.players.h.username) || null, m, 'h', td_player_h);
                    });

                    // score H input
                    const scoreH = document.createElement('input');
                    scoreH.type = 'number';
                    scoreH.inputMode = 'numeric';
                    scoreH.pattern = '[0-9]*';
                    scoreH.min = '0';
                    scoreH.step = '1';
                    scoreH.placeholder = '-';
                    scoreH.className = 'form-control t-info-item';
                    scoreH.id = `m-score-H-${m.id ?? `${i}-${j}`}`;
                    var score_H = 0;
                    if (m.results && m.results.h)
                    {
                        if (m.results.h.fw > 0 || m.info.status === 'Complete')
                        {
                            score_H = m.results.h.fw;
                            scoreH.value = score_H;
                        } else 
                        {
                            scoreH.value = '';
                        }
                    }
                    scoreH.addEventListener('change', async () => 
                    {
                        if (!m.results) m.results = {};
                        if (!m.results.h) m.results.h = {};
                        m.results.h.fw = scoreH.value === '' ? 0 : Number(scoreH.value);
                        const resp = await DB_Update('tbl_matches', m, m.id);
                    });
                    td_score_h.appendChild(scoreH);

                    // score A input
                    const scoreA = document.createElement('input');
                    scoreA.type = 'number';
                    scoreA.inputMode = 'numeric';
                    scoreA.pattern = '[0-9]*';
                    scoreA.min = '0';
                    scoreA.step = '1';
                    scoreA.placeholder = '-';
                    scoreA.className = 'form-control t-info-item';
                    scoreA.id = `m-score-A-${m.id ?? `${i}-${j}`}`;
                    var score_A = 0;
                    if (m.results && m.results.a)
                    {
                        if (m.results.a.fw > 0 || m.info.status === 'Complete')
                        {
                            score_A = m.results.a.fw;
                            scoreA.value = score_A;
                        } else 
                        {
                            scoreA.value = '';
                        }
                    }
                    scoreA.addEventListener('change', async () => 
                    {
                        if (!m.results) m.results = {};
                        if (!m.results.a) m.results.a = {};
                        m.results.a.fw = scoreA.value === '' ? 0 : Number(scoreA.value);
                        const resp = await DB_Update('tbl_matches', m, m.id);
                    });
                    td_score_a.appendChild(scoreA);

                    // player A cell (clickable / swappable)
                    td_player_a.classList.add('cell-player-swappable');
                    td_player_a.textContent = GetPlayerDisplayName((m.players && m.players.a && m.players.a.username) ? m.players.a.username : '---') || '?';
                    td_player_a.style.cursor = 'pointer';
                    td_player_a.addEventListener('click', () => {
                        Swap_matchPlayer((m.players && m.players.a && m.players.a.username) || null, m, 'a', td_player_a);
                    });

                    // link / open icon
                    const link = document.createElement('a');
                    link.href = `https://thediveclub.org/matches/index.html?matchID=${m.id}`;
                    link.className = 'btn btn-link p-0';
                    link.title = 'Open match';
                    link.setAttribute('aria-label', 'Open match');

                    const openIcon = document.createElement('i');
                    openIcon.className = 'bi bi-box-arrow-up-right';
                    link.appendChild(openIcon);

                    td_match_link.appendChild(link);

                    // delete button
                    const delBtn = document.createElement('button');
                    delBtn.className = 'btn btn-sm btn-danger';
                    delBtn.type = 'button';
                    delBtn.textContent = 'X';
                    delBtn.title = 'Remove match';
                    delBtn.addEventListener('click', async () => {
                        if (!confirm('Delete this match?')) return;
                        try {
                            const resp = await DB_Delete('tbl_matches', m.id);
                            if (resp && resp.error) {
                                console.error('Failed to delete match', resp.error);
                                alert('Failed to delete match: ' + (resp.error.message || resp.error));
                                return;
                            }
                            tr_match.remove();
                        } catch (err) {
                            console.error('Error deleting match', err);
                        }
                    });
                    td_match_delete.appendChild(delBtn);

                    // append tds to match row and add to tbody
                    tr_match.appendChild(td_match_status);
                    tr_match.appendChild(td_player_h);
                    tr_match.appendChild(td_score_h);
                    tr_match.appendChild(td_score_a);
                    tr_match.appendChild(td_player_a);
                    tr_match.appendChild(td_match_link);
                    tr_match.appendChild(td_match_delete);

                    e_tbody.appendChild(tr_match);
                }
            }
        }        
    }
}

var completedMatchesHidden = false;
const input_hideCompleted = document.getElementById('option-hideCompleted');
if (input_hideCompleted)
{
    input_hideCompleted.addEventListener('change', async () => 
    {
        completedMatchesHidden = input_hideCompleted.checked;
        UpdateTournamentMatches(tournamentPlayers, tournamentRounds);
    });
}


var swapA = null;
var swapB = null;

async function Swap_matchPlayer(player, match, side, cell)
{
    if (!swapA)
    {
        swapA = { player, match, side, cell};
        cell.classList.add('cell-player-swap');
    } else 
    {
        swapB = { player, match, side, cell};

        if (swapA.match == swapB.match && swapA.side != swapB.side)
        {
            swapA.match.players[swapA.side] = { username: swapB.player };
            swapB.match.players[swapB.side] = { username: swapA.player };
            await DB_Update('tbl_matches', swapA.match, swapA.match.id);
            //clear swap variables
            swapA.cell.classList.remove('cell-player-swap');
            swapB.cell.classList.remove('cell-player-swap');
            swapA = null;
            swapB = null;
            return;
        }

        if (swapA.match == swapB.match && swapA.player == swapB.player)
        {
            if (!swapA.match.players){ swapA.match.players = {}; }
            swapA.match.players[swapA.side] = null;
            await DB_Update('tbl_matches', swapA.match, swapA.match.id);
            //clear swap variables
            swapA.cell.classList.remove('cell-player-swap');
            swapB.cell.classList.remove('cell-player-swap');
            swapA = null;
            swapB = null;
            return;
        }

        if (swapA.match)
        {
            swapA.match.players[swapA.side] = { username: swapB.player };
            await DB_Update('tbl_matches', swapA.match, swapA.match.id);
        }

        if (swapB.match)
        {
            swapB.match.players[swapB.side] = { username: swapA.player };
            await DB_Update('tbl_matches', swapB.match, swapB.match.id);
        }

        //clear swap variables
        swapA.cell.classList.remove('cell-player-swap');
        swapB.cell.classList.remove('cell-player-swap');
        swapA = null;
        swapB = null;
    }
}