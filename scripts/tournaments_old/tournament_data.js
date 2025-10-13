import { UpdateTournamentUI_Control } from "/scripts/tournaments_old/tournament_UI_control.js";
import { UpdateTournamentUI } from "/scripts/tournaments_old/tournament_UI_view.js";

import { DB_Update } from "/scripts/supabase/supabase_db_helpers.js";

var tournamentID = null;
var tournament = null;
var tournamentMatches = null;
var tournamentRounds = null;
var tournamentLog = null;
var tournamentPlayers = null;

Start ();

async function Start ()
{
    tournamentID = GetTournamentID();
    if (tournamentID)
    {
        tournament = await GetTournament(tournamentID);
        console.warn('Source: Tournament', tournament);
        tournamentPlayers = await PopulatePlayerInfo(tournament.players);
        console.warn('Source: Tournament Players', tournamentPlayers);
        if (tournament)
        {
            tournamentMatches = await GetTournamentMatches(tournamentID);
            SubscribeToUpdates(tournamentID);
            tournamentLog = CompileTournamentLog(GetConfirmedPlayers(tournamentPlayers), tournamentMatches);
            tournamentRounds = await CompileTournamentRounds(tournamentMatches);
            console.warn('Source: Tournament Rounds', tournamentRounds);
            console.warn('Source: Tournament Log', tournamentLog);
        }
    }

    if (window.location.href && window.location.href.toLowerCase().includes('view.html')) 
    {
        UpdateTournamentUI(tournament, tournamentLog, tournamentRounds, tournamentPlayers);
    } else 
    {
        UpdateTournamentUI_Control(tournament, tournamentPlayers, tournamentLog, tournamentRounds);
    }
}

export async function UpdateTournamentData ()
{
    tournamentPlayers = await PopulatePlayerInfo(tournament.players);
    tournamentMatches = await GetTournamentMatches(tournamentID);
    tournamentLog = CompileTournamentLog(GetConfirmedPlayers(tournamentPlayers), tournamentMatches);
    tournamentRounds = await CompileTournamentRounds(tournamentMatches);

    if (window.location.href && window.location.href.toLowerCase().includes('view.html')) 
    {
        UpdateTournamentUI(tournament, tournamentLog, tournamentRounds, tournamentPlayers);
    } else 
    {
        UpdateTournamentUI_Control(tournament, tournamentPlayers, tournamentLog, tournamentRounds);
    }
}

function GetTournamentID()
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

async function GetTournament (_tournamentID)
{
    const response = await supabase.from('tbl_tournaments').select('*').eq('id', _tournamentID);
    return response.data[0];
}

async function GetTournamentMatches (_tournamentID)
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

