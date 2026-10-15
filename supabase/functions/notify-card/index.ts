// notify-card
// Tells the other player that something happened to a match: they were put in
// one, or something happened to its scorecard.
//
// Deploy from the repo root:  npx supabase functions deploy notify-card --use-api
// Secrets live in Supabase (Edge Functions → Secrets), never in the repo:
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//
// The page sends two things: which match, and what happened. It does not send
// the message, and it does not say who to tell. Both are worked out here from
// the match itself — otherwise anyone signed in could push any text to anyone,
// which is a spam machine rather than a notification.
//
// What the caller can do is cause a message they are entitled to cause: they
// must be in the match, and the only person told is the other player.

import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import webpush from 'npm:web-push@3.6.7';

const LOG = '[notify-card]';

const ALLOWED_ORIGINS = ['https://thediveclub.org', 'http://localhost:8080'];

function corsHeaders(req: Request): Record<string, string> {
	const origin = req.headers.get('Origin') ?? '';
	return {
		'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
		'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Vary': 'Origin',
	};
}

function reply(req: Request, status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
	});
}

const env = {
	SUPABASE_URL:              Deno.env.get('SUPABASE_URL'),
	SUPABASE_ANON_KEY:         Deno.env.get('SUPABASE_ANON_KEY'),
	SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
	VAPID_SUBJECT:             Deno.env.get('VAPID_SUBJECT'),
	VAPID_PUBLIC_KEY:          Deno.env.get('VAPID_PUBLIC_KEY'),
	VAPID_PRIVATE_KEY:         Deno.env.get('VAPID_PRIVATE_KEY'),
};
const missingSettings = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);

