# Beth, data model

Derived from `beth-app-requirements-transcribed.md` (Prototype v4, Alisa Henning,
Bogenhofen Adventist College) and from the prototype `beth-standalone-en.html`.
Where the two disagree, the requirements document wins.

Store: one DynamoDB table, `beth`. Accounts in Amazon Cognito. Api and the
iCalendar proxy in Lambda. Site in Amazon Simple Storage Service behind CloudFront.

Scale: about 50 people. Two sessions a week. A semester of about 20 weeks is
about 2,000 work entries. Every number below is small on purpose, because the
scale allows a simple key design and forbids an index that no screen asks for.

---

## 1. Access patterns

Each one names the screen or rule in the requirements document that asks for it.

**Accounts and sign in**

- A1 Register a name and a password. Section 2.
- A2 Sign in by name and password. Section 2.
- A3 List the Leiter accounts waiting for approval. Section 2.
- A4 Approve or reject one pending Leiter account. Section 2.
- A5 Resolve the signed in account to its Bogianer profile. Section 4.5.
- A6 Leave the Head-Leiter out of every list. Section 2.

**Home dashboard, section 4.1**

- H1 Count present, excused and unexcused for one chosen day.
- H2 Name the people in each of those three groups for that day.
- H3 Read one month of days at once, for the calendar cells.
- H4 Read the campus calendar events for a month, and a person's private ones.

**Planning whiteboard, section 4.2**

- P1 List the people with no board this semester.
- P2 List the boards with their members, in order, with task detail and the star.
- P3 Move a person onto a board, and off every other board.
- P4 Move the star to another member.
- P5 Change one member's task detail.
- P6 Open one person's profile from inside planning.
- P7 Planned. Show who is absent today so their area can be filled again.

**People list, section 4.3**

- L1 List everybody for the current semester, sorted by last name.
- L2 Jump to a letter. Served in the browser from L1, about 50 rows.
- L3 Add a person.

**Profile, section 4.4**

- F1 Read one person's profile.
- F2 Read one person's entries for a semester, newest first.
- F3 Read one person's entries for one month, for the calendar view.
- F4 Total hours, target hours and minus hour days for one person for a semester.
- F5 Export one person's entries as comma separated values.
- F6 Read the evaluations that belong to those entries.

**Own view, section 4.5**

- B1 A Bogianer reads their own profile and their own entries, and nothing else.
- B2 An Aufsicht reads and writes entries for the members of their own group.
- B3 A Bogianer's minus figures reach that person, their Aufsicht and the Leiter.

**Entries and rules, sections 3 and 6**

- E1 Write one entry for one person on one date.
- E2 Change or delete one entry.
- E3 Suggest an absence reason from the ones used before.
- E4 Write an extra hours entry on any date.
- E5 Write the evaluation that belongs to one entry.

**Areas and semesters, sections 5 and 6**

- G1 List the named areas for the group picker.
- S1 Read the current semester.
- S2 List the semesters.

---

## 2. Key schema

One table. Partition key `pk`, sort key `sk`. Two secondary indexes, and no more,
because no third access pattern needs one.

**Base table.** `pk` groups everything that belongs to one person, one semester or
one calendar, so the common reads are one query with no index.

- F1, F2, F3, F4, F5, F6 all read `pk = PROFILE#<profileId>`.
  `sk begins_with ENTRY#` returns the entries and their evaluations together, in
  date order, in one query, because an evaluation sorts directly after its entry.
  A semester is `sk between ENTRY#<startsOn> and ENTRY#<endsOn>~`.
- P2 reads `pk = SEMESTER#<semesterId>`, `sk begins_with BOARD#`.
- E3 reads `pk = REASONS`.
- H4 reads `pk = CALENDAR#<calendarId>`, `sk between EVENT#<from> and EVENT#<to>~`.

**GSI1, the collection index.** `gsi1pk` names a collection, `gsi1sk` sorts it.

- `gsi1pk = ENROLMENTS#<semesterId>` sorted by last name serves L1, L2 and P1.
- `gsi1pk = AREAS` sorted by display order serves G1.
- `gsi1pk = SEMESTERS` sorted by start date serves S1 and S2.
- `gsi1pk = ACCOUNTS#PENDING` serves A3. Sparse: the attribute is removed when the
  account is approved, so the index holds only the queue.

