// Supabase client for The Dive Club
// Requires the Supabase JS library <script> tag to be loaded before this file.

const SUPABASE_URL = 'https://db.thediveclub.org';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-G3BZ_64HC-gGrn1SOMXFQ_CE4WjO-8';

// Every call the client makes goes through this fetch, which counts what is in
// flight. A checkbox that saves as it changes (tdc-controls.js) keeps its ring
// loading until the network has gone quiet: its load time is the site's own
// call, not a number (UV, 24 Oct). Counting only; nothing is changed.
const TDCNet = (() => {
	let started = 0;
	let inflight = 0;
	let waiters = [];
	let calm = null;
	const askers = [];   // onAsk: told each time a page asks (the new match page shows every call on its ring)

	// Quiet means nothing in flight for a moment, so a page's re-read straight
	// after its write is waited for too. That gap is a few promise steps and
	// the sign-in token, so the moment is short: the ring draws as soon as the
	// network really is done.
	const QUIET_MS = 50;
	function settle() {
		clearTimeout(calm);
		if (inflight) return;
		calm = setTimeout(() => {
			if (inflight) return;
			const ready = waiters;
			waiters = [];
			ready.forEach((fn) => fn());
		}, QUIET_MS);
	}

	async function counted(...args) {
		started++;
		inflight++;
		clearTimeout(calm);
		try { return await fetch(...args); }
		finally { inflight--; settle(); }
	}

	return {
		fetch: counted,
		// A page asking (rpc, from) counts at once: the fetch itself starts a
		// moment later, once the client has its sign-in token, and quiet must
		// not be declared in that gap.
		asked() {
			started++;
			settle();
			for (const fn of askers) {
				try { fn(); } catch (err) { console.error('[Net] a page\'s onAsk listener failed:', err); }
			}
		},
		// A page that wants to know whenever a call is asked for (match-v2.js,
		// 30 Oct). Told synchronously, before the call's fetch has started.
		onAsk(fn) { askers.push(fn); },
		get started() { return started; },
		quiet() {
			return new Promise((resolve) => { waiters.push(resolve); settle(); });
		}
	};
})();

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
	global: { fetch: TDCNet.fetch }
});
for (const name of ['rpc', 'from']) {
	const ask = supabaseClient[name].bind(supabaseClient);
	supabaseClient[name] = (...args) => { TDCNet.asked(); return ask(...args); };
}
