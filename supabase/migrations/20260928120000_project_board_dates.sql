-- Project board: start and due dates on tasks.
-- Both are optional and include a time. The page treats a due time of 23:59 as "end of the day" and a start time of
-- 00:00 as "start of the day", and hides those times. A task is overdue when its due date has passed and it isn't done;
-- that is worked out in the page, not stored. created_at and updated_at already exist.

alter table public.tbl_pm_items
	add column start_at timestamptz,
	add column due_at   timestamptz,
	add constraint tbl_pm_items_start_before_due check (start_at is null or due_at is null or start_at <= due_at);

create index tbl_pm_items_due_idx on public.tbl_pm_items (venue_id, due_at);
