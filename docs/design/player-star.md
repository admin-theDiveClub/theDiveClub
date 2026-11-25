# The player star (19 Nov; on the profile, some points still open)

A five-spoke star on the player profile that tells a player **where their own game needs work**. It is not a ranking: each spoke is measured against a standard UV sets, never against other players (UV, 19 Nov).

**Built on the player profile (19 Nov): how it works is in `docs/systems/players.md`, "The player star".** The star is defined once in `src/scripts/player-star.js` (`TDCStar`) and `src/stylesheets/player-star.css`, used by the profile and by the sandbox, **`/sandbox/star/`** (`src/sandbox/star/index.html`, `src/scripts/sandbox-star.js`), where the numbers are tried. This file keeps the idea and what is still open.

## The spokes (UV)

| # | Spoke | Counted as |
|---|---|---|
| 1 | Win rate | frames won / frames played |
| 2 | Own break | frames won / frames they broke |
| 3 | Their break | frames won / frames the opponent broke |
| 4 | Break in | breaks "In" / breaks with a result recorded |
| 5 | B&F | B&F and golden breaks / frames they broke |

Frames where who broke is unknown count for spoke 1 only. Spoke 4's "In" means the stored `break_outcome = 'in'`; scratch and foul are separate outcomes and do not count (Claude's reading, not yet confirmed by UV).

## How a spoke is worked out (UV, 19 Nov)

- **UV's standard** per spoke: what a decent player is expected to reach. The spoke shows the gap between the player and the standard.
- **Starting frames** per spoke, to keep small samples meaningful (Claude's suggestion, UV said use it as well): every player starts with that many frames played exactly at the standard.
  `shown = (successes + start × standard) / (chances + start)`
  Example, standard 50%, 30 starting frames: 60 of 100 shows 57.7%; 5 of 5 shows 57.1%; 1 of 5 shows 45.7%. A new player starts on the standard and moves away as real frames come in.
- **How solid the star is** follows frames played (a "solid at" number), so a five-frame star is faint.

## UV's numbers (set on the sandbox, 20 Nov; these replace the 19 Nov ones)

| Spoke (label on the star) | Standard | Starting frames | Was (19 Nov) |
|---|---|---|---|
| Win % | 67% | 100 | 50% / 100 |
| Lags Won (new) | 50% | 20 | none |
| W \| Own Brk | 75% | 100 | 70% / 50 |
| W \| Opp Brk | 40% | 100 | 40% / 50 |
| B&F \| Own Brk | 7% | 100 | 10% / 100 (B&F moved through 5, 10 and 8 on 20 Nov) |
| Break in (no longer on any star) | 50% | 10 | 50% / 10 |

The profile's player star uses these standards and starting frames; the league stars use the standards but no starting frames.

**Solid at 200 frames.** The gap was drawn as **Ratio** (twice the standard at the edge, the standard the ring halfway out) when UV approved the numbers; Points stays on the sandbox. Three of these (Win rate and B&F starting frames, Solid at) sit at the end of their sliders' range. These are TDCStar's numbers now, on the profile and the sandbox.

## Compare (UV, 19 Nov)

Two players on one star, picked from the page's players (league players once added): the first green, the second the team blue (`--color-team`), with a legend and a table of each spoke's shown rate and gap from the standard.

## On the profile (UV, 19 Nov)

- Every Profile tab: the star, actual filled and adjusted dotted (swapped 21 Nov). Compare: one star across both halves, you green and them blue, no raw star.
- It follows the Stats period. A spoke with no data sits on the standard, its label greyed with "no data".
- The line only, no dots at the corners; the standard ring grey.
- The break result comes from `tdc_player_profile` since migration `20261119142114`.

## On a league (UV, 19 Nov, reworked 20 Nov)

A star on each league's row on the profile and each `/leagues/` card, with **its own five spokes**: Win rate (FW / FP), **Lags won** (frames broken / FP, standard 50%), Own break (FW / lags won), Their break (FW / lags lost) and B&F (BF / lags won). Grey pentagon = UV's standards (set on the sandbox, the same for every league), yellow line = the league's own average per spoke, green shape = the player's stats **with no starting frames** (the league is where you feel the heat; the player star's starting frames protect the profile). Opacity = matches played / matches scheduled. The player star on the profile keeps its five spokes for now ("we will play around with the main player star later", UV). Details: `docs/systems/players.md`, "The league star".

**A star on every team's card (UV, 25 Nov).** The league star, drawn from a team's frames, on each team's card on the Season tab, under its players, with the league's average as on every league star. As solid as the team's matches played ÷ scheduled. In singles each player's card opens to that player's league star. Signed in only. Built: `docs/systems/leagues.md`, "Every team's star on its card".

## More spokes and better pictures (UV, 20 Nov)

What the real league data can tell, new spoke ideas, 2D pictures and the 3D ideas for later are in `docs/design/profile-stories.md` (ideas only, nothing decided).

## Unsettled: tried on the sandbox, not decided

| Question | What the sandbox offers |
|---|---|
| Walkovers | A switch, off: a frame decided by walkover (`result_event = 'default'`) is left out. Claude's default |
| Whether golden breaks count towards B&F | Counted (Claude's default) |
| B&F where the match's rules had B&F off | Not handled yet: such frames still count in the denominator |

## What the data has (checked on production, 19 Nov, read only)

- 900 finished league frames: who broke is recorded on 881, **the break result on none**. The captain's scorecard does not ask for it, so spoke 4 has no league data until it does; social and singles matches do record it.
- 79 league players with frames; the most anyone has is 31. Every real player is a small sample.

## On the sandbox (reworked 20 Nov, UV)

**The sandbox now draws the league star's five spokes and headings** (Win %, Lags Won, W | Own Brk, W | Opp Brk, B&F | Own Brk, with the same formulas), with a standard and a starting-frames slider for each, so UV can set new values for both; the Star menu and the Break in spoke are gone from it, and its table has no break-result columns. Its star is drawn **with** the starting frames (that is what is being set), unlike the league stars on the league cards, which use no starting frames. The profile's own player star still has its five spokes (Break in included) and its current values until UV says; the standards set here for the shared spokes are TDCStar's defaults, so they reach the league stars and the player star alike once written into `player-star.js`.

(Earlier:)

- Five made-up players (a 400-frame regular, two five-frame newcomers, a strong breaker, one exactly on every standard), their nine counts editable.
- **League players are added by search**, signed in: `tdc_search_opponents`, then `tdc_player_profile`'s `frames`, counted in the browser (`TDCStar.count`), the break result included once migration `20261119142114` is pushed. No name or number of theirs is in the repo, and nothing is written. Their counts can be edited on the page too.
- A dashed outline shows the raw star (no starting frames), so the effect of the adjustment can be seen.

## 21 Nov (UV): which shape is which

Wherever the player star shows (profile, Compare, home page, sandbox): **filled = actual stats, dotted = adjusted by the standards and starting frames**, the dotted line's corners solid and joined, its edges broken. The sandbox's "Show the raw star" switch is gone (the dotted line is always drawn). The league star is unchanged. The key for the grey standard and the yellow league average is under the "Leagues" heading, once.
