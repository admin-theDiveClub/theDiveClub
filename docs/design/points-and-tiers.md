# Points and tiers: the design so far

**Status: concept settled with UV on 6 Nov 2026; the formulas are not. The tuning page (§9) is being built, `docs/systems/points.md`.** UV describes formulas from the page's data points, Claude adds them, and the sliders judge them against scenarios. **§9a overrides §3's model and §9's weights where they differ.**

**Why this file exists.** The whole concept was worked out in one claude.ai chat (6 Nov). Anything decided there is here so it is not asked again. Lines marked *Claude's, for UV to judge* are suggestions UV has not confirmed; everything else is UV's.

---

## 1. What points are for

UV, 6 Nov, in his words where possible:

- **The site's point is a truly painless way for players, TDs and LDs to manage their play.** It is part of the way there, with a lot still to do.
- **Points reward using and testing the site.** They should get people to use it, test it and learn its **"language"**. Every feature a player, director or user turns on enriches the data and pushes the site forward.
- **Points are also a show of skill.** Data that is recorded builds the points, and skill decides who gets them.
- **Points show long-term usage.** They feed a hall of fame and VIP status.
- **Points are new data the site creates.** They are subjective, not worth reading for their quantitative quality.
- **Nothing gimmicky, not copied from existing work**, and built from what already exists rather than adding features.
- **We are encouraging players to join leagues, become captains and be fluent at using the site.**

## 2. Settled rules

| Rule | UV, 6 Nov |
|---|---|
| Who earns | **Verified accounts only.** "That's the whole point of the points system." A guest, walk-in or unverified player earns nothing, not even reduced points |
| Points and credits | **Separate.** "You can't gamify people's money on a site I give away for free." Many players will use the site without money. Points are never bought, spent or converted |
| Points and credits, later | They will connect **indirectly**, on the business side, after a lot of trial and error. Not part of this design |
| Lifetime | Points measure long-term usage. Nothing resets lifetime points |
| Social games | Count for **one match per opponent per week**, and can never count nearly as much as league or managed tournament play |
| Managed play | League nights and managed tournaments count the most. Captains, scorers and directors get more, because that is dedicated site use |
| Removing data | **If a player removes a match from their profile, the data is lost, so the points go too** |
| Periodic awards | Yes, e.g. the highest-performing league player in a week (§5) |
| Tiers | A tiered system, **completely subjective**, defined by UV (§6) |
| Past titles | **UV enters past champions' titles himself**, from people he trusts for the data (§7) |

## 3. The model: a pot and a split

UV's model: the recorded data builds a **pot** of points for a match, and the frame data **splits** it between the players. The split is decided by the qualitative nature of what happened, so both players earn something for tracking their play.

UV's four scenarios, as he gave them (the numbers are illustrative, not settled):

| | Scenario | Pot | Split |
|---|---|---|---|
| A | Social game, bare scoreboard, nothing enabled, score only | 1000 | By score alone: a 5–4 result splits about 5:4 |
| B | Social game with special wins, break information, frame timing, win condition and so on enabled | 1000 + 100 per feature enabled | Per frame, from the frame data. Example: the opponent broke and broke in, then the player won the frame, and the frame time was low. That says something unusual or impressive happened, which moves that frame's split |
| C | Sanctioned match, e.g. a team league night | 3000. Features barely matter, since the LD sets them | From frame and match data, plus a **captain bonus**, an incentive for joining a league, a **scorer incentive**, etc. |
| D | Tournament final with referee and scorer, sanctioned (e.g. nationals) | 100 000 | A win multiplies again from the match stats |

**Claude's, for UV to judge.** UV has not confirmed these; the tuning page should let him try each one against his own version.

| Suggestion | Why |
|---|---|
| Build the pot per **frame**, not per match | A flat pot per match rewards playing race-to-1 matches |
| Scale context with **multipliers** (e.g. ×1 social, ×3 league, ×10 or more for a refereed final) rather than separate bases | A 100× gap means one final outweighs years of social play, and casual users stop caring |
| Pay for data that is **actually recorded on a frame**, not for a setting switched on | Otherwise people will turn everything on and tap junk |
| Pay only once a match is **signed** by both sides, or by the LD | Stops invented results and invented events |
| **First-use bonuses**: the first golden break recorded, first time as scorer, first captain's signature, first tournament run | Most directly teaches the site's language, as a checklist |
| Points for **bug reports and feedback** UV confirms | The system exists to get the site tested |

