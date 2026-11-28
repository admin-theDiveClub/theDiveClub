// device-login
// Signing in a TV (or any browser) with a phone (UV, 28 Nov; docs/systems/foundations.md,
// "Signing in a TV with a phone"; migration 20261128123827_device_login).
//
// The login page is signed out, so it talks only to this function:
//   { action: 'start',   secret }  → { code, expires_at }       a new code for the QR
//   { action: 'collect', secret }  → { state, token_hash? }     asked every few seconds
// `secret` is the page's own random secret (43 base64url characters); the database keeps only its
// SHA-256. When a phone has allowed the code, `collect` answers once with `token_hash`, a one-time
// sign-in token, which the page turns into a session of its own (supabase.auth.verifyOtp).
//
// Deploy from the repo root:  npx supabase functions deploy device-login --use-api
// verify_jwt is off (supabase/config.toml): the caller is signed out, and the site's publishable
// key is not a JWT. Nothing here trusts the caller; it only ever acts for the holder of the secret.
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically. No secrets to set.

import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const LOG = '[device-login]';

// Browsers may only call this from our own site. Not the security check (the secret is); it stops
// other websites' pages from calling it in a visitor's browser.
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
	SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
};
const missingSettings = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
if (missingSettings.length) console.error(LOG, 'Missing settings:', missingSettings.join(', '));

// What the phone is shown ("Allow this device? Chrome on Windows"), from the TV's own browser.
// Read here rather than sent by the page, so a page cannot name itself something it is not.
function deviceOf(ua: string): string {
	const tv = /SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|Android TV|GoogleTV|CrKey|HbbTV|Roku|PlayStation|Xbox/i.test(ua);
	const os = /iPhone/.test(ua) ? 'iPhone'
		: /iPad/.test(ua) ? 'iPad'
		: /Tizen/.test(ua) ? 'Samsung TV'
		: /Web0S|webOS|NetCast/.test(ua) ? 'LG TV'
		: /AFT[A-Z]/.test(ua) ? 'Fire TV'
		: /CrKey|GoogleTV/.test(ua) ? 'Google TV'
		: /Android/.test(ua) ? (tv ? 'Android TV' : 'Android')
		: /CrOS/.test(ua) ? 'Chromebook'
		: /Macintosh|Mac OS X/.test(ua) ? 'Mac'
		: /Windows/.test(ua) ? 'Windows'
		: /Linux/.test(ua) ? (tv ? 'a TV' : 'Linux')
		: tv ? 'a TV' : 'a device';
	const browser = /SamsungBrowser/.test(ua) ? 'Samsung Internet'
		: /EdgA|EdgiOS|Edg\//.test(ua) ? 'Edge'
		: /OPR\/|Opera/.test(ua) ? 'Opera'
		: /Firefox|FxiOS/.test(ua) ? 'Firefox'
		: /CriOS|Chrome\//.test(ua) ? 'Chrome'
		: /Safari\//.test(ua) ? 'Safari'
		: '';
	return browser ? browser + ' on ' + os : (os === 'a device' ? 'A browser' : os);
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
	if (req.method !== 'POST') return reply(req, 405, { error: 'TDC (Error): use POST.' });
	if (missingSettings.length) {
		return reply(req, 500, { error: 'TDC (Error): server is missing settings: ' + missingSettings.join(', ') });
	}

	let body: Record<string, unknown> = {};
	try {
		const parsed = await req.json();
		if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
	} catch {
		// Checked below.
	}
	const action = body.action;
	const secret = body.secret;
	if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(secret)) {
		return reply(req, 400, { error: 'TDC (Error): the page sent no usable secret.' });
	}

	const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
		auth: { persistSession: false, autoRefreshToken: false },
	});

	try {
		if (action === 'start') {
			const { data, error } = await admin.rpc('tdc_device_login_start', {
				p_secret: secret,
				p_device: deviceOf(req.headers.get('User-Agent') ?? ''),
			});
			if (error) {
				console.error(LOG, 'start failed:', error);
				return reply(req, 500, { error: error.message });
			}
			return reply(req, 200, data);
		}

		if (action === 'collect') {
			const { data, error } = await admin.rpc('tdc_device_login_collect', { p_secret: secret });
			if (error) {
				console.error(LOG, 'collect failed:', error);
				return reply(req, 500, { error: error.message });
			}
			if (data?.state !== 'approved') return reply(req, 200, { state: data?.state ?? 'unknown' });

			// Allowed: a one-time sign-in token for that account. Nothing is emailed; the token goes to
			// the page holding the secret, once (the request is already marked used).
			if (!data.email) {
				console.error(LOG, 'approved account has no email:', data.user_id);
				return reply(req, 500, { error: 'TDC (Error): the account that allowed this has no email address.' });
			}
			const { data: link, error: linkError } = await admin.auth.admin.generateLink({
				type: 'magiclink',
				email: data.email,
			});
			const tokenHash = link?.properties?.hashed_token;
			if (linkError || !tokenHash) {
				console.error(LOG, 'generateLink failed:', linkError);
				return reply(req, 500, { error: 'TDC (Error): could not make the sign-in: ' + (linkError?.message ?? 'no token') + '.' });
			}
			return reply(req, 200, { state: 'approved', token_hash: tokenHash });
		}

		return reply(req, 400, { error: 'TDC (Error): unknown action.' });
	} catch (err) {
		console.error(LOG, 'unexpected:', err);
		return reply(req, 500, { error: 'TDC (Error): ' + (err instanceof Error ? err.message : String(err)) });
	}
});
