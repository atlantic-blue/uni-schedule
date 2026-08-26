# Work schedule

A web app that replaces the paper work schedule. Twice a week students and guests
are assigned to work areas. This app makes the assignment, records what happened,
and counts the hours.

About 100 to 140 people. One link, or a printed code on the wall. No app store.

## Run it now, with no account

```
npm install
npm run dev
```

With no Supabase settings the app starts on demo data: 118 invented people, five
areas, four weeks of shifts. It is held in memory and a reload starts it again.
Sign in as `admin@example.edu` to see the whole app.

## What each screen does

- **My schedule**: your next shifts, who is on them with you, your hours.
- **Assign**: fill a week. The list of people offers whoever is furthest behind
  their target first, and hides anybody already working that day.
- **Attendance**: mark worked, excused or missed, after the shift.
- **Hours**: worked against target, and minus hours. An administrator can correct
  a balance and must give a reason.
- **Print**: the sheet for the wall, names only.

## Connect it to Supabase

1. Create a project in an European Union region.
2. Run the three files in `supabase/migrations` in order, in the SQL editor.
3. Run `supabase/seed.sql`, after you change the areas and the times to your own.
4. Copy `.env.example` to `.env.local` and fill in the project url and the
   anon key.
5. Sign in once with your own address. This makes your profile.
6. Make yourself the administrator. In the SQL editor:

```sql
update public.profiles set role = 'admin' where id = (
  select id from auth.users where email = 'you@your-university.edu'
);
```

After that you add everybody else from the app.

## Who can see what

The database decides, not the browser. The rules are in
`supabase/migrations/0003_policies.sql` and `tests/rls.test.ts` proves them
against a real Postgres.

- Names, areas, shifts and who is assigned: anybody signed in. The paper sheet on
  the wall showed the same thing.
- Whether somebody turned up, and whether an absence was excused: only that
  person and an administrator.
- Target hours and hours balance: only that person and an administrator.
- A student can correct their own name. Only an administrator can change a role,
  a target or an assignment.

## Absence is health data

An absence marked excused often means illness. Under the General Data Protection
Regulation that is a special category, so the app stores as little as it can.

- The status is one word: `worked`, `excused` or `absent`. There is no field for
  a reason, and no place to write a diagnosis.
- The printed sheet carries names and places only, never a status.
- Put the project in an European Union region.
- Ask your data protection officer before you load real names.

## Tests

```
npm run typecheck
npm run lint
npm test
```

37 tests. The policy tests start a real Postgres in memory, apply the migrations
that ship, and try to read what a student must not read.

## Deploy

Continuous integration builds and tests every push. The deploy job is in
`.github/workflows/deploy.yml` and waits for the Amazon Web Services role
described in `infra/README.md`.
