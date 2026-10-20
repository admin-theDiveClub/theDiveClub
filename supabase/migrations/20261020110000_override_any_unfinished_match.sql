-- Correcting yesterday's guard on tdc_set_match_override.
--
-- 20261020100000 refused an override on a match whose status is 'in_progress',
-- reading claude/approval-and-corrections.md's open question 5 — "overriding a
-- match still being played seems like a mistake worth refusing" — too literally.
--
-- 'in_progress' does not mean people are at the table. It means frames have
-- been recorded and the card has not been submitted, which is exactly the
-- state a TD-run match sits in: the TD records what happened, nobody submits,
-- and the card stays open. The database has no way to know whether anybody is
-- actually playing.
--
-- Combined with tdc_submit_card only accepting the players in a match, that
-- guard left the TD with no way out at all: he could record frames, could not
-- submit, and could not override either. A dead end in the main flow.
--
-- So the refusal is dropped. It is the page's job to ask "this match looks
-- like it is still being played, are you sure?", which is the house rule —
-- confirm and repair rather than block. The database keeps the refusals that
-- protect the record: a reason is still required, and only somebody running
-- the competition may do it.
--
-- Everything else about the function is unchanged.

create or replace function public.tdc_set_match_override(
	p_match_id   uuid,
	p_home_score integer,
	p_away_score integer,
	p_reason     text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_m    public.tbl_matches%rowtype;
	v_me   uuid;
	v_home integer;
	v_away integer;
begin
	select * into v_m from public.tbl_matches where id = p_match_id;
	if v_m.id is null then
		raise exception 'TDC (Error): match % not found.', p_match_id;
	end if;

	if not private.tdc_can_override_match(p_match_id) then
		raise exception 'Only the people running the competition this match belongs to can set its score.';
	end if;

	if nullif(trim(coalesce(p_reason, '')), '') is null or char_length(trim(p_reason)) < 3 then
		raise exception 'Setting a score by hand needs a reason.';
	end if;

	if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
		raise exception 'TDC (Error): a score needs two numbers, neither of them negative.';
	end if;

	select id into v_me from public.tbl_players where user_id = (select auth.uid());

	select
		count(*) filter (where f.winner_side = 'home'),
		count(*) filter (where f.winner_side = 'away')
	into v_home, v_away
	from public.tbl_frames f
	where f.match_id = p_match_id and f.status = 'complete';

	insert into public.tbl_match_result_override
		(match_id, home_score, away_score, reason, set_by, counted_home, counted_away, card_version)
	values
		(p_match_id, p_home_score, p_away_score, trim(p_reason), v_me, v_home, v_away, v_m.card_version)
	on conflict (match_id) do update set
		home_score   = excluded.home_score,
		away_score   = excluded.away_score,
		reason       = excluded.reason,
		set_by       = excluded.set_by,
		set_at       = now(),
		counted_home = excluded.counted_home,
		counted_away = excluded.counted_away,
		card_version = excluded.card_version;
end;
$$;
