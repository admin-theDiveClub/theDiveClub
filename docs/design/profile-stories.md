# Stories in the data: more spokes and better pictures (20 Nov, ideas only)

**Nothing here is decided.** UV asked (20 Nov) for Claude to read the real league data and think about what story it can tell: more spokes on the star, or better ways to show a player's profile. This is the thinking, for UV to pick from. Read only; no name or per-player number of anyone is in this file.

## What the data holds (production, read only, 20 Nov)

**8-Ball Mainstream 2026-27** (real): 12 teams, 80 active players, 132 fixtures, 36 finished nights across rounds 1 to 6 (7 Oct to 18 Nov), one venue, team size 5, so 25 frames a night.

| Recorded | How much | Notes |
|---|---|---|
| Frame winner | 900 of 900 finished frames | |
| Who broke | 881 of 900 (98%) | The scorecard asks for it |
| Place in the night's 25-frame rotation (`lineup_slot`) | every frame | The captain's order is not stored on the frame (`play_order` is empty), so a player's lineup position has to be worked out from the rotation table in the rules |
| Result event | 863 win, 21 break & finish, 16 walkover | Break & finish is 2.3% of frames, by 18 players, none more than twice. The 16 walkovers are in 3 nights |
| Break result (in, dry, scratch, foul) | **0** | The scorecard does not ask |
| Frame start and end times | 16 of 900 | The scorecard does not record them |
| Golden break | off in the rules | |

**What it already says**

| Fact | Number |
|---|---|
| The player who breaks wins | 57.9% (510 of 881) |
| Home side wins | 52.1% |
| Spread of players' win rate (62 players with 15 or more frames) | lowest 3%, quarter 32%, median 54%, three-quarters 72%, highest 90% |
| Frames a player has so far | median 25, most 31 |
| The breaker's edge, round by round | 48% to 67% with about 150 frames a round, so mostly noise at this size |
| Who breaks the next frame | not "the winner" and not "the loser" (463 against 382): it follows the rotation |

**Black Ball Singles** (a dummy league, recorded the way a live match is): only 10 frames, but each carries the break result (in 5, dry, scratch, foul on the break, 2 not recorded), frame start and end, and when the rack was set. The timings are seconds, because they were made showing the clicker, so they say nothing about pace. It does show that **live scoring records the things the captain's scorecard does not**.

## Two things the data says about the star as it stands

1. **UV's break standards are far above the league.** Own break is 70% and Their break 40%. In the league the breaker wins 57.9%, so the typical player on their own break is at 58% and on their opponent's at 42%. The yellow league line therefore sits well inside the grey ring on Own break and a little outside it on Their break. This is not wrong (the standard is what a decent player reaches, UV's), but the average player will look weak on Own break. **UV to decide whether to move them.**
2. **B&F is nearly invisible.** At 2.3% of frames against a standard of 10% (lowered to 5% on 20 Nov), almost everyone sits in the bottom third and most have none. It reads better as a **highlight or badge** (21 events, 18 players) than as a spoke. The same question applies to any rare event.

Also: the star is measured against UV's standards, never against other players. The yellow line already bends that rule on league stars, at UV's request. **A spoke that compares a player with the people they played breaks it too**, so those are listed below as pictures or league-only extras, not as spokes, unless UV says otherwise.

## More spokes (each a rate against a standard, no other players needed)

| Spoke | Counted as | Data today | Verdict |
|---|---|---|---|
| **Clutch** | frames won in the deciding stretch of a night (the last session, frames 21 to 25) out of frames played there | Yes, from the rotation order and winners, if frames are played in order | Good story, but the order is assumed: no start times on the scorecard |
| **Break edge** | win rate on own break minus on their break | Yes | Not a new number; the gap between two spokes. Better as a picture (below) |
| **Break in** | in out of breaks with a result | Singles and live only. **Team leagues have no way to store a break result at all, only who broke (UV, 20 Nov), so it is always "no data" there** | On the player star; left off the league star (20 Nov), which uses Lags won instead |
| **Scratch and foul on the break** | breaks scratched or fouled out of breaks with a result | Singles and live only | Same wait. An inverted spoke (lower is better) |
| **Pace** | frames finished inside a target time | Live only | Later |

**The one data change that unlocks the most:** the captain's scorecard recording the break result (and, if it can be done without slowing the night, the frame's start). That is UV's decision; it is not built.

## Pictures (2D) for the profile, instead of or beside the star

All of these use data we have now.

| Picture | What it shows | Why it tells a story |
|---|---|---|
| **Where you stand** | For each stat a line from the league's lowest to highest with a dot for the player, the quartiles shaded | "I am in the top quarter on my break" is understood by anyone; no polygon to read. Needs the league's spread (62 players now) |
| **Break split** | Two paired dots per player, on their own break and on the opponent's, with the league's pair ticked | One look shows who wins because of the break and who wins in spite of it |
| **Nights** | One bar a night, frames won out of 5, coloured by whether their team won, the league's average as a dashed line | Hot and cold nights, and a player who carries a losing team. Form is a row of dots already; this is the night-level view |
| **Trend** | Win rate by round as a line, the league's middle half shaded behind it | Who is improving. Six rounds is thin; wait for more |
| **The night, frame by frame** (match or card page) | The running frame difference through the 25 frames, with the lead changes and the deciding frame marked | Comebacks and the frame that settled it. Needs the order assumption above |
| **Team grid** (league page) | Teams against teams, each cell the frame difference | The league's shape on one screen; a heat map is learned in seconds |
| **Who carried the team** (team page) | Each player's share of the team's frames won, stacked | Contribution, not rank |

**Rating a player against the players they met** (a strength-adjusted "you beat better players than your record shows") is possible: the win-rate spread is wide enough (3% to 90%). It would be an extra number or a line on Where you stand, not a spoke.

## Claude's recommendation

1. **Where you stand** first: it uses what is already counted, adds the league's distribution, and reads in a second on a phone.
2. Then **Nights** and **Break split**.
3. Keep the star, with B&F possibly moving to a highlight and Clutch trialled on the sandbox.
4. Ask UV about the break standards and the scorecard's break result before building any more spokes.

## 3D (after the 2D work is finished, UV 20 Nov)

Not for now; written down so it is not lost. Most people understand 2D, and a phone at the bar is the main screen, so 3D would be an optional "explore" view and never the only way to see a number.

| Idea | What it would show |
|---|---|
| The star as a solid | The five spokes extruded, one layer a round, so a player's shape can be seen changing through the season |
| A terrain of the rotation | A 5 by 5 surface of win rate by lineup position against lineup position, as hills and valleys |
| The league as a cloud | Every player as a point: frames, win rate, break edge on the three axes, spun by hand |
| Pool table views | A table drawn in perspective for break results once they are recorded |

Cautions: three.js or similar would be a large new dependency (`cdnjs`, pinned); WebGL on older phones; accessibility (every 3D view needs the 2D numbers beside it); the dots rule for waits; and the stop-servers rule when checking headless.
