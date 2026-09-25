// send-test-notification
// Sends a test push to every device of the signed-in caller (profile page, "Send Test Notification").
// It only ever pushes to the caller's own devices.
//
// Deploy from the repo root:  npx supabase functions deploy send-test-notification --use-api
// Secrets live in Supabase (Edge Functions → Secrets), never in the repo:
//   VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// Supabase provides SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY automatically.

import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import webpush from 'npm:web-push@3.6.7';

const LOG = '[send-test-notification]';

// Browsers may only call this from our own site. This is not the security check (the login check below is),
// it just stops other websites' pages from calling it in a visitor's browser.
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

// ─── Settings, checked once at start-up so a missing secret fails loudly ───
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

// ─── Input clean-up ───
// Text: trimmed and length-limited, or the visible fallback.
function text(value: unknown, fallback: string, max: number): string {
	return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : fallback;
}

// Links and icons must be paths on our own site (e.g. "/accounts/profile/"), never another website.
function sitePath(value: unknown, fallback: string): string {
	return typeof value === 'string' && value.length <= 300 && /^\/(?!\/)\S*$/.test(value) ? value : fallback;
}

// Push endpoints are secret-ish addresses; log only which push service they belong to.
function serviceOf(endpoint: string): string {
	try {
		return new URL(endpoint).host;
	} catch {
		return 'TDC (Bad endpoint)';
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders(req) });
	}
	if (req.method !== 'POST') {
		return reply(req, 405, { error: 'TDC (Error): use POST.' });
	}
	if (missingSettings.length) {
		return reply(req, 500, { error: 'TDC (Error): server is missing settings: ' + missingSettings.join(', ') });
	}

	try {
		// Who is calling? Checked with their own login token.
		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return reply(req, 401, { error: 'TDC (Error): not authenticated' });
		}

		const authClient = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
			global: { headers: { Authorization: authHeader } },
		});
		const { data: { user }, error: userError } = await authClient.auth.getUser();

		if (userError || !user) {
			console.error(LOG, 'Auth failed:', userError);
			return reply(req, 401, { error: 'TDC (Error): not authenticated' });
		}

		// Admin access to read subscriptions, always limited to the user id verified above.
		const adminClient = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);

		const { data: subs, error: subsError } = await adminClient
			.from('tbl_push_subscriptions')
			.select('id, endpoint, p256dh, auth')
			.eq('user_id', user.id);

		if (subsError) {
			console.error(LOG, 'Error fetching subscriptions:', subsError);
			return reply(req, 500, { error: 'TDC (Error): ' + subsError.message });
		}
		if (!subs || subs.length === 0) {
			console.warn(LOG, 'No subscriptions for user:', user.id);
			return reply(req, 404, { error: 'TDC (No subscriptions found)' });
		}

		// Optional message details from the page. An empty or invalid body falls back to visible markers.
		let requestBody: Record<string, unknown> = {};
		try {
			const parsed = await req.json();
			if (parsed && typeof parsed === 'object') requestBody = parsed as Record<string, unknown>;
		} catch {
			// No body sent: the markers below make that obvious on the phone.
		}

		const payload = JSON.stringify({
			title: text(requestBody.title, 'TDC (No Title Sent)', 100),
			body:  text(requestBody.body, 'TDC (No Body Sent)', 300),
			url:   sitePath(requestBody.url, '/'),
			icon:  sitePath(requestBody.icon, '/resources/icons/icon-192.png'),
		});

		console.log(LOG, `Sending to ${subs.length} device(s) for user:`, user.id);

		const results: { service: string; status: 'sent' | 'failed'; error?: string }[] = [];
		for (const sub of subs) {
			const service = serviceOf(sub.endpoint);
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
					payload,
				);
				results.push({ service, status: 'sent' });
			} catch (err) {
				const statusCode = (err as { statusCode?: number }).statusCode;
				console.error(LOG, `Failed to send via ${service} (status ${statusCode ?? 'n/a'}):`, err);
				results.push({ service, status: 'failed', error: String(err) });

				// The device unsubscribed or the subscription expired: remove it.
				if (statusCode === 404 || statusCode === 410) {
					const { error: delError } = await adminClient.from('tbl_push_subscriptions').delete().eq('id', sub.id);
					if (delError) {
						console.error(LOG, 'Could not delete dead subscription:', sub.id, delError);
					} else {
						console.log(LOG, 'Deleted dead subscription:', sub.id);
					}
				}
			}
		}

		return reply(req, 200, { results });
	} catch (err) {
		console.error(LOG, 'Unexpected error:', err);
		return reply(req, 500, { error: 'TDC (Error): ' + String(err) });
	}
});
