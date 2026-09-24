import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

webpush.setVapidDetails(
	Deno.env.get('VAPID_SUBJECT')!,
	Deno.env.get('VAPID_PUBLIC_KEY')!,
	Deno.env.get('VAPID_PRIVATE_KEY')!
);

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	try {
		// Identify who's calling, using their own auth token
		const authClient = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_ANON_KEY')!,
			{ global: { headers: { Authorization: req.headers.get('Authorization')! } } }
		);
		const { data: { user }, error: userError } = await authClient.auth.getUser();

		if (userError || !user) {
			console.error('[send-test-notification] Auth failed:', userError);
			return new Response(JSON.stringify({ error: 'TDC (Error): not authenticated' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		console.log('[send-test-notification] Sending test push to user_id:', user.id);

		// Service role client to read subscriptions, bypassing RLS (safe — we're scoping to `user.id` we just verified)
		const adminClient = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
		);

		const { data: subs, error: subsError } = await adminClient
			.from('tbl_push_subscriptions')
			.select('*')
			.eq('user_id', user.id);

		if (subsError) {
			console.error('[send-test-notification] Error fetching subscriptions:', subsError);
			return new Response(JSON.stringify({ error: 'TDC (Error): ' + subsError.message }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (!subs || subs.length === 0) {
			console.warn('[send-test-notification] No subscriptions found for user:', user.id);
			return new Response(JSON.stringify({ error: 'TDC (No subscriptions found)' }), {
				status: 404,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		let requestBody = {};
try {
	requestBody = await req.json();
} catch {
	// no body sent — fine, we'll use defaults
}

const payload = JSON.stringify({
	title: requestBody.title || 'TDC (No Title Sent)',
	body: requestBody.body || 'TDC (No Body Sent)',
	url: requestBody.url || '/',
	icon: requestBody.icon || '/resources/icons/icon-192.png',
});

		const results = [];
		for (const sub of subs) {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					payload
				);
				results.push({ endpoint: sub.endpoint, status: 'sent' });
				console.log('[send-test-notification] Sent to endpoint:', sub.endpoint);
			} catch (err) {
				console.error('[send-test-notification] Failed to send to endpoint:', sub.endpoint, err);
				results.push({ endpoint: sub.endpoint, status: 'failed', error: String(err) });

				// Subscription is dead (expired/unsubscribed) — clean it up
				if (err.statusCode === 404 || err.statusCode === 410) {
					await adminClient.from('tbl_push_subscriptions').delete().eq('id', sub.id);
					console.log('[send-test-notification] Deleted dead subscription:', sub.id);
				}
			}
		}

		return new Response(JSON.stringify({ results }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (err) {
		console.error('[send-test-notification] Unexpected error:', err);
		return new Response(JSON.stringify({ error: 'TDC (Error): ' + String(err) }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
});