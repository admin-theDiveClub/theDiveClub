# The shop — design and build plan

Settled direction (UV, 24 Nov 2026). Built in stages, **one stage per chat**. UV opens a fresh Claude Code chat for each stage and says "Read `docs/design/shop.md` and do Stage N."

Designs: https://claude.ai/artifact/PeddCFMHTwkoxnVwf41Mu6 (look and flow only; nothing on it is wired up, and its prices are samples).

## The decision behind it

**First chat (Stage 1) adds this to `docs/DECISIONS.md` before anything else:**

> ## 2026-11-24 — The shop is built before the payment gateway
> *Decided by UV:* the shop (credits, products, cart, checkout, orders, the staff queue, receipts) is built and running before PayFast or any other gateway, reversing 3 Nov "Payments before spending, designed as one". "Pay at the club" is the payment step until a gateway is live, and the site says so.
> *Why:* payment providers' compliance reviews (PayFast stalled since 9 Nov) need to see a working shop with real products and prices. A gateway (PayFast, or Yoco as the fallback) plugs into the payment step later without changing the rest.
> *Touches:* `docs/STATUS.md` P4, P5; this file

Then update `docs/STATUS.md` P4 and P5 to point here.

## Principles (UV)

- **Minimal clicks. Never take the person off the page they're on.** Cards and sheets open over the page.
- **Functionality first; every screen clean and in the site's own look** (`docs/ui.md`, `design.css`).
- **Simple words, minimal text.** The page guides; it doesn't explain.
- **Buying credits and buying things are separate.**
- Until a gateway is live: online payment shows as "Coming soon", and **Pay at the club** is the working option, said plainly on the shop and in checkout.
- Venue-scoped (`venue_id`), like the credit ledger, so other clubs can use it later.
- Restricted products never appear on the site (UV, 14 Nov).
- Money and business rules are UV's: **never assume a price, tier, limit or rule. Ask.**

## The stages

| # | Chat | Builds | Depends on |
|---|---|---|---|
| 1 | **Credits** | The Add credits card, top-up requests, staff confirming payment | — |
| 2 | **Products and cart** | The product list, prices, the shop page, the cart | 1 (balance pill) |
| 3 | **Checkout and orders** | One-page checkout, the order record, the order screen | 2 |
| 4 | **Staff queue and hand-over** | `/staff/orders/`, scan or type a code, hand-over | 3 |
| 5 | **Receipt emails** | Emails at each step, credits and orders | 1, 3, 4 |
| 6 | **Gateway** (later) | Card and Instant EFT in the payment step | an approved provider account |

Each stage: read this file, `CLAUDE.md`, `docs/STATUS.md`, `docs/systems/foundations.md` (credits) and `docs/ui.md`; ask the stage's open questions; plan; wait for UV's go-ahead; build; test; document (CLAUDE.md §3). Nothing from a later stage is built early.

---

### Stage 1 — Credits

**The Add credits card** (canvas artboard 2). One pop-up card, opened from the balance pill wherever it appears (shop, profile, nav if UV wants it there). It never leaves the page. Three steps on the same card:

1. **Amount**: a numeric input and a slider, kept in step. Ticks on the slider show the discount tiers and light up as they're passed, with a line like "You save R… · 250 more for 15%". A Checkout button, with the accepted payment methods shown small below it.
2. **Checkout**: the order (credits, discount, total in rand), who it's for (name; receipt to the account email), and the payment options: Card / Instant EFT greyed "Coming soon", **Pay at the club** selected.
3. **Pay at the club**: a short code and QR on the card, "Waiting for payment", Done. The request is also listed under Credits on the profile.

**Staff side**: staff find the request (scan or type the code) on a staff page, take payment, confirm. The credits land in the ledger at once and the person's card or profile updates.

**Pricing set by the owner** (memory: flexible ZAR per credit, promos): rand per credit and the discount tiers are settings the owner changes, not code.

