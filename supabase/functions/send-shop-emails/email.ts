// The shop's receipt emails: one layout (the shop canvas, artboard 7), five kinds.
//
// Pure: no Deno or network here, only data in and { subject, html, text } out, so the same file
// renders the previews (scripts in the scratchpad, never in the repo) and the real thing.
//
// The data is what private.tdc_shop_email_payload returns, built when the email is sent. Every
// string from it is escaped: product names are typed by venue staff.
//
// The look follows the site's dark theme (variables.css): background #202020, cream text,
// green #61ffad, yellow #ffae00. Email clients ignore web fonts and CSS variables, so every
// colour and size is written inline, in tables, as the auth emails are (supabase/templates/).

export type Kind = 'top_up_paid' | 'order_placed' | 'order_ready' | 'order_collected' | 'order_cancelled';

export interface Line {
	name: string;
	price_credits: number;
	qty: number;
	collect: 'bar' | 'collect';
}

export interface Payload {
	kind: Kind;
	first_name: string | null;
	display_name: string | null;
	venue_name: string;
	venue_address: string | null;
	venue_area: string | null;
	venue_city: string | null;
	timezone: string;
	// An order
	label?: string;
	status?: string;
	pay_with?: 'credits' | 'club';
	total_credits?: number;
	pay_cents?: number;
	collect_by?: string | null;
	paid_method?: 'cash' | 'card' | null;
	collected_at?: string | null;
	cancelled_by?: 'you' | 'club' | 'uncollected' | null;
	refunded?: boolean;
	lines?: Line[];
	// A top-up
	code?: string;
	credits?: number;
	discount_pct?: number;
	gross_cents?: number;
	balance?: number;
}

export interface Built {
	subject: string;
	html: string;
	text: string;
}

