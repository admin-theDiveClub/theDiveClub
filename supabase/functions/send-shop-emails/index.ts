// send-shop-emails
// Sends the shop's receipt emails waiting in tbl_shop_emails (migration shop_receipt_emails;
// docs/systems/foundations.md, "The shop: receipt emails").
//
// Deploy from the repo root:  npx supabase functions deploy send-shop-emails --use-api
// Secrets live in Supabase (Edge Functions → Secrets), never in the repo:
//   RESEND_API_KEY   a Resend key with sending access for thediveclub.org (required)
//
// Like notify-push, this is told nothing. The caller cannot name a recipient, write a word, or
// choose which email goes: it asks the database for whatever is waiting and sends that. Signing
// in is the whole permission. The rows are written by triggers when an order or a top-up moves,
// so the page that caused it doesn't know what was queued; it can only say "go and look"
// (TDC.flushPushes, which sweeps both).
//
// Each send carries the row's id as Resend's Idempotency-Key, so a retry after a send that did
// go through (the answer lost on the way back) is dropped by Resend instead of sent twice.

import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { buildEmail, type Kind, type Payload } from './email.ts';

const LOG = '[send-shop-emails]';

const ALLOWED_ORIGINS = ['https://thediveclub.org', 'http://localhost:8080'];

// UV, 24 Nov: from orders@, replies to admin@ (a real inbox).
const FROM     = 'The Dive Club <orders@thediveclub.org>';
const REPLY_TO = 'admin@thediveclub.org';
const SITE     = 'https://thediveclub.org';

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
	RESEND_API_KEY:            Deno.env.get('RESEND_API_KEY'),
};
const missingSettings = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (missingSettings.length) console.error(LOG, 'Missing settings:', missingSettings.join(', '));

// Small on purpose: the sweep is fired from a page and shouldn't hold a request open. What's
// left goes on the next sweep (more: true asks the page for one straight away).
const BATCH = 10;

interface Claimed {
	email_id: string;
	kind: Kind;
	to_email: string | null;
	payload: Payload;
}

async function sendOne(row: Claimed): Promise<{ id: string | null; error: string | null }> {
	if (!row.to_email) return { id: null, error: 'No address' };
	let built;
	try {
		built = buildEmail(row.payload, SITE);
	} catch (err) {
		return { id: null, error: 'Could not build the email: ' + String(err) };
	}
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + env.RESEND_API_KEY,
				'Content-Type': 'application/json',
				'Idempotency-Key': row.email_id,
			},
			body: JSON.stringify({
				from: FROM,
				to: [row.to_email],
				reply_to: REPLY_TO,
				subject: built.subject,
				html: built.html,
				text: built.text,
			}),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) {
			return { id: null, error: `Resend ${res.status}: ${body?.message ?? body?.name ?? 'no reason given'}` };
		}
		return { id: body?.id ?? null, error: null };
	} catch (err) {
		return { id: null, error: 'Could not reach Resend: ' + String(err) };
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
	if (req.method !== 'POST') return reply(req, 405, { error: 'TDC (Error): use POST.' });
	// Nothing is claimed without the key, so the rows wait (and are skipped after a day).
	if (missingSettings.length) {
		return reply(req, 500, { error: 'TDC (Error): server is missing settings: ' + missingSettings.join(', ') });
	}

	try {
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

		const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

		const { data: claimed, error: claimError } = await admin.rpc('tdc_claim_shop_emails', { p_limit: BATCH });
		if (claimError) {
			console.error(LOG, 'Could not claim emails:', claimError);
			return reply(req, 500, { error: 'TDC (Error): ' + claimError.message });
		}

		const rows = (claimed ?? []) as Claimed[];
		if (rows.length === 0) return reply(req, 200, { sent: 0, note: 'nothing waiting' });

		let sent = 0;
		for (const row of rows) {
			const result = await sendOne(row);
			if (result.error) console.error(LOG, `Email ${row.email_id} (${row.kind}) not sent:`, result.error);
			else sent += 1;
			const { error: markError } = await admin.rpc('tdc_mark_shop_email', {
				p_id: row.email_id,
				p_provider_id: result.id,
				p_error: result.error,
			});
			// Unmarked, the row is claimed again after 10 minutes; the idempotency key stops a
			// second copy if this one went.
			if (markError) console.error(LOG, `Could not mark email ${row.email_id}:`, markError);
		}

		console.log(LOG, `Sent ${sent} of ${rows.length} email(s).`);
		return reply(req, 200, { sent, claimed: rows.length, more: rows.length === BATCH });
	} catch (err) {
		console.error(LOG, 'Unexpected error:', err);
		return reply(req, 500, { error: 'TDC (Error): ' + String(err) });
	}
});
