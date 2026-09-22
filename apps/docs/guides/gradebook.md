# Teacher gradebook

The Gradebook is always available to teachers. There is no classroom activation
step. Teachers who ignore points can continue their existing workflow. Students
have no gradebook interface, grading notifications, or access to its API.

## New challenges only

New challenges created through manual creation, AI creation, or the wizard save
an immutable completion policy with their existing creation write:

```json
{
  "pointsPossible": 5,
  "method": "COMPLETION",
  "policyVersion": 1,
  "includedAt": "2026-09-16T12:00:00.000Z"
}
```

This is stored as the challenge's `grading` field. The classroom's optional
`gradingSettings.defaultChallengePoints` supplies the default; an absent setting
resolves to 5. All creation APIs accept optional top-level `pointsPossible`.
For the wizard this is beside `draft` and `schedule`; it is not AI-generated
content. Zero is valid. Values must be nonnegative and have at most two decimals.

The maximum freezes at creation, including while a challenge is a draft.
Changing a classroom default affects future challenges only. Existing challenge
updates reject `pointsPossible` and `grading`. Existing documents have no
grading policy and remain ungraded; reading, editing, or reopening them does not
backfill one. Initialization/week-zero records are excluded.

## Calculation

The gradebook reads current decisions and enrollment records on demand. No grade
calculation is added to submission saves, schedules, simulation jobs, receipts,
notifications, or retry/recovery processing.

| Evidence | Effective grade |
| --- | --- |
| `MANUAL` decision | Full completion points, even if simulation processing failed |
| Automated decision before deadline | Pending, excluded from current totals |
| `DEFAULTS`, `AI`, `AI_FALLBACK`, or `FORWARDED_PREVIOUS` after deadline | Zero |
| Missing decision before deadline | Pending |
| Missing decision after deadline, including `SKIP` | Zero |
| Teacher `POINTS` adjustment | Assigned points, from zero to the maximum |
| Teacher `EXCUSED` adjustment | Excused, excluded from totals |
| Challenge exclusion | Excluded from every student's totals |
| Work due before enrollment, without manual work or an adjustment | Not applicable |
| Unpublished/future challenge | Upcoming, excluded from totals |
| No grading policy | Ungraded, excluded from totals |

A student's successful edit of an automated decision becomes `MANUAL` through
the existing submission behavior. Accepted late submissions earn full credit;
grading does not change late-submission acceptance or apply simulation penalty
settings. Decisions without generation metadata retain the legacy convention of
student participation and are labeled `LEGACY_MANUAL`.

The cutoff is `submissionDeadlineAt`, falling back to `closeSubmissionsAt`. With
neither timestamp, an active student's missing work becomes zero when the
challenge locks or closes. Deadline changes take effect on the next read and
may return missing work to pending. They never change frozen point maxima.

Student submission time is reported as unknown: the existing `submittedAt` can
refer to the original automatic record rather than the student's later edit.
Unknown enrollment dates are flagged without inventing exemptions. Removed
students are hidden by default; including them stops new missing-work penalties
after their removal. An undated closure cannot retrospectively establish a
missing grade for a removed student. Re-enrollments are deduplicated by member
ID and preserve the earliest recorded join and existing work. Grades do not
transfer to another classroom.

Totals sum integer hundredths of points. The current percentage includes early
completed work and due zeros, but excludes pending, excused, not-applicable,
upcoming, ungraded, and excluded work. A zero denominator has no percentage.
Totals and exports follow the selected challenge filter.

## Teacher changes and API

All endpoints below use the prefix
`/v1/admin/class/:classroomId/gradebook`. They require existing organization
teacher authentication plus classroom administration access. JSON responses
wrap results in `data`; errors use `error`. Responses are private and not cached.

| Method and suffix | Purpose |
| --- | --- |
| `GET /` | Read paginated rows, challenge columns, totals, and `evaluatedAt` |
| `GET /settings` | Read the resolved classroom default |
| `PUT /settings` | Save `{ "defaultChallengePoints": 5 }` for future challenges |
| `PUT /challenges/:challengeId/students/:studentId/adjustment` | Assign points, excuse, or restore automatic grading |
| `GET /challenges/:challengeId/students/:studentId/history` | Read adjustment history |
| `PUT /challenges/:challengeId/exclusion` | Exclude or restore a challenge |
| `GET /challenges/:challengeId/history` | Read challenge exclusion history |
| `POST /export` | Download gradebook or detailed CSV |

`studentId` in route parameters means the stable SCALE member ID, not the
university's student number. Both are provided separately in the gradebook.

Read filters: `page` (one-based), `limit` (1–100, default 50), `search` (name or
student number), `sort` (`name`, `earned`, `percentage`), `direction` (`asc` or
`desc`), `includeRemoved` (default false), and `challengeIds` (comma-separated IDs
for GET, or an array for export). Name sorting uses last name then first name;
unavailable percentages sort last. No challenge filter means all challenges.

