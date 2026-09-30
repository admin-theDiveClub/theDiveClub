-- Project board: cost estimates on tasks.
-- A cost is a range in rand (low to high). Both are empty, or both are set; the page saves a single figure as both.
-- cost_period says whether it's a once-off, monthly or yearly cost; totals are kept separate per period.
-- Each task's cost is its own. A parent's cost doesn't include its sub-tasks' costs; the page shows those separately.

alter table public.tbl_pm_items
	add column cost_low    numeric(12, 2),
	add column cost_high   numeric(12, 2),
	add column cost_period text not null default 'once',
	add constraint tbl_pm_items_cost_period check (cost_period in ('once', 'monthly', 'yearly')),
	add constraint tbl_pm_items_cost_pair check ((cost_low is null) = (cost_high is null)),
	add constraint tbl_pm_items_cost_range check (cost_low is null or (cost_low >= 0 and cost_low <= cost_high));
