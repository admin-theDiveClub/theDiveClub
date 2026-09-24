-- Push subscriptions: one row per device/browser where a user has turned on notifications.
-- Replaces the dashboard-made version (it only held test data) so the table is defined in the repo.

drop table if exists public.tbl_push_subscriptions;

create table public.tbl_push_subscriptions (
	id          bigint generated always as identity primary key,
	created_at  timestamptz not null default now(),
	user_id     uuid not null references auth.users (id) on delete cascade,
	endpoint    text not null unique,
	p256dh      text not null,
	auth        text not null
);

create index tbl_push_subscriptions_user_id_idx
	on public.tbl_push_subscriptions (user_id);

alter table public.tbl_push_subscriptions enable row level security;

create policy "Users manage their own subscriptions"
	on public.tbl_push_subscriptions
	for all
	to authenticated
	using ((select auth.uid()) = user_id)
	with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tbl_push_subscriptions to authenticated;
grant select, insert, update, delete on public.tbl_push_subscriptions to service_role;