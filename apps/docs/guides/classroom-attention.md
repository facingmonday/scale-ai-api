# Teacher dashboard: Needs attention

The selected classroom's teacher dashboard includes a student follow-up panel
above the leaderboard. Category filters show students with repeated missed
submissions, incomplete profiles, or seats needing review. Students with multiple
issues appear once, with each issue and a link to its existing management screen.
The list shows five students per page, prioritizing students with more issues.

## Checks

- **Missed submissions:** At least two missing student submissions among the
  classroom's five most recent published, past-due challenges. The due date is
  `submissionDeadlineAt`, falling back to `closeSubmissionsAt`. Challenges that
  have not opened, drafts, and challenges without either date are excluded.
  Only deadlines after the student's enrollment date count. If that date is
  unknown, participation is not flagged. `MANUAL` and legacy decisions without
  generation metadata count as submitted; automatic decisions do not. A later
  student submission clears that challenge's missing status.
- **Profile setup:** No profile, or a profile missing its name or profile type.
  Optional profile fields and student IDs do not trigger this check.
- **Seat review:** A recorded held, expired, or revoked classroom seat with no
  active seat in the same classroom. Missing seat records alone are not flagged.
  This is an administrative review signal, not a determination that the student
  is blocked from accessing the classroom.

Only current, non-removed student enrollments whose members still have the
organization's student role are included. Removed students and teachers are
excluded. Category counts can overlap; the overall count is unique students.

## Refresh and API

`GET /v1/admin/class/{classroomId}/attention` requires `org:admin` authentication
and classroom authorization. All data sources are scoped to the organization
and classroom. The response contains `checkedAt`, `totalEnrolled`,
`recentChallengeCount`, category `counts`, and `students` with their issues.

The panel loads when a classroom is selected and refreshes when dashboard
submission counts, challenge scheduling state, or roster removals change. Its
Refresh button rechecks profiles and seats on demand. Failed requests show an
unavailable state rather than reporting that no students need attention.
This feature does not send notifications or modify student records.

## Verification

```sh
node --require ./test/helpers/env.js --test --test-force-exit --test-concurrency=1 services/classroom/classroomAttention.test.js services/classroom/classroomAttention.integration.test.js
npm run build:web
```