**GSI2, entries by month.** `gsi2pk = MONTH#<yyyy-mm>`, `gsi2sk = <date>#PROFILE#<profileId>`.

- H3 reads one month in one query.
- H1 and H2 read one day with `begins_with(gsi2sk, '<date>')`.
- Sparse: only work entries carry these attributes, so evaluations, boards and
  profiles never appear in it.
- Partition size: about 50 people times about 8 sessions a month, so about 400
  items. Well inside one partition.

**Indexes considered and rejected.**

- An index on group, for B2. Not needed. The board item already lists its members,
  and the caller's own enrolment already carries `groupCode`.
- An index on account by username, for A2. Not needed. Cognito owns sign in.
- An index for the minus hour ranking. No screen asks for a ranking.

---

## 3. Entities and attributes

Types are DynamoDB types: S string, N number, BOOL boolean, L list, M map.
Every item carries `pk`, `sk`, `type`, `createdAt` and `updatedAt`.

### Profile, the person

Stable facts only. What changes each semester lives on the enrolment.

    pk           S   PROFILE#<profileId>
    sk           S   PROFILE#<profileId>
    type         S   "Profile"
    profileId    S   uuid v4
    firstName    S
    lastName     S
    lastNameLower  S   folded for sorting, umlauts mapped, ae oe ue ss
    firstNameLower S
    schoolClass  S   optional
    schoolYear   S   optional
    department   S   optional
    birthday     S   optional, ISO date, or --MM-DD when the year is unknown
    accountId    S   optional, the Cognito subject, absent for a person with no login
    active       BOOL
    createdAt    S   ISO timestamp
    updatedAt    S   ISO timestamp

### Enrolment, one person in one semester

Section 5 assigns areas annually, and section 3 sets target hours per semester, so
this is its own item. It is what the semester setup wizard writes in bulk.

    pk           S   PROFILE#<profileId>
    sk           S   ENROLMENT#<semesterId>
    type         S   "Enrolment"
    profileId    S
    semesterId   S
    firstName    S   copied from the profile, so a list needs one query
    lastName     S   copied
    lastNameLower  S copied
    groupType    S   "shared" | "individual"
    groupCode    S   optional, an area code, absent when groupType is "individual"
    roleType     S   "ts_intern" | "ts_extern" | "org_intern" | "org_extern"
    targetHours  N   default from roleType, editable
    defaultSpecialStatus S optional, for example "Projekt Salzburg"
    isAufsicht   BOOL
    gsi1pk       S   ENROLMENTS#<semesterId>
    gsi1sk       S   <lastNameLower>#<firstNameLower>#<profileId>

### WorkEntry, one person, one session

    pk            S   PROFILE#<profileId>
    sk            S   ENTRY#<date>#<entryId>
    type          S   "WorkEntry"
    entryId       S   uuid v4
    profileId     S
    semesterId    S
    date          S   ISO date
    weekday       N   1 Monday to 7 Sunday
    entryType     S   "regular" | "extra"
    suggestedHours N  optional, what rule R1 produced, kept so an edit is visible
    durationHours N   what the session was worth, editable
    present       BOOL
    punctuality   S   optional, "on_time" | "late", only when present
    excused       BOOL optional, only when absent
    reason        S   optional, only when absent
    isBirthdayExcuse BOOL
    comment       S   optional
    specialStatus S   optional, the per entry override
    creditedHours N   written by rule R3
    minusSessions N   written by rule R2, 0 or 1
    createdBy     S   accountId
    gsi2pk        S   MONTH#<yyyy-mm>
    gsi2sk        S   <date>#PROFILE#<profileId>

### Evaluation, one per entry, written by a Leiter

Its own item, not a field on the entry, because an Aufsicht may write the entry and
may not write the evaluation. Separate items make that a permission on an item
rather than a rule about which fields an update expression may name.

    pk            S   PROFILE#<profileId>
    sk            S   ENTRY#<date>#<entryId>#EVAL
    type          S   "Evaluation"
    entryId       S
    thoroughness  N   1 superficial to 5 thorough
    motivation    N   1 to 5
    interpersonalConduct N 1 to 5
    taskCompliance BOOL
    note          S   optional
    evaluatedBy   S   accountId, must be a Leiter
    evaluatedAt   S

No index attributes, so it never appears in GSI2. It sorts directly after its own
entry, so one query returns both.

### Area, the named list from section 5

    pk        S   AREA#<areaCode>
    sk        S   AREA#<areaCode>
    type      S   "Area"
    areaCode  S   lower case ASCII, for example "kueche"
    name      S   the German display name, for example "Küche"
    sortOrder N
    active    BOOL
    note      S   optional, for example "für Gebetswoche"
    gsi1pk    S   AREAS
    gsi1sk    S   <sortOrder padded to 3>#<areaCode>

Seeded, 26 from the document: BGM, Bibliothek, Bogi-Zeitung, BH, EDV, Garten,
Gemeindezentrum, Hausmeisterei, Hauswirtschaft, Kapelle, Küche, Mensa, MH,
Memory-Buch, Müllaktion, Orchesteraufbau, Park, Pikadeum, Schloss, Speisesaal,
Spülküche, Turnhalle, Sabbatschule-Aufnahmen, Dekoteam, Technik, Projekt.

### Board, one area in one semester, the planning column

    pk         S   SEMESTER#<semesterId>
    sk         S   BOARD#<areaCode>
    type       S   "Board"
    semesterId S
    areaCode   S
    name       S
    members    L   of M, each:
                     profileId  S
                     firstName  S
                     lastName   S
                     taskDetail S optional
                     isAufsicht BOOL
                     position   N
    version    N   raised on every write, used as the condition on a move

Members are embedded because a board holds at most about ten people, it is always
read whole, and the order decides who starts as Aufsicht. A move is one
transaction over two board items and one enrolment item.

### Semester

    pk         S   SEMESTER#<semesterId>
    sk         S   SEMESTER#<semesterId>
    type       S   "Semester"
    semesterId S   for example "2026-ws"
    name       S   for example "Wintersemester 2026/27"
    startsOn   S   ISO date
    endsOn     S   ISO date
    isCurrent  BOOL
    gsi1pk     S   SEMESTERS
    gsi1sk     S   <startsOn>

### Account

Cognito holds the name and the hashed password. This item holds what Cognito does
not: the approval queue and the link to a profile.

    pk             S   ACCOUNT#<accountId>
    sk             S   ACCOUNT#<accountId>
    type           S   "Account"
    accountId      S   the Cognito subject
    username       S   the name the person types
    role           S   "head_leiter" | "leiter" | "bogianer"
    approvalStatus S   "approved" | "pending"
    profileId      S   optional, set for a bogianer
    hidden         BOOL true only for the seeded Head-Leiter
    gsi1pk         S   ACCOUNTS#PENDING, removed when approved
    gsi1sk         S   <createdAt>#<accountId>

`aufsicht` is not stored here. It is `Enrolment.isAufsicht`, which the planning
board owns, and the effective role is worked out per request:
`role === "bogianer" && enrolment.isAufsicht` means Aufsicht. One source of truth,
so the board and the role cannot drift apart.

### ReasonSuggestion, the autocomplete history

    pk         S   REASONS
    sk         S   REASON#<normalised text>
    type       S   "ReasonSuggestion"
    text       S
    useCount   N
    lastUsedAt S

### CalendarSource and CalendarEvent

    pk          S   CALENDAR#<calendarId>
    sk          S   SOURCE
    type        S   "CalendarSource"
    calendarId  S   "CAMPUS", or USER#<profileId>#<n>
    url         S
    scope       S   "campus" | "private"
    ownerProfileId S optional
    lastFetchedAt  S
    lastStatus     S

    pk         S   CALENDAR#<calendarId>
    sk         S   EVENT#<date>#<uid>
    type       S   "CalendarEvent"
    calendarId S
    uid        S
    date       S   ISO date, one item per day of a multi day event
    title      S
    ttl        N   epoch seconds, so the cache clears itself

