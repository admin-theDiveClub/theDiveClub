-- "May I score this match?", asked by the page before it draws the controls.
--
-- private.tdc_can_edit_match already answers this, and every write calls it, but
-- the private schema is deliberately not reachable through the API. Without a
-- way to ask, the page would have to work the rule out again in JavaScript —
-- two copies of the same rule, and the one on the phone would be the one that
-- drifts. This wrapper keeps a single source of truth.
--
-- It only ever answers about the person asking, so it tells nobody anything
-- about anybody else. A false answer is not a secret either: the page says
-- plainly that only the players and venue staff can score, which is the same
-- thing the refusal message says when a write is attempted.

create function public.tdc_may_edit_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select private.tdc_can_edit_match(p_match_id);
$$;

revoke execute on function public.tdc_may_edit_match(uuid) from public, anon;
grant execute on function public.tdc_may_edit_match(uuid) to authenticated;
