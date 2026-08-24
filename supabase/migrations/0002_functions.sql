-- Reads the caller's role without going through row level security, so a policy
-- on profiles can call it without asking profiles a question that calls itself.
create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create function public.current_role_of_caller() returns public.person_role
  language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Every new sign in gets a profile. The name falls back to the address, because a
-- guest invited by link may never have typed one.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.shift_minutes(p_shift_id uuid) returns integer
  language sql stable as $$
  select (extract(epoch from (ends_at - starts_at)) / 60)::integer
  from public.shifts where id = p_shift_id;
$$;

-- Marking attendance credits the full shift for 'worked' and for 'excused', and
-- nothing for 'absent'. An excused absence still counts, which is the rule the
-- paper sheet used. Change the 'excused' branch here if your rule differs.
create function public.default_credit(p_shift_id uuid, p_status public.attendance_status)
  returns integer language sql stable as $$
  select case p_status
    when 'worked'  then public.shift_minutes(p_shift_id)
    when 'excused' then public.shift_minutes(p_shift_id)
    else 0
  end;
$$;

-- Fills one week from the templates. Returns how many shifts it created. Running
-- it twice on the same week creates nothing the second time.
create function public.generate_week(p_monday date) returns integer
  language plpgsql as $$
declare
  created integer;
begin
  if extract(isodow from p_monday) <> 1 then
    raise exception 'generate_week expects a Monday, got %', p_monday;
  end if;

  with made as (
    insert into public.shifts (area_id, shift_date, starts_at, ends_at, places)
    select t.area_id, p_monday + (t.weekday - 1), t.starts_at, t.ends_at, t.places
    from public.shift_templates t
    join public.areas a on a.id = t.area_id and a.active
    on conflict (area_id, shift_date, starts_at) do nothing
    returning 1
  )
  select count(*) into created from made;

  return created;
end;
$$;

-- Hours for one person: what the shifts credited, plus corrections, against the
-- target. A negative balance is what the paper sheet calls minus hours.
create view public.hours_balance with (security_invoker = true) as
select
  p.id                                                as person_id,
  p.full_name,
  p.role,
  (p.target_hours * 60)::integer                      as target_minutes,
  coalesce(worked.minutes, 0)                         as credited_minutes,
  coalesce(fixed.minutes, 0)                          as adjustment_minutes,
  coalesce(worked.minutes, 0) + coalesce(fixed.minutes, 0) - (p.target_hours * 60)::integer
                                                      as balance_minutes,
  greatest(0, (p.target_hours * 60)::integer - coalesce(worked.minutes, 0) - coalesce(fixed.minutes, 0))
                                                      as minus_minutes,
  coalesce(worked.excused_days, 0)                    as excused_days
from public.profiles p
left join lateral (
  select sum(at.credited_minutes)::integer as minutes,
         count(*) filter (where at.status = 'excused')::integer as excused_days
  from public.attendance at
  join public.assignments asg on asg.id = at.assignment_id
  where asg.person_id = p.id
) worked on true
left join lateral (
  select sum(adj.minutes)::integer as minutes
  from public.adjustments adj where adj.person_id = p.id
) fixed on true
where public.is_admin() or p.id = auth.uid();

-- The credit is decided in one place. A client sends the status and leaves the
-- minutes empty, so the browser can never disagree with the database about what
-- a shift was worth. An administrator may still send a number to override it.
create function public.fill_credit() returns trigger language plpgsql as $$
declare
  target_shift uuid;
begin
  select shift_id into target_shift from public.assignments where id = new.assignment_id;

  if new.credited_minutes is null then
    new.credited_minutes := public.default_credit(target_shift, new.status);
  elsif tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and new.credited_minutes = old.credited_minutes
  then
    -- The status changed and no new number came with it. That is what a
    -- correction from the app looks like, because it sends the status alone. The
    -- old number has to go, or a shift marked worked and then corrected to
    -- missed would keep its four hours.
    new.credited_minutes := public.default_credit(target_shift, new.status);
  end if;
  return new;
end;
$$;

create trigger attendance_credit
  before insert or update on public.attendance
  for each row execute function public.fill_credit();
