// notify-push
// Sends the pushes for notification rows that have not had one yet.
//
// Deploy from the repo root:  npx supabase functions deploy notify-push --use-api
// Secrets live in Supabase (Edge Functions → Secrets), never in the repo:
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//
// ─── How this differs from notify-card ───
//
// notify-card is told which match and what happened, and works out the rest.
// This one is told nothing at all. The caller cannot name a recipient, cannot
// write a message, and cannot even say which notification to send — it asks
// the database for whatever is waiting and sends that. There is no input to
// abuse, which is the strongest version of the rule both functions follow.
//
// A notification row is written inside the database, by the function or
// trigger that owns the moment: a TD confirming an entrant, a draw advancing,
// an official editing a frame. The page that caused it has no idea how many
// rows were written or to whom, so it cannot be the thing that composes them.
// It can only say "something happened, go and look".
//
// ─── What a missed call costs ───
//
// The push, and nothing else. The row is already written and will be in the
// tray next time that person opens it. That is why the record is written
// first and the push second: the unreliable half is allowed to be unreliable.
//
// ─── If pg_cron is ever turned on ───
//
// Nothing here changes. This function does not know or care what set it off,
// so a schedule can call it instead of, or as well as, a page.

import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import webpush from 'npm:web-push@3.6.7';

const LOG = '[notify-push]';

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

// Which push service an endpoint belongs to, for the log. Apple and Google
// fail in different ways and it matters which one is refusing.
function serviceOf(endpoint: string): string {
	try {
		return new URL(endpoint).hostname;
	} catch {
		return 'unknown';
	}
}

// How many rows one call will take. Small on purpose: a sweep is fired from a
// page and should not hold a request open sending a hundred messages. What is
// left over goes on the next sweep, and the rows are safe meanwhile.
const BATCH = 25;

interface Claimed {
	notification_id: string;
	user_id: string;
	title: string;
	body: string | null;
	link: string | null;
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
	if (req.method !== 'POST') return reply(req, 405, { error: 'TDC (Error): use POST.' });
	if (missingSettings.length) {
		return reply(req, 500, { error: 'TDC (Error): server is missing settings: ' + missingSettings.join(', ') });
	}

	try {
		// Two different faults, two different messages. One says no token
		// arrived, the other says the auth server refused the one that did,
		// and carries its reason — "expired" and "bad signature" need
		// completely different fixes.
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

		// Signing in is the whole of the permission. The caller chooses
		// nothing about what is sent, so there is nothing further to check:
		// they are asking the queue to be drained, not asking for a message.
		const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

		// Claiming and returning are one statement in the database, so two
		// sweeps at once cannot both take the same row.
		const { data: claimed, error: claimError } = await admin
			.rpc('tdc_claim_pushes', { p_limit: BATCH });

		if (claimError) {
			console.error(LOG, 'Could not claim notifications:', claimError);
			return reply(req, 500, { error: 'TDC (Error): ' + claimError.message });
		}

		const rows = (claimed ?? []) as Claimed[];
		if (rows.length === 0) return reply(req, 200, { sent: 0, note: 'nothing waiting' });

		// One read of the subscription table for everybody in this batch,
		// rather than one per row: a round of a tournament tells sixteen
		// people at once.
		const userIds = [...new Set(rows.map((r) => r.user_id))];
		const { data: subs, error: subsError } = await admin
			.from('tbl_push_subscriptions')
			.select('id, user_id, endpoint, p256dh, auth')
			.in('user_id', userIds);

		if (subsError) {
			console.error(LOG, 'Could not read subscriptions:', subsError);
			return reply(req, 500, { error: 'TDC (Error): ' + subsError.message });
		}

		const byUser = new Map<string, typeof subs>();
		for (const s of subs ?? []) {
			const list = byUser.get(s.user_id) ?? [];
			list.push(s);
			byUser.set(s.user_id, list);
		}

		let sent = 0;
		let devices = 0;
		const dead: string[] = [];

		for (const row of rows) {
			const list = byUser.get(row.user_id) ?? [];
			// The claim already skips anybody with no device, so this is only
			// the race where their last one was removed in between. Not a
			// fault; the row stays in their tray.
			if (list.length === 0) continue;

			const payload = JSON.stringify({
				title: row.title,
				body: row.body ?? '',
				// The database constrains link to a same-site path, so this
				// cannot send somebody to another site.
				url: row.link ?? '/',
				icon: '/resources/icons/icon-192.png',
			});

			for (const sub of list) {
				devices += 1;
				try {
					await webpush.sendNotification(
						{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
						payload,
					);
					sent += 1;
				} catch (err) {
					const statusCode = (err as { statusCode?: number }).statusCode;
					console.error(LOG, `Failed via ${serviceOf(sub.endpoint)} (status ${statusCode ?? 'n/a'}):`, err);
					if (statusCode === 404 || statusCode === 410) dead.push(sub.id);
				}
			}
		}

		// Gone for good, as the push service has just told us. Removed in one
		// statement rather than inside the loop, so a slow delete cannot hold
		// up the sending.
		if (dead.length) {
			const { error: delError } = await admin
				.from('tbl_push_subscriptions').delete().in('id', dead);
			if (delError) console.error(LOG, 'Could not remove dead subscriptions:', delError);
			else console.log(LOG, `Removed ${dead.length} dead subscription(s).`);
		}

		console.log(LOG, `Swept ${rows.length} notification(s): sent on ${sent} of ${devices} device(s).`);
		// more tells the caller a second sweep is worth making, so a round of
		// sixteen does not wait for the next page action to finish going out.
		return reply(req, 200, { sent, devices, claimed: rows.length, more: rows.length === BATCH });
	} catch (err) {
		console.error(LOG, 'Unexpected error:', err);
		return reply(req, 500, { error: 'TDC (Error): ' + String(err) });
	}
});