if (missingSettings.length) {
	console.error(LOG, 'Missing settings:', missingSettings.join(', '));
} else {
	webpush.setVapidDetails(env.VAPID_SUBJECT!, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

const KINDS = ['opponent_added', 'submitted', 'agreed', 'disputed', 'reopened', 'deleted'] as const;
type Kind = typeof KINDS[number];

// A match that has not been played yet has no score worth sending, so these
// kinds describe the match itself instead.
const NO_SCORE: ReadonlySet<string> = new Set(['opponent_added']);

const DISCIPLINE: Record<string, string> = {
	'8ball': '8-ball',
	'9ball': '9-ball',
	'10ball': '10-ball',
	blackball: 'blackball',
};

// "Race to 7, 9-ball". Enough to decide whether you want the game, which is the
// point of telling somebody they are in one.
function describeMatch(rules: Record<string, unknown> | null): string {
	if (!rules) return '';
	const target = Number(rules.win_condition_target);
	const n = Number.isFinite(target) && target > 0 ? String(target) : '';
	let shape = '';
	switch (String(rules.win_condition_type)) {
		case 'race_to':      shape = n ? 'Race to ' + n : 'A race'; break;
		case 'best_of':      shape = n ? 'Best of ' + n : ''; break;
		case 'fixed_frames': shape = n ? n + ' frames' : ''; break;
		case 'timed':        shape = 'Timed'; break;
		case 'free_play':    shape = 'Free play'; break;
	}
	const game = DISCIPLINE[String(rules.discipline)] ?? '';
	return [shape, game].filter(Boolean).join(', ');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceOf(endpoint: string): string {
	try {
		return new URL(endpoint).host;
	} catch {
		return 'TDC (Bad endpoint)';
	}
}

// A dispute reason is written by a person, so it is trimmed and cut short
// before it goes anywhere near a lock screen.
function shorten(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	const clean = value.trim().replace(/\s+/g, ' ');
	return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
	if (req.method !== 'POST') return reply(req, 405, { error: 'TDC (Error): use POST.' });
	if (missingSettings.length) {
		return reply(req, 500, { error: 'TDC (Error): server is missing settings: ' + missingSettings.join(', ') });
	}

	try {
		// Two different faults, two different messages. One says no token arrived,
		// the other says the auth server refused the one that did, and carries its
		// reason — "expired" and "bad signature" need different fixes.
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) return reply(req, 401, { error: 'TDC (Error): no login token was sent.' });

		const authClient = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
			global: { headers: { Authorization: authHeader } },
		});
		const { data: { user }, error: userError } = await authClient.auth.getUser();
		if (userError || !user) {
			console.error(LOG, 'Auth failed:', userError);
			return reply(req, 401, {
				error: 'TDC (Error): the login token was refused — ' + (userError?.message ?? 'no user on it') + '.',
			});
		}

		let body: Record<string, unknown> = {};
		try {
			const parsed = await req.json();
			if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
		} catch {
			return reply(req, 400, { error: 'TDC (Error): no match or kind sent.' });
		}

		const matchId = typeof body.match_id === 'string' ? body.match_id : '';
		const kind = String(body.kind ?? '') as Kind;

		if (!UUID.test(matchId)) return reply(req, 400, { error: 'TDC (Error): that is not a match id.' });
		if (!KINDS.includes(kind)) return reply(req, 400, { error: 'TDC (Error): unknown kind "' + kind + '".' });

		const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

		// Who am I, as a player?
		const { data: me, error: meError } = await admin
			.from('tbl_players').select('id, display_name').eq('user_id', user.id).maybeSingle();
		if (meError) {
			console.error(LOG, 'Could not read the caller:', meError);
			return reply(req, 500, { error: 'TDC (Error): ' + meError.message });
		}
		if (!me) return reply(req, 403, { error: 'TDC (Error): no player profile for this account.' });

		// Who is on this match, and who is the other one? For a deleted match
		// the match itself is gone, so the note left behind is read instead.
		let homeId: string | null = null;
		let awayId: string | null = null;
		let summary = '';
		let shape = '';

		if (kind === 'deleted') {
			const { data: gone } = await admin
				.from('tbl_deleted_matches')
				.select('home_player_id, away_player_id, summary')
				.eq('match_id', matchId).maybeSingle();
			if (!gone) return reply(req, 404, { error: 'TDC (Error): no record of that match being deleted.' });
			homeId = gone.home_player_id;
			awayId = gone.away_player_id;
			summary = gone.summary ?? '';
		} else {
			const { data: match } = await admin
				.from('tbl_matches')
				.select('home_player_id, away_player_id, home_side_kind, away_side_kind, rules')
				.eq('id', matchId).maybeSingle();
			if (!match) return reply(req, 404, { error: 'TDC (Error): match not found.' });
			if (match.home_side_kind !== 'player' || match.away_side_kind !== 'player') {
				// Team matches have no single "other player" to tell. They get
				// their own notifications when teams are built.
				return reply(req, 200, { sent: 0, note: 'team match' });
			}
			homeId = match.home_player_id;
			awayId = match.away_player_id;
			shape = describeMatch(match.rules as Record<string, unknown> | null);

			if (!NO_SCORE.has(kind)) {
				const { data: frames } = await admin
					.from('tbl_frames').select('winner_side, status').eq('match_id', matchId);
				const done = (frames ?? []).filter((f) => f.status === 'complete');
				const hs = done.filter((f) => f.winner_side === 'home').length;
				const as = done.filter((f) => f.winner_side === 'away').length;
				summary = hs + ' – ' + as;
			}
		}

		if (me.id !== homeId && me.id !== awayId) {
			return reply(req, 403, { error: 'TDC (Error): you are not in that match.' });
		}

		const otherId = me.id === homeId ? awayId : homeId;
		if (!otherId) return reply(req, 200, { sent: 0, note: 'no other player' });

		const { data: other } = await admin
			.from('tbl_players').select('id, user_id, display_name').eq('id', otherId).maybeSingle();
		if (!other || !other.user_id) {
			// A walk-in has no account and no devices. Nothing to do, and not a
			// fault worth reporting to the page.
			return reply(req, 200, { sent: 0, note: 'no account' });
		}

		// The score is written from the recipient's point of view, so it reads
		// the way they would say it.
		let mine = summary;
		if (kind !== 'deleted' && summary.includes(' – ')) {
			const [h, a] = summary.split(' – ');
			mine = other.id === homeId ? `${h} – ${a}` : `${a} – ${h}`;
		}

		const who = me.display_name ?? 'The other player';
		let title: string;
		let message: string;
		let url = '/match/?id=' + matchId;

		switch (kind) {
			case 'opponent_added':
				title = 'You are in a match';
				message = shape
					? `${who} started a match against you. ${shape}.`
					: `${who} started a match against you.`;
				break;
			case 'submitted':
				title = 'Scorecard to check';
				message = `${who} submitted ${mine}. Tap to agree or say what is wrong.`;
				break;
			case 'agreed':
				title = 'Scorecard agreed';
				message = `${who} agreed the card. ${mine} is settled.`;
				break;
			case 'disputed': {
				const { data: ev } = await admin
					.from('tbl_match_events').select('note')
					.eq('match_id', matchId).eq('kind', 'disputed')
					.order('created_at', { ascending: false }).limit(1).maybeSingle();
				const note = shorten(ev?.note, 140);
				title = 'Scorecard disputed';
				message = note ? `${who} says: ${note}` : `${who} says the card is wrong.`;
				break;
			}
			case 'reopened':
				title = 'Scorecard reopened';
				message = `${who} reopened the match. It needs agreeing again.`;
				break;
			case 'deleted':
				title = 'Match deleted';
				message = summary ? `${who} deleted ${summary}.` : `${who} deleted a match you played.`;
				url = '/matches/';
				break;
		}

		const { data: subs, error: subsError } = await admin
			.from('tbl_push_subscriptions')
			.select('id, endpoint, p256dh, auth')
			.eq('user_id', other.user_id);

		if (subsError) {
			console.error(LOG, 'Could not read subscriptions:', subsError);
			return reply(req, 500, { error: 'TDC (Error): ' + subsError.message });
		}
		if (!subs || subs.length === 0) {
			// They have not turned notifications on. Normal, not a fault.
			return reply(req, 200, { sent: 0, note: 'no devices' });
		}

		const payload = JSON.stringify({
			title,
			body: message,
			url,
			icon: '/resources/icons/icon-192.png',
		});

		let sent = 0;
		for (const sub of subs) {
			const service = serviceOf(sub.endpoint);
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					payload,
				);
				sent += 1;
			} catch (err) {
				const statusCode = (err as { statusCode?: number }).statusCode;
				console.error(LOG, `Failed via ${service} (status ${statusCode ?? 'n/a'}):`, err);
				if (statusCode === 404 || statusCode === 410) {
					await admin.from('tbl_push_subscriptions').delete().eq('id', sub.id);
					console.log(LOG, 'Removed a dead subscription:', sub.id);
				}
			}
		}

		console.log(LOG, `${kind}: told ${other.display_name} on ${sent} of ${subs.length} device(s).`);
		return reply(req, 200, { sent, devices: subs.length });
	} catch (err) {
		console.error(LOG, 'Unexpected error:', err);
		return reply(req, 500, { error: 'TDC (Error): ' + String(err) });
	}
});
