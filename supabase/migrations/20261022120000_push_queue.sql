-- Sending a push for a notification row.
--
-- The rows are written inside database functions and triggers — a TD confirms
-- an entrant, a draw advances, an official edits a frame — so the page that
-- caused it does not know how many were written or to whom. The existing
-- pattern of the page telling an Edge Function what to send does not reach
-- these.
--
-- ─── Why a queue and not a trigger ───
--
-- The obvious build is a trigger calling the Edge Function over HTTP as each
-- row is written. That needs pg_net, and the project has neither pg_net nor
-- pg_cron installed (checked 22 Oct). Turning them on is a decision of its
-- own, and there is a design that needs neither.
--
-- So pushing is a **sweep**: tbl_notifications.pushed_at marks what has gone
-- out, this function hands out the rest, and an Edge Function sends them.
-- Any page can set the sweep going after an action, which is the same shape
-- as notify-card being fired from the page.
--
-- The useful property: nothing here knows or cares what started the sweep.
-- If pg_cron is ever turned on — the dispute-window reminder wants it too —
-- it can call the same Edge Function on a schedule and none of this changes.
--
-- ─── What a missed sweep costs ───
--
-- The push, and only the push. The row is already written and will be in the
-- tray next time the person opens it. That is the whole reason the record
-- comes first: the unreliable part is allowed to be unreliable.

-- ─────────────────────────────────────────────────────────────────
-- Handing out work
--
-- Claiming and reporting in one statement, so two sweeps running at once
-- cannot both take the same row and send it twice. `for update skip locked`
-- is what makes that true under concurrency rather than only in testing.
-- ─────────────────────────────────────────────────────────────────

-- In public, not private, which is the exception to this project's rule that
-- internals live in private. It has to be: PostgREST exposes the public
-- schema only, and this is called over the API by the Edge Function. The
-- lock-down is the grant rather than the schema — revoked from anon and
-- authenticated, granted to service_role alone, which is the key the Edge
-- Function holds and the browser never sees.
create function public.tdc_claim_pushes(p_limit integer default 50)
returns table (
	notification_id uuid,
	user_id         uuid,
	title           text,
	body            text,
	link            text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
	-- ── Retire what should never be sent ──
	--
	-- Marked as pushed without being sent, so the sweep does not reconsider
	-- them every time it runs. Three reasons, all permanent for that row:
	--
	--   the category is muted — the record stays, the interruption does not
	--   the recipient has no account or no device — nothing to send to
	--   it is stale — a push about something that happened hours ago is
	--     worse than silence; the tray has it, and that is the right place
	--     for old news
	update public.tbl_notifications n
	set pushed_at = now()
	where n.pushed_at is null
		and (
			n.created_at < now() - interval '1 hour'
			or not exists (
				select 1
				from public.tbl_players p
				join public.tbl_push_subscriptions s on s.user_id = p.user_id
				where p.id = n.player_id
			)
			or exists (
				select 1 from public.tbl_notification_prefs f
				where f.player_id = n.player_id
					and f.category = n.category
					and f.push_enabled = false
			)
		);

	-- ── Hand out the rest ──
	return query
	with claimed as (
		select n.id
		from public.tbl_notifications n
		where n.pushed_at is null
		order by n.created_at
		limit greatest(1, least(coalesce(p_limit, 50), 200))
		for update skip locked
	)
	update public.tbl_notifications n
	set pushed_at = now()
	from claimed c, public.tbl_players p
	where n.id = c.id and p.id = n.player_id
	returning n.id, p.user_id, n.title, n.body, n.link;
end;
$$;

comment on function public.tdc_claim_pushes(integer) is
	'Marks notifications as pushed and returns the ones worth sending. Claiming and returning are one statement so two sweeps cannot send the same row twice. Muted, device-less and stale rows are retired without being returned.';

revoke execute on function public.tdc_claim_pushes(integer) from public, anon, authenticated;
grant execute on function public.tdc_claim_pushes(integer) to service_role;


-- ─────────────────────────────────────────────────────────────────
-- Is there anything to sweep?
--
-- So a page can skip the round trip to the Edge Function on the common case,
-- which is that there is nothing waiting. Safe for any signed-in caller: it
-- answers a number about the queue as a whole and discloses nothing about
-- who is being told what.
-- ─────────────────────────────────────────────────────────────────

create function public.tdc_pushes_waiting()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
	select count(*)::integer
	from public.tbl_notifications
	where pushed_at is null
		and created_at >= now() - interval '1 hour';
$$;

revoke execute on function public.tdc_pushes_waiting() from public, anon;
grant execute on function public.tdc_pushes_waiting() to authenticated;
