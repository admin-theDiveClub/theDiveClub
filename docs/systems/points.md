# Points

The tuning page and its formula. The concept and UV's rules are in `docs/design/points-and-tiers.md`; §9a there says how the page came to be this shape.

**Built so far (6 Nov): the formula module and its tests; `/staff/points/` with one scenario, sliders and live points, the data points list and the formula space; UV's first formula, profile completeness.** Weights are not saved and real data is not read yet. Real points are not worked out or shown anywhere.

## The formula module

`src/scripts/points-formula.js` (`TDCPoints`) is one pure file: `calculate(scenario, formulas, weights)` gives points per person, with a breakdown. It has no page, no database and no clock, so the page can run it live, Node can test it, and real points can reuse it later.

| Level | Runs | From |
|---|---|---|
| `player` | Once a person | Profile and history: the fixed bonuses |
| `frame` | Once a person, per complete frame | That frame, as they saw it |
| `match` | Once a person | The match |
| `tournament` | Once a person, if the match is in one | The tournament |
| `league` | Once a person, if the match is in one | The league season |

**Everything is from that person's point of view:** `d.frame.won` means their side won. Officials have no side, so `won` is false for them.

## Adding a formula

UV writes it in the page's formula space (or just describes it); Claude adds it to `FORMULAS` in the module:

```js
{
	id: 'stolen_frame',           // never reused: saved weights find a formula by this
	level: 'frame',
	who: 'players',               // or everyone, td, ld, captain, scorer, referee
	label: 'Won after the opponent broke in',
	weights: {
		bonus: { label: 'Points', value: 100, min: 0, max: 500, step: 5 }
	},
	calc: (d, w) => (d.frame.won && d.frame.opp_break_outcome === 'in' ? w.bonus : 0)
}
```

`calc` is ordinary JavaScript, so any operator works. It may return a negative number. It reads:

| Name | Holds |
|---|---|
| `d.me` | Side, has an account, signed, roles, profile, history |
| `d.frame` | The frame (frame level only; otherwise null) |
| `d.match` | The match and this person's counts in it |
| `d.rules` | Every match setting, as frozen on the match |
| `d.tournament`, `d.league` | Their settings and this person's entry; null if the match is not in one |
| `d.site` | Site-wide stats, such as average frames per match |

The full list is `DATA` in the module, which the page will show. A test checks that every path in it exists. Match settings are not listed there: every key of `d.rules` is available, and the page will list them from `TDCMatchDef`.

## When new data is defined

**Every time the site defines new data, the points page is updated too** (UV, 6 Nov; `CLAUDE.md` §3). Add it to `DATA` and the views in `points-formula.js`, and to the read that fills a real match. A new match setting in `TDCMatchDef` needs nothing more.

**Using the app (13 Nov; migration `20261113164109_player_devices`):** `me.profile.uses_app` (has opened the installed app on any device) and `me.profile.app_days` (the days they did) are in `DATA` and `fillPerson`. They will be read from `tbl_player_devices`: any row with `installed` true, and the sum of those rows' `days_seen`. Recording started with that migration and nothing before it can be recovered. No formula uses them yet, and the real read is not built.

## Rules in the engine, not in a formula

| Rule | How |
|---|---|
| Guests and walk-ins earn nothing | `has_account` false: `points` is 0, and `would_earn` keeps what it would have been (Claude's, for UV to judge). An ID verified is not part of this: it is one bonus in profile completeness and carries into nothing else (UV, 6 Nov) |
| Social cap | `social_cap` on the weight set (default 1, 0 is off). Once a person's earlier social matches against this opponent this week reach it, frame and match formulas stop. Player formulas carry on, and career counts still include those frames (Claude's, for UV to judge) |
| Complete frames only | Abandoned and in-progress frames are not run or counted |
| A director's score | Decides `match.won` and `side_frames_won`; the frame counts stay as played |
| A formula that fails | Throwing, or returning anything but a finite number, counts as 0 and adds a warning, shown on the page: never a silent low score |
| Stale saved weights | A saved weight or formula that no longer exists adds a warning |