## 4. Dynamic points and a small ledger

UV's lean, 6 Nov: **dynamic**, so that removing a match removes its points.

| Kind | How | Why |
|---|---|---|
| Match and frame points | **Dynamic.** Worked out from frames whenever asked, never stored | Removing a match removes its points; a formula change applies to everyone the same way |
| First-use bonuses | Dynamic | Derivable from history |
| Periodic awards | **Ledger.** Frozen when awarded | A late edit or a formula change should not take back someone's weekly win |
| Retro titles | **Ledger.** Entered by the owner | There are no frames behind them |
| Manual adjustments | **Ledger**, with a reason | An audit trail |

A player's total is the dynamic points plus their ledger entries. Tiers read the total.

*Claude's, for UV to judge:* **version the formula.** Under dynamic points, retuning changes everybody's total at once. That is fine while testing, but each version should be kept so a change can be seen and compared.

## 5. Periodic awards

UV: reward e.g. the highest-performing league player in a week. Periodic points fit "a show of skill".

*Claude's, for UV to judge:*

| Period | Example | Scope |
|---|---|---|
| Weekly | Top performer of a league night | Per league |
| Monthly | Most frames in managed play; best captain | Per venue |
| Season | League MVP, top scorer, LD | Per league |
| Yearly | Hall of fame inductees | Global |

| Risk | Guard |
|---|---|
| The same strong player wins every week | Measure against the player's own level, or cap repeat wins |
| A league of 6 pays the same as a league of 60 | Scale by league size |
| A disputed result | Award only once every match in the period is signed |

## 6. Tiers

UV, 6 Nov: tiers are completely subjective and defined by him on top of points. Points stay a show of skill; a tier is also a signal of VIP status. Examples he gave:

- A **senior citizens** tier.
- The **top 3 in the league each week** receive VIP status.

So a tier is a **rule** the owner writes, not part of the points maths:

| Rule type | Example |
|---|---|
| Points threshold | Lifetime points over X |
| Periodic placement | Top 3 in the league this week; VIP until next week |
| Manual or group | Senior citizens; champions |
| Credit link | Business side, later, trial and error |

Tiers can be time-limited, earned or assigned.

## 7. Retro points for champions

UV: existing champions get retroactive points, which then enable some kind of credit reward through their tier, so high-end players keep coming back. UV enters the titles himself and knows whom to trust for the data. Each title becomes a ledger entry (§4): who, which title, when, at what level, and where the information came from.

## 8. The data inventory (6 Nov, from production's schema)

**Objective values only**, the raw material the formula combines. UV, 6 Nov: no interpretation at this stage; values will be combined in very specific ways to award points. Use frame time and racking time, not a judgement like "a fast frame". Each value carries its own weight; for example, B&F and reverse B&F are weighted differently. UV refines the order.

**Frame** (`tbl_frames`, `tbl_frame_participants`)

| # | Value | Source |
|---|---|---|
| 1 | Result: reverse B&F | `result_event = 'reverse_break_and_finish'` |
| 2 | Result: B&F | `result_event = 'break_and_finish'` (needs `break_outcome = 'in'`) |
| 3 | Result: golden break | `result_event = 'golden_break'` (needs `break_outcome = 'in'`) |
| 4 | Result: win | `result_event = 'win'` |
| 5 | Result: default | `result_event = 'default'` |
| 6 | Winner | `winner_side` |
| 7 | Break: in | `break_outcome = 'in'` |
| 8 | Break: dry | `break_outcome = 'dry'` |
| 9 | Break: foul | `break_outcome = 'foul'` |
| 10 | Break: scratch | `break_outcome = 'scratch'` |
| 11 | Breaker | `break_side`, `break_player_id` |
| 12 | Breaker set by hand vs by rule | `break_side_manual` |
| 13 | **Frame time** | `ended_at` − `started_at` − `paused_seconds` |
| 14 | **Racking time** | `started_at` − `rack_started_at` (null when no break was played) |
| 15 | Paused time | `paused_seconds` |
| 16 | Frame number | `frame_no` |
| 17 | Lineup slot (team play) | `lineup_slot` |
| 18 | Frame referee | `referee_player_id` |
| 19 | Status | `status`: in_progress, complete, abandoned |
| 20 | Abandon reason | `abandon_reason` |
| 21 | Clicker log | `clicker_log` (jsonb; **content unknown**, see §10) |
| 22 | Who played, and in what order | `tbl_frame_participants.player_id`, `side`, `play_order` |