const C = {
	page:   '#181818',
	card:   '#202020',
	text:   '#f4e8d2',
	muted:  '#9a9a9a',
	line:   '#333333',
	off:    '#3a3a3a',
	green:  '#61ffad',
	yellow: '#ffae00',
	inset:  '#1a1a1a',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// The company block, as the policies' foot (src/_includes/policy/details.html). Only the
// trading address: that page keeps the registered office to itself.
const COMPANY = {
	name:    'The Dive Club (Pty) Ltd',
	reg:     '2025/917817/07',
	vat:     'Not registered for VAT',
	address: 'C5, The Gantry, Lonehill, Fourways, 2191',
	email:   'admin@thediveclub.org',
	phone:   '+27 82 766 4905',
	tel:     '+27827664905',
};

function esc(s: unknown): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// R30, or R112.50 when there are cents.
export function rand(cents: number): string {
	const r = cents / 100;
	return 'R' + (Number.isInteger(r) ? r.toLocaleString('en-ZA') : r.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

function credits(n: number): string {
	return n.toLocaleString('en-ZA') + (n === 1 ? ' credit' : ' credits');
}

function day(iso: string, tz: string): string {
	return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
}

function dayTime(iso: string, tz: string): string {
	return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function nameOf(p: Payload): string | null {
	const n = (p.first_name || p.display_name || '').trim();
	return n && n !== 'TDC (No Name)' ? n : null;
}

function venuePlace(p: Payload): string {
	return [p.venue_name, p.venue_address, p.venue_area].filter(Boolean).join(', ');
}

// ─── The pieces of the layout ───

interface Row { left: string; right: string; strong?: boolean; colour?: string }

interface Parts {
	subject: string;
	preheader: string;
	eyebrow: string;
	heading: string;
	steps?: number;           // order bars lit, of four; undefined = no bars
	rows: Row[];
	note?: string[];          // the inset box: first line bold
	button: { label: string; path: string };
}

function build(site: string, parts: Parts): Built {
	const url = (path: string) => site.replace(/\/$/, '') + path;

	const bars = parts.steps === undefined ? '' : `
		<tr><td style="padding:0 0 20px 0;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;"><tr>
				${[1, 2, 3, 4].map((i) => `<td width="25%" style="width:25%; padding:0 ${i < 4 ? '4px' : '0'} 0 0;"><div style="height:4px; line-height:4px; font-size:4px; border-radius:2px; background-color:${i <= parts.steps! ? C.green : C.off};">&nbsp;</div></td>`).join('')}
			</tr></table>
		</td></tr>`;

	const rows = parts.rows.map((r, i) => {
		const last = i === parts.rows.length - 1;
		const border = last ? '' : `border-bottom:1px solid ${C.line};`;
		const weight = r.strong ? 'font-weight:700;' : '';
		return `<tr>
			<td style="padding:11px 0; ${border} ${weight} color:${C.text}; font-size:15px; line-height:1.4;">${r.left}</td>
			<td align="right" style="padding:11px 0 11px 12px; ${border} ${weight} color:${r.colour ?? C.muted}; font-size:15px; line-height:1.4; white-space:nowrap;">${r.right}</td>
		</tr>`;
	}).join('');

	const note = parts.note && parts.note.length ? `
		<tr><td style="padding:22px 0 0 0;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
				<td style="padding:16px 18px; background-color:${C.inset}; border:1px solid ${C.line}; border-radius:16px; font-size:14px; line-height:1.55; color:${C.text};">
					<strong>${parts.note[0]}</strong>${parts.note.slice(1).map((n) => `<br><span style="color:${C.muted};">${n}</span>`).join('')}
				</td>
			</tr></table>
		</td></tr>` : '';

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="x-apple-disable-message-reformatting">
	<meta name="color-scheme" content="dark">
	<meta name="supported-color-schemes" content="dark">
	<title>${esc(parts.subject)}</title>
	<style>
		@media (max-width: 600px) { .content { padding-left: 22px !important; padding-right: 22px !important; } }
	</style>
</head>
<body style="margin:0; padding:0; background-color:${C.page};">
	<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C.page}; opacity:0;">${parts.preheader}</div>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
		<tr><td align="center" style="padding:24px 12px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
				<tr><td align="center" style="padding:0 0 16px 0;">
					<a href="${url('/')}" target="_blank"><img src="${url('/resources/branding/email-wordmark.png')}" width="180" alt="The Dive Club" style="display:block; width:180px; max-width:60%; height:auto; border:0; color:${C.text}; font-family:${FONT}; font-size:20px;"></a>
				</td></tr>
				<tr><td class="content" style="background-color:${C.card}; border:1px solid ${C.line}; border-radius:20px; padding:36px 44px; font-family:${FONT}; color:${C.text};">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
						<tr><td style="padding:0 0 6px 0; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:${C.muted};">${parts.eyebrow}</td></tr>
						<tr><td style="padding:0 0 22px 0; font-size:28px; line-height:1.25; font-weight:700; color:${C.text};">${parts.heading}</td></tr>
						${bars}
						<tr><td>
							<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>
						</td></tr>
						${note}
						<tr><td style="padding:26px 0 0 0;">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
								<td bgcolor="${C.green}" style="border-radius:999px; background-color:${C.green};">
									<a href="${url(parts.button.path)}" target="_blank" style="display:inline-block; padding:15px 28px; font-family:${FONT}; font-size:16px; font-weight:700; line-height:1; color:${C.card}; text-decoration:none; border-radius:999px;">${parts.button.label}</a>
								</td>
							</tr></table>
						</td></tr>
					</table>
				</td></tr>
				<tr><td align="center" style="padding:22px 16px 0 16px; font-family:${FONT}; font-size:12px; line-height:1.7; color:${C.muted};">
					${esc(COMPANY.name)} &middot; Reg. ${esc(COMPANY.reg)}<br>
					${esc(COMPANY.vat)}<br>
					${esc(COMPANY.address)}<br>
					<a href="mailto:${COMPANY.email}" style="color:${C.muted};">${COMPANY.email}</a> &middot; <a href="tel:${COMPANY.tel}" style="color:${C.muted};">${COMPANY.phone}</a><br>
					<a href="${url('/refunds/')}" target="_blank" style="color:${C.muted};">Refunds</a> &middot;
					<a href="${url('/delivery/')}" target="_blank" style="color:${C.muted};">Delivery</a> &middot;
					<a href="${url('/termsofservice.html')}" target="_blank" style="color:${C.muted};">Terms</a><br>
					<a href="${url('/accounts/profile/#emails')}" target="_blank" style="color:${C.muted};">Choose which emails you get</a>
				</td></tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`;

	// The plain-text copy: the same words, the tags taken out.
	const plain = (s: string) => s.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
		.replace(/&middot;/g, '·').replace(/&times;/g, '×').replace(/&minus;/g, '−').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
		.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
	const text = [
		plain(parts.eyebrow),
		plain(parts.heading),
		'',
		...parts.rows.map((r) => plain(r.left) + ' · ' + plain(r.right)),
		...(parts.note && parts.note.length ? ['', ...parts.note.map(plain)] : []),
		'',
		plain(parts.button.label) + ': ' + url(parts.button.path),
		'',
		`${COMPANY.name} · Reg. ${COMPANY.reg} · ${COMPANY.vat}`,
		COMPANY.address,
		`${COMPANY.email} · ${COMPANY.phone}`,
		`Refunds ${url('/refunds/')} · Delivery ${url('/delivery/')} · Terms ${url('/termsofservice.html')}`,
		`Choose which emails you get: ${url('/accounts/profile/#emails')}`,
	].join('\n');

	return { subject: parts.subject, html, text };
}

// ─── The five emails ───

function lineRows(p: Payload): Row[] {
	return (p.lines ?? []).map((l) => ({
		left: `${l.qty} &times; ${esc(l.name)}`,
		right: credits(l.price_credits * l.qty),
	}));
}

function collectNote(p: Payload): string[] {
	const lines = p.lines ?? [];
	const note = [`Collect at ${esc(venuePlace(p))}`];
	if (lines.some((l) => l.collect === 'bar')) note.push('Café: made when you arrive.');
	if (lines.some((l) => l.collect === 'collect') && p.collect_by) note.push(`Merch: collect by ${esc(day(p.collect_by, p.timezone))}.`);
	note.push('Show your code or QR at the bar.');
	return note;
}

function payRow(p: Payload, collected: boolean): Row {
	const total = credits(p.total_credits ?? 0);
	if (p.pay_with === 'credits') {
		return { left: 'Total &middot; paid with credits', right: total, strong: true, colour: C.green };
	}
	if (collected && p.paid_method) {
		const how = p.paid_method === 'card' ? 'Card' : 'Cash';
		return { left: `Total &middot; paid at the club &middot; ${how}`, right: `${rand(p.pay_cents ?? 0)} &middot; ${total}`, strong: true, colour: C.green };
	}
	return { left: 'Total &middot; pay at the club', right: `${rand(p.pay_cents ?? 0)} &middot; ${total}`, strong: true, colour: C.yellow };
}

export function buildEmail(p: Payload, site = 'https://thediveclub.org'): Built {
	const name = nameOf(p);
	const label = esc(p.label ?? '');

	switch (p.kind) {
	case 'order_placed':
		return build(site, {
			subject: `Order ${p.label} placed`,
			preheader: `Order ${label} · ${credits(p.total_credits ?? 0)}. We'll email you when it's ready.`,
			eyebrow: `Order ${label} &middot; placed`,
			heading: name ? `Thanks, ${esc(name)}` : 'Thanks for your order',
			steps: 1,
			rows: [...lineRows(p), payRow(p, false)],
			note: collectNote(p),
			button: { label: 'Show my order', path: '/accounts/profile/' },
		});

	case 'order_ready':
		return build(site, {
			subject: `${p.label} is ready to collect`,
			preheader: `At ${esc(p.venue_name)}. Show your code at the bar.`,
			eyebrow: `Order ${label} &middot; ready to collect`,
			heading: name ? `Your order is ready, ${esc(name)}` : 'Your order is ready',
			steps: 3,
			rows: [...lineRows(p), payRow(p, false)],
			note: collectNote(p),
			button: { label: 'Show my order', path: '/accounts/profile/' },
		});

	case 'order_collected':
		return build(site, {
			subject: `Your receipt for ${p.label}`,
			preheader: `Collected at ${esc(p.venue_name)}. Thank you.`,
			eyebrow: `Order ${label} &middot; collected`,
			heading: name ? `Here's your receipt, ${esc(name)}` : "Here's your receipt",
			steps: 4,
			rows: [...lineRows(p), payRow(p, true)],
			note: [`Collected at ${esc(p.venue_name)}`, ...(p.collected_at ? [esc(dayTime(p.collected_at, p.timezone))] : [])],
			button: { label: 'My orders', path: '/accounts/profile/' },
		});

	case 'order_cancelled': {
		const back = p.refunded
			? `${credits(p.total_credits ?? 0)} are back in your account.`
			: 'Nothing was charged.';
		const heading = p.cancelled_by === 'you'
			? `You cancelled ${label}`
			: p.cancelled_by === 'uncollected'
				? `${label} wasn't collected in time`
				: `The club cancelled ${label}`;
		return build(site, {
			subject: p.cancelled_by === 'uncollected' ? `${p.label} wasn't collected in time` : `${p.label} cancelled`,
			preheader: back,
			eyebrow: `Order ${label} &middot; cancelled`,
			heading,
			rows: [...lineRows(p), { left: p.refunded ? 'Credits back' : 'Charged', right: p.refunded ? credits(p.total_credits ?? 0) : 'Nothing', strong: true, colour: p.refunded ? C.green : C.muted }],
			note: [back, ...(p.cancelled_by === 'club' ? ['Questions? Ask at the bar or reply to this email.'] : [])],
			button: { label: 'Open the shop', path: '/shop/' },
		});
	}

	case 'top_up_paid': {
		const n = credits(p.credits ?? 0);
		const how = p.paid_method === 'card' ? 'Card' : 'Cash';
		const rows: Row[] = [{ left: n, right: rand(p.gross_cents ?? 0) }];
		if ((p.discount_pct ?? 0) > 0) {
			rows.push({ left: `${p.discount_pct}% off`, right: '&minus;' + rand((p.gross_cents ?? 0) - (p.pay_cents ?? 0)) });
		}
		rows.push({ left: `Paid &middot; ${how}`, right: rand(p.pay_cents ?? 0), strong: true, colour: C.green });
		return build(site, {
			subject: `${n} added`,
			preheader: `Your balance at ${esc(p.venue_name)} is ${credits(p.balance ?? 0)}.`,
			eyebrow: `Credits &middot; code ${esc(p.code ?? '')}`,
			heading: name ? `${n} added, ${esc(name)}` : `${n} added`,
			rows,
			note: [`Your balance: ${credits(p.balance ?? 0)}`, `At ${esc(p.venue_name)}.`],
			button: { label: 'Open the shop', path: '/shop/' },
		});
	}
	}
	throw new Error('TDC (Error): unknown email kind "' + (p as Payload).kind + '".');
}
