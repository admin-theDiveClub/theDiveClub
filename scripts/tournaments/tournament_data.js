var t_ID = null;
var t = null;
var t_matches = null;
var t_log = null;

import { UpdateTournamentUI } from "/scripts/tournaments_old/tournament_UI.js";

Start ();

async function Start ()
{
    t_ID = _tournamentID();
    if (t_ID)
    {
        t = await _tournament(t_ID);
        console.log("Tournament Data:", t);

        const players = t.players || [];

        if (t && t.players.length > 0)
        {
            t_log = await _playerProfiles(players);

            t_matches = await _tournamentMatches(t_ID);
            console.log("Tournament Matches:", t_matches);
            
            t_log = CompileLog(t_log, t_matches);
            console.log("Tournament Log & Matches:", t_log);

            UpdateTournamentUI(t_log, t_matches);

            SubscribeToTournamentUpdates(t_ID);
            SubscribeToTournamentMatchesUpdates(t_ID);
        }

        const coordinatorID = t.coordinatorID || null;
        if (coordinatorID)
        {
            RedirectCoordinator(coordinatorID);
        }
    }
}

function RedirectCoordinator (coordinatorID)
{
    const s_userProfile = localStorage.getItem('userProfile') || sessionStorage.getItem('userProfile');
    const userProfile = s_userProfile ? JSON.parse(s_userProfile) : null;
    const id = userProfile ? userProfile.id : null;

    if (id && coordinatorID === id) 
    {
        if (confirm("You are listed as the coordinator for this tournament. Do you want to go to the tournament management page?"))
        {
            window.location.href = `/tournaments_old/index.html?tournamentID=${t_ID}`;
        }
    } else 
    {
        console.log("User is not the coordinator, no redirect.");
    }
}

function _tournamentID()
{
    var t_ID = new URLSearchParams(window.location.search).get('tournamentID');
    if (!t_ID)
    {
        t_ID = localStorage.getItem('tournamentID') || sessionStorage.getItem('tournamentID') || null;
    }

    if (t_ID)
    {
        sessionStorage.setItem('tournamentID', t_ID);
        localStorage.setItem('tournamentID', t_ID);
        return t_ID;
    } else 
    {
        return null;
    }
}

async function _tournament (_tournamentID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _tournamentID);
    return response.data[0];
}

async function _tournamentMatches (_tournamentID)
{
    const response = await supabase
        .from('tbl_matches')
        .select('*')
        .eq('competitions->>tournamentID', _tournamentID)
        .order('info->>round', { ascending: true })
        .order('createdAt', { ascending: true })
        .order('id', { ascending: true });
    return response.data;
}

async function SubscribeToTournamentUpdates (_tournamentID)
{
  const channels = supabase.channel('custom-update-channel')
  .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'tbl_tournaments', filter: `id=eq.${_tournamentID}` },
      (payload) => 
      {
        OnPayloadReceived_tournament(payload.new);
      }
  )
  .subscribe();
  return channels;
}

async function SubscribeToTournamentMatchesUpdates (_tournamentID)
{
    const channels = supabase
    .channel('realtime:tbl_matches')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tbl_matches' }, (payload) => 
    {
        if (payload.new.competitions && payload.new.competitions.tournamentID === _tournamentID)
        {
            OnPayloadReceived_tournamentMatches(payload.new);
        } else if (payload.eventType === 'DELETE')
        {
            OnPayloadReceived_tournamentMatches(payload.new);
        }
    })
    .subscribe();
    return channels;
}

async function _playerProfiles (players)
{
    const response = await supabase.from('tbl_players').select('*').in('username', players.map(p => p.username));
    var allProfiles = [];

    for (let i = 0; i < players.length; i++)
    {
        if (players[i].confirmed)
        {
            var profile = null;
            const existingProfile = response.data.find(p => p.username === players[i].username);
            if (existingProfile)
            {
                profile = 
                {
                    username: players[i].username,
                    displayName: existingProfile.nickname || existingProfile.name || players[i].username.split('@')[0],
                    name: existingProfile.name || players[i].username.split('@')[0],
                    pp: existingProfile.pp || null,
                    id: existingProfile.id || null,
                }
            } else 
            {
                profile =
                {
                    username: players[i].username,
                    displayName: players[i].username.split('@')[0],
                    name: players[i].username.split('@')[0],
                    pp: null,
                    id: null,
                }
            }

            allProfiles.push(profile);
        }        
    }

    return allProfiles;
}