**Match** (`tbl_matches`, `tbl_match_result_override`, tournament fixtures)

| # | Value | Source |
|---|---|---|
| 23 | Sanctioned | `sanctioned`, `sanctioned_by`, `sanctioned_at` |
| 24 | Competition stage | `tbl_tournament_fixtures` |
| 25 | Competition type: league, tournament, social | The match's links |
| 26 | Singles or team | `home_side_kind`, `away_side_kind` |
| 27 | First break side | `first_break_side` |
| 28 | Match time | `ended_at` − `started_at` |
| 29 | Scheduled vs actual start | `scheduled_at`, `started_at` |
| 30 | Match referee | `referee_player_id` |
| 31 | Override vs counted score | `tbl_match_result_override`: `home_score` / `away_score` vs `counted_home` / `counted_away`, with `reason` |
| 32 | Rules as played | `rules` (jsonb, below) |

**Rules: what was switched on** (`tbl_matches.rules` keys)

| # | Value | Keys |
|---|---|---|
| 33 | Breaks tracked | `track_breaks` |
| 34 | Reverse B&F | `reverse_break_finish_enabled` |
| 35 | B&F | `break_finish_enabled`, `break_finish_requires_breaker` |
| 36 | Golden break | `golden_break_enabled` |
| 37 | Referee required | `referee_required` |
| 38 | Shot clock | `shot_clock_enabled`, `shot_clock_seconds`, `shot_clock_first_shot_seconds`, `extensions_per_player`, `extension_seconds` |
| 39 | Win condition | `win_condition_type`, `win_condition_target` |
| 40 | Match time limit | `max_match_minutes`, `on_time_expiry` |
| 41 | Game | `discipline`, `rotation`, `break_determination` |
| 42 | Scoring and approval | `approval_mode`, `score_entry_mode`, `dispute_window_hours` |
| 43 | Team play | `team_size`, `lineup_cutoff_hours`, `strict_frame_order` |
| 44 | Ties | `draws_allowed`, `tiebreak_method` |

**People and roles**

| # | Value | Source |
|---|---|---|
| 45 | Tournament director (rank 100) | `tbl_competition_roles`, `tbl_competition_role_types` |
| 46 | Referee (rank 50) | Same |
| 47 | Scorer (rank 30) | Same |
| 48 | League director | The league's roles |
| 49 | Captain | `tbl_league_season_entrants.is_captain` |
| 50 | Signatures, and who signed | `tbl_match_events`: `kind`, `signed_as` (captain or director), `card_fingerprint` |
| 51 | Submitted, approved | `tbl_match_events.kind` |
| 52 | Lineup locked, by captain or by cutoff | `tbl_league_match_sides`: `locked_by`, `by_cutoff` |
| 53 | Squad availability | `tbl_league_match_squad` |
| 54 | Entry confirmed by the player, paid | `confirmed_at`, `paid_at` on the entrants tables |
| 55 | Seed | `tbl_tournament_entrants.seed` |
| 56 | Verified | `tbl_identifier_verifications` |

**Background only, not for points:** `tbl_frame_edit`, card versions and fingerprints, `tbl_deleted_matches`, venue, follows, notifications.

## 9. The tuning page

UV, 6 Nov: a page on the site that **only he can access**, where he plays with sliders and views scenarios to fine-tune the points system.

