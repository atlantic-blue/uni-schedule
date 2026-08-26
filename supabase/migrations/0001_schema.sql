-- Work schedule: people, areas, shifts, who is planned where, what happened.
-- Two facts are kept apart on purpose. Who is planned on a shift is public to the
-- group, the way the paper sheet on the wall is. Whether somebody turned up, and
-- why they did not, is not.

create type public.person_role as enum ('admin', 'student', 'guest');
create type public.attendance_status as enum ('worked', 'excused', 'absent');

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text        not null check (length(btrim(full_name)) between 1 and 120),
  role          person_role not null default 'student',
  -- Hours the person owes for the period. Guests usually owe none.
  target_hours  numeric(6, 2) not null default 0 check (target_hours >= 0),
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text    not null unique check (length(btrim(name)) between 1 and 80),
  description text,
  places      integer not null default 1 check (places between 1 and 50),
  sort_order  integer not null default 0,
  active      boolean not null default true
);

create table public.shifts (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references public.areas (id) on delete restrict,
  shift_date date not null,
  starts_at  time not null,
  ends_at    time not null,
  places     integer not null check (places between 1 and 50),
  notes      text,
  constraint shift_ends_after_it_starts check (ends_at > starts_at),
  constraint one_shift_per_area_and_time unique (area_id, shift_date, starts_at)
);

create index shifts_by_date on public.shifts (shift_date);

create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid not null references public.shifts (id) on delete cascade,
  person_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id),
  constraint one_place_per_person_per_shift unique (shift_id, person_id)
);

create index assignments_by_person on public.assignments (person_id);

-- Health data lives here, and nowhere else. 'excused' covers illness and every
-- other accepted reason, so the row never states which one it was.
create table public.attendance (
  assignment_id    uuid primary key references public.assignments (id) on delete cascade,
  status           attendance_status not null,
  credited_minutes integer not null check (credited_minutes between 0 and 1440), -- filled by trigger when sent empty
  recorded_at      timestamptz not null default now(),
  recorded_by      uuid references public.profiles (id)
);

-- Anything the shifts cannot explain: hours carried in, a correction, a swap.
create table public.adjustments (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.profiles (id) on delete cascade,
  minutes     integer not null check (minutes <> 0 and minutes between -6000 and 6000),
  reason      text not null check (length(btrim(reason)) between 1 and 300),
  happened_on date not null default current_date,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create index adjustments_by_person on public.adjustments (person_id);

-- The two fixed days each week are described once here, then a week is filled
-- from them in one action.
create table public.shift_templates (
  id         uuid primary key default gen_random_uuid(),
  area_id    uuid not null references public.areas (id) on delete cascade,
  weekday    integer not null check (weekday between 1 and 7), -- 1 is Monday
  starts_at  time not null,
  ends_at    time not null,
  places     integer not null check (places between 1 and 50),
  constraint template_ends_after_it_starts check (ends_at > starts_at),
  constraint one_template_per_area_and_time unique (area_id, weekday, starts_at)
);
