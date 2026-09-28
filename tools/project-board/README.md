# Project board

The running task list for The Dive Club (business) and theDiveClub (website).

- **Live board:** https://claude.ai/artifact/PMACuEGdQGJh2LfHjq2S38 (private to UV)
- **Source:** `index.html` in this folder

This is a Claude artifact, not part of the website. It runs on claude.ai and stores its data in the artifact's own database, not in Supabase. It sits outside `src/`, so Eleventy never builds or publishes it. The copy here is a record of the source; editing it does not change the live board. To change the board, edit this file and ask Claude to republish it to the URL above.

## How it's used

- UV updates tasks directly on the board.
- In any chat in the Dive Club project, "check the board" means Claude reads it first, and "update the board" means Claude ticks off, adds or re-links tasks from that session.
- The board is the high-level view. Website detail stays in `CLAUDE.md`; decisions stay in the chats.

## Features

- Tabs: Business, Website, All.
- Statuses: Next, In progress, To do, Waiting, Done. Keep Next to about three per side.
- Sub-tasks to any depth. Each sub-task behaves like a task (status, person, links, its own sub-tasks). Deleting a task deletes its sub-tasks.
- Links between tasks: Waiting on, Blocks, Related to. The other task shows the reverse ("Holding up", "Blocked by").
- Groups and people are dropdowns with "+ New…", and both can be renamed from their heading.
- Filters: search, status, person, group. Group by group, status, person or nothing. Filtered views are flat and show each task's parent path.

## Data

Collection `items`, one document per task:

| Field | Meaning |
|---|---|
| `title`, `note` | Text |
| `track` | `business` or `website` |
| `group` | Group name. Top-level tasks only; sub-tasks use their top parent's group |
| `parentId` | Parent task id, or null for top-level |
| `status` | `next`, `progress`, `todo`, `waiting`, `done` |
| `person` | One name, or empty |
| `links` | `[{type, id}]`, type is `waiting_on`, `blocks` or `related` |
| `order` | Sort order among siblings |
| `updated` | ISO timestamp of the last edit |

Document `meta/lists`: `groups.business`, `groups.website` (group order) and `people`.

Per-viewer settings (tab, filters, expanded tasks) are kept in the browser only.
