# Challenge calendar

The teacher Challenges page starts with a calendar occupying one of three desktop
columns and an overview occupying the other two. These panels stack on mobile.

The calendar shows configured scheduled openings, submission deadlines, scheduled
email reminders, and delayed result releases. Deadlines fall back to the configured
submission closing time when no deadline is set. Manual openings and manual or
immediate result releases are not assigned invented calendar dates. All dates and
times use the classroom's automation timezone, defaulting to America/Chicago.

Select a day to see every event on that date, or choose **Show upcoming** to see
the next five events. Month arrows browse other months; **Today** returns to the
current date in the classroom's timezone. Each event opens the corresponding
challenge, where its dates and reminders can be edited using the existing forms.

The overview shows counts for open, scheduled, draft, and review-needed challenges.
Selecting a count filters the challenge list below; selecting it again or choosing
**Show all challenges** clears the filter. Review includes blocked/failed automation
and calculated results awaiting feedback release. Counts may overlap. Calendar
events continue to show the whole classroom regardless of the status filter.

Actions include creating a challenge, creating one with AI, opening classroom
schedule settings, and refreshing the schedule. Dates come from the challenge list.
`GET /v1/admin/class/{classroomId}/calendar-reminders` supplies pending scheduled
reminders with only their IDs, challenge IDs, and send times. It requires org admin
authentication and classroom authorization. Sent, skipped, failed, cancelled, and
manual email runs are excluded. Reminder lookup failure shows a retry message
without hiding the other calendar events.

Verification:

```sh
node --require ./test/helpers/env.js --test --test-force-exit --test-concurrency=1 test/helpers/challengeCalendar.test.js services/classroom/classroomCalendar.test.js services/classroom/classroomCalendar.integration.test.js
npm run build:web
```
