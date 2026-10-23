# Project board

> Moved verbatim from `CLAUDE.md` on 23 Oct 2026.

- The owner's task list for the business and the website, at **`/staff/board/`**. Owners only: the hub tile shows for owners, and the tables' access rules allow only `owner` at the venue (UV uses admin@thediveclub.org; his personal account is staff and can't see it).
- Kept separate from the rest of the site on purpose:
  - Code: `tools/project-board/app/board.js` and `board.css` (outside `src/`). `.eleventy.js` publishes that folder at `/staff/board/app/`. Only `app/` is published; the README stays private.
  - Page: `src/staff/board/index.html` is only front matter and an empty box the script fills.
  - Database: `tbl_pm_items`, `tbl_pm_groups`, `tbl_pm_people`, `tbl_pm_links` (migration `project_board`), all scoped by `venue_id`. Details in `tools/project-board/README.md`.
- It uses the site's colour variables and `TDC` helpers, and loads everything on open, then reloads after each change and when the tab is shown again (no Realtime).
- The board is the high-level list; this file stays the detailed record for the website. When a website item here is finished or added, update the board too.