async function SubscribeToUpdates (_tournamentID)
{
    const subscriptionResponse_tournament = await SubscribeToTournamentUpdates(_tournamentID);
    //console.log('Source: Subscription Response Tournaments', subscriptionResponse_tournament);

    const subscriptionResponse_tournamentMatches = await SubscribeToTournamentMatchesUpdates(_tournamentID);
    //console.log('Source: Subscription Response Tournament Matches', subscriptionResponse_tournamentMatches);
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

function OnPayloadReceived_tournament (_tournament)
{
    console.log('Tournament Data Updated:', _tournament);
    tournament = _tournament;
    UpdateTournamentData();
}

function OnPayloadReceived_tournamentMatches (_match)
{
    console.log('Tournament Match Data Updated:', _match);

    const idx = tournamentMatches.findIndex(m => m && m.id === _match.id);
    if (idx !== -1) 
    {
        tournamentMatches[idx] = _match;
    }
    UpdateTournamentData();
}


async function PopulatePlayerInfo (t_players)
{
    if (!t_players || t_players.length === 0)
    {
        console.log('No players to populate.');
        return;
    }

    // collect unique, non-empty usernames
    const usernames = [...new Set(t_players.map(p => p && p.username).filter(Boolean))];

    // fetch all profiles in one call
    const profiles = await GetPlayerProfiles(usernames);
    const profileMap = {};
    if (profiles && profiles.length)
    {
        profiles.forEach(p => {
            if (p && p.username) profileMap[p.username] = p;
        });
    }

    // update player entries by comparing with fetched profiles
    for (let i = 0; i < t_players.length; i++)
    {
        const player = t_players[i] || {};
        const uname = player.username;
        const playerInfo = uname ? profileMap[uname] : null;

        if (playerInfo)
        {
            t_players[i].username = playerInfo.username;
            let displayName = playerInfo.username;
            if (playerInfo.nickname && playerInfo.nickname !== "Guest")
            {
                displayName = playerInfo.nickname;
            }
            else
            {
                displayName = playerInfo.name || playerInfo.username;
            }
            t_players[i].displayName = displayName;
            // preserve the original confirmed flag from the incoming player object
            t_players[i].confirmed = player.confirmed;
            t_players[i].playerProfile = playerInfo;

            const response_pic = await supabase.storage.from('bucket-profile-pics').getPublicUrl(playerInfo.id);
            if (response_pic.data && response_pic.data.publicUrl && !response_pic.data.publicUrl.endsWith('null')) 
            {
                /*const imgElement_H = document.getElementById('player-H-pic');
                if (imgElement_H) {
                    const img = new Image();
                    img.onload = () => {
                        imgElement_H.src = response_pic.data.publicUrl;
                    };
                    img.src = response_pic.data.publicUrl;
                }*/
                t_players[i].pp = response_pic.data.publicUrl;
            }
        }
        else
        {
            // no profile found — preserve what we have or fall back
            t_players[i].username = player.username;
            t_players[i].displayName = player.username;
            t_players[i].confirmed = player.confirmed;
            t_players[i].playerProfile = null;
        }
    }
    
    return t_players;
}

async function GetPlayerProfiles (usernames)
{
    if (!usernames || usernames.length === 0) return [];

    const response = await supabase.from('tbl_players').select('*').in('username', usernames);
    return response.data || [];
}

var tournamentRounds = null

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

function CompileTournamentLog (players, matches)
{
    const log = players.map(p => {
        const uname = p.username || 'Unknown';
        let MP = 0, MW = 0, ML = 0, FP = 0, FW = 0, BF = 0;

        for (const m of matches || []) {
            if (!m || !m.players) continue;

            let side = null;
            if (m.players.a && m.players.a.username === uname) side = 'a';
            else if (m.players.h && m.players.h.username === uname) side = 'h';
            if (!side) continue;

            const status = m.info && m.info.status;
            MP++;
            const results = m.results || {};
            const pRes = results[side] || {};
            const oRes = results[side === 'a' ? 'h' : 'a'] || {};

            const pFW = Number(pRes.fw) || 0;
            const oFW = Number(oRes.fw) || 0;
            const pBF = Number(pRes.bf) || 0;

            FP += pFW + oFW;
            FW += pFW;
            BF += pBF;
            
            if (status !== 'Complete') continue;

            if (pFW > oFW) MW++;
            else if (pFW < oFW) ML++;
        }

        const FPercent = FP > 0 ? ((FW / FP) * 100).toFixed(2) : "0.00";

        return {
            username: uname,
            Player: p.displayName,
            MP,
            MW,
            ML,
            FP,
            FW,
            'F%': FPercent,
            'B/F': BF
        };
    });

    // sort by MW desc, then FW desc, then F% desc, then B/F desc, then username
    log.sort((a, b) => {
        const aMW = Number(a.MW) || 0, bMW = Number(b.MW) || 0;
        if (bMW !== aMW) return bMW - aMW;

        const aFW = Number(a.FW) || 0, bFW = Number(b.FW) || 0;
        if (bFW !== aFW) return bFW - aFW;

        const aF = Number(a['F%']) || 0, bF = Number(b['F%']) || 0;
        if (bF !== aF) return bF - aF;

        const aBF = Number(a['B/F']) || 0, bBF = Number(b['B/F']) || 0;
        if (bBF !== aBF) return bBF - aBF;

        return (a.username || '').localeCompare(b.username || '');
    });

    const finalLog = log.map((entry, idx) => ({
        Rank: idx + 1,
        username: entry.username,
        MP: entry.MP,
        MW: entry.MW,
        ML: entry.ML,
        FP: entry.FP,
        FW: entry.FW,
        'F%': entry['F%'],
        'B/F': entry['B/F']
    }));

    return finalLog;
}

async function CompileTournamentRounds (matches)
{
    var allRounds = [];

    for (var i = 0; i < matches.length; i++)
    {
        const m_round = (() => {
            const r = matches[i]?.info?.round;
            if (Number.isInteger(r)) return r;
            const n = parseInt(String(r ?? '0'), 10);
            return Number.isNaN(n) ? 0 : n;
        })();
        allRounds[m_round] = allRounds[m_round] || [];
        const matchRef = 
        {
            match: matches[i],
            round: m_round,
            id: allRounds[m_round].length,
            precedingRound: m_round > 0 ? m_round - 1 : null,
            precedingMatches: m_round > 1 ? [allRounds[m_round].length * 2, allRounds[m_round].length * 2 + 1] : []
        }

        if (m_round > 1)
        {
            const prevRound = allRounds[m_round - 1] || [];
            const m = matchRef.match || null;
            const prevMatch_0 = prevRound[matchRef.precedingMatches[0]]?.match || null;
            const prevMatch_1 = prevRound[matchRef.precedingMatches[1]]?.match || null;
            if (m && prevMatch_0 && prevMatch_1)
            {
                //matchRef.match = await AutoUpdateMatchPlayers(m, prevMatch_0, prevMatch_1);
            }
        }

        allRounds[m_round].push(matchRef);
    }

    return allRounds;
}