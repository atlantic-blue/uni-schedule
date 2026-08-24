-- Nothing is readable until a policy says so.
alter table public.profiles        enable row level security;
alter table public.areas           enable row level security;
alter table public.shifts          enable row level security;
alter table public.assignments     enable row level security;
alter table public.attendance      enable row level security;
alter table public.adjustments     enable row level security;
alter table public.shift_templates enable row level security;

-- Names and roles are needed to build a roster, so they are readable by anybody
-- signed in. The rest of a profile, the target and the address, is not, which is
-- why this view exists instead of a policy on the table.
create view public.people_directory as
  select id, full_name, role, active from public.profiles;

grant usage on schema public to authenticated;
grant select on public.people_directory to authenticated;
grant select on public.hours_balance to authenticated;
grant select, insert, update, delete on
  public.profiles, public.areas, public.shifts, public.assignments,
  public.attendance, public.adjustments, public.shift_templates
  to authenticated;
grant execute on function public.generate_week(date) to authenticated;

-- profiles
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_insert on public.profiles
  for insert to authenticated with check (public.is_admin());
create policy profiles_admin_delete on public.profiles
  for delete to authenticated using (public.is_admin());

-- A student may correct their own name. Only an admin may change what a person
-- is, what they owe, or whether they still count.
create function public.guard_profile_changes() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- A request with no signed in user is the service role or the SQL editor, which
  -- is how the first administrator is made. There is no earlier administrator to
  -- ask, so this has to be allowed.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role <> old.role or new.target_hours <> old.target_hours or new.active <> old.active then
    raise exception 'only an administrator can change role, target hours or active';
  end if;
  return new;
end;
$$;

create trigger profiles_guarded
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- areas, shifts, templates: everybody reads the plan, admins write it.
create policy areas_read on public.areas
  for select to authenticated using (true);
create policy areas_write on public.areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy shifts_read on public.shifts
  for select to authenticated using (true);
create policy shifts_write on public.shifts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy templates_read on public.shift_templates
  for select to authenticated using (true);
create policy templates_write on public.shift_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Who is planned where is group knowledge, as it was on the wall.
create policy assignments_read on public.assignments
  for select to authenticated using (true);
create policy assignments_write on public.assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Whether somebody turned up is not group knowledge.
create policy attendance_read_own on public.attendance
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.assignments a
      where a.id = attendance.assignment_id and a.person_id = auth.uid()
    )
  );
create policy attendance_write on public.attendance
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy adjustments_read_own on public.adjustments
  for select to authenticated using (person_id = auth.uid() or public.is_admin());
create policy adjustments_write on public.adjustments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
