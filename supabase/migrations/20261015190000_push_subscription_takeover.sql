-- Saving a push subscription when the browser has had a different owner.
--
-- A push endpoint identifies a *browser*, not an account. The same phone used
-- by two people — or one person who signs out and back in as somebody else —
-- produces the same endpoint, and the row already in the table belongs to
-- whoever enabled notifications on it last.
--
-- The page upserted on endpoint, so that case ran the UPDATE arm of the policy
-- against a row owned by someone else and was refused:
--
--   new row violates row-level security policy (USING expression)
--
-- The person then had no subscription, so sending a test notification answered
-- "no subscriptions found". One fault, two confusing messages.
--
-- Taking the endpoint over is the right answer, not a workaround. Notifications
-- go to a browser; whoever is signed in on that browser is who should receive
-- them, and the previous owner is not there any more. Knowing the endpoint is
-- itself the evidence — it is a long unguessable URL the push service issued to
-- that browser, and only that browser is given it.
--
-- It goes through a function because the policy cannot express "you may replace
-- a row belonging to someone else, but only when you can produce its endpoint".

create function public.tdc_save_push_subscription(
	p_endpoint text,
	p_p256dh   text,
	p_auth     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user uuid := (select auth.uid());
begin
	if v_user is null then
		raise exception 'TDC (Error): not signed in.';
	end if;

	if coalesce(trim(p_endpoint), '') = ''
		or coalesce(trim(p_p256dh), '') = ''
		or coalesce(trim(p_auth), '') = '' then
		raise exception 'TDC (Error): the subscription is missing its endpoint or keys.';
	end if;

	-- Push services issue https URLs. Anything else is not one of theirs.
	if p_endpoint !~ '^https://' then
		raise exception 'TDC (Error): a push endpoint must be an https address.';
	end if;

	-- Generous ceilings, to keep anything odd out of the table rather than to
	-- second-guess the push services' formats.
	if char_length(p_endpoint) > 2000 or char_length(p_p256dh) > 500 or char_length(p_auth) > 500 then
		raise exception 'TDC (Error): the subscription data is longer than expected.';
	end if;

	-- Whoever holds the browser holds the endpoint.
	delete from public.tbl_push_subscriptions where endpoint = p_endpoint;

	insert into public.tbl_push_subscriptions (user_id, endpoint, p256dh, auth)
	values (v_user, p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke execute on function public.tdc_save_push_subscription(text, text, text) from public, anon;
grant execute on function public.tdc_save_push_subscription(text, text, text) to authenticated;


-- Writing straight to the table is no longer how this is done: it cannot handle
-- a browser changing hands, which is the case that was failing. Reading and
-- removing your own stay as they were, so turning notifications off still works.
revoke insert, update on public.tbl_push_subscriptions from authenticated;