---

## 4. Rules, each one tight enough to fail a test

**R1 Session duration.** Tuesday, 3.0 hours, all year. Friday, 3.0 hours while
European daylight saving is active, and 2.5 hours while it is not. Daylight saving
is active from the last Sunday in March up to, and not including, the last Sunday
in October of the same year. Any other weekday produces no suggestion. The
suggestion is only a suggestion: `durationHours` may be set to anything from 0 up.

**R2 Minus sessions.** `minusSessions` is 1 when `entryType` is "regular" and
`present` is false and `excused` is false. It is 0 in every other case. A person's
minus hour days for a semester is the sum over their entries in that date range.
It is never calculated from target hours.

**R3 Credited hours.** `creditedHours` is `durationHours` when present, and 0 when
absent, for both entry types. Total hours for a semester is the sum.

**R4 Birthday exception.** When the entry date matches the person's birthday by
month and day, and the weekday is Tuesday or Friday, and `present` is false, then
`excused` is forced to true, `reason` is forced to "Geburtstag" and
`isBirthdayExcuse` is set. The api refuses a request that tries to set `excused`
false on such an entry.

**R5 Extra hours offset minus hours.** `extraHours` is the sum of `creditedHours`
over entries with `entryType` "extra". `minusHoursRaw` is the sum of
`durationHours` over the entries that produced a minus session. `minusHoursOpen` is
`max(0, minusHoursRaw - extraHours)`. The headline figure stays the count of minus
hour days.

**R6 Target hours by role type.** ts_intern 131.5, ts_extern 79, org_intern 146.5,
org_extern 94. Written as the default on a new enrolment, and editable, because
section 3 says they vary by role and by holidays.

**R7 Authorisation, enforced in the api and in the access policy.**

- head_leiter reads and writes everything, and never appears in a list response.
- leiter reads and writes every profile, enrolment, entry and evaluation, and
  approves pending Leiter accounts.
- aufsicht reads and writes entries for the profiles whose current enrolment has
  the same `groupCode`, and reads their own profile. May not write an evaluation.
- bogianer reads their own profile, enrolment, entries and evaluations, and writes
  nothing.
- Only leiter and head_leiter write an Evaluation.
- Minus figures for a person go to that person and to a Leiter, and to nobody
  else. An Aufsicht sees the sessions they record for their own group, and never
  another person's running total. Section 6 says the number is anonymous from
  everybody else, and section 2 gives the Aufsicht their group, so the two readings
  collide on exactly this number. The tighter one is the default here. See the open
  question below.

**R8 Board and Aufsicht.** Placing a person on a board takes them off every other
board in that semester. The first member of an empty board gets `isAufsicht`. A
board with members has exactly one member with `isAufsicht`. Removing that member
promotes the next by `position`. The same write updates the person's enrolment
`groupCode` and `isAufsicht`.

**R9 Reason history.** Every absence reason other than "Geburtstag" is written into
the REASONS partition, and `useCount` goes up by one.

**R10 Head-Leiter seed.** Created on first launch with fixed credentials,
`hidden` true, and left out of every list endpoint.

---

## 5. Diagram