**Likely database work** (plan it, confirm with UV): a top-up request record (venue, player, credits, rand, discount, code, status, who confirmed, when); the ledger taking a new entry kind for a confirmed top-up (it allows only `adjustment` today; `docs/BACKLOG.md` §3 item 3); owner pricing settings. Any new table referencing `tbl_players` goes into `private.tdc_merge_players`.

**Ask UV first:**
- Rand per credit, the tiers (amounts and %), the slider's min and max
- Is the discount money off, or bonus credits?
- How long a pay-at-the-club code stays valid; what happens when it expires
- Which staff may confirm a top-up, and is cash vs card recorded?
- Where the balance pill shows (shop and profile at least; the nav?)
- How this sits beside the existing redeem codes (keep both?)

### Stage 2 — Products and cart

**The shop page** (canvas artboard 1): balance pill top right, a short "Online payment is coming soon. Pay at the club for now." note, category tabs (sunken pill, sliding thumb), a list with a + per item turning into a quantity, and a cart bar pinned to the foot ("3 items · 140 credits · View cart") that follows you. **Since 25 Nov the tabs and the + per row are gone** (DECISIONS 25 Nov, "The shop: categories as cards, a product's own card"): the categories are cards, each opening a product sheet and a product's own card.

**Products**: owner-managed (name, category, price, picture, active, collect-type: made at the bar / collect within 30 days). The current `/shop/` listing becomes the real shop; its policy links stay.

**Cart**: kept for the signed-in person (survives a reload); quantity steppers; never more than one tap from the shop.

**Ask UV first:**
- Prices in credits, rand or both
- The real starting product list and prices
- Stock counts now, or wait for P5 (stock management)?
- Can someone signed out browse? (Buying needs an account.)
- Does anything need ID verification to buy (per track gating)?

### Stage 3 — Checkout and orders

**One-page checkout** (canvas artboard 3): the cart lines with steppers, **Pay with** (credits, or at the club), **Collect** (The Dive Club; café made when you arrive; merch within 30 days; bring ID), total, Place order.

**Order placed** (artboard 4): the order number large (A27), a QR, status Placed → Preparing → Ready → Collected, the lines and payment, "We'll email you when it's ready." Orders listed on the profile.

**Rules already in the policies** (`/refunds/`, `/delivery/`): merch collected by the account holder with ID within 30 days; uncollected or out of stock → credits back. Follow them; don't restate them differently.

**Ask UV first:**
- Can shop items be paid with credits now?
- Can an order be cancelled by the player, and until when?
- Order numbers: per venue, per day, reset when?

### Stage 4 — Staff queue and hand-over

**`/staff/orders/`** (artboard 5): three columns, New · Preparing · Ready to collect, each card with the number, name, lines, payment tag (Paid · credits / Pay at club · amount) and one button to move it on. A code field and Scan at the top. Top-ups waiting (Stage 1) shown too.

**Hand-over** (artboard 6): the person's name and picture, ID verified or not, the lines, three ticks (ID matches, payment taken, items handed over), then Mark collected. Collected sends the receipt.

**Settled since (UV, 24 Nov):** staff look at an ID document at hand-over for merch (the Delivery policy's line stays), though no ID verification is needed to buy. An order not collected within 30 days is cancelled by a nightly job with its credits returned (STATUS §3).

**Ask UV first:**
- Which roles see the queue
- One screen at the bar, or phones too? Live updates needed?
- Sounds or alerts for a new order?

### Stage 5 — Receipt emails

One email layout (artboard 7), in the site's look, sent through Resend from an edge function (secrets server-side only): top-up confirmed, order placed, ready, collected, refunded. Each with the lines, total, payment, where to collect, and the company block and policy links at the foot.

**Ask UV first:**
- The sending address (UV wants function addresses later, e.g. orders@)
- Which steps send an email, and whether staff get one for new orders

### Stage 6 — Gateway (later)

Only once a provider account is approved (PayFast, or Yoco: hosted Checkout API with webhooks). It switches on Card / Instant EFT in the Add credits card and checkout; the payment confirmation (ITN or webhook) is checked server-side before anything is marked paid. Nothing else changes.
