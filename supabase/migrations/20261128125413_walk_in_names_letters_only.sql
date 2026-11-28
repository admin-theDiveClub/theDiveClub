-- Walk-in names from a pasted list: letters only, made neat (UV, 28 Nov;
-- docs/systems/tournaments.md, "Walk-ins from Entrants, and connecting them").
--
-- A WhatsApp list carries more than "1. " numbering: "4 UV420" and "420UV"
-- are both UV. Each line now keeps only letters (any language), the spaces
-- between words, and an apostrophe or hyphen inside a word (O'Brien,
-- Jean-Luc: UV). Digits, dots, brackets, emoji and symbols are taken off
-- wherever they are, each leaving a space, so "Jo.Smith" is Jo Smith. A
-- phone's curly apostrophe is made a straight one, so O’Brien and O'Brien
-- are the same name.
--
-- Neat (UV): runs of spaces become one, and each word's first letter is made
-- a capital; the rest of the word stays as typed, so UV stays UV and
-- "jo smith" becomes Jo Smith. A line with no letters left is dropped, as a
-- blank line was.
--
-- Patched from 20261127134429's definition, not retyped: only the clean-up at
-- the top of the loop changes. create or replace keeps the grants and the
-- comment.

create or replace function public.tdc_add_walk_in_entrants(p_tournament_id uuid, p_names text[])
returns table (name text, player_id uuid, skipped text)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_t     public.tbl_tournaments%rowtype;
	v_name  text;
	v_seen  text[] := '{}';
	v_count integer;
	v_id    uuid;
begin
	select * into v_t from public.tbl_tournaments where id = p_tournament_id;
	if v_t.id is null then
		raise exception 'TDC (Error): tournament % not found.', p_tournament_id;
	end if;

	if not private.tdc_can_run_tournament(p_tournament_id) then
		raise exception 'Only the people running this tournament can add entrants.';
	end if;

	if p_names is null or coalesce(array_length(p_names, 1), 0) = 0 then
		raise exception 'Please enter at least one name.';
	end if;
	if array_length(p_names, 1) > 256 then
		raise exception 'That is more than 256 names. Add them in smaller lists.';
	end if;

	foreach v_name in array p_names loop
		-- Letters only, made neat: "4 UV420" is UV, "1. jo  smith 🎱" is Jo Smith.
		v_name := regexp_replace(replace(coalesce(v_name, ''), '’', ''''), '[^[:alpha:][:space:]''-]', ' ', 'g');
		select coalesce(string_agg(upper(left(x.w, 1)) || substr(x.w, 2), ' ' order by x.ord), '')
		into v_name
		from (
			select regexp_replace(t.w, '^[''-]+|[''-]+$', '', 'g') as w, t.ord
			from unnest(regexp_split_to_array(trim(v_name), '\s+')) with ordinality as t(w, ord)
		) x
		where x.w <> '';
		continue when v_name = '';

		-- The same name twice in one list is one person.
		continue when lower(v_name) = any (v_seen);
		v_seen := v_seen || lower(v_name);

		name := v_name;
		player_id := null;
		skipped := null;

		if char_length(v_name) > 100 then
			skipped := 'longer than 100 characters';
		elsif exists (
			select 1 from public.tbl_tournament_entrants e
			join public.tbl_players p on p.id = e.player_id
			where e.tournament_id = p_tournament_id and lower(p.display_name) = lower(v_name)
		) then
			skipped := 'already entered';
		else
			-- Withdrawn entrants do not take up a place (as tdc_add_entrant).
			select count(*) into v_count
			from public.tbl_tournament_entrants
			where tournament_id = p_tournament_id and status <> 'withdrawn';

			if v_t.max_entrants is not null and v_count >= v_t.max_entrants then
				skipped := 'the tournament is full';
			end if;
		end if;

		if skipped is null then
			insert into public.tbl_players (display_name, player_type, created_by)
			values (v_name, 'walk_in', (select auth.uid()))
			returning id into v_id;

			insert into public.tbl_tournament_entrants (added_by, tournament_id, player_id, status)
			values ((select auth.uid()), p_tournament_id, v_id, 'confirmed');

			-- No notification: a walk-in has no account to tell (private.tdc_notify).
			player_id := v_id;
		end if;

		return next;
	end loop;
end;
$$;