| | What |
|---|---|
| Where | `/staff/points/`, owner only, like the project board (`staff-hub.js` shows its tile only for `role === 'owner'`; the database checks again) |
| What it does | Holds every weight as a slider or input; shows the points each player gets for a set of scenarios; recalculates live as a slider moves |
| Weights | One per value in §8 that can carry one: each result event, each break outcome, frame time, racking time, each role, each rule switched on, the context (social, league, tournament, stage, sanctioned, referee), the social once-per-opponent-per-week cap, the split |
| Scenarios | UV's A to D (§3) as built-in presets that can be edited frame by frame; plus real finished matches from production, **read only** |
| Writes | **None to match or frame data.** Points are not shown anywhere else yet |
| The formula | One pure function (frames + context + weights → points per player), in one place, so the same code can later work out real points |

**Claude's, for UV to judge.** None of these are settled:

- Save weight sets as named versions, so they can be compared (§4).
- Show a breakdown for each player: which values earned what.
- Compare two weight sets side by side on the same scenario.
- Show the "language" checklist for first-use bonuses alongside.

## 9a. How the page changed (UV, 6 Nov, answering the plan)

- **Formula sets by level.** Fixed "bonus" formulas from a player's profile and history, then a section each for frames, matches, tournaments, leagues and so on. A first-use bonus is simply a player-level formula.
- **The way of working.** UV looks at the data points and describes a formula; Claude adds it to the page. The sliders are for judging scenarios afterwards. An on-page formula builder is not part of the first build; UV may want it later.
- **A space to write formulas.** UV types pseudo code on the page, clicks data points to drop them in, and copies the result to Claude to implement. Then UV moves the weights to see how the scenarios change.
- **Any logic is welcome.** UV is versed in maths and code, so a formula can use any operator.
- **Roles are data**, so there can be formulas for a TD, an LD and so on, who earn without playing.
- **Every setting is a data point**, the minimum role for score entry included.
- **No starting set.** "We will place value on the story that comes out of the data (when the data is locked)." Just scores are boring: they say who won and by how much. Rich data could write a whole article about a match, like the commentary Claude wrote from one exported match. So points follow the story's richness.
- **Locking a result is a feature to reward.** It discourages players from ever deleting a bad result.
- **"Negative" is a playing style**, not a number below zero, though negative values are allowed too. It is subjective. It suggests site-wide stats as data points, such as average frames per match across all matches ever played, to measure a player against. Nice to have, and Claude found a clean way, so they are on the list.
- **Weight sets:** named versions in an owner-only table. **No** side-by-side comparison in the first build, **no** bug-report slider.

## 10. Open questions for UV

| | Question |
|---|---|
| 5 | How honours (`docs/BACKLOG.md` §2 item 9) relate to points: the same design, or separate |
| 6 | Whether a player can hide a match without removing it, and whether hiding costs points |
| 7 | What in the data marks the "negative" playing style. No data point is named for it until UV describes one |
| 8 | **What "verified accounts only" (§2) means: an ID checked by staff, or a confirmed email?** §8 item 56 read it as ID, which Claude listed, not UV. Read that way only 2 of 25 players earn anything, which does not fit profile completeness going to "everyone almost by default" (UV, 6 Nov), and "ID verified" could never score for anyone who has not got it. `docs/STATUS.md` §1 item 3 reads it the other way, as the confirmed email plus a bot check |
| 9 | **Shop points against §2's "never bought".** Per rand spent, or only for what a customer does? See §10a |
| 10 | Whether the rolling period for tiers is right, and how long it is |
| 11 | Whether a table of earned points that can always be rebuilt is acceptable beside "frames are the only record" (§10a) |

**Answered, 6 Nov (from the code):**

- **`clicker_log`** was designed for a referee's physical clicker, built separately (`docs/archive/stats-schema-design.md`): each entry a code and a time, for whose turn it is, pauses, extensions and racking. No page sends it and no frame in production has one.
- **Shot clock and extension use** is not recorded. `match.js` counts extensions only while the page is open. Only the settings are saved, so those are data points and use is not.
- **Where weight sets live:** §9a.

**Data note, 6 Nov:** only 2 of 66 frames in production have a break outcome. The earlier note called these test data since cleared; they were made on 5 Nov, after the clear. 18 matches are finished (5 team with 45 frames, 12 tournament with 11), none social. Break data is the richest story data and is barely used; this is what points should push.

