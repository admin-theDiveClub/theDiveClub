# Players: the profile page

## The player page (`/players/?p=<player id>`, 5 Nov)

Built from UV's combined design (artboard D, "Player Profile Designs" canvas on claude.ai), with a toggle UV added: **Profile · Head to head**, just below Compare with me. Reached from a name on a league's season page and its standings. Signed in only (UV, 5 Nov); a visitor is sent to sign in and brought back.

**Files:** `src/players/index.html`, `src/scripts/player.js`, `src/stylesheets/player.css` (after `league.css`, whose `.cp-views` pill, `.team-pic` and `.fx-state-*` colours it uses). Migrations `20261105044302_player_profile.sql` and `20261105064410_player_profile_every_state.sql`, tests `045_player_profile.test.sql` and `046_player_profile_every_state.test.sql`.

### What the page shows

| Part | What | From |
|---|---|---|
| Hero | Picture in a green ring with the verified tick, left of the centre line; display name and full name right of it. A tap on a photo shows it large (below) | `player` |
| Buttons | Ring icons in one row: Challenge (the cue ball, green ring; not built), Follow (below), Share (the phone's share sheet, else copies the link; the player's short link, or the long address if they have none, and then your own page says why; `docs/systems/foundations.md`, "Short links"), More (not built) | `tdc_i_follow` |
| Toggle | **Compare · Profile** (20 Nov, UV; Head to head was removed, below). Compare opens first for another player's page; `&tab=profile` in the address keeps Profile on reload; an old `&tab=h2h` or `&tab=cmp` opens Compare. Your own profile has no toggle | |
| Profile | Form (their last 10 frames, a yellow ring where they broke), Stats with a period (All time · Last 90 days · Last 30 days) in four boxes, leagues and teams with the team's place, recent matches (3, then See all), the last match's frames, honours, about. The frame difference per night is on Compare only (17 Nov) | `matches`, `frames`, `teams` |
| ~~Head to head~~ | **Removed completely on 20 Nov (UV):** the tab, its panel, its code and styles (the meetings, the split bar, the last meeting, the rematch button). `tdc_head_to_head` is still in the database (migration `20261105044302`) but nothing calls it | ~~`tdc_head_to_head`~~ |
| Compare | Both profiles side by side, yours left: every Profile section, each player's picture and names frozen at the top of their half | both profiles |

**The hero (reworked 5 Nov, UV).** `.pp-id` is two equal columns: the picture sits against the centre line on its left, the names against it on its right. The chips that were under the names went to About: Verified, Home venue and Since were already rows there, so only the discipline was added, as **Plays**. A display name too long for its half has its size brought down only until its longest word fits (`fitName`, run once the page is shown, after the fonts load and on resize), so it wraps between words and never inside one. *Claude's, for UV to judge:* at 420 wide the half is 172px, which even "Shadow" at 2.75rem overflows; it reads 39px there, "Thabo Mokoena" 34px, both 44px on a PC.

