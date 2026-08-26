-- Beth. The work afternoon programme at Bogenhofen Adventist College.
--
-- These migrations have never been applied to any database, so they are edited
-- in place. Once a real Supabase project exists, every change becomes a new
-- numbered file instead.
--
-- The model comes from reference/beth-app-requirements-transcribed.md. DOMAIN.md
-- explains each decision and lists what the document leaves open.

create type public.app_role       as enum ('head_leiter', 'leiter', 'aufsicht', 'bogianer');
create type public.account_status as enum ('pending', 'approved');
create type public.group_kind     as enum ('shared', 'individual');
create type public.role_type      as enum ('ts_intern', 'ts_extern', 'org_intern', 'org_extern');
create type public.entry_kind     as enum ('regular', 'extra');
create type public.punctuality    as enum ('on_time', 'late');

-- The areas are assigned once a year at the start of the semester. The full list
-- is in migration 0004. A Leiter may add more.
create table public.areas (
  id         uuid primary key default gen_random_uuid(),
  name       text    not null unique check (length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  active     boolean not null default true
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,

  -- People sign in with a name, never an address. Supabase needs an address, so
  -- the app makes an internal one and never shows it. This is the name they type.
  login_name text           not null unique check (length(btrim(login_name)) between 2 and 60),
  role       public.app_role       not null default 'bogianer',
  status     public.account_status not null default 'approved',
  -- The Head-Leiter appears in no list. Every list reads people_directory.
  hidden     boolean        not null default false,

  first_name text not null check (length(btrim(first_name)) between 1 and 60),
  last_name  text not null check (length(btrim(last_name))  between 1 and 60),

  -- The document names three. The prototype has one free text field. See
  -- DOMAIN.md, open question 1.
  school_class text,
  school_year  text,
  department   text,

  birthday date,

  group_kind public.group_kind not null default 'shared',
  area_id    uuid references public.areas (id) on delete set null,
  -- The optional detail on the person card in the planning board.
  task_detail text,
  -- The star. One per area, enforced below.
  is_aufsicht boolean not null default false,

  role_type    public.role_type,
  -- Filled from role_type by a trigger, then editable, because the document says
  -- the number varies by role and by holidays.
  target_hours numeric(6, 2) not null default 0 check (target_hours >= 0),

  default_special_status text,

  active     boolean     not null default true,
  created_at timestamptz not null default now(),

  constraint shared_group_needs_an_area check (
    (group_kind = 'shared' and area_id is not null)
    or (group_kind = 'individual' and area_id is null)
  ),
  constraint aufsicht_needs_an_area check (not is_aufsicht or area_id is not null)
);

-- The first person put on a board becomes the Aufsicht, and it can be moved to
-- somebody else. Never two at once.
create unique index one_aufsicht_per_area
  on public.profiles (area_id) where is_aufsicht;

create index profiles_by_area on public.profiles (area_id);

-- One entry per person per session.
create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  entry_kind public.entry_kind not null default 'regular',

  -- What the session was worth. Suggested from the season and always editable,
  -- because somebody arrives late, leaves early or falls ill. It stays on an
  -- absent entry too, because an unexcused absence owes exactly this much.
  duration_hours numeric(4, 2) not null check (duration_hours >= 0 and duration_hours <= 24),

  present  boolean not null,
  excused  boolean not null default false,
  reason   text,
  punctuality public.punctuality,
  comment  text,
  -- Overrides the profile default for this entry.
  special_status text,
  is_birthday boolean not null default false,

  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),

  constraint a_present_entry_has_punctuality_and_no_reason check (
    not present or (punctuality is not null and excused = false and reason is null)
  ),
  constraint an_absent_entry_has_no_punctuality check (
    present or punctuality is null
  )
);

-- One regular session per person per day. Extra hours are not limited, because
-- somebody can work twice outside the schedule.
create unique index one_regular_entry_per_person_per_day
  on public.entries (person_id, entry_date) where entry_kind = 'regular';

create index entries_by_person on public.entries (person_id);
create index entries_by_date   on public.entries (entry_date);

-- Filled by a Leiter. The document lists this under the data model and again
-- under planned items, so the table is here and the screen is minimal.
create table public.evaluations (
  entry_id              uuid primary key references public.entries (id) on delete cascade,
  thoroughness          smallint check (thoroughness between 1 and 5),
  motivation            smallint check (motivation between 1 and 5),
  interpersonal_conduct smallint check (interpersonal_conduct between 1 and 5),
  task_compliance       boolean,
  evaluated_by          uuid references public.profiles (id),
  evaluated_at          timestamptz not null default now()
);

-- A shared campus calendar, plus optional private calendars. owner_id null means
-- the shared one. The fetch itself runs in a Supabase edge function, because the
-- browser cannot read another origin's iCalendar file.
create table public.calendar_feeds (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  url        text not null check (url like 'https://%'),
  created_at timestamptz not null default now()
);

create index calendar_feeds_by_owner on public.calendar_feeds (owner_id);
