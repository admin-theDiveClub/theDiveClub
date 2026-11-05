# Players: the profile page

## The player page (`/players/?p=<player id>`, 5 Nov)

Built from UV's combined design (artboard D, "Player Profile Designs" canvas on claude.ai), with a toggle UV added: **Profile · Head to head**, just below Compare with me. Reached from a name on a league's season page and its standings. Signed in only (UV, 5 Nov); a visitor is sent to sign in and brought back.

**Files:** `src/players/index.html`, `src/scripts/player.js`, `src/stylesheets/player.css` (after `league.css`, whose `.cp-views` pill and `.team-pic` it uses). Migration `20261105044302_player_profile.sql`, tests `045_player_profile.test.sql`.

### What the page shows

| Part | What | From |
|---|---|---|
| Bar | Back, Share (the phone's share sheet, else copies the link), More (not built) | |
| Hero | Picture in a green ring, the verified tick, display name, full name; chips: Verified, Home venue (not built), the discipline played most, Since | `player` |
| Buttons | Challenge and Follow (not built), Compare with me (opens Head to head) | |
| Toggle | Profile · Head to head; `&tab=h2h` in the address keeps it on reload | |
| Profile | Form (last 10 matches), Stats with a period (All time · Last 90 days · Last 30 days), frames won per night (last 12 nights in the period), on the break, leagues and teams with the team's place, recent matches (3, then See all), the last match's frames, honours, about | `matches`, `frames`, `teams` |
| Head to head | You v them in meetings won, the split bar, frames and the current streak; the last meeting frame by frame; side by side (all time); every meeting (3, then All); Challenge to a rematch (not built) | `tdc_head_to_head`, both profiles |

**Your own profile** has no toggle and none of the buttons meant for somebody else. Account settings stay on `/accounts/profile/`.

**Not built yet** (UV, 5 Nov: shown, a tap says so): Challenge, Follow, the rematch, Home venue, More, trophies. Each is a control with `data-unbuilt="<name>"`; a tap writes "<name> is not built yet." on its section's note line (`[data-note]`), or the page's status line.

### The two functions

Both security definer, signed in only, read only; the page never reads `tbl_players` directly (keeps clear of STATUS B2).

- **`tdc_player_profile(player)`** returns `player` (display and full name, picture, since, `verified`: an identifier with an active verification at any venue, only the yes or no; `is_me`), `matches` (every match they played a frame in, newest first, its kind and competition, the opponent, and the score counted from the frames), `frames` (their own frames in those matches: `won`, `broke`, null where breaks were not tracked, `result_event`) and `teams` (every league season they are entered in).
- **`tdc_head_to_head(player)`**: the caller against that player. Only frames the two played on opposite sides count; a meeting is a match holding at least one, won by whoever won more of them. Against yourself it returns `same: true` and no meetings.

### How it counts (why it is shaped this way)

- **Frames are the only record:** the functions return matches and frames; `player.js` counts every number, so the period filter is the page's alone (on `played_at`, as `/matches/` dates a match).
- **Only finished matches count** (status `complete`), and only their complete frames. A social match still being played, or a league night not yet signed by both captains, adds nothing; an abandoned match never does. *Claude's choice, for UV to judge.*
- **A team night is the player's match** (UV, 5 Nov): won if their side won, scored as the two sides' frames (3–1), while the player's own frames are only the ones they played. Form, Matches and the streak use the match; Frames, Frame win, the break figures and honours use their own frames.
- **Head to head on a team night** counts only the frames the two played against each other: UV and Shadow in the same night but never paired have not met.
- **"Lags won"** is frames broken out of frames with the break recorded, as the standings count `lags_won`.
- **Break & finish "1 in n breaks"**: frames they broke, divided by their break and finishes.
- **Best streak**: matches won in a row; a loss or a draw ends one.
- **A team's place** is ranked in the browser with `TDCStandings.rank` and that season's own team columns (`tbl_league_standing_columns`), exactly as the Standings tab ranks it, from `tdc_league_standings` (signed nights only). "–" where the league has no ranking column.
- **Honours** shows what can be counted today (golden breaks, break and finishes, the best win streak) beside a Trophies tile that is not built.

### Checked

Rendered and driven headless on a scratch build against the local Supabase copy, seeded through the real functions (Shadow: six singles and a team night): 420 × 860 both themes and 1440 wide; every count checked against the seed; the period, the toggle, the address, a not-built tap, your own profile. Never against production.
