# The UI list

**UV's running list of UI things to keep consistent across every page** (started 24 Nov 2026).

## How it is used

| When UV… | Claude… |
|---|---|
| **Mentions anything UI related** (a look, a spacing, a word, a behaviour on screen) | Adds it to the list below **in the same turn**: the rule in UV's words, the date, the page where it was seen, and how to check a page for it. If it repeats or changes an earlier item, that item is updated rather than a new one added |
| **Says "fix the UI" of a page** (or "fix `<page>`") | Goes through **every item on the list** against that page, then compares the page with the pages already done (the log at the foot) so it matches them. Renders it at 420px first, then a PC width. Fixes go into the shared stylesheets and scripts, never that page alone (`feedback-site-wide-changes`). Lists for UV what changed, item by item, and adds the page to the log |
| **Says an item is wrong or no longer wanted** | Changes or strikes it here, with the date |

Where an item is a site-wide design rule, it also goes into `docs/ui.md` ("The design" table) when it is built, as the other rules there are. This list stays the checklist; `docs/ui.md` stays the reference.

**Anything the list does not settle is asked, never judged** (CLAUDE.md §1).

---

## The list

| # | Rule | Raised | Seen on | How to check a page |
|---|---|---|---|---|
| 1 | **Spacing under the custom font, everywhere on the page.** No line of Rushford Clean runs into the line below it, or into a label, underline or box edge | 24 Nov | Tournament poster | Every rule that sets the display font has `line-height: 1.32` (`docs/ui.md`, "The display font on iPhones", 17 Nov). Look at every heading, name, number and badge at 420px, and on an iPhone if possible, since Safari sits the letters higher. Look for wrapped lines touching and clipped tops |
| 2 | **Tapping a player opens their profile**: in the banner and everywhere below it, both names and pictures | 24 Nov | Tournament poster | A picture uses `TDC.profilePic(el, playerId)` (`tdc.js`). A name is a link to `/players/?p=<id>`, or is marked the same way where it sits inside something already tappable. A walk-in with no account has no profile and stays plain. Tap every player on the page |
| 3 | **A tournament's pages work as a league's do**: one set of pages for each tournament, public and admin. The **bar at the foot of the screen** has the public tabs, plus the admin controls as their own separate icon for whoever runs it (as Manage on the league bar) | 24 Nov | Tournament poster | Compare with a league's bottom bar (`league-nav.js`, `#league-tabbar`; `docs/ui.md`, "The league tabs' bottom bar"). Check every page of one tournament (poster, bracket, manage), signed out, as a player and as the director. **This one is a build, not a check.** The first time it comes up in a fix, Claude plans it (the tabs, the icons, what goes in the admin menu) and waits for UV before building |
| 4 | **Spacing above a page's main button** (I'm interested, Join this league): the gap between the banner and the button under it matches the gap under the button, and is the same on every page that has one | 24 Nov | Tournament poster | Measure the gap from the banner's foot to the button's top and from the button's foot to the next thing, with the banner folded, at 420px. Compare with the league Season tab's Join this league |
| 5 | **No small text links at the foot of a page** ("Back to …", "Entrants · Draw"): the bottom bar and the site's menu are the way round | 24 Nov | Tournament pages | Scroll to the foot of the page above the footer: no `.link-row` of small links. A message with nothing else on the page ("Nothing here") may keep its one way out. `/leagues/new/` still has "Back to …", for when it goes through the list |
| 6 | **Who is in comes before the rules** on a competition's public page | 24 Nov | Tournament poster | The entrants' section sits above How it is played and Round by round |

---

## Pages put through the list

| Page | Date | Items checked (up to #) | Notes |
|---|---|---|---|
| Tournament poster (`/tournaments/poster/`) and the draw page (`/tournaments/bracket/`) | 24 Nov | 4 | **1:** nothing to change in Chrome, every display-font line at 1.32 (rendered at 420 with every section showing); still to see on an iPhone. **2:** built: player ids in the snapshot, every person and draw side a link (migration `20261124172239`). **3:** planned and answered by UV (Poster · Draw · Rules; Manage as its own icon with Run the draw, Entrants, Settings; signed out the bar shows and Draw and Rules ask to sign in); built the same day on both pages (`tournament-nav.js`). **4:** built site-wide: the gap under every table banner measured from the table as drawn |

A page checked up to item #N needs only the items after N on its next pass, unless a later item changed an earlier one.
