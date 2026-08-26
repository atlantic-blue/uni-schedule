# Work schedule, resume context

```state
stage: three stacked pull requests open, none merged, nothing deployed
next: raise the GitHub Actions spending limit on atlantic-blue so the Check workflow can run
blocked: GitHub Actions refuses to start any job on this account, so continuous integration has never run
blocked: the deploy needs credentials for the account that creates the OpenID Connect role, and they are not on this workspace
prs:
  - https://github.com/atlantic-blue/uni-schedule/pull/1
  - https://github.com/atlantic-blue/uni-schedule/pull/2
  - https://github.com/atlantic-blue/uni-schedule/pull/3
steps:
  - [x] database schema, policies and hours, tested against a real Postgres (pull request 1)
  - [x] the five screens, running on demo data (pull request 2)
  - [x] continuous integration and deploy workflows, plus bootstrap Terraform (pull request 3)
  - [ ] get continuous integration running at all, then green on all three
  - [ ] merge bottom up with merge commits
  - [ ] bootstrap the Amazon Web Services role, once, with infrastructure credentials
  - [ ] first deploy, then open the site and read what it says
  - [ ] open the app in a browser and look at it, which has never been done
  - [ ] answer the six domain questions and correct the assumptions below
```

## The goal

Replace a paper work schedule for about 100 to 140 students and guests at a
university. Twice a week people are assigned to work areas. Track hours, minus
hours and absences. Students see their own schedule through a link or a printed
code.

## Assumptions, none confirmed

The six questions were asked and not answered, so the build carries these. Each
one is cheap to change and each one is written down where it lives.

1. Minus hours are a shortfall against a target per person, held in
   `profiles.target_hours`. A guest has a target of zero.
2. An excused absence still counts towards the target. A missed shift counts
   nothing. This is `public.default_credit` in `0002_functions.sql`, and it is
   four lines.
3. The two fixed days are Tuesday and Friday, 16:00 to 20:00, described in
   `shift_templates` and filled into a week by `public.generate_week`.
4. Everybody signed in sees the whole roster, because the paper sheet on the wall
   already did. Absence and hours are private to the person and the
   administrators.
5. Sign in is a link sent by email, so a guest with no university address can
   still get in.
6. The project belongs in an European Union region.

## What is built

- `supabase/migrations`: three files, applied in order. Schema, functions and
  the hours view, then row level security.
- `src/lib/api.ts`: what the screens may do. Two implementations, Supabase and a
  demo store held in memory.
- `src/routes`: my schedule, assign, attendance, hours, print.
- `tests`: 37 tests. The policy tests run the real migrations against Postgres
  compiled to WebAssembly, so they test the policies rather than a copy.

## Decisions worth knowing

- Who is assigned and whether they turned up are two tables, not one column.
  A status of excused often means illness, which the General Data Protection
  Regulation treats as a special category, so it never sits in a table the whole
  group can read.
- The credit for a shift is calculated by a database trigger, never by the
  browser, so the two can never disagree about what a shift was worth.
- The assign screen offers whoever is furthest behind their target first. That is
  the decision the person filling the sheet is trying to make.
- The demo store copies the permission rules so the screens behave the same way.
  It is not the guarantee. `tests/rls.test.ts` is, and a mutation of one policy
  was seen to turn it red.

## Not done, and worth knowing before trusting any of this

- Nobody has run this against a real Supabase project. The Supabase
  implementation is typed, built and never executed against the service.
- Nobody has opened the app in a browser. Chromium would not install in the
  sandbox it was built in. The tests drive the real components in a simulated
  document, and the built bundle serves over HTTP, which is a weaker claim.
- Continuous integration has never run. The workflow is written and the account
  refuses to start a job, saying the spending limit needs raising. Every gate was
  run locally instead, in a clean checkout of each commit on its own.
- Adding and removing people is done in the Supabase dashboard, not in the app.
- There is no notification when a shift is near.

## Amazon Web Services, checked live on 2026-08-23

- The credentials on this workspace are root access keys for account
  230345688874. Root can create the provider and the role. The account is in no
  organisation, so no service control policy stands in the way.
- The reason the bootstrap is not run here is a rule, not a permission: nothing
  applies to Amazon Web Services from the sandbox, and root keys should not be
  the thing that deploys. Delete them once the role exists.
- The GitHub OpenID Connect provider **already exists** in that account:
  `arn:aws:iam::230345688874:oidc-provider/token.actions.githubusercontent.com`.
  Creating a second one is an error, so `create_oidc_provider` stays false and
  the Terraform reads the existing one.