Mermaid is not used here. Rule 22 says a diagram must be rendered through the
mermaid command line tool before it ships, and that tool needs a browser this
sandbox cannot install, so this is plain text instead.

    TABLE beth
    ────────────────────────────────────────────────────────────────────────
    pk                        sk                              entity
    ────────────────────────────────────────────────────────────────────────
    PROFILE#<id>              PROFILE#<id>                    Profile
    PROFILE#<id>              ENROLMENT#<semesterId>          Enrolment
    PROFILE#<id>              ENTRY#<date>#<entryId>          WorkEntry
    PROFILE#<id>              ENTRY#<date>#<entryId>#EVAL     Evaluation
    SEMESTER#<semesterId>     SEMESTER#<semesterId>           Semester
    SEMESTER#<semesterId>     BOARD#<areaCode>                Board  (members[])
    AREA#<areaCode>           AREA#<areaCode>                 Area
    ACCOUNT#<accountId>       ACCOUNT#<accountId>             Account
    REASONS                   REASON#<text>                   ReasonSuggestion
    CALENDAR#<calendarId>     SOURCE                          CalendarSource
    CALENDAR#<calendarId>     EVENT#<date>#<uid>              CalendarEvent

    GSI1  gsi1pk / gsi1sk                       serves
    ────────────────────────────────────────────────────────────────────────
    ENROLMENTS#<semesterId> / <lastName>...     L1 list, L2 jump, P1 unassigned
    AREAS / <sortOrder>#<areaCode>              G1 area picker
    SEMESTERS / <startsOn>                      S1 current, S2 list
    ACCOUNTS#PENDING / <createdAt>#<id>         A3 approval queue   (sparse)

    GSI2  gsi2pk / gsi2sk                       serves
    ────────────────────────────────────────────────────────────────────────
    MONTH#<yyyy-mm> / <date>#PROFILE#<id>       H3 month, H1 and H2 one day
                                                (sparse, work entries only)

    ONE QUERY, ONE SCREEN
    ────────────────────────────────────────────────────────────────────────
    Profile screen    pk=PROFILE#<id>, sk begins_with ENTRY#
                      → entries and their evaluations, date order, one call
    Planning          pk=SEMESTER#<sid>, sk begins_with BOARD#   → all boards
                      GSI1 ENROLMENTS#<sid>                      → all people
                      unassigned = people minus board members, in the browser
    Dashboard day     GSI2 MONTH#<yyyy-mm>, begins_with(gsi2sk, <date>)
    Dashboard month   GSI2 MONTH#<yyyy-mm>
    People list       GSI1 ENROLMENTS#<sid>, already sorted by last name

    ACCESS
    ────────────────────────────────────────────────────────────────────────
    Cognito  name + password, groups head_leiter | leiter | bogianer
             ↓ token
    Lambda   works out the effective role, aufsicht = bogianer + isAufsicht
             ↓ applies R7 before every read and every write
    DynamoDB one table, condition expressions for R8

---

## 6. What I chose, and what is still open for Julian

**Choices I made, each reversible before implementation.**

1. Profile and Enrolment are two items, not one. The document assigns areas
   annually and sets target hours per semester, so last semester has to survive.
2. Evaluation is its own item, so that "an Aufsicht may not evaluate" is a
   permission on an item rather than a rule about field names.
3. Board members are embedded in the board item, because a board is small, is
   always read whole, and its order decides the first Aufsicht.
4. `aufsicht` is derived, not stored on the account, so the planning board stays
   the only place that decides it.

**Open, and I need an answer.**

1. **R5, the unit.** Section 6 counts minus hours per missed session, and also says
   extra hours offset them and the remainder is worked off or paid. A count and an
   amount of hours cannot offset each other without a conversion. I convert at the
   missed session's own duration, so one missed Friday in winter is 2.5 hours owed.
   Confirm, or give the rule you use.
2. **Class, year, department.** Section 3 lists three words. The prototype has one
   field labelled "Class / Year". I modelled three optional fields. Say if it is one.
3. **Guests.** The prototype has Guest, Trial Pupil, Trial Student, Volunteer,
   Visitor and Other, kept in the department field. The requirements document never
   mentions them. I left them out. Say whether they are still needed.
4. **Evaluation scale.** The document names thoroughness, motivation and
   interpersonal conduct without a scale. I used 1 to 5. Say if it is 1 to 4, or a
   word list.
5. **Area count.** The document lists 26 names. You said about 28. Two may have
   been lost in transcription. Check the list in section 3 above.
6. **Umlauts.** The transcription writes Kueche, Muellaktion and Spuelkueche. I
   assumed the real names carry umlauts and kept the ASCII form as the code.
7. **Semester dates.** Nothing states when a semester starts and ends. The setup
   wizard needs them.
8. **Does an Aufsicht see a group member's minus total?** Section 2 gives the
   Aufsicht read and write over their own group. Section 6 says a Bogianer's minus
   number is anonymous from everybody else. I read the second as the narrower and
   later rule, so an Aufsicht records attendance but never sees a running total.
   Say if the college works the other way.
