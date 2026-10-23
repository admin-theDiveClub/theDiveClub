# Which Claude model to use

Plan: Claude Max 5x. Goal: use the allowance fully without wasting it on a stronger model than the task needs.

**Default: Sonnet 5.5. Step up to Opus 5.5 for heavy work. Haiku 5.5 for quick lookups.**

Whichever chat is working should flag it when a task crosses the line below, and when it is time to start a fresh chat.

## Use Opus 5.5 if any of these is true

- A mistake could lose or corrupt real data (walk-in merge, credit ledger, migrations on live tables, `tdc_merge_players`).
- Several rules interact (league sessions and rotation, standings, approval and override logic).
- It is a new design, where a wrong choice means rebuilding later.
- Sonnet already gave a wrong or shaky answer on the same problem.
- It needs a long chain of steps that must all stay consistent.

## Use Sonnet 5.5 for

- Styling, layout, wording, page tweaks.
- Following a pattern that already exists in the code.
- Updating notes files, commit subjects, checking test results.
- Bug fixes where the cause is already known.

## Use Haiku 5.5 for

- Quick lookups and one-line questions.

## Quick test

If the result can be checked by looking at it (a page renders, a test passes), Sonnet is enough.
If the only check is "does this hold up when real players use it", use Opus.

## Fable 5.1

Not a default. Counts heavily against the weekly limit on Max. Try it only for a long, many-step job
over a lot of source material, and only when Sonnet or Opus is clearly falling short.

## Habits

- Work on one thing at a time. Switch model at the start of a task, not in the middle.
- Check Settings -> Usage around day 5 of the week.
  Under about 70% of the weekly limit: move more work up to Opus.
  Near 100%: move work back to Sonnet.
- Long file-heavy sessions use far more allowance than chat. Start a fresh chat when one gets long.

_Last reviewed: 23 Oct 2026. Model names and limits change; re-check occasionally._
