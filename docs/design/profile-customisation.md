# Profile customisation: ideas

**Status: ideas only, 6 Nov 2026. Nothing here is settled, unlike the rest of `docs/design/`.** §1 is UV's. Everything else is *Claude's, for UV to judge*, including every list of options. Nothing is built. The questions are in §8.

Read with `docs/design/points-and-tiers.md` (the story idea, §9a) and `docs/STATUS.md` D1 (one profile, an environment per sport).

---

## 1. What UV asked for (6 Nov)

- Avoid gimmicky functionality, but players can have **some customisation options**.
- Examples: **dominant playing hand, pre-selected profile pictures, sport-specific traits or superpowers.** **Custom avatars might be nice.**
- The point is to **enrich the story of a match**. UV's example: a player marks themselves as attacking or aggressive, then loses a match where the frame times were very long, which suggests they got ground down.
- The exact options will be very subjective, but they **should point at usable data in some way**.
- Visual customisation still counts, but it **mostly affects how a player appears to other players**.

## 2. The test for each option

An option earns its place if it can complete this sentence: **"Because the player said X, the site can now say Y about their matches."** Saying what a player is gives the frames something to agree or disagree with.

| Kind | What it does | Example |
|---|---|---|
| **Tested** | The frames can agree or disagree with it | "Attacking", then the frame times |
| **A split** | Says nothing about the player themselves, but lets others' records be divided by it | Left-handed: "3–7 against left-handers" |
| **Background** | Colour for a story; nothing checks it | Playing since 1998 |
| **Looks** | How the player appears to others | A chosen picture |

**The split is the use for dominant hand.** One player's hand says nothing about their frames. Once enough players have filled it in, every player gains a new record: how they do against left-handers. The same works for playing style: "Beats attacking players, struggles against patient ones."

**Traits only describe.** They never change a score, a rule or a multiplier, which keeps them from becoming the gimmick UV wants to avoid.

## 3. Options that could be offered

All optional, with "Not said" as the default.

### About the player

| Option | Choices | Kind | Checked against |
|---|---|---|---|
| Dominant hand | Left · Right · Both | A split | Frames against players of each hand |
| Playing since | A year | Background | Nothing |
| Home venue | A venue (the row is already on About, not built) | Background, and a split | Frames at home and away, once matches carry a venue |

### About their game (per sport: pool first)

| Option | Choices | Kind | Checked against |
|---|---|---|---|
| Playing style | Attacking · Tactical · Patient · All-round | Tested | Frame time, against their own and the site's average |
| Pace | Quick · Steady · Takes their time | Tested | Frame time. Overlaps with style; perhaps only one of the two |
| Best game | 8-ball · 9-ball and so on | Tested | Win % by `rules.discipline` |
| Best format | Short races · Long races | Tested | Win % by `win_condition_target` |

### Superpowers

Pick up to two. Each is a **claim tied to a number the site already counts or could count**, so the site can show the record beside it. Every name is a placeholder.

| Superpower | The claim | The number beside it |
|---|---|---|
| Big Break | "My break is my weapon" | Break in %, B&F and golden break count |
| Clean Dish | "I finish what I start" | Frames won on their own break |
| Closer | "I win the decider" | Deciding frames won |
| Comeback | "Never out of it" | Matches won after being behind |
| Hot Streak | "I run frames together" | Longest run of frames won |
| Last Man Standing | "The longer it goes, the better" | Win % in their longest frames |

A **weak spot**, chosen the same way, could be good for stories ("says the break is their weak spot; broke in 2 of 14"), and players may enjoy admitting one.

### What stories might come out

These sentences are built by rules, counted from frames whenever they are asked for and never stored (`CLAUDE.md` §5, idea 1).

| The player said | The frames show | The site might say |
|---|---|---|
| Attacking | Lost; average frame 11 min, their own average 6 | "An attacking player, ground down: frames ran nearly twice their usual length" |
| Patient | Won 5–1 in quick frames | "Not the patient game they're known for: this one was over quickly" |
| Closer | Won the decider, 7 of 8 now | "Closer by name: that's 7 of 8 deciders" |
| Left-handed opponent | Won | "First win over a left-hander this year" |

## 4. What the data can support today

**Checked against production on 6 Nov, read only, and in the code.**

| Matches | Complete frames | With a frame time | With a break result |
|---|---|---|---|
| League nights | 45 | **0** | **0** |
| Tournament matches | 12 | 12, every one under 30 seconds (test taps) | 2 |

**League nights record no time and no break result.** The captain's card (`league-card.js`, `send`) sends only the status, the winner, the result event and who broke. So UV's example, an attacking player ground down, **cannot be told about a league night as it stands**, and league nights are where most frames will be played. It works on matches scored through `/match/`, which saves all of it.

Example: Shadow marks themselves Attacking and loses 3–5 on a Wednesday league night. The site knows the score and who broke. It doesn't know whether those frames took 4 minutes or 20, so it has no story to tell.

| Way forward | Effect | Against |
|---|---|---|
| The card stamps the time each result is tapped | Gives a rough frame time for no extra effort | Wrong if a captain enters results in a batch at the end, or frames run side by side on two tables |
| Each table's card offers a start tap and a break result | Real data, same as `/match/` | More tapping for a captain mid-night |
| Scorers use `/match/` for each league frame | The full data | A big change to how a night runs: the captain's card is how a league night is scored today |
| Leave it | Stories on singles and tournaments only | The story misses league play |

**Whichever is chosen, this is its own decision and comes before any story work.** Points need the same data (points design, data note: "this is what points should push").

