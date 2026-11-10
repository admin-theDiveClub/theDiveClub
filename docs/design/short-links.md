# Short links

Settled with UV, 9 Nov 2026. Being built in steps (`docs/STATUS.md`).

A short link is a shortcut to an existing page: `https://thediveclub.org/<code>`. The address bar still ends up on the long address; everywhere else, people only see the code.

## The format

| Code | What it is | Who sets it |
|---|---|---|
| `T-BC26` | A tournament | The TD types BC26; the `T-` is fixed |
| `T-BC26-7` | Match 7 of that tournament | Automatic, nobody can change it |
| `L-BCDAM` | A league | The LD types BCDAM; the `L-` is fixed |
| `L-BCDAM-14` | Match 14 of that league | Automatic, nobody can change it |
| `4821` | A social match | Automatic, nobody can change it |
| `Yuvan-Naidoo` | A player (UV, 10 Nov) | Automatic, built from their first name and surname |
| `Yuvan-Naidoo-2` | The next player with that name | Automatic |

- **Nobody can type an invalid code.** The field takes letters and digits only, 2 to 8 of them, and capitals as you type. The site adds the dashes. Capitals or lower case in an address count as the same code.
- **Only leagues and tournaments can be customised.** Matches inside them carry the competition's code and a number; social matches carry a number.
- **One code each.** One per league, one per tournament, one for every match, one per player. No other page has one.
- **Every one gets a code automatically** when it is created. The LD or TD can replace it.

## Who can do what

| Action | Who |
|---|---|
| Share a link | Anyone who can open the page, including a signed-out visitor on a tournament poster |
| Change a league's or tournament's code | Only whoever created it, in that league's or tournament's Settings. For a suggested code, that is whoever created the league or tournament |

- A changed code is **released at once**. The old link stops working, its match links too, and anybody can take it afterwards. Settings says so beside the field.
- Nobody else can change a code, a co-director or the club owner included (UV, 9 Nov).

## What a code opens

| Code | Signed out | Signed in, not part of it | Signed in and part of it |
|---|---|---|---|
| Tournament | Poster | Poster | Draw |
| League, newest season | Sign in, then the season page | Season page | Season page |
| League or tournament match, social match | Sign in, then the match | The match | The match |
| Player | Sign in, then the profile | The profile | The profile |

Signed-out visitors keep the current flow until the pages for them exist (`docs/STATUS.md` §0 P2).

## Players (UV, 10 Nov)

Full names, so a list of links can be searched elsewhere.

- **Built by the site, never chosen.** First name, dash, surname, each word kept (`Mary-Anne-van-der-Merwe`). Accents come off and apostrophes close up (`Jose-OBrien`).
- **The first to register has the plain name.** The next person with it gets `-2`, then `-3`.
- **It follows the name.** Change your name and the link changes; the old one stops working and anybody may have it. Saving the same name keeps the link, its number included.
- **No first name or surname, no link.** Share gives the long address, and your own page says why. Sign-up asks for both and can be skipped, with the same warning; somebody who skipped is asked again at each sign-in until both are in.
- **Only somebody with an account has one**, so a walk-in cannot hold a name ahead of the person who later registers. Merging a walk-in gives them one.
- **A signed-out visitor is always asked to sign in first, found or not**, so nobody can test names to learn who belongs to the club.
- **A name cannot clash with another code.** It holds only letters, so it is never all digits and never ends in a number but the one added. A first name reading `T-` or `L-`, or either name under two letters, gets no link: `T-Bone` would read as a tournament's code.

## Broken links

An unknown address reaches `404.html` (GitHub Pages sends it for anything that does not exist), which looks the code up and either forwards or shows the reason. It never falls back to the home page.

| Reason | When |
|---|---|
| Not a valid code | The address cannot be a code at all |
| No such code | Nothing has it. It may have been changed or removed |
| No such match | The league or tournament exists, its match number does not |
| Player not found | Signed in, and nobody has this name's link |
| Poster not shared yet | The tournament's poster is private. Its name is not shown |
| No season yet | The league has no season to open |
| Offline | The lookup could not be made |

## Where it appears

- **The code:** a section in league Settings and tournament Settings, with live feedback (Too short, Taken, Available).
- **The Share button:** the tournament poster, the league season page, the match page (⋯ menu and the finished match's result, until that menu is tidied) and the league match card.
- **Long links replaced:** the league's share box and the tournament's entry link.

## Security

- The lookup is given only a code and returns only an address the database builds from a page type and an ID. A code can never lead off the site.
- A code grants no access. Private pages still check who you are.
- Writes go through `tdc_` functions. The columns are not written from the browser.

## Known limit

The lookup runs after the page has loaded and GitHub answers these addresses with a "not found" status. A WhatsApp preview will probably be missing or generic, never that tournament's own. Only a test after a deploy will say. Page-specific previews would need a small server in front of the site.

## Claude's choices, for UV to judge

- A suggested league or tournament code is 5 characters with no vowels and no look-alikes (0, O, 1, I, L), so it cannot spell a word.
- Social match numbers run in order from 1000 rather than at random: short, and never clashing. Someone could walk through them, but a number only leads to a page that still asks for a sign-in.
- The ban list on what a director types is a short list of the worst words.
- A league or tournament match's number belongs to its fixture, so a rematch on the same fixture keeps it. Numbers are never reused, even after a redraw.
- A former director who created the code cannot change it: they must still be running the competition too.
