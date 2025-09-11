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


//Matches
function UpdateTournamentMatches(players, rounds)
{
    const table = document.getElementById('tbl-t-matches');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Instead of clearing and rebuilding all rows, update existing rows where possible.
    // We key rows by match.id. If a match.id is new or removed, we insert/remove rows accordingly.

    // Create or reuse per-table maps
    const rowMap = table._rowByMatchId || (table._rowByMatchId = new Map());
    const headerMap = table._roundHeaderByKey || (table._roundHeaderByKey = new Map());

    const ensureHeaderRow = (rk, rnum) => {
        let trHeader = headerMap.get(rk);
        if (trHeader && !trHeader.isConnected) {
            headerMap.delete(rk);
            trHeader = null;
        }
        if (!trHeader) {
            trHeader = document.createElement('tr');
            trHeader.dataset.round = rk;

            const tdHeader = document.createElement('td');
            tdHeader.colSpan = 7;
            tdHeader.textContent = `Round ${rnum}`;
            tdHeader.style.fontWeight = 'bold';
            tdHeader.style.backgroundColor = 'rgba(0,0,0,0.25)';

            trHeader.appendChild(tdHeader);
            tbody.appendChild(trHeader);
            headerMap.set(rk, trHeader);
        } else {
            // keep header text in sync (in case round label changes)
            const tdHeader = trHeader.firstElementChild;
            if (tdHeader) tdHeader.textContent = `Round ${rnum}`;
            // keep at least attached to tbody
            if (trHeader.parentElement !== tbody) {
                tbody.appendChild(trHeader);
            }
        }
        return trHeader;
    };

    const ensureInsertedAfterHeader = (row, headerRow) => {
        // Insert the row right after the header if it's not already in DOM
        if (!row.isConnected) {
            if (headerRow.nextSibling) {
                tbody.insertBefore(row, headerRow.nextSibling);
            } else {
                tbody.appendChild(row);
            }
        }
    };

    const createMatchRow = (rk, mkKey) => {
        const tr = document.createElement('tr');
        tr.dataset.round = rk;

        // Completion checkbox
        const tdComplete = document.createElement('td');
        const chk = document.createElement('input');
        chk.className = 'form-check-input form-check-input-small';
        chk.type = 'checkbox';
        chk.id = `m-complete-${rk}-${mkKey}`;
        chk.title = 'Complete';
        tdComplete.appendChild(chk);
        tr.appendChild(tdComplete);

        // Home name
        const tdHName = document.createElement('td');
        tdHName.style.cursor = 'pointer';
        tdHName.title = 'Click to select this player for swapping';
        tdHName.classList.add('cell-player-swappable');
        tr.appendChild(tdHName);

        // Home score
        const tdHScore = document.createElement('td');
        const inputH = document.createElement('input');
        inputH.type = 'number';
        inputH.min = '0';
        inputH.step = '1';
        inputH.className = 'form-control t-info-item input-score';
        inputH.id = `m-score-${rk}-${mkKey}-h`;
        inputH.setAttribute('inputmode', 'numeric');
        inputH.setAttribute('pattern', '[0-9]*');
        tdHScore.appendChild(inputH);
        tr.appendChild(tdHScore);

        // Arrow cell
        const tdArrow = document.createElement('td');
        const link = document.createElement('a');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const icon = document.createElement('i');
        icon.className = 'bi bi-box-arrow-up-right';
        link.appendChild(icon);
        tdArrow.appendChild(link);
        tr.appendChild(tdArrow);

        // Away score
        const tdAScore = document.createElement('td');
        const inputA = document.createElement('input');
        inputA.type = 'number';
        inputA.min = '0';
        inputA.step = '1';
        inputA.className = 'form-control t-info-item input-score';
        inputA.id = `m-score-${rk}-${mkKey}-a`;
        inputA.setAttribute('inputmode', 'numeric');
        inputA.setAttribute('pattern', '[0-9]*');
        tdAScore.appendChild(inputA);
        tr.appendChild(tdAScore);

        // Away name
        const tdAName = document.createElement('td');
        tdAName.style.cursor = 'pointer';
        tdAName.title = 'Click to select this player for swapping';
        tdAName.classList.add('cell-player-swappable');
        tr.appendChild(tdAName);

        // Remove button
        const tdRemove = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.type = 'button';
        btn.title = 'Remove match';
        btn.textContent = 'X';
        tdRemove.appendChild(btn);
        tr.appendChild(tdRemove);

        // Store element refs
        tr._els = {
            chk,
            tdHName,
            inputH,
            link,
            inputA,
            tdAName,
            btnRemove: btn
        };

        // Listeners use row._match so we can update the bound data without recreating the row
        chk.addEventListener('change', async () => {
            const m = tr._match;
            if (!m) return;
            m.info = m.info || {};
            m.info.status = chk.checked ? 'Complete' : 'New';
            await DB_Update('tbl_matches', m, m.id);
        });

        tdHName.addEventListener('click', () => {
            const m = tr._match;
            if (!m) return;
            const uname = m && m.players && m.players.h ? m.players.h.username : null;
            Swap_matchPlayer(uname, m, 'h', tdHName);
            tdHName.classList.add('cell-player-swap');
        });

        inputH.addEventListener('change', async () => {
            const m = tr._match;
            if (!m) return;
            const raw = inputH.value;
            const parsed = raw === '' ? null : parseInt(raw, 10);
            m.results = m.results || { a: { fw: 0 }, h: { fw: 0 } };
            if (!m.results.h) m.results.h = { fw: 0 };
            m.results.h.fw = parsed ? parsed : 0;
            await DB_Update('tbl_matches', m, m.id);
        });

        inputA.addEventListener('change', async () => {
            const m = tr._match;
            if (!m) return;
            const raw = inputA.value;
            const parsed = raw === '' ? null : parseInt(raw, 10);
            m.results = m.results || { a: { fw: 0 }, h: { fw: 0 } };
            if (!m.results.a) m.results.a = { fw: 0 };
            m.results.a.fw = parsed ? parsed : 0;
            await DB_Update('tbl_matches', m, m.id);
        });

        tdAName.addEventListener('click', () => {
            const m = tr._match;
            if (!m) return;
            const uname = m && m.players && m.players.a ? m.players.a.username : null;
            Swap_matchPlayer(uname, m, 'a', tdAName);
            tdAName.classList.add('cell-player-swap');
        });

        btn.addEventListener('click', async () => {
            const m = tr._match;
            if (!m) return;
            const hName = tr._els.tdHName.textContent || '-';
            const aName = tr._els.tdAName.textContent || '-';
            if (confirm(`Delete match between ${hName} and ${aName}? This action cannot be undone.`)) {
                if (m.info.round == tournamentRounds.length - 1) {
                    await DB_Delete('tbl_matches', m.id);
                } else {
                    if (tournamentRounds[m.info.round].length > 1) {
                        await DB_Delete('tbl_matches', m.id);
                    } else {
                        alert("You cannot delete the last match in a preceeding round until you delete all matches in the following rounds.");
                    }
                }
            }
        });

        return tr;
    };

    const updateMatchRow = (tr, rk, mkKey, match, t_player_h, t_player_a) => {
        tr.dataset.matchId = String(match.id);
        tr._match = match;

        const els = tr._els;

        // Status
        const statusComplete = !!(match && match.info && String(match.info.status) === 'Complete');
        els.chk.checked = statusComplete;

        // Names
        els.tdHName.textContent = t_player_h ? (t_player_h.displayName || t_player_h.username || '-') : '-';
        els.tdAName.textContent = t_player_a ? (t_player_a.displayName || t_player_a.username || '-') : '-';

        // Scores
        const scH = match && match.results && match.results.h && typeof match.results.h.fw !== 'undefined'
            ? Number(match.results.h.fw) : 0;
        const scA = match && match.results && match.results.a && typeof match.results.a.fw !== 'undefined'
            ? Number(match.results.a.fw) : 0;

        els.inputH.value = String(scH);
        els.inputA.value = String(scA);

        // Reset and apply classes based on completion/winner
        els.inputH.classList.remove('input-complete', 'input-win');
        els.inputA.classList.remove('input-complete', 'input-win');
        if (statusComplete) {
            els.inputH.classList.add('input-complete');
            els.inputA.classList.add('input-complete');
            if (scH > scA) els.inputH.classList.add('input-win');
            if (scA > scH) els.inputA.classList.add('input-win');
        }

        // Link
        els.link.href = 'https://thediveclub.org/matches/scoreboard.html?matchID=' + encodeURIComponent(match.id);

        // Hide/Show based on filter
        if (completedMatchesHidden && statusComplete) {
            tr.style.display = 'none';
        } else {
            tr.style.display = '';
        }
    };

    // Build sorted round -> match keys
    const roundKeys = Object.keys(rounds)
        .map(k => Number(k))
        .filter(n => !Number.isNaN(n))
        .sort((a, b) => a - b);

    let totalMatches = 0;
    const seenIds = new Set();

    roundKeys.forEach(rnum => {
        const rk = String(rnum);
        const matchesObj = rounds[rk] || {};
        const matchKeys = Object.keys(matchesObj)
            .map(k => Number(k))
            .filter(n => !Number.isNaN(n))
            .sort((a, b) => a - b);

        // Ensure round header exists
        const headerRow = ensureHeaderRow(rk, rnum);

        matchKeys.forEach(mk => {
            const mkKey = String(mk);
            const mm = matchesObj[mkKey];
            if (!mm || !mm.match) return;

            const match = mm.match;
            if (!match || !match.id) return;

            seenIds.add(String(match.id));

            // Resolve players for display
            const un_h = match.players && match.players.h ? match.players.h.username : null;
            const un_a = match.players && match.players.a ? match.players.a.username : null;

            const FindMatchPlayerInTournamentPlayers = (username) => {
                if (!username) return null;
                return players.find(p => p.username === username) || null;
            };

            const t_player_h = FindMatchPlayerInTournamentPlayers(un_h);
            const t_player_a = FindMatchPlayerInTournamentPlayers(un_a);

            // Row by id
            let tr = rowMap.get(String(match.id));
            if (!tr) {
                tr = createMatchRow(rk, mkKey);
                rowMap.set(String(match.id), tr);
                ensureInsertedAfterHeader(tr, headerRow);
            } else if (!tr.isConnected) {
                // Row exists in map but got detached; reattach beneath header
                ensureInsertedAfterHeader(tr, headerRow);
            }

            updateMatchRow(tr, rk, mkKey, match, t_player_h, t_player_a);
            totalMatches++;
        });
    });

    // Remove rows for matches that no longer exist
    for (const [mid, tr] of Array.from(rowMap.entries())) {
        if (!seenIds.has(mid)) {
            if (tr && tr.isConnected) tr.remove();
            rowMap.delete(mid);
        }
    }

    // Remove headers for rounds that no longer exist or have no rows under them
    for (const [rk, headerRow] of Array.from(headerMap.entries())) {
        if (!rounds[rk]) {
            if (headerRow && headerRow.isConnected) headerRow.remove();
            headerMap.delete(rk);
        } else {
            // If no rows exist for this round, keep header if you want a placeholder,
            // or remove it. We remove it to avoid empty sections.
            const hasAnyRow = Array.from(rowMap.values()).some(r => r.dataset.round === rk);
            if (!hasAnyRow) {
                if (headerRow && headerRow.isConnected) headerRow.remove();
                headerMap.delete(rk);
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