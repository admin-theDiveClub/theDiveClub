# Players: the profile page

## The player page (`/players/?p=<player id>`, 5 Nov)

Built from UV's combined design (artboard D, "Player Profile Designs" canvas on claude.ai), with a toggle UV added: **Profile · Head to head**, just below Compare with me. Reached from a name on a league's season page and its standings. Signed in only (UV, 5 Nov); a visitor is sent to sign in and brought back.

**Files:** `src/players/index.html`, `src/scripts/player.js`, `src/stylesheets/player.css` (after `league.css`, whose `.cp-views` pill, `.team-pic` and `.fx-state-*` colours it uses). Migrations `20261105044302_player_profile.sql` and `20261105064410_player_profile_every_state.sql`, tests `045_player_profile.test.sql` and `046_player_profile_every_state.test.sql`.

### What the page shows

| Part | What | From |
|---|---|---|
| Hero | Picture in a green ring with the verified tick, left of the centre line; display name and full name right of it. A tap on a photo shows it large (below) | `player` |
| Buttons | Ring icons in one row: Challenge (the cue ball, green ring) and Follow (not built), Share (the phone's share sheet, else copies the link), More (not built) | |
| Toggle | Profile · Head to head · Compare; `&tab=h2h` or `&tab=cmp` in the address keeps it on reload | |
| Profile | Form (their last 10 frames, a yellow ring where they broke), Stats with a period (All time · Last 90 days · Last 30 days) in four boxes, the frame difference per night (last 15 nights in the period), leagues and teams with the team's place, recent matches (3, then See all), the last match's frames, honours, about | `matches`, `frames`, `teams` |
| Head to head | Your meetings: you v them in meetings won, the split bar, frames and the current streak; the last meeting frame by frame; every meeting (3, then All); Challenge to a rematch (not built) | `tdc_head_to_head` |
| Compare | Side by side: both players' all-time stats, yours left | both profiles |

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

**The Profile tab, third pass (UV, 5 Nov).** Order: **Teams** (the old Leagues & teams list, renamed, moved to the top), Form, Stats, Frame difference per night, **Competitions**, **Recent matches**, About. Competitions has two sub-sections, **Leagues** and **Tournaments**, 4 matches a page; Recent matches is every kind, social too, 5 a page. Each list's page number is the site's number stepper on its side (`data-stepper="across"`) at the right of its heading, which stays centred (`.pp-head`, a three-column grid); with one page it is greyed out. Each row starts with the match's **state strip**, the league fixtures' colours (`league.css` `.fx-state-*`): green not started, amber and lit playing, green and lit finished, red abandoned; the score shows once a frame is in ("–" before), the win or loss dot only once finished. **Last match frames** and **Honours** were removed (honours: `docs/BACKLOG.md` §2 item 9).

**Every state, counted or not (migration `20261105064410`).** `tdc_player_profile` now lists every match the player is in, each with its `status`: through their frames (a team night once both lineups lock, since the lock creates the frames), a singles match naming them before any frame, and a team night's **squad** before the lock. UV asked for a league night once the player is in their team's lineup; the order is a blind exchange until both sides lock, so the function reads the squad (open to read) instead and never the order, or the profile would tell an opponent who is playing. What is counted is unchanged: `frames` holds finished frames of finished matches only, and the page counts matches only where `status` is `complete` (`inPeriod`, `count`). A page served before the push says "Push migration 20261105064410" rather than showing empty lists. Tests: `046_player_profile_every_state`.

**Your own profile** has no toggle and none of the buttons meant for somebody else. Account settings stay on `/accounts/profile/`.

**Not built yet** (UV, 5 Nov: shown, a tap says so): Challenge, Follow, the rematch, Home venue (About's row), More. Each is a control with `data-unbuilt="<name>"`; a tap writes "<name> is not built yet." on its section's note line (`[data-note]`), or the page's status line.

### The two functions

Both security definer, signed in only, read only; the page never reads `tbl_players` directly (keeps clear of STATUS B2).

- **`tdc_player_profile(player)`** returns `player` (display and full name, picture, since, `verified`: an identifier with an active verification at any venue, only the yes or no; `is_me`), `matches` (every match they played a frame in, newest first, its kind and competition, the opponent, and the score counted from the frames), `frames` (their own frames in those matches: `won`, `broke`, null where breaks were not tracked, `result_event`) and `teams` (every league season they are entered in).
- **`tdc_head_to_head(player)`**: the caller against that player. Only frames the two played on opposite sides count; a meeting is a match holding at least one, won by whoever won more of them. Against yourself it returns `same: true` and no meetings.

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