**The large picture** (UV, 5 Nov: players use it to recognise each other). A tap, or Enter or Space, on the hero's photo opens `.pp-zoom`: a dimmed, blurred page with the picture in the middle in the hero's conic green ring and glow, as large as 80% of the screen's shorter side, at most 36rem (a 512px picture, the size stored, inside its ring). It grows out of the hero picture's place (a transform from its box, Web Animations, 0.35 s) while the hero copy hides; any `pointerdown`, `wheel`, `touchmove`, `keydown` or `scroll` on the window shrinks it back the same way and removes it. The closers are added after the opening event, so the tap that opened it cannot close it. With less motion (`data-motion`, read as `dots.js` reads it) it fades in and out in place. A player with no photo gets no zoom: the picture is not a button, since initials help nobody recognise anyone (Claude's recommendation, UV said implement).

**The buttons and the tabs (UV, 5 Nov).** No bar above the hero: Back and the "Player" title are gone, and Share and More joined Challenge and Follow as one centred row of ring icons (`TDCRing`, as the fixtures page's buttons): each `.pp-icon` names itself by `title` and `aria-label`, carries its icon in `data-icon`, and draws itself in once the page is shown (`wakeIcons`). Challenge is the team card's lag icon, the spotted cue ball (UV), in a green ring with a soft glow; the rest are cream. `follow`, `share` and `more` were added to `ring-status.js` for them. Buttons marked `data-others` hide on your own profile, leaving Share and More. Compare with me became the toggle's third tab, **Compare**, holding Side by side, which left Head to head; Head to head is the meetings alone (UV).

**The Profile tab, second pass (UV, 5 Nov; Compare to follow).** The names stand on the picture's foot (`align-self: end`). **Form** is their last 10 frames across every finished match, newest right, by each frame's time: green and glowing won, an empty ring lost, a yellow ring round it where they broke (`.pp-dot-broke`). **Stats** is four boxes, equal widths in one row and as many rows as they need (`auto-fit`, at least 9rem: 2 × 2 on a phone, 4 across on a PC):

| Box | Big | Line |
|---|---|---|
| Frames | frame win %, green | P · W · L |
| Matches | match win %, green | P · W · L, and D only if they drew one |
| B&F | break & finish count, yellow | GB · rB&F |
| Conversion | frames won on their own break, of the frames they broke, cream | Lags (frames broken) · FW (of those, won) |

**Frame difference per night** replaced frames won per night: frames won minus frames lost on each of the last 15 nights in the period, a green bar above the base line, a grey one below it, a short grey stub on the line for a night that came out even. The line sits where the tallest bar on each side puts it. On the break, Golden breaks, Lags won and Best streak as boxes were removed (the best streak is still an honour).

**The Profile tab, third pass (UV, 5 Nov).** Order: **Teams** (the old Leagues & teams list, renamed, moved to the top), Form, Stats, Frame difference per night, **Competitions**, **Recent matches**, About. Competitions has two sub-sections, **Leagues** and **Tournaments**, 4 matches a page; Recent matches is every kind, social too, 5 a page. Each list's page number is the site's number stepper on its side (`data-stepper="across"`) at the right of its heading, which stays centred (`.pp-head`, a three-column grid); with one page it is greyed out. Each row starts with the match's **state strip**, the league fixtures' colours (`league.css` `.fx-state-*`): green not started, amber and lit playing, green and lit finished, red abandoned; the score shows once a frame is in ("–" before). The win or loss dot was removed 17 Nov (fourth pass, below). **Last match frames** and **Honours** were removed (honours: `docs/BACKLOG.md` §2 item 9).

**The Compare tab (UV, 5 Nov).** Each profile next to the other, yours on the left, every Profile section (UV), the old Side by side bars gone (UV). The halves are the match stage's (`match.css` `.mv-side::before`): each set in with the page's inner shadow, cast by the light, so the centre line is where they meet; the shadows sit under the content. Each half is headed by its player's picture and names in the stage's style (`.mv-person` sideways: display name 0.6 of the picture's height over the full name, both with the light's shadow; yours mirrored so both pictures face the line), and the heads stay at the top as the page scrolls (`position: sticky`, under the nav while it shows: `body:has(.site-nav:not(.is-hidden))`). Every section heading runs across both halves. **Form** runs down the page, newest at the foot; **Frame difference per night** too: a night a row, the line upright, won to its right, lost to its left; **About** is one table, the headings in the middle, every cell centred (UV). One period switch for both sides, kept in step with the Profile tab's (UV). Leagues and Tournaments are rows of their own so their headings line up.

*How it is drawn:* every Profile section's function takes a **view** (`view(root, p, side)`: the player and their boxes by `data-part`); the Profile tab is one view, Compare two (`views`), so Compare is the Profile tab's own drawing. A view on Compare is `vertical`, which turns the frame difference down the page. About is `aboutRows(p)`, laid as the Profile tab's list or Compare's table.

*The layout's doing, for UV to judge:* in a half the rows drop their picture and win or loss dot and the score is smaller, the page number sits under its list's heading, and a half's stat boxes are one column on a phone (two by two on a PC). Not driven: the heads moving down under the nav when it comes back on a scroll up (the rule is CSS only; seen at the top with the nav away).

**Fourth pass (UV, 17 Nov).**

| What | Now | Why |
|---|---|---|
| Frame difference per night | Off the Profile tab; still on Compare, down the page (`renderBars` runs for Compare's views only) | UV |
| A match row | Three lines, no date: **vs Team** / the league or tournament (`kindLabel`) / the venue (`rowNames`). Every meeting in Head to head the same, **Home v Away** for a team night, **vs Name** for singles; meetings carry no venue, so two lines | UV |
| A score | `scoreNode`: "9 : 16", the ":" grey with an even gap (`.pp-colon`), no win or loss dot. Won: yours green, theirs grey. Lost: both grey. Drawn: both cream. The same on Last meeting, the big meetings score and the Frames line | UV |
| Compare | No sunken halves; the heads (picture and names) stay, pinned, without a pill (UV chose). Leagues and Tournaments are one heading across both halves, each side's page number under it | UV |
| Compare's width | Takes back the card's padding below 36rem, the width at which the card's phone padding starts (design.css, 9 Nov); it said 24rem, so between 384 and 576px Compare ran past the card's edges, hidden until the halves went | Claude, found while rendering |

**The hero, the same day (UV):** the picture as tall as the display name and full name beside it, all in one row; the picture's top meets the display name's capitals and its foot the full name's baseline. The names are trimmed to those edges (`text-box: trim-both cap alphabetic`) with a small gap between them, and `sizePic` (run by `fitName`: on load, once fonts arrive, on resize) sets the picture to the names' height, never wider than its half. So a one-word name gives a smaller picture, three lines a larger one. The full name's paragraph margin (24px, from the card) is cleared, or the picture came out that much too tall. Where `text-box` is not supported (iOS before 18.2) the line spacing stays and the picture is that much taller.

**The hero, 19 Nov (UV).** Everything is centred: the picture and the display name in one row (`.pp-row`), the full name centred below. The picture is the display name's line height (`sizePic`, never over half the row), so a name that wraps gives a larger picture; the `text-box` trim and the two-column grid are gone. The verified tick sits centred on the picture's rim at 4:30 (`right` and `bottom` of 14.6% less half the disc), so it keeps its place at any picture size; it had sat inside the circle, 8px up. **The display name is 1.725rem** (UV, 19 Nov): 1.5 times the league's name in a league page's heading line (`h1.sd-line`, 1.15rem), in the display face. Claude misread this twice, setting the *full name* to that size first. The full name under it is 0.9rem, body face, line height 1.3, no paragraph margin. The picture is one line of the display name tall, not the name's whole height (a wrapped name had grown the picture and pushed its own last word out of the card), so it is about 36px at 1.725rem; the verified tick is half the picture across, so it scales with it. The Profile and Compare headings **Teams** are now **Leagues** (UV, 19 Nov; About's "Teams" row is unchanged); Competitions still has a Leagues sub-heading under it. **The tabs are one sunken pill (UV, 19 Nov):** `.pp-tabs` wraps the Profile · Head to head · Compare row and the three panels, so the tab row is the pill's top (its own sunken shadow gone, the thumb still raised) and the chosen tab's content sits inside it. Compare no longer takes back the card's padding, since the pill is its edge. On your own profile the tab row is hidden and the pill holds the Profile content. *Claude's reading of "fix placement", for UV to judge:* on the rim at the lower right, the usual badge place.

The display font's line height on this page (the name, the stat numbers, the team's place, every score) is 1.32, as `docs/ui.md` sets for it; at 1 or less Safari drew the lines into each other and into the labels above.

**Every state, counted or not (migration `20261105064410`).** `tdc_player_profile` now lists every match the player is in, each with its `status`: through their frames (a team night once both lineups lock, since the lock creates the frames), a singles match naming them before any frame, and a team night's **squad** before the lock. UV asked for a league night once the player is in their team's lineup; the order is a blind exchange until both sides lock, so the function reads the squad (open to read) instead and never the order, or the profile would tell an opponent who is playing. What is counted is unchanged: `frames` holds finished frames of finished matches only, and the page counts matches only where `status` is `complete` (`inPeriod`, `count`). A page served before the push says "Push migration 20261105064410" rather than showing empty lists. Tests: `046_player_profile_every_state`.

**Your own profile** has no toggle and none of the buttons meant for somebody else. Account settings stay on `/accounts/profile/`.

**Not built yet** (UV, 5 Nov: shown, a tap says so): Challenge, the rematch, Home venue (About's row), More. Each is a control with `data-unbuilt="<name>"`; a tap writes "<name> is not built yet." on its section's note line (`[data-note]`), or the page's status line.

### The player star (UV, 19 Nov; migration `20261119142114`, test `087_player_profile_break_outcome`)

Five spokes (win rate, own break, their break, break in, B&F), each measured against UV's own standard, never against other players: where the player's game needs work. The idea, UV's numbers and what is still open are in `docs/design/player-star.md`; it was tuned on `/sandbox/star/`.

| Where | What |
|---|---|
| Profile tab (yours and anyone's) | Under the Stats boxes, in the period. The star, plus the **raw star dashed**: their frames alone, with no starting frames (UV: every Profile tab) |
| Compare | **One star across both halves** (`#pp-cmp-star`, `.pp-c-wide`): you green, them blue (`--color-team`), a legend with both names; no raw star (UV) |

**How it is drawn.** One module, `scripts/player-star.js` (`TDCStar`), holds UV's standards and starting frames, the counting (`count`) and the drawing (`draw`), and the profile and the sandbox both use it, so a standard changed there changes both. Styles in `stylesheets/player-star.css`, loaded by both pages. `player.js` adds `renderStar(v)` for the Profile tab's view and `renderCompareStar()`, both run by `renderPeriod`, so the period switch redraws them. The counts come from `inPeriod(p).frames`: finished frames of finished matches, doubles left out as for every other number. Walkovers are left out.

- **The line only, no dots at the corners** (UV). The standard is the grey ring halfway out (UV).
- **A spoke with no data** (no chances in the period, e.g. Break in for a player with league frames only) sits on the standard, its label greyed with "no data" under it (UV). On Compare a label greys only when neither player has data for it.
- **How solid** the star is follows frames played, solid at 200 (UV), so a player with a dozen frames has a faint star.
- **The break result.** `tdc_player_profile`'s frames gain `break_outcome` (migration `20261119142114`, patched from the fresh-database text after `doubles_matches`, one line). It is the breaker's, so it counts on the player's own breaks only. League scorecards do not record it (none of 900 league frames on 19 Nov), so it comes from social and singles matches.

**Checked:** rendered headless at 420 on the local copy, seeded through the real functions (two players, two finished matches with break results, one dry, one scratch, one not recorded), signed in through the local auth: your own profile (star and dashed raw star, Break in counted 5 of 6), someone else's Profile tab, Compare (one star, both colours, no raw). The no-data label checked on the sandbox. Not on a phone, not against production.

**The league star (UV, 19 Nov, reworked 20 Nov; migrations `20261119180000` and `20261120080000`, test `088_player_profile_league_star`).** A star on **each Leagues row of a profile** (`.pp-team-star`, both halves of Compare) and on **each `/leagues/` card you are active in** (`.lc-star`, under the stat boxes; `leagues.js` `loadStars`). One player's frames in that league only, so the Stats period does not apply. It is **not the player star**: it has its own five spokes, drawn by the same `TDCStar` (`LEAGUE_SPOKES`), so it needs only who broke and who won, which every scorecard records (Break in is out, so no league star is "no data" for want of a break result).

| # | Spoke | Counted as |
|---|---|---|
| 1 | Win rate (label **Win %**) | FW / FP |
| 2 | **Lags won** (label **Lags Won**) | frames they broke / FP (UV's standard 50%) |
| 3 | Own break (label **W \| Own Brk**) | FW / lags won: frames won out of the frames they broke |
| 4 | Their break (label **W \| Opp Brk**) | FW / lags lost: frames won out of the frames the opponent broke |
| 5 | B&F (label **B&F \| Own Brk**) | BF / lags won |

*Claude's reading of "FW" in 3 and 4, for UV to judge:* frames won within those lags (as Conversion counts), since all frames won over lags won would pass 100%.

**Three lines (UV, 20 Nov).** **Grey pentagon:** UV's standards, the ones set on `/sandbox/star/` (50, 70, 40, 7, and 50 for Lags won), the same for every league, venue or not; the ring halfway out. **Yellow:** the league's own average for each spoke (below). **Green:** the player's current stats, **from their frames alone with no starting frames** (UV: you feel the heat in the league, while the player profile's starting frames keep it from hurting your profile too much). **Under each spoke's label** (UV, 20 Nov) the player's stat in green, a bar, the league's average in yellow, whole numbers with a % sign (`markNumbers`; UV first asked for none, then added them); a spoke the player has no data for shows "no data" instead, one the league has none for a dash. No raw dashed line, since it would be the green shape. How solid it is (the opacity) is **matches played ÷ matches scheduled**: the player's own finished matches over their team's non-bye fixtures (UV: the player's own), falling back to frames ÷ 200 with no schedule. This replaces the 19 Nov idea of starting frames equal to the league's expected maximum frames, which UV dropped on 20 Nov.

**On Compare, a league you are both in is one card with one star (UV, 20 Nov).** `#pp-cmp-shared`, full width above the two halves' lists (`renderShared`, `sharedSeasons`: both players need a team in that season); those leagues leave the halves' lists, and the others stay in them. The card names the league and season, then each side's team and place ("You" and the team name in green; the other player's display name and team name in cream, the name underlined: each side's names take its line's colour, UV 20 Nov), then one star: **yours the green shape, theirs a solid cream line** (UV, 20 Nov; the viewer was a dashed line, then a solid cream one, before UV swapped them; `dashed` layer option: the line alone, no fill, class `star-me`), the league's average yellow, UV's standards the grey pentagon. Under each label three numbers: **yours | theirs | the league's** (green, cream, yellow). *The three numbers are Claude's addition, for UV to judge; UV asked only for the combined card and the line.* Rendered headless in a scratch harness at 420 and 1000 wide on 20 Nov (star inside its card, no overlap); not on the real page.

**A league on one player's side of Compare is the star alone (UV, 20 Nov).** In a half-width list (a league only one of you plays) the star has no labels or numbers, since the half is too narrow to read them (`draw(…, { bare: true })`: the picture is trimmed to the star). The Profile tab's rows and the shared card keep their labels.

**A league card opens the league's first page, Standings (UV, 20 Nov).** The profile's Leagues rows linked with `&team=`, which opens the Season tab on that team; they now open Standings like every other league card (`/leagues/` cards, the home cards, the menu and venue tiles already did). A team's name in About still links to the team on Season.

**The league's average (UV, 20 Nov; migration `20261120080000`).** `tdc_league_star_average(season)` returns the nine counts of every player's frames in the season pooled (finished frames of finished matches, doubles and walkovers left out, a frame once per player in it), signed in only; `TDCStar.leagueSettings` reads it with the schedule and `layer` draws it as plain rates (`avg` option), on the same scale as the star, so the grey pentagon still marks UV's standard. *Claude's reading, for UV to judge:* pooled (total successes ÷ total chances), not the mean of each player's own rate, so a player with many frames weighs more; the win-rate spoke is always 50%, as every frame has a winner and a loser.

`tdc_player_profile` gained `matches[].league_season_id` (so frames can be tied to a season) and `teams[].rules` (added for the expected-frames idea UV later dropped; unused now, left in as the migration is on production). "Matches played" is the player's own matches (UV, 19 Nov), so a team night they sat out lowers their star's solidity. Not rendered yet: checked only by the logic and the database test.

### Follow (UV, 5 Nov; migration `20261105205913`, test `061_player_follows`)

**One-way, no approval, and private** (UV): a tap follows, a second tap stops, and only you can see who you follow. No follower lists, no counts, no notification. Private can be opened up later; once people have seen who follows whom it cannot be taken back.

The button is the person with a plus, turning to a green tick once you follow. Its label names the player. After each write the page re-reads `tdc_i_follow` and redraws the icon only if it changed. It does not show on your own profile.

**Why it is shaped this way.** `tbl_player_follows` has no grants and no policies: nothing can read it directly, and `tdc_i_follow(player)` answers only for the person asking, so no call can say who follows somebody. `tdc_set_follow(player, follow)` is the one write; saying what is already so is not an error, so two phones end in the same place. Anybody with a player record can be followed, a walk-in too, since their followers then move with them. `private.tdc_merge_players` carries both directions: nothing is left on the signup record, each person follows once, and the two records following each other is removed rather than becoming somebody following themselves.

**The list of whom you follow (UV, 5 Nov; migration `20261105212922`, test `063_my_follows`).** On `/players/`, under the search: each player by name, a link to their profile, with a green tick beside it that stops following them. `tdc_my_follows` returns only the list of the person asking, so follows stay private. Stopping is `tdc_set_follow`, then the list is read again and a line says "You no longer follow Shadow." There is no confirm (UV, 5 Nov): one tap, since following them again takes only a search and a tap.

### The player search (`/players/` with nobody in the address, UV 5 Nov)

Players in the left menu. Type two letters: each result is a link to that player's profile and does nothing else. It reuses `tdc_search_opponents`: everyone with an account but you, by display, first or last name, 20 at most. Walk-ins are not found, and "Nobody by that name" says so. Signed in only, as the profile is. The dots run on a small spot of their own at the field's right, because on the field they would dim it under the person's typing.

### The feed (UV, 5 Nov; migration `20261105214625`, test `064_my_feed`)

On `/players/`, above Following, once you follow somebody: matches being played and results from the players you follow. Playing first, then results, newest first; ten rows, then Show more. A row opens its match to watch, or a league night's team card.

| Part | How |
|---|---|
| A singles match | "Shadow v Thabo", the score, Playing with its race or Finished with its date, the competition if any |
| A league night | One row, "Team 0 v Team 3", the team score, and "Shadow played" (UV) |
| Two you follow in one match | One row, naming both |
| Left out | Not started (UV), abandoned (Claude's) |

**Finished as soon as it is scored (UV).** A match reads finished once it is complete, once a card has been submitted, once a race or best-of is reached, or once every frame of a team night has a result. So a result still waiting on a second captain or a coordinator reads Finished here, while the match's own page says more. Claude recommended waiting until it was settled; UV chose this.

**Live while the page is open (UV).** `player.js` watches each match being played through `tbl_matches`, as the fixtures page does, and any change reads the feed again, the score fading (`TDC.liveFade`). Hidden, it lets go of the socket; shown again, it reads the feed. **A match that starts meanwhile is not heard**, so it appears on coming back to the page or reloading.

**Why it is safe.** It shows nothing a signed-in player could not already see on those players' profiles. A team night comes only through its frames, which are made when both lineups lock, so the secret order is never read. Nobody can read another person's feed, so it says nothing about who follows whom.

**Checked:** 25 tests, and driven at 420 on the local copy with real accounts: a second session scored while the page stayed open, for a viewer inside the match and one outside it, and the score followed with no reload. **Not driven in a browser:** a league night's row (by tests only). Not on a phone.

### The two functions

Both security definer, signed in only, read only; the page never reads `tbl_players` directly (keeps clear of STATUS B2).

- **`tdc_player_profile(player)`** returns `player` (display and full name, picture, since, `verified`: an identifier with an active verification at any venue, only the yes or no; `is_me`), `matches` (every match they played a frame in, newest first, its kind and competition, the opponent, and the score counted from the frames), `frames` (their own frames in those matches: `won`, `broke`, null where breaks were not tracked, `result_event`) and `teams` (every league season they are entered in).
- **`tdc_head_to_head(player)`**: the caller against that player. Only frames the two played on opposite sides count; a meeting is a match holding at least one, won by whoever won more of them. Against yourself it returns `same: true` and no meetings. **Unused since 20 Nov** (the Head to head tab was removed); the function and its test remain.

- **Venues (5 Nov):** a team and a match each carry `venues`, shown after the league and date on its row. Head to head does not.

### How it counts (why it is shaped this way)

- **Frames are the only record:** the functions return matches and frames; `player.js` counts every number, so the period filter is the page's alone (on `played_at`, as `/matches/` dates a match).
- **Only finished matches count** (status `complete`), and only their complete frames. A social match still being played, or a league night not yet signed by both captains, adds nothing; an abandoned match never does. *Claude's choice, for UV to judge.* Since `20261105064410` such matches are listed, with their state, but still not counted.
- **A team night is the player's match** (UV, 5 Nov): won if their side won, scored as the two sides' frames (3–1), while the player's own frames are only the ones they played. Matches and the streak use the match; Form, Frames, B&F, Conversion and honours use their own frames.
- **Head to head on a team night** counts only the frames the two played against each other: UV and Shadow in the same night but never paired have not met.
- **"Lags"** is frames broken, as the standings count `lags_won`; Compare's "Lags won" is those out of frames with the break recorded.
- **Best streak**: matches won in a row; a loss or a draw ends one.
- **A team's place** is ranked in the browser with `TDCStandings.rank` and that season's own team columns (`tbl_league_standing_columns`), exactly as the Standings tab ranks it, from `tdc_league_standings` (signed nights only). "–" where the league has no ranking column.
- **Honours** are off the page until built (UV, 5 Nov; `docs/BACKLOG.md` §2 item 9).

### Checked

Rendered and driven headless on a scratch build against the local Supabase copy, seeded through the real functions (Shadow: six singles and a team night): 420 × 860 both themes and 1440 wide; every count checked against the seed; the period, the toggle, the address, a not-built tap, your own profile. Never against production.

### Doubles (19 Nov, migration `20261119124608`)

A doubles match is listed but never counted (UV): `tdc_player_profile` marks it `doubles` with the `partner`, and leaves its frames out of `frames`, so Form, Frames, B&F and Conversion never see it; `inPeriod` skips it, so Matches and the streak do not either. Its row reads "with Bob vs Carol & Dan". `tdc_head_to_head` skips doubles: two players on opposite sides of a doubles match have not met. Showing doubles numbers of their own is not built.
