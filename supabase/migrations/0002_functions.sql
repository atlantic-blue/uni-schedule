-- ── who is asking ────────────────────────────────────────────────────────────

create function public.is_supervisor() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'supervisor' and status = 'approved'
  );
$$;

create function public.current_person_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select person_id from public.profiles where id = auth.uid();
$$;

-- A new sign in makes an account. Somebody asking to be a supervisor waits for an
-- existing supervisor to approve them. Everybody else is approved at once.
-- The account links itself to a person record when the name matches one exactly.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wanted text := btrim(coalesce(new.raw_user_meta_data ->> 'requested_role', 'student'));
  shown  text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                          split_part(new.email, '@', 1));
  found  uuid;
begin
  select id into found from public.people
  where lower(btrim(first_name || ' ' || last_name)) = lower(shown)
    and not exists (select 1 from public.profiles where person_id = people.id)
  limit 1;

  insert into public.profiles (id, person_id, display_name, role, status)
  values (
    new.id, found, shown,
    case when wanted = 'supervisor' then 'supervisor' else 'student' end::public.account_role,
    case when wanted = 'supervisor' then 'pending'    else 'approved' end::public.account_status
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── the calendar rules ───────────────────────────────────────────────────────

-- The last Sunday in a month. Daylight saving changes on these two dates, and
-- the Friday afternoon is half an hour shorter in winter because of it.
create function public.last_sunday(p_year integer, p_month integer) returns date
  language sql immutable as $$
  select last_day - extract(dow from last_day)::integer
  from (select (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date as last_day) m;
$$;

create function public.is_summer(p_day date) returns boolean
  language sql immutable as $$
  select p_day >= public.last_sunday(extract(year from p_day)::integer, 3)
     and p_day <  public.last_sunday(extract(year from p_day)::integer, 10);
$$;

-- The work afternoons are Tuesday and Friday. Another day is still allowed, and
-- the screens warn about it, exactly as the old system did.
create function public.is_work_day(p_day date) returns boolean
  language sql immutable as $$
  select extract(dow from p_day)::integer in (2, 5);
$$;

-- Tuesday is three hours. Friday is three in summer and two and a half in winter.
-- Any other day is three. The supervisor can always overrule the suggestion.
create function public.default_duration(p_day date) returns numeric
  language sql immutable as $$
  select case
    when extract(dow from p_day)::integer = 5 and not public.is_summer(p_day) then 2.5
    else 3
  end;
$$;

create function public.falls_on_birthday(p_person uuid, p_day date) returns boolean
  language sql stable as $$
  select exists (
    select 1 from public.people
    where id = p_person
      and birthday is not null
      and extract(month from birthday) = extract(month from p_day)
      and extract(day   from birthday) = extract(day   from p_day)
  );
$$;

-- ── what an entry is worth ───────────────────────────────────────────────────

-- Everything the browser is not allowed to decide happens here, so the screens
-- and the database can never disagree about a day.
create function public.shape_entry() returns trigger
  language plpgsql as $$
begin
  if new.present then
    if new.duration_hours is null then
      new.duration_hours := public.default_duration(new.entry_date);
    end if;
    new.excused := false;
    new.reason := null;
    new.is_birthday := false;
  else
    new.duration_hours := 0;
    new.punctual := null;
    -- Absent on your own birthday is excused, and the reason is fixed.
    if public.falls_on_birthday(new.person_id, new.entry_date) then
      new.is_birthday := true;
      new.excused := true;
      new.reason := 'Birthday';
    else
      new.is_birthday := false;
    end if;
  end if;
  return new;
end;
$$;

create trigger entries_shaped
  before insert or update on public.attendance_entries
  for each row execute function public.shape_entry();

-- A reason a supervisor types is offered back to them next time. Birthday is set
-- by the rule above, so it never joins the list.
create function public.learn_reason() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not new.present and new.excused
     and coalesce(btrim(new.reason), '') <> '' and new.reason <> 'Birthday' then
    insert into public.absence_reasons (reason) values (btrim(new.reason))
    on conflict (reason) do nothing;
  end if;
  return new;
end;
$$;

create trigger entries_teach_reasons
  after insert or update on public.attendance_entries
  for each row execute function public.learn_reason();

-- ── moving people between areas ──────────────────────────────────────────────

-- A person stands on one area at a time. The first person placed on an empty
-- area leads it, and removing a lead promotes whoever is left.
create function public.leave_area(p_person uuid) returns void
  language plpgsql as $$
declare
  old_area uuid;
  was_lead boolean;
begin
  select area_id, is_area_lead into old_area, was_lead
  from public.people where id = p_person;

  update public.people
  set area_id = null, is_area_lead = false, task_detail = null
  where id = p_person;

  if was_lead and old_area is not null then
    update public.people set is_area_lead = true
    where id = (
      select id from public.people
      where area_id = old_area and active
      order by last_name, first_name
      limit 1
    );
  end if;
end;
$$;

create function public.place_on_area(p_person uuid, p_area uuid) returns void
  language plpgsql as $$
declare
  area_is_empty boolean;
begin
  perform public.leave_area(p_person);
  select not exists (select 1 from public.people where area_id = p_area)
  into area_is_empty;

  update public.people
  set area_id = p_area, group_type = 'shared', is_area_lead = area_is_empty
  where id = p_person;
end;
$$;

create function public.make_area_lead(p_person uuid) returns void
  language plpgsql as $$
declare
  the_area uuid;
begin
  select area_id into the_area from public.people where id = p_person;
  if the_area is null then
    raise exception 'that person is not on an area, so they cannot lead one';
  end if;
  update public.people set is_area_lead = false where area_id = the_area;
  update public.people set is_area_lead = true  where id = p_person;
end;
$$;

-- ── the three numbers ────────────────────────────────────────────────────────

-- Total hours is the hours worked. Minus hours is a COUNT of days missed without
-- an excuse, which is what the old system means by the phrase. The balance is
-- the hours against the target, and it is a different number from the minus.
create view public.person_balance with (security_invoker = true) as
select
  p.id                                as person_id,
  p.first_name,
  p.last_name,
  p.target_hours,
  coalesce(counted.total_hours, 0)    as total_hours,
  coalesce(counted.minus_count, 0)    as minus_count,
  coalesce(counted.excused_count, 0)  as excused_count,
  coalesce(counted.late_count, 0)     as late_count,
  round(coalesce(counted.total_hours, 0) - p.target_hours) as balance_hours
from public.people p
left join lateral (
  select
    sum(e.duration_hours) filter (where e.present)                      as total_hours,
    count(*) filter (where not e.present and not e.excused)::integer    as minus_count,
    count(*) filter (where not e.present and e.excused)::integer        as excused_count,
    count(*) filter (where e.present and not e.punctual)::integer       as late_count
  from public.attendance_entries e
  where e.person_id = p.id
) counted on true
where public.is_supervisor() or p.id = public.current_person_id();