**Locked data is not enforced by the engine.** UV wants value placed on the story once data is locked, and locking rewarded; `d.match.locked` and `d.me.signed` are there for the formulas UV describes.

## Tests

No install needed:

```text
node --test tools/points-tests/points-formula.test.js
```

Most formulas in the test file only prove the engine. The profile completeness tests are for the real one.

## The formulas

### Profile completeness (UV, 6 Nov; level `player`, for everyone)

Almost the base for anyone who uses the site, so it should stay close to insignificant. Each property is a value in 0 to 1 (a property's general range is -1 to 1), each with its own slider; they are added, then multiplied at the end.

```text
total = ( picture + display name + name and surname + ID verified
          + notifications + sign-in methods ) x multiplier
```

| Property | Data point | Value | Will be read from (step 5) |
|---|---|---|---|
| Picture added | `me.profile.has_picture` | 1 or 0 | `tbl_players.avatar_path` |
| Display name added | `me.profile.has_display_name` | 1 or 0 | `tbl_players.display_name`; sign-up asks for it, so nearly always 1 |
| Name and surname set | `me.profile.has_full_name` | 1 if both | `first_name`, `last_name` |
| ID verified | `me.profile.id_verified` | 1 or 0 | `tbl_identifier_verifications`, not revoked |
| Notifications enabled | `me.profile.notifications_enabled` | 1 or 0 | A row in `tbl_push_subscriptions`: on, on at least one device; a dead phone's row still counts |
| Sign-in methods | `me.profile.sign_in_methods` | Methods ÷ 2, at most 1 (Claude's) | **No influence for now** (UV, 6 Nov: perhaps not to count at all, as a security matter): its slider starts at 0, to be settled with the values. Would read `auth.identities`; do not read it for the real data until UV decides |

The sliders' starting values (each 0.5 to 1, sign-in methods 0, multiplier 5 to 10, so 12.5 to 50 with everything done) are Claude's, only so the page opens with a number. It is `who: 'everyone'`, so an official earns it too.

A formula's `parts` gives the breakdown's rows, in points, and a test checks they add up to its amount.

### Scenarios

`SCENARIOS` in the module. Each has `people` and an `edit` list saying what can be changed on the first person, which the page draws as switches and steppers. Edits last until the page is reloaded, Reset is pressed or another scenario is chosen.

## The page

`src/staff/points/index.html`, `src/scripts/points-tuning.js`, `src/stylesheets/points-tuning.css`. The hub tile (`staff-hub.js`) shows for owners only, like the board's, and the page says "This page is for owners only" to anyone else.

**That gate is the page's alone so far.** Everything on the page is already public code, and it reads and writes nothing in the database beyond the staff check. The database starts checking in step 5, when there is something to guard.

| Part | How |
|---|---|
| Scenario and weights | UV, 6 Nov: as compact as possible. Each formula's weights get a row by themselves, in folding groups: a filled band for a level (`.points-band`), a green line down the left holding a formula's rows, with its own low and high on its heading (`.points-sub`). A row is the scenario's toggle for that step (or a small stepper for a number), the name, a typed low, a two-thumb range and a typed high. A scenario step with `formula` and `weight` sits on that row; one without sits above the groups |
| Low and high | Every weight has both, so every scenario gives a low and a high total: two runs of `TDCPoints.calculate`, one with each set. `value` is a weight's default and the page's high; `low` is the page's low. Low can never pass high: the other follows. A typed value may go past the slider's ends, and the slider grows to fit. Reset returns both weights and the scenario to the start |
| Streams | Each real formula names a `stream`; the breakdown's lines carry it. Hidden from players, who see one total (UV, 6 Nov) |
| Results | On a phone only the two totals stay on the screen, stuck to the foot; on a PC they sit beside the weights. The breakdown folds away, low and high in columns |
| Formula space | Folds away, open by itself if a draft is in it. Name, Level, For and a pseudo code box. **Nothing parses or runs it**: it is text for Claude (UV, 6 Nov: pseudo code). Copy for Claude adds the name, level and who at the top. The draft stays in this browser only, as a convenience |
| Data points | `DATA` from the module, grouped, plus every `rules` setting read from `TDCMatchDef.SETTINGS`, so a new setting appears by itself. Scope `match` settings (lag winner, referee) are `match.*` data points instead. A tap drops the name in at the cursor without moving the cursor or keyboard. These rows are `data-no-dots`, so they skip the site's button animation (UV, 6 Nov): nothing waits, and the name landing is the feedback |
| Two-thumb range | Two native range inputs laid over one track, only the thumbs taking the pointer. Where they meet, the one that can still move lies on top. Number boxes are `data-control="none"`, or the site turns them into steppers. The switch's size comes from `--switch-height` and `--switch-width`, set smaller on `.points-tune` |
| Search | Every word must match the name, description or type; matching groups open |
| Layout | On a phone the box stays on the screen while the list scrolls; on a PC the writer stays beside the list. `.points-writer` is `display: contents` on a phone, or the box could stick only as far as the writer's own foot; `.points-results` likewise, for the totals |

## The title ladder

**Built 6 Nov: the list and the page UV edits it on. Nothing reads it yet:** no player has a step or a chosen title. The design and its open questions are `docs/design/points-and-tiers.md` §6a.

| Part | How |
|---|---|
| Tables | `tbl_title_groups` (name, position) and `tbl_titles` (group, name, step 1 to 100, optional note), migration `title_ladder`. RLS on, no policy and no grant to the browser. Neither refers to a player, so `private.tdc_merge_players` does not change; a later table holding a player's chosen title must be added to it |
| Who | `private.tdc_can_edit_titles()` is the one place: an owner at the venue with slug `the-dive-club` (UV, 6 Nov). Another venue's owner and The Dive Club's staff are refused, reading as well as writing, so players cannot find the list |
| Functions | `tdc_title_ladder` reads everything; `tdc_save_title` and `tdc_save_title_group` add (`p_id` null) or change; `tdc_delete_title` and `tdc_delete_title_group` delete, a group taking its titles. `tdc_can_edit_titles` is only for the hub's tile, asked only when the person is an owner somewhere |
| Draft | The migration inserts Claude's lists once. **From then on the list lives in the tables, not in any file**, and a later migration must not reinsert it |
| Page | `/staff/titles/`: `src/staff/titles/index.html`, `src/scripts/title-ladder.js`, `src/stylesheets/title-ladder.css`. A table scrolling inside its own box both ways, so the step column and the group row can stick. Empty steps stay hidden unless All 100 steps is on. Each cell's titles are plain buttons with the site's button look taken off, because a title's capitals are part of it (T. rex). The forms are `<dialog>`s inside the card, or the site's field styles do not reach them. The switch sits beside its label, not inside one: inside, a tap toggles it twice |

**The points page gains nothing yet:** the list is not data about a player or a match. When a player has a step, it joins `DATA` in `points-formula.js`.

## Still to build

| Step | What |
|---|---|
| 3 | UV's further formulas, each with a scenario, as he describes them (begun: profile completeness) |
| 4 | Presets A to D, editable frame by frame, with roles, settings, history and the cap |
| 5 | Migration: named weight sets in an owner-only table, saved through `tdc_` functions; an owner-only read of real matches and site-wide stats. Real matches, read only; saving named sets |

**The module is public** like every script, as the board's code is, though nothing links to it. Anyone who finds it can read the formulas. That matters only when real points arrive.

**Gate (Claude's, to tighten before a second club):** the same as the board, owner at a venue. UV is the only owner today.