## 10a. One system, and how to build it (6 Nov)

**UV's lean, not yet a decision:** one points system that looks simple from the outside, rather than different types for different uses. Shop customers should benefit from using the site too, so someone who is both a pool player and a shop customer qualifies for the best benefits at the club. Periodic totals may need emphasising.

**The conflict to settle first.** §2 says points are never bought and "you can't gamify people's money". Points per rand spent in the shop would be buying points, so that rule has to be kept or changed (§10a q9).

Everything below is *Claude's, for UV to judge*.

**One number outside, sources inside.** Each formula gets a **stream** (play, running competitions, profile, shop and so on). The player sees one number; the streams let a stream be switched off, weighed or filtered without separate points.

**One number, three windows.** All the same points, so no second system:

| Window | Used for | Why |
|---|---|---|
| Lifetime | Hall of fame | Never resets (§2) |
| A rolling period, e.g. 90 days | Tiers and benefits | Status has to be kept up, a new player can reach it, and benefits follow who is using the club now |
| Week, month, season | Periodic awards | Frozen into the ledger when the period closes (§4) |

**Points are global; benefits belong to a venue.** A player has one total across the community. Each venue decides what its tiers give, and pays for them.

**How the numbers get worked out.** The page's formula runs in the browser, on one match. A leaderboard needs everybody's points, and a browser can neither hold that nor be trusted with it.

| Option | For | Against |
|---|---|---|
| The same `points-formula.js` run by an edge function, writing a table of earned points that can be rebuilt at any time (recommended) | One copy of the formula; fast to read; retuning is one rebuild | A stored table, so it must be treated as a cache: it is never the record, and can be deleted and rebuilt from frames (§5 idea 1 of `CLAUDE.md`) |
| Rewrite the formula in SQL | Runs beside the data | Two copies that will drift, and UV's formulas are harder to change |
| Work it out on every read | Nothing stored | Too slow as soon as there is a leaderboard |

**The order to build it in.** Each stage is useful alone, and points can start late: because they are counted from frames, matches played before launch are counted when it happens.

| Stage | What | Seen by |
|---|---|---|
| 1 | Tune formulas on the page; give each a stream and a date rule | UV |
| 2 | Real matches on the page, weight sets saved | UV |
| 3 | The rebuildable table, running in the background beside a real league | UV |
| 4 | A player's own total and this period's | Players |
| 5 | Leaderboards, periodic awards, the ledger, past champions | Players |
| 6 | Tiers and venue benefits | Players |
| 7 | The shop stream, after payments and the shop (`docs/STATUS.md` P4, P5) | Players |

**The hard parts.**

| Problem | Example | Plan |
|---|---|---|
| Not everything has a date | A picture's upload date is not kept, so it cannot fall in a period | Each formula says "dated" (counts in periods) or "base" (lifetime only). Profile completeness is base |
| Data that cannot be recovered later | App installs and shop visits are not recorded, so those points cannot be backdated | List what must start recording before opening |
| Retuning once it is public | A change moves everyone's lifetime total overnight | Keep it private until stable; keep each version; change rarely and say so. Periods soften it, since old points matter less to status |
| Gaming | Two friends trading wins | Locked data, verified opponents, the social cap; watch for it in stage 3, before anyone can see a total |
| Test data | Today's 18 finished matches would count | Clear them before stage 4 |

**The shop stream.** Reward what a shop customer does (a visit, a verified account, using the site), not what they spend, with a daily limit. No page records a visit yet, and P5 is not designed, so this waits for that design. Whether points can reward buying from the cannabis side at all needs asking properly first, as PayFast's approval does in P4, so it stays a stream that can be switched off alone.

## 11. Not part of this

- **Fantasy league.** "A big one", saved for later (UV, 6 Nov).
- **The pool game / simulator** UV made, to be placed somewhere on the site. It wasn't found in this project's chats or artifacts, so it is waiting on UV for a link or the file.
- **The credits link.** Business side, later.
- **A skill rating** (Elo-style). Not asked for; points are not a rating.