**Other limits:**

- **A frame time belongs to both players.** It shows a frame was long, not who was slow. "Ground down" is fair; "played slowly" is not, so the sentences must stay on the fair side.
- **Small numbers mislead.** A sentence should need a minimum number of frames, say 20, before it compares a player with their own average.
- **Shot clock use is not recorded** (points design §10), so a style can't be tested on it.
- **Walk-ins have no account**, so they have no traits. A story with a walk-in simply says nothing about them.

## 5. Pictures and avatars

| Option | What the player does | Cost | For | Against |
|---|---|---|---|---|
| **A. Pool ball** | Picks a number and a colour | Small: drawn in code | On theme, sharp at any size, recognisable across a room | Many players will pick the 8 |
| **B. Preset set** | Picks from a designed set of about 20 | Small to build; needs artwork | Quick and polished | Needs an artist or generated art; players may repeat each other |
| **C. Initials, styled** | Picks a colour and pattern behind their initials | Very small | Better than today's plain initials | Not very expressive |
| **D. Avatar builder** | Assembles a character from parts | **Large**: artwork for every part | The custom avatar UV mentioned; the most personal | A big art job for launch in a month; easy to feel gimmicky |

**Recommendation: A and B first; D after opening, if it still appeals.** C costs so little it could be the fallback.

**A trade-off to keep in mind:** the large picture was built because "players use it to recognise each other" (UV, 5 Nov; `docs/systems/players.md`). An avatar helps with that less than a photo. A player might keep both: the avatar on the small circles, the photo when the picture is opened. The large view already treats a photo differently from initials.

**Colours carry meaning on this site.** Green means won or finished, yellow means breaking or in play, and red means abandoned. Letting players colour their own ring or name would blur that language, so **colour choices belong inside the picture, never on the ring or the name**.

**Earned looks (later).** The hall of fame already "sits like a boost on the profile" (points design §10a). A frame round the picture or a banner could show a tier or a title. These are reached rather than bought, since points are never spent.

## 6. How it might be built

- **Where each option lives depends on D1.** Hand and picture belong to the person, and style and superpowers to the sport. That suggests a small per-sport table, `tbl_player_traits`, rather than more columns on `tbl_players`. **D1 doesn't need finishing first** if the table carries the sport from day one.
- **The merge must carry it (`CLAUDE.md` §5, idea 9).** A new table referencing players has to be added to `private.tdc_merge_players`. A new column on `tbl_players` needs the same care, because the merge keeps only the walk-in's row and carries over the names.
- **Found while checking:** the merge does not carry `avatar_path`, so a player who set a picture before being linked to a walk-in would lose it (read in `20261105205913`; not run). Worth deciding when the merge is next retested (STATUS §1 item 00b).
- **A preset could go through the existing picture path.** `avatar_path` could hold, say, `preset/ball-8`, with `TDC.pictureUrl` turning that into a site image. The functions that already return `avatar_path` then need no change, and every page shows it. The constraint "only your own folder" would have to allow it, Remove must not try to delete a preset, and each of the 14 places in 11 scripts that name the bucket needs checking.
- **A changed trait shouldn't rewrite old stories** (the same reasoning as `CLAUDE.md` §5, idea 2). Example: Shadow is Attacking through March and Patient from April. A March match should still read as attacking. Keeping each change with its date, as an append-only list, handles this; players can change whenever they like.
- **Writes go through a `tdc_` function**, with the option lists defined once, as match settings are (`TDCMatchDef`), so pages are generated from them.
- **The points page is updated when the data is defined** (`CLAUDE.md` §3, step 5): `DATA` in `points-formula.js`. Profile completeness might gain "traits filled in", and a formula could reward a trait being backed up by frames.
- **Who can see them:** everyone signed in, as the rest of the profile page. Traits can also serve as scouting before a match, which is part of the fun. **Date of birth is left out on purpose**, though the senior citizens tier (points design §6) may one day want it: it is personal information (POPIA, STATUS B1) and should be decided on its own.

## 7. A possible order

| Step | What | Why here |
|---|---|---|
| 1 | Settle the options and the questions below | Nothing can be built without them |
| 2 | Pictures: the pool ball and presets | Independent of everything; quick visible polish before opening |
| 3 | Traits on the profile: choosing them, showing them on About and Compare | Useful at once as colour and scouting |
| 4 | Decide league night timing (§4) | Stories depend on it |
| 5 | The numbers beside the claims | Uses data that already exists |
| 6 | Stories on the match page, profile and feed | Needs real frames, so it comes after opening |

## 8. Questions for UV

| | Question | Why it matters |
|---|---|---|
| 1 | Should league nights record frame time and break results, and how (§4)? | Without it, stories and much of points miss league play |
| 2 | Which options stay in §3? Style or pace or both? | Fewer, sharper options make better data |
| 3 | Should the site publicly show a claim beside its record ("Closer: 2 of 9 deciders")? | The best part of the idea, but it can embarrass a player. Could be opt-in, or only shown when flattering at first |
| 4 | Superpowers: serious names or playful? | Sets the tone; too playful and it reads as gimmicky |
| 5 | Which pictures: ball, presets, styled initials, builder (§5)? Does a preset count as "Picture added" for points? | Sets the art work needed; profile completeness reads `has_picture` |
| 6 | Should a photo stay for recognition when a player chooses an avatar? | Keeps the reason the large picture exists |
| 7 | Where should a story first appear: the match page, the profile or the feed? | Decides the first version's shape |