function CompileLog (players, matches)
{
    var log = players;
    for (let i = 0; i < log.length; i++)
    {
        log[i].results = 
        {
            rnk: 0,
            mp: 0,
            mw: 0,
            mwr: 0,
            fp: 0,
            fw: 0,
            fwr: 0,
            bf: 0,
        }

        log[i].matches = [];
    }

    for (let i = 0; i < matches.length; i++)
    {
        const match = matches[i];
        const matchPlayers = match.players || {h: {username: null}, a: {username: null}};
        matchPlayers.h = matchPlayers.h || {username: null};
        matchPlayers.a = matchPlayers.a || {username: null};
        if (!match.results) match.results = {"h": {fw: 0}, "a": {fw: 0}};
        match.results.h = match.results.h || {fw: 0};
        match.results.a = match.results.a || {fw: 0};
        const matchResults = match.results  ? match.results : {h: {fw: 0}, a: {fw: 0}};
        const matchStatus = match.info ? match.info.status : "New";
        const matchRound = match.info ? match.info.round || 0 : 0;

        const log_player_h = log.find(p => p.username === matchPlayers.h.username);
        if (log_player_h)
        {
            const lhr = log_player_h.results;
            lhr.mp += matchStatus === "Complete" ? 1 : 0;
            lhr.mw += matchResults.h.fw > matchResults.a.fw ? 1 : 0;
            lhr.fp += matchResults.h.fw + matchResults.a.fw;
            lhr.fw += matchResults.h.fw;
            lhr.bf += matchResults.h.bf || 0;
            log_player_h.matches[matchRound] = match;
        }

        const log_player_a = log.find(p => p.username === matchPlayers.a.username);
        if (log_player_a)
        {
            const lar = log_player_a.results;
            lar.mp += matchStatus === "Complete" ? 1 : 0;
            lar.mw += matchResults.a.fw > matchResults.h.fw ? 1 : 0;
            lar.fp += matchResults.h.fw + matchResults.a.fw;
            lar.fw += matchResults.a.fw;
            lar.bf += matchResults.a.bf || 0;
            log_player_a.matches[matchRound] = match;
        }
    }

    log.sort((a, b) => 
    {
        const ra = a.results || {};
        const rb = b.results || {};
        const keys = ['mw', 'fw', 'mp', 'fp', 'bf'];
        for (const k of keys) {
            const va = Number(ra[k]) || 0;
            const vb = Number(rb[k]) || 0;
            const diff = vb - va; // descending
            if (diff !== 0) return diff;
        }
        return 0;
    });

    for (let i = 0; i < log.length; i++)
    {
        const r = log[i].results;
        r.mwr = r.mp > 0 ? (r.mw / r.mp * 100).toFixed(0) + "%" : "0%";
        r.fwr = r.fp > 0 ? (r.fw / r.fp * 100).toFixed(0) + "%" : "0%";
        r.rnk = i + 1;
    }

    return log;
}

async function OnPayloadReceived_tournament (newTournamentData)
{
    t = newTournamentData;
    const players = t.players || [];

    if (t && t.players.length > 0)
    {
        const playerUsernames = players.map(player => player.username);
        t_log = await _playerProfiles(playerUsernames);

        t_matches = await _tournamentMatches(t_ID);
        
        t_log = CompileLog(t_log, t_matches);

        UpdateTournamentUI(t_log, t_matches);
    }
}

async function OnPayloadReceived_tournamentMatches (newMatchData)
{
    const matchIndex = t_matches.findIndex(m => m.id === newMatchData.id);

    if (newMatchData && newMatchData.id)
    {
        if (matchIndex !== -1)
        {
            t_matches[matchIndex] = newMatchData;
        } else 
        {
            t_matches.push(newMatchData);
        }
        t_log = CompileLog(t_log, t_matches);

        UpdateTournamentUI(t_log, t_matches);
    }
}