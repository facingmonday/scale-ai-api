# Challenge creation wizard

On Teacher Challenges, choose **Create with wizard**. The modal starts with a suggested challenge based on the active classroom. Manual creation and **Create with AI** remain available.

1. Choose a challenge. Regenerate, revisit the previous suggestion, edit the text, or give a short direction.
2. Optionally add challenge-specific student decisions one at a time. Each suggestion includes the actual student input preview, options/ranges, and default. Choose **Skip variables** to continue without adding any, using the classroom's existing decision fields. Otherwise, keep and add another, keep and continue, or continue using only previously kept variables. Kept variables can be edited or removed; skipping never removes classroom definitions.
3. Choose an outcome with optional hidden guidance. Public notes become visible through the existing results-release flow. Hidden guidance stays instructor-only and may be edited or left blank.
4. Review the complete draft and proposed schedule, then create. Changing earlier content preserves later selections and requires reviewing them again.

Closing the modal keeps its draft for the current page session. Reloading, leaving the page, changing classroom, successfully creating, or choosing Start over clears it. Suggestions never create database records. Creation saves the challenge, its challenge-scoped variable definitions, and an unapproved outcome together using the existing rollback behavior on failure.

## Source-text AI creation

The separate **Create with AI** action opens a generated challenge at 8:00 AM the following calendar morning when the prompt gives no opening instruction or the generated opening is in the past. It uses the classroom timezone, with the supplied browser timezone as a fallback when the classroom has none (UTC if neither is valid). A deadline or a date in the scenario does not by itself specify an opening. Explicit future openings are preserved.

Without a deadline, the default remains 11:59 PM two calendar days after creation. When an opening is corrected, a generated deadline earlier than that opening is replaced with this default; a valid later deadline is preserved. Locking and processing follow the resulting deadline. This policy applies to source-text AI creation; the wizard retains its reviewed schedule.

## Suggestion behavior

The existing `CHALLENGE_AI_MODEL`, then `AI_MODEL`, then `gpt-4o-mini` selection is reused. For the original GPT-5, GPT-5 mini, and GPT-5 nano models (including dated snapshots), scenario and variable requests use minimal reasoning to reduce waiting, while outcome pairs use low reasoning for scenario consistency; other models retain their defaults. See the [official reasoning guidance](https://developers.openai.com/api/docs/models/gpt-5). Each request produces three alternatives. The next two can be browsed immediately, with a background refill when one unused alternative remains. Obsolete requests are cancelled and stale responses ignored. Failed requests leave the selected content intact and expose retry controls.

Context is restricted to the authorized organization and classroom: up to ten recent non-initialization challenges with their variables/outcomes, classroom prompts, active profiles and preset values, variable definitions, and metric definitions. Text and collection sizes are bounded. No student identities, submissions, or individual results are included.

The wizard supports zero to 30 challenge-specific variables and requires a title, scenario, and public outcome. Send `variables: []` when skipping. Outcome suggestions then use the challenge, configured profile types and existing classroom decision definitions. Hidden guidance is optional; omitted or blank `hiddenNotes` is stored as an empty string. Each added variable's storage key must be distinct after label normalization.

Suggested hidden guidance is either empty or 1–3 brief sentences (at most 60 words) describing the likely direction of effects on the configured profile types. For example, rain may reduce demand at outdoor venues while drawing customers into indoor stores, when those types are present in the classroom. Suggestions must not invent profile attributes or provide formulas, percentages, cost rules, or a replacement calculation method. Classroom calculation settings remain authoritative. Teachers can still edit their own guidance; existing drafts and saved outcomes are not rewritten.

## Scheduling

The server uses the classroom timezone, falling back to America/Chicago for absent or invalid settings. It takes the latest eight distinct valid opening dates, calculates the rounded median positive interval in local calendar days, and retains the most recent opening time. When a valid timeline exists, it carries forward deadline, closing, and processing offsets in local calendar time. This preserves clock times across daylight-saving changes.

The suggested opening follows existing scheduled openings and submission windows and is at least 24 hours away. Insufficient history uses the classroom's default release/due weekdays and times, plus configured closing/processing delays. Delayed feedback without a historical default is initially proposed for the day after processing. Policies and dates remain editable.

The wizard and the new-challenge page share the same **Challenge opening** and **After opening** components: opening method, lifecycle control, submission deadline, lock/calculation dates, feedback release, late-submission policy, and missing-decision policy. Conditional fields and options match in both places. Switching to **Open manually** clears the suggested opening. Choosing **Instructor controlled** hides lock/calculation dates and changes scheduled feedback to manual release. Lifecycle dates can be left blank; existing challenge defaults apply. The wizard does not add separate processing controls to this creation form.

Suggested dates are a starting point, not a creation requirement. There is no minimum opening lead time: teachers can choose an opening less than 24 hours away, now, or in the past. Creation preserves the reviewed dates instead of replacing them with a refreshed suggestion. Automatic opening still requires a valid opening date; manual opening does not. Supplied dates must follow opening, deadline, closing, and processing order; delayed feedback requires a release date at or after a supplied processing date. Invalid local times in a daylight-saving gap are rejected.

The resulting challenge is initially unpublished, with either manual or scheduled opening as selected. Existing automation, readiness checks, outcome approval, and feedback-release behavior apply.

## API

All endpoints require authentication, the `org:admin` route role, and classroom admin access. The organization is resolved from the authenticated request. Responses use `{ success: true, data }`.

- `POST /v1/admin/challenges/wizard/suggestions`: `{ classroomId, step, draft?, direction?, rejected? }`. `step` is `challenge`, `variable`, or `outcome`. Returns `{ step, candidates }` with three candidates. Variable and outcome suggestions need a selected challenge; an outcome may have no accepted variables. `rejected` contains up to 12 short candidate summaries, not database IDs.
- `POST /v1/admin/challenges/wizard/schedule`: `{ classroomId }`. Returns `{ timeZone, explanation, schedule }`. Date strings are local `YYYY-MM-DDTHH:mm` values in the returned classroom timezone.
- `POST /v1/admin/challenges/wizard`: `{ classroomId, draft, schedule }`. Returns the created challenge with HTTP 201. `draft` contains `{ challenge: { title, description }, variables, outcome: { notes, hiddenNotes } }`. Variables use the existing definition fields. Schedule uses the existing challenge scheduling and processing fields; `publishMode` accepts `MANUAL` or `SCHEDULED` (the default for older clients). Optional dates may be omitted or sent as empty strings. No AI request occurs during this endpoint.

Validation errors return 400, unavailable/unauthorized classrooms return 404/403, and failed or invalid generation returns 502. The wizard routes accept JSON bodies up to 1 MB.

## Verification

Automated tests cover scheduling (including DST), validation, classroom isolation, authorization, generation failures, rollback, outcome persistence, suggestion queues, cancellation, and dependent review state. Browser verification uses deterministic suggestions in an isolated temporary harness so it does not create real classroom challenges or notifications.
