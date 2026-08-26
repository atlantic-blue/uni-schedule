alter table public.areas              enable row level security;
alter table public.people             enable row level security;
alter table public.profiles           enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.absence_reasons    enable row level security;

-- Names and where somebody works are needed to build and read a plan, so they are
-- readable by anybody signed in. A birthday, a class, a target and a default
-- status are not, which is why this view exists instead of a policy on the table.
create view public.people_directory as
  select p.id, p.first_name, p.last_name, p.group_type, p.area_id,
         a.name as area_name, p.task_detail, p.is_area_lead, p.guest_type, p.active
  from public.people p
  left join public.areas a on a.id = p.area_id;

grant usage on schema public to authenticated;
grant select on public.people_directory, public.person_balance to authenticated;
grant select, insert, update, delete on
  public.areas, public.people, public.profiles,
  public.attendance_entries, public.absence_reasons
  to authenticated;
grant execute on function
  public.place_on_area(uuid, uuid),
  public.leave_area(uuid),
  public.make_area_lead(uuid),
  public.default_duration(date),
  public.is_work_day(date),
  public.is_summer(date)
  to authenticated;

-- ── areas ────────────────────────────────────────────────────────────────────
create policy areas_read on public.areas
  for select to authenticated using (true);
create policy areas_write on public.areas
  for all to authenticated using (public.is_supervisor()) with check (public.is_supervisor());

-- ── people ───────────────────────────────────────────────────────────────────
create policy people_read_own on public.people
  for select to authenticated
  using (public.is_supervisor() or id = public.current_person_id());
create policy people_write on public.people
  for all to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

-- ── accounts ─────────────────────────────────────────────────────────────────
create policy profiles_read_own on public.profiles
  for select to authenticated using (public.is_supervisor() or id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_supervisor() or id = auth.uid())
  with check (public.is_supervisor() or id = auth.uid());
create policy profiles_admin_write on public.profiles
  for insert to authenticated with check (public.is_supervisor());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.is_supervisor());

-- Somebody may correct the name shown on their own account. Only a supervisor
-- approves an account, changes what it is, or links it to a person. Without this
-- a pending supervisor could approve themselves, since the row is their own.
create function public.guard_profile_changes() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- No signed in user means the service role or the SQL editor, which is how the
  -- first supervisor is made. There is no earlier supervisor to ask.
  if auth.uid() is null or public.is_supervisor() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.person_id is distinct from old.person_id then
    raise exception 'only a supervisor can approve an account or change what it is';
  end if;
  return new;
end;
$$;

create trigger profiles_guarded
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ── entries ──────────────────────────────────────────────────────────────────
-- Whether somebody turned up, and whether the absence was excused, is between
-- them and the supervisors. An excused absence usually means illness, which the
-- General Data Protection Regulation treats as a special category.
create policy entries_read_own on public.attendance_entries
  for select to authenticated
  using (public.is_supervisor() or person_id = public.current_person_id());
create policy entries_write on public.attendance_entries
  for all to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());

-- ── reasons ──────────────────────────────────────────────────────────────────
create policy reasons_read on public.absence_reasons
  for select to authenticated using (public.is_supervisor());
create policy reasons_write on public.absence_reasons
  for all to authenticated
  using (public.is_supervisor()) with check (public.is_supervisor());