Each cell separates `pointsPossible`, `automaticPoints`, `effectivePoints`,
`status`, `reasonCode`, `generationMethod`, `includedInTotal`, `policyVersion`,
adjustment, and revision. A null numeric score is distinct from zero.

Example adjustment:

```json
{
  "mode": "POINTS",
  "points": 3.5,
  "reason": "Reviewed the student's submission",
  "expectedRevision": 0
}
```

Modes are `POINTS`, `EXCUSED`, and `AUTOMATIC`. Restoring automatic grading records
a new history entry rather than deleting old changes. Exclusions accept
`excluded`, `reason`, and `expectedRevision`. Reasons are required and limited
to 2,000 characters. Initial revision is zero. Concurrent writes return `409`;
refresh and review before retrying. History returns the latest 100 changes and
`nextBefore`, which can be passed as `before` to fetch earlier changes.

Adjustment and exclusion state/history are updated atomically in separate
collections. They never rewrite a student's decision. They persist through
resubmissions and simulation resets. Drafts cannot receive student adjustments,
and historical ungraded challenges cannot be activated this semester.

## CSV

Send the same filters to `POST /export` with `layout: "gradebook"` (default) or
`layout: "detailed"`. Pagination is ignored so every matching student is
exported. The first layout has one row per student; detailed has one row per
student/challenge. Matrix headers include unique challenge IDs and maxima.

The matrix uses explicit nonnumeric status labels; detailed exports use separate
status and numeric fields. Only an actual zero grade is exported as numeric zero.
Both include stable identifiers and an evaluation timestamp, use UTF-8 and CSV
escaping, and neutralize formula-like text. Import student identifiers as **text**
in spreadsheet software to retain leading zeros. Files are authenticated direct
downloads, not public URLs or email attachments.

These are current previews, not finalized grade snapshots. A fresh export can
differ from an earlier screen. Concurrent source changes can occur during a
long export; `evaluatedAt` fixes deadline evaluation, not a database snapshot.

## Operational boundaries and rollout

`GRADEBOOK_ENABLED=false` hides the teacher navigation item and returns 404 from
gradebook endpoints. It never changes challenge creation or existing grading
data. The default is true. Apply this through the API deployment environment;
existing browser navigation updates when authentication/routes refresh. No
classroom-level flag or teacher setup is required.

For a staged release, deploy backend additions with this switch false, verify
ordinary classroom operations, deploy the frontend, then set it true. During
rollback, disable the interface/endpoints and retain the additive metadata and
adjustment collections. No old documents need migration and no submission or
simulation indexes change.

Reads use explicit projections and batches of at most 100 students. Score-based
sorting computes small totals in batches before reading the requested page.
Exports stream batches with backpressure. There is no periodic polling. Queries
have a 5-second execution bound; batch work has a 30-second request budget.
Exports have a 30-second hard timeout and a maximum of two concurrent exports per
API process, one per teacher. Preview limits are 10,000 enrollment records and
1,000 challenges per classroom; oversize requests fail explicitly.

Monitor normal API request latency and 5xx rates for the gradebook prefix, export
429s/timeouts, and `Grading cleanup needs repair` logs. Error logs omit scores,
names, and private adjustment reasons. A grading outage may make this page or an
export unavailable, but is not consulted by submission or simulation operations.

Permanent challenge/classroom deletion retains its existing behavior. Deleted
parents disappear from grade calculations immediately. Grading cleanup is
scheduled after successful deletion and its failure cannot fail that deletion.
Repair orphaned grading records with the organization-scoped command below:

```sh
node scripts/repair-grading-cleanup.js --organization ORGANIZATION_OBJECT_ID
node scripts/repair-grading-cleanup.js --organization ORGANIZATION_OBJECT_ID --apply
```

The first command is a dry run. The second only deletes grading records whose
classroom or challenge no longer exists in that organization. Repeating it is
safe. It does not modify enrollments, decisions, challenges, or simulations.

## Verification and extensions

Focused tests live in `services/grading/*.test.js`; run with the repository's
Node test environment. They cover defaults/immutability, provenance, deadlines,
overrides, enrollment, atomic conflicts/history, tenant access, student
serialization, source-operation failure isolation, CSV, and a fixture with
1,000 students, 100 challenges, and 100,000 actual decision records.

The frontend build and browser checks cover gradebook rendering, adjustments,
history, default settings, both downloads, search, and mobile horizontal scrolling.

Future scoring methods should implement the existing points/status contract with
a new policy version. Rubrics, weighted categories, performance scoring, student
release, finalized snapshots, Excel, and LMS adapters remain separate from
submission/simulation execution and are outside this semester's release.
