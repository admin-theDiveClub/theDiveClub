# theDiveClub — status

**The one live list.** What is being built, what is next, what is blocked, and what is waiting on UV. If an outstanding item is tracked anywhere else, that other place is wrong — bring it here and delete it there.

Updated at every milestone, in the same breath as giving UV a commit subject. Never batched to the end of a session.

Last updated: **24 Oct 2026** (a match's own referee, picked from the players)

**Production is current through `20261024102616`** (league status and the search filters; checked against production's migration list, 24 Oct). **Waiting to push: `20261024162559` (match referee). Push it before deploying**: `match.js` reads the new column, and without it the match page fails to load.

---

## 1. Waiting on UV

Nothing here can be done by Claude.

| | What | Why it matters |
|---|---|---|
| 0000 | **Push `20261024162559`, deploy, then try the referee** | Start a social match on `/matches/new/` against a second account, open Officials and approval, search for a third account as Referee, Start. On the match page the panel shows them. **As the referee:** you can score, the settings are greyed out, and the match is in your `/matches/` list as "A v B" with a Referee tag. Record frame 1. **As a player:** change frame 1 and you're refused ("last set by the referee"); remove the referee in the panel, and frame 1 can be changed again. Claude checks the rows |
| 000 | **Deploy (migration pushed, confirmed 24 Oct), then try `/leagues/`** | Test_WedSim_8BMTL starts as **Running** (it has fixtures) and New League Test as **Taking entries**. On `/leagues/`: your rows show status, discipline and team size under the name, a coloured strip, and Starts / Ends / Ranking / Teams (4 teams, 20 players) as columns on the PC. In the search: the filters (Singles says there are none yet), the tiles scrolling sideways. As Owner@TDC, Settings → Status → On break → Save: the strip turns amber. Then glance at any other page on the PC: everything is 10/12 wide now |
| 00b | **Retest the merge** (A5 is pushed, confirmed 24 Oct) | This is item 2 below. Production has **no walk-in records** (checked 24 Oct), so make one first. As Owner@TDC on `/staff/`, add a walk-in; then on `/staff/link/` link it to a dummy Test_WedSim player who is in a lineup (e.g. Dylan Fourie, Team 0 position 5). **It cannot be undone**: the dummy's player record becomes the walk-in's. Afterwards Team 0 v Team 3 should still show them at position 5 with their frames. Claude checks the rows |
| 00a | **Try A4** (pushed, confirmed 24 Oct) | Nothing to see: the card sends neither of the things it refuses. Record one result and one lag on Team 0 v Team 3 (frame 15 has Thabo Mokoena in it, who has since moved to Team 2; it must still save) |
| 00 | **Deploy if not done, then try A2/A3** (migration pushed, confirmed 24 Oct) | In **Test Tournament - 2**, open Linton Paul v UV (in progress, 1 frame). **As UV** (a player and its scorer): the panel says the rules and time are set by whoever runs the tournament; every setting and the time are greyed out except **Lag winner**, which still saves. **As Owner@TDC** (its director): everything is open; change the time and it saves. No notification will arrive when Owner@TDC moves it (B7). Ignore the "Social match" line at the top of the panel (§6) |
| 0a | **Try the league settings page** | After pushing `20261023193153` and deploying: open Test_WedSim_8BMTL → Settings (TestTuesday and Test 8BMTL were cleared on 23 Oct). Set team size 5, look at the rotation grid, change one cell in session 2 and watch it swap, save. The message should say **2 matches now use these rules** (neither has started) and none kept. To see the card follow it, try team size 4 once: a match's card should then offer 16 slots, not 25. Set it back to 5 afterwards |
| 0a2 | **Try the team limit** | After pushing `20261023213048` and deploying: Test_WedSim's teams should each read **5 of 7 active** (reserves default to 2). From your captain account, claim two more onto Team 0 (7 of 7), then try a third: refused, "Team 0 is full". Mark one player **Away**: 6 of 7, and Claim works again. As that player (or you), press **Back** while the team is full: refused. As Owner@TDC, set Reserves allowed to 1 in Settings: the manage page should warn that Team 0 is over the limit |
| 0a3 | **Finish the night on the new card** | **Checked against production 24 Oct 09:58:** Team 0 v Team 3 locked both sides, built 25 frames, every pairing matches the rotation, 7 frames recorded each with its own lag (4–3). **Still untried:** an empty seat, a reserve, signing. Both sides were full, so try them on Team 1 v Team 2. **A reserve needs somebody beyond the five**: every team has exactly five, so first add a sixth to one team (the limit is 7). All 20 entrants are already placed, so there is nobody to claim: as Owner@TDC, add Owner@TDC itself (or any other account) on the manage page and put them on Team 1. Without one there is no picker, only a note saying so. Then leave one position empty on one side; put a reserve into one of its frames; try the same reserve again in that session (refused: rule 1); try a regular in the empty seat (refused: rule 2); sign, and the seats still empty become walkovers. **Its cutoff is 8 hours (11:30 on 24 Oct)**: set it to 0 first, or both sides lock empty and the night has no frames |
| 0b | **Play a singles match straight after pushing** | `20261022230000` and `20261023090000` both patch **`tdc_record_frame`**, which every match goes through, plus `tdc_submit_card`, `tdc_answer_card` and `private.tdc_card_state`. All changes are additive and covered by new tests — including that a singles card still settles on submission when no approval is wanted, and still waits for an answer when it is — but the original match suites from 15–21 Oct did not survive their container, so a real singles match is the only end-to-end check there is |
| 0c | **Retest Name Down → In the League** | After pushing `20261023201147` and deploying: re-run `supabase/seed/dummy-league-players.sql`, which puts the 19 dummies back on Name Down, unconfirmed (Test_WedSim_8BMTL, cleared and recreated 23 Oct). Move them in: they should show **Has not confirmed**. That league confirms on payment, so tick paid on one and it should confirm. Your own entry is untouched |
| 0d | **Try the league pages on a phone** | Steps 2 and 3 are pushed and were proven only on a throwaway Postgres driven by headless Chromium. At `/leagues/`: create a league, add a second account, make two teams, confirm as both, generate the fixtures, start a match |
| 1 | **Play through sections 8, 11, 12, 13 and 14 of the test plan** | Several builds are proven only against a scratch database. The logic is verified; a real league night is not |
| 1b | **Try the bracket editor on a real draw** | Insert a prelim, add a match to it, click an arrow to rewire, remove a match. Proven against a scratch database and rendered in headless Chromium; never driven by a person. **Check a tournament with a third-place playoff in particular** — it was broken from 22 Oct until this build and nobody hit it |
| 2 | **Retest the walk-in merge via `/staff/link/`** | The one thing left that could lose real data. Changed on 21 Oct and again on 24 Oct (A5), so earlier testing no longer counts. Now covered locally by `028_merge_players`; the steps are in 00b |
| 3 | **Enable the signup bot check** (Turnstile or hCaptcha) | Self-entry currently rests on a confirmed email address alone. The bot check is the other half of "a verified account" |
| 4 | **Set the black-alpha values** for the refreshed branding | UV sets them himself on `/sandbox/` (palette Depth strengths and the logo controls) and saves them into `variables.css` (22 Oct). Done once he has saved and committed them |

---

## 1a. From the 23 Oct audit

Found in a read-only review of every migration, the front end, the edge functions and the build. **Each was checked against the latest code.** The full write-up is the "project-wide audit" doc in the claude.ai project.

### Fix before the next real league or tournament night

| | Where | What happens | Fix |
|---|---|---|---|
| A2 + A3 | `tdc_update_match_settings`, `tdc_set_match_time` | A player could change a competition match's rules after approval (e.g. approval off, which unpublished it), or move it and its lineup cutoff | **Pushed (`20261024082447`); `match.js` deploys with the site.** UV to try it (§1, 00). Directors only, never once settled; the lag winner stays with the players |
| A4 | `tdc_record_frame`, team matches | A sent player list could put anybody into a team frame, and being in a frame grants edit rights | **Pushed (`20261024084837`, confirmed 24 Oct); UV to try it (§1, 00a)** (`docs/systems/leagues.md`). On a team card it never changes who is in a frame or makes one; the reserve picker is the one way in |
| A5 | `private.tdc_merge_players` | Missed `tbl_league_match_squad`, `tbl_league_match_order` and `tbl_notification_prefs`; a merge emptied lineups and reset notification settings | **Pushed (`20261024090641`, confirmed 24 Oct); UV to retest (§1, 00b)** (`docs/systems/foundations.md`). All 22 references handled; on a clash the account's row wins |

### Before more real players join

| | What | Notes |
|---|---|---|
| B1 | **Privacy policy and terms** | Stubs today while the site stores SA ID numbers. Written or checked by a person, not Claude alone. Register an Information Officer with the Information Regulator |
| B2 | **Direct reads of personal data** | `tbl_tournament_entrants` (paid, notes — §6) and `tbl_players` (every player's first and last name, including names staff typed from ID documents) are readable by any signed-in user. Director notes on tournaments, leagues and fixtures, and dispute notes, likewise. Revoke the direct reads; read through functions |
| B3 | **Sign-in redirect** | `TDC.safeNext` lets `?next=/\evil.example` through, which sends a user off-site after sign-in. Notification links share the gap in their check constraint. Compare origins with `new URL(next, location.origin)` |
| B4 | `tdc_staff_link_account` | Staff at any venue can attach any walk-in to any account, with no consent and no venue link. Owner/admin only, walk-in tied to that venue, user confirms |
| B5 | `tdc_add_my_identifier` | Reveals whether an SA ID, phone or email belongs to someone else. Generic message and a rate limit |
| B6 | `tdc_remove_entrant` | Hard delete blanks decided bracket history. Refuse once they have played; mark withdrawn |
| B7 | `notify-card` | A match player can repeat a notification, or send one that doesn't match the card. Check the event exists; ignore repeats within a few minutes. **Also (found 24 Oct with A2/A3):** it accepts only a caller who is in the match, so when a director or venue staff who isn't playing moves a match (or deletes one, A1), nobody is told, while the page says "Both players have been told". The failure goes only to the console. Let `notify-card` accept whoever `private.tdc_can_change_match` / `tdc_can_delete_match` allows, or have the page stop claiming it |
| B8 | Leagues and `score_entry_mode` | The competition lookup only knows tournaments, so a league's score-entry mode, rank protection and publishing don't apply. Extend it, or record that leagues don't use them |
| B9 | **Account deletion** | Decide the flow (POPIA). Also see §6 on deleting an account leaving a league player behind |

### Before public launch

| | What |
|---|---|
| C1 | **Backups and one test restore** — UV, 23 Oct: once functionality is complete and the site is ready for public use |
| C2 | A "local only — never `config push`" warning at the top of `supabase/config.toml` (it holds `127.0.0.1`, 6-character passwords, confirmations off) |
| C3 | A Content Security Policy meta tag in `layout.html`; move the inline service-worker registration into a script file |
| C4 | Real `404.html`, `robots.txt` (hide `/staff/` and `/sandbox/`) and `sitemap.xml` — all empty today |
| C5 | Service worker: cache scripts and styles so an offline reload of `/match/` keeps the offline queue; stop caching error pages |
| C6 | Define what the platform is for, and what "free" covers, **before involving other clubs** (UV, 23 Oct) |
| C7 | The director's guide, `docs/product/running-a-tournament.md`, before the first outside venue |

Lower-priority audit items are in `docs/BACKLOG.md` §7.

---

## 2. In progress

| Area | Chat | State |
|---|---|---|
| Leagues | Leagues | **All six steps built and pushed.** A league night is playable end to end: fixtures → start the match → both captains lock a lineup → frames appear → results on the grid → both sign. Structure, pages, fixtures, ruleset v2, lineups, submission, entry. See `docs/systems/leagues.md`. **The LD settings page and the team limit are pushed; the session rework (the order is per position, reserves under three rules, empty seats open until signing) is built and waiting to push (24 Oct).** **One body of work remains: LD-configurable standings** (`docs/design/leagues.md` §6, token-array equations) |

---

## 3. Next up

In the order it probably makes sense.

| | What | Notes |
|---|---|---|
| 00 | **Put the tests in the repo** | **The harness is done (23 Oct):** Docker Desktop and a local Supabase that the fingerprint shows is identical to production, `supabase/roles.sql` for the two dashboard-made differences, the helpers, and `npx supabase test db` as the one command. See `docs/systems/tests.md`. **Still to do:** rebuild the scratch-database checks (468 by 23 Oct, all lost) as pgTAP files, one area at a time: matches and the card first (what A1–A4 touch), then the merge (A5), tournaments, leagues, notifications, identity and credits |
| 0c | **The LD schedule page** | UV, 23 Oct: weeks (date and time, assumed from the generate settings), venue, tables, home/away. Open questions to put to him: is the venue per fixture or the home team's? how are tables identified? is a manual home/away swap wanted? |
| 1 | **Leagues: standings** | The table a league is for. LD-configurable columns built from a **token array, never a string** — the design is explicit about that and lists the tokens. Designed in `docs/design/leagues.md` §6 |
| 1a | **Singles leagues** | UV, 24 Oct: a league with team size 1. Today every league must have a team size of 2–10 (`private.tdc_check_league_rules`, "Every league has a team size", 23 Oct), so this reaches the rules check, the lineup and the card (a singles night has no sessions), the team limit and the rotation. The league search's Singles filter is built and finds nothing until then |
| 1b | **A player's own frame on `/match/`** | The design's second surface: a player opens the match page and sees only their own frame. `/match/` still refuses a team match, so today a player's frame is entered by their captain on the card. Nothing is blocked by this — it is the convenience half of "two surfaces, one record" |
| 2 | **UV to play through the bracket editor** | Built and render-checked, not yet used on a real draw. See §1 |

---

## 3a. UI work

| What | Notes |
|---|---|
| **The custom controls, now site-wide** | Switched on everywhere 24 Oct (`layout.html`). **Checkboxes are UV's ring status design since 24 Oct** (switches for settings, rings for ticks against people), loading for as long as their save takes: proven with a fake slow network and a table redraw, never against the real database. **UV to try the saving ones**: Paid on league and tournament manage, Here tonight on the card, the notification switches on the profile, Listed and Paid also confirms on league manage. **Quick input is queued since 24 Oct** (`TDC.writer`), proven with a fake network: tick several quickly, flick one on and off. **Fields now fade in and out when a setting shows or hides them, only the touched control animates, and beside-controls line up on the centre line (24 Oct)**: toggle a few ruleset switches on `/leagues/new/` and `/tournaments/new/`. **The ruleset form is regrouped to UV's five sections, and folding groups open and close with the same fade (24 Oct)**, render-checked at 420px on a stand-in form: open and close Match settings, Timing and Officials on `/matches/new/`, `/tournaments/new/` and `/leagues/new/`; turn the shot clock on and off (its four numbers come and go as one row). **On `/match/`, tap two or three frames quickly**: all should save, in order, with no "Someone else has scored"; then, with a second phone scoring the same match, check that notice still appears. The match page's queue has not been run against a real match **UV to try on a phone**, especially the pages not render-checked: `/match/` (the settings panel needs a real match to load), `/tournaments/bracket/` (the round-rules panel), `/leagues/card/`, `/leagues/manage/`. Checked at 420px with a stand-in database: the new-league, settings, fixtures, leagues, new-tournament, codes, credits, walk-in, profile and sandbox pages, no errors and nothing wider than the screen. **Still to design:** the bracket's score boxes (kept native), a control for date-and-time fields (native), and the checkbox and UV's other elements (next chat). Fields with no `max` (the fee, credits) always show both chevrons |
| **A player cannot start their own match** | With `create_matches: manual` a player sees their fixture, has no way in, and no explanation. **UV, 22 Oct: a communication problem, to be solved when the rounds are drawn properly with progression arrows** — not a schema gap. The TD already gets a hint |

---

## 4. Wanted, not built

Agreed in principle, nothing written.

| What | Notes |
|---|---|
| **Close a tournament to specific players** | UV, 21 Oct: restricted to a named set, e.g. everyone in a given league. Probably a fourth `entry_mode` value plus an eligibility table, not a separate flag. Interacts with the poster: a restricted tournament may still want a public poster that says "members only" |
| **A live public scoreboard** | Explicitly *not* what the poster is. Needs an `anon` read of live data and therefore the per-function audit the poster design deliberately avoids. Decide on its own merits, do not grow the poster into it |
| **`player_facing` on `TDCMatchDef`** | **Corrected 22 Oct — this does less than it used to say here.** The flag would let the *pages* agree on which settings are player-facing, which is worth having. It would **not** remove `private.tdc_poster_rules`: that runs in SQL, cannot read the JS, and decides what becomes publicly readable, so it has to keep its own list. The real fix for the drift is a check that the two lists agree, not a shared one. Scope it as two jobs, not one |
| **Entry fee charging** | **Blocked** on the credit ledger's `ref_table` / `ref_id`, undecided for travelling leagues |
| **Double elimination, round robin, groups** | Only single elimination generates a draw today |
| **A screen for `tdc_frame_history`** | The audit log is written and queryable with nothing displaying it. **UV, 22 Oct: do it with the match visualisation**, not on its own |
| **Public follow view** | Watch a tournament without being in it |
| **A league's venue: only one you own, defaulted for a venue's LDs** | UV, 24 Oct: when setting up a league, the venue can only be a venue the person owns (for league directors other than UV), and it should be filled in by default for a venue's LDs. **Checked 24 Oct:** `tdc_create_league` (and `tdc_create_tournament`) already refuse a venue unless the caller is its owner, admin **or staff** (`private.tdc_has_venue_role`). What is missing: no page sends a venue (`venue_id` is always null, as for tournaments, next row), nothing defaults it, and UV's "only the venue I own" may be **stricter** than owner/admin/staff. To confirm with UV: owners only or staff too, whether `tdc_update_league` may move a league to another venue, and what "other than me" means for a platform admin |
| **A league's own picture** | UV, 24 Oct: set on the league settings (and the new-league form), shown in the leagues list's picture column and on the search tiles, where a trophy stands in today. Wants a storage bucket like `player-avatars` (migration-made, public, a random path per upload, cropped and re-encoded in the browser) and a path column on `tbl_leagues`; per league or per season to decide |
| **Venue picker on tournament creation** | `p_venue_id` is always null today, so every tournament made in the app is the open tier. A club tournament needs the picker and staff rights at that venue |
| **Real content for 404, privacy policy, terms** | Stubs of 42–49 bytes |

---

## 5. Decisions needed from UV

Work is blocked or will be built wrong without these.

| Question | Why it is not Claude's call |
|---|---|
| Does a coordinator's rejection need a reason? | A dispute does. A rejection currently requires one in the function; confirm that is wanted |
| What does the coordinator's approval queue screen look like? | No design yet |
| Should an unpublished result be marked as pending in a player's own view? | Affects the match page and the match list |
| Travelling leagues: does a league have an owning venue, or its own fee scope? | Blocks entry fee charging |
| Shot clock and extension rules the timer hardware reads | Hardware is not specified |
| **A match started after its lineup cutoff** | Found 23 Oct. Round 1 was generated for 19:30 that day; the LD started it at 22:25 with an 8-hour cutoff (11:30), and opening the card locked both sides "by cutoff" with nothing in, so nobody could set a lineup. Should starting a match past its cutoff refuse, warn, or not apply the cutoff until the LD moves it? And should generating refuse a first round already in the past? |
| **Where the leagues list sends the LD** | Found 23 Oct. Signed in as Owner@TDC (runs the league, does not play), opening the league from the search results gave the join page's "Fancy a game? Put my name down". Correct from the data, but the LD probably wants the season or manage page |
| **In a league that confirms on payment, may a player confirm themselves?** | Found 23 Oct with `20261023201147`. The paid tick confirms, but `tdc_confirm_league_entry` still lets any player who is in the league press "I'm playing" before paying, and the season page offers the button. UV's rule ("not confirmed until the LD says so, as set in the settings") suggests it should refuse an unpaid player there. It affects players added by hand too, so it is not Claude's call |
| **Who may create a league or a tournament** | UV, 24 Oct: "We may need to revisit policy for creating leagues (who is allowed) and tournaments." Today anyone signed in may create either (`tdc_create_league`, `tdc_create_tournament`): with no venue it is the open tier, and with one the caller must be that venue's owner, admin or staff (checked 24 Oct). Ties in with C6 (what the platform is for, and what "free" covers) and the venue guard in §4 |
| Captains inviting players to their team | UV, 22 Oct: common practice in existing leagues; to be discussed later. For now the director adds players (mid-season too) and a captain claims them — since 23 Oct without waiting for them to confirm |

---

## 6. Known gaps and rough edges

Real, small, and none of them blocking.

| | Area |
|---|---|
| **`tbl_tournament_entrants` can be read directly by any signed-in player** | `paid_at` and the TD's `notes` come back from the API with no function in the way. The 21 Oct gate on `tdc_tournament_entrants` closed the function, not the table: the `select … using (true)` policy and grant are still there. Found 22 Oct while building the league equivalent. The fix is a migration revoking the grant and dropping the policy, after checking no page selects from the table directly. Now item B2 in §1a |
| League pages not built yet | Per-season rule overrides, continuing a team from an earlier season, a venue picker. None blocks lineups. **When per-season overrides get a form, `tdc_update_league_season` must call `private.tdc_refreeze_league_matches`** as `tdc_update_league` does (23 Oct), or a season's change will not reach its unstarted matches |
| **The match page calls every match "Social match"** | `loadMatch()` hard-codes `context: social`, so a tournament match's panel reads "Social match · not part of a league or tournament", which since A2 sits right above "The rules and the time are set by whoever runs this tournament." It needs a real lookup of the tournament, round and name. Found 24 Oct |
| `strict_frame_order` is obeyed by the card only | The scorecard offers only the next unplayed frame when it is on. `/match/` does not know about it, which does not matter while `/match/` refuses team matches |
| **Deleting an account leaves an accountless league player** | `tbl_players.user_id` is `ON DELETE SET NULL`, so removing an auth user leaves the player row behind — still on any league's list, which is the one thing a league player may not be. The trigger that enforces it is insert-only on purpose (the walk-in merge needs that). Found 23 Oct while writing the dummy-player cleanup. Unlikely but real; the fix is either a cascade or a nightly check |
| **The 23 version 1 ruleset keys are not type-checked** | `private.tdc_check_match_rules` checks that the keys are present and that the enumerated values are known, but never that `win_condition_target` is a number or `draws_allowed` a boolean. The two version 2 keys added 22 Oct are checked; the older ones are a job of their own. The design note calls this jsonb quietly becoming an unvalidated config format the heaviest standing risk in the system |
| **Nothing tells the players the fixtures are out** | Generating notifies nobody on purpose (`docs/DECISIONS.md`): a fresh schedule is the director's working document and regenerating it is ordinary. Telling them should be a separate act, as sharing a tournament poster is. Not built |
| The team card records a winner, not how they won | `/leagues/card/` enters winner-only. Break detail, break & finish and the rest are on `/match/`, which refuses a team match — so on a league night those are unreachable. Fine for a club night; a nationals night that tracks breaks would want them |
| **A player marked away stays in a squad they were already in** | `tdc_set_team_player_active` changes their status and nothing else. A new squad cannot take them (`tdc_set_match_squad` asks for active), but if their captain had already ticked them for an upcoming match, they stay ticked and could still be put in its order. Small; the fix is to clear an away player from the squad and order of every match whose side has not locked. Found 23 Oct; the session rework (24 Oct) did not take it on |
| **The card page shows its messages at the bottom** | A refusal (e.g. a reserve rule) appears in red under all 25 frames, so on a phone a captain who picked a reserve at the top may not see why nothing changed. Every page uses the one status line; a card this long is the first place it hurts. Found 24 Oct |
| **The card tells the LD the other order is "sealed"** | Before both lock, the panel for the locked side says "sealed until you lock yours". True for a captain; the league director can see both orders all along. Wording only. Found 24 Oct |
| **Two leftover matches from 23 Oct** | Test_WedSim's first round 1, started at 22:25 and locked by cutoff, were taken off the fixtures by the regenerate but still exist: "in progress", no frames. Harmless, but **`supabase/seed/clear-test-leagues.sql` would miss them**: it deletes only matches still on a fixture. It should also take team matches whose teams belong to the leagues it clears |
| `tdc_remove_league_entrant` removes anyone | Fine while there are no fixtures. Once there are, it should refuse for a player who has played — as `tdc_remove_entrant` should have |
| Settings writes are still last-write-wins | Frames are guarded, settings are not |
| The match list and nav are not live | Everything else is |
| A future fixture does not read as upcoming in the match list | |
| **New Match's second calls fail out of sight** | The time and (since 24 Oct) the referee are saved after `tdc_create_match`; if either fails the page writes a status line and leaves for the match at once, so only the console says so. The match page can put both right. Found 24 Oct with the referee |
| **Venue staff are rank 0 against a match referee** | In a social match at a venue, staff may score but cannot change a frame the referee set (staff outrank only inside a tournament that belongs to their venue). Nobody has hit it; found 24 Oct |
| **The rank refusal says "tournament director" in a league** | A league director is rank 100 since 24 Oct, and `tdc_frame_rank_guard` names rank 100 "the tournament director". It reaches a league only when a league match has a referee. Wording only |
| `tbl_frames.referee_player_id` is written by nothing | A per-frame referee from the first scoring migration, carried by the merge, never set by a page. Unrelated to the match's own referee (24 Oct) |
| PWA icons are still the old silver artwork | `src/resources/icons/*` |
| Email assets are pre-refresh | `email-wordmark.png`, `email-dive.gif` |
| Duplicate light/dark SVGs are byte-identical | `logo-mark-*`, `logo-primary-*`. One of each is redundant, or one was never made |
| `hero.jpg` and `social-share.jpg` are 0 bytes | Referenced, empty |

---

## 7. How this document is kept

- **One list, not several.** Before adding an outstanding item anywhere else, add it here instead.
- **Date anything that could go stale.** A line without a date is read as current.
- **Move, do not copy.** An item that is done comes out of this document; if the reasoning is worth keeping it goes to `docs/DECISIONS.md`, and if it is a built system it goes to its file in `docs/systems/`.
- **This file is the agenda. `docs/systems/` is the record. `docs/DECISIONS.md` is the why.** `CLAUDE.md` is the short index that points at all of them.
- **The long backlog is `docs/BACKLOG.md`** — someday work, the schema still to come, deferred refinements. The split: if it is active, blocked, or waiting on UV it belongs here; if it is someday, it belongs there. When something there becomes active, **move** it here rather than copying it.
- **Business to-dos** (the club, not the code) live on the owner board at `/staff/board/`, not here.
