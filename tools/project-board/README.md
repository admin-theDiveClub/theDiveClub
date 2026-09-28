# Project Board

The owner's task list for The Dive Club (business) and theDiveClub (website), at **https://thediveclub.org/staff/board/**.

Only venue **owners** can open it. The staff hub shows its gold tile to owners only, and the database rules block everyone else. For The Dive Club that is admin@thediveclub.org.

## Where things are

| What | Where |
|---|---|
| Code | `tools/project-board/app/board.js` (all logic and screens) and `app/board.css` (styles) |
| Published at | `/staff/board/app/`, copied by one line in `.eleventy.js`. Only `app/` is published |
| Page | `src/staff/board/index.html`: front matter and an empty box the script fills |
| Database | Migrations `supabase/migrations/20260928103000_project_board.sql` and `20260928120000_project_board_dates.sql` |
| Hub tile | `src/staff/index.html` + `src/scripts/staff-hub.js` (`tile-owner`, colour `--color-owner`) |

To work on it locally: `npx eleventy --serve` and log in as an owner. Changes to `app/` reload like any other file.

## How it works

- On open it checks the login and the owner role, then loads the whole board for that venue.
- Every change is saved to Supabase straight away, then the board reloads.
- It also reloads when you switch back to the tab (at most every 5 seconds), so a change made on another device shows up.
- The tab, filters and which tasks are expanded are remembered in the browser only.

## Features

- Tabs: Business, Website, All. Views: **List** and **Timeline**.
- Statuses: Next, In progress, To do, Waiting, Done. Keep Next to about three per side.
- Sub-tasks to any depth. A sub-task works like a task (status, person, links, its own sub-tasks). Deleting a task deletes its sub-tasks.
- Links between tasks: Waiting on, Blocks, Related to. The other task shows the reverse ("Holding up", "Blocked by"). Tap a link to jump to that task.
- Groups and people are dropdowns with "+ New…", and both can be renamed from their heading. An empty group can be removed.
- Search, filters (status, person, group, or Overdue) and Group by (group, status, person, nothing). Filtered views are flat, show each task's parent path, and can still expand sub-tasks.
- Dates: optional start and due, each with an optional time. No start time = start of the day (saved as 00:00); no due time = end of the day (saved as 23:59). Those default times are hidden. The edit form also shows when the task was created and last changed.
- **Overdue** is automatic, not a status: a task whose due date has passed and isn't Done gets a red "Overdue" badge, is counted in the header (tap the count to filter) and shows red on the timeline.
- **Timeline** (Gantt): tasks with dates as bars from start to due; ◆ for a due date with no start; a short fading bar for a start with no due. Red line = now, shaded columns = weekends. Weeks or Months scale. Sections follow Group by, and the tabs and filters apply. Tasks without dates are listed underneath. Tap a bar or name to open the task in the list.

## Data

All four tables carry `venue_id`, and only that venue's owners can read or write them.

**`tbl_pm_items`** (tasks)

| Column | Meaning |
|---|---|
| `track` | `business` or `website`. Can't be changed after creation |
| `group_id` | Top-level tasks only. Sub-tasks have none and use their top parent's group |
| `parent_id` | Parent task, or empty for top-level |
| `person_id` | One person, or empty |
| `title`, `note` | Text (up to 300 / 4000 characters) |
| `status` | `next`, `progress`, `todo`, `waiting`, `done` |
| `sort_order` | Order among siblings |
| `start_at`, `due_at` | Optional start and due, date and time. Start can't be after due |
| `created_by`, `updated_by`, `updated_at` | Filled in by the database |

**`tbl_pm_groups`**: `track`, `name` (unique per venue and track), `sort_order`. A group that still has tasks can't be deleted.

**`tbl_pm_people`**: `name` (unique per venue).

**`tbl_pm_links`**: `from_id`, `to_id`, `link_type` (`waiting_on`, `blocks`, `related`). Deleting either task removes the link.

The database also refuses: a sub-task in a different track from its parent, a task moved under one of its own sub-tasks, and a task linked to itself.

## History

The board started on 28 Sep 2026 as a Claude artifact and was moved here the same day. Its 49 tasks, groups, people and links were copied across unchanged.
