# Challenge emails and reminders

Teachers can use **Email students** on a challenge page to preview and send an announcement to all enrolled students, or a reminder to students with missing decisions. Publication emails continue to work independently. This panel's history covers manual sends and scheduled reminders created through the panel.

Automatic reminders are opt-in. Add one or more dates in the classroom timezone; pending reminders can be edited or cancelled. Daylight-saving times that do not exist or occur twice are rejected. The existing challenge lifecycle worker checks every five minutes and dispatches due reminders, including for instructor-controlled challenges. Delivery also depends on email queue latency.

Recipients must have a current student enrollment and the organization's student role. Any existing decision counts as submitted. Enrollment, decision status, challenge availability, notification suppression, and email preferences are checked again before delivery. A passed deadline alone does not lock instructor-controlled submissions; the existing submission lock controls eligibility. Closed, locked, unpublished, or deleted challenges skip due reminders. Skipped reminders do not restart when a challenge reopens.

## API

All endpoints use the `/v1/admin/challenges/{challengeId}` prefix and require organization admin authentication and classroom administration access. Responses wrap results in `data`.

| Method and suffix                | Request                        | Result                                                                                                |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /emails`                    | —                              | Classroom `timezone`, upcoming reminders and latest 100 other runs with recipient and delivery counts |
| `POST /emails/preview`           | `audience`: `all` or `missing` | Subject, template data, recipient count and availability/delivery flags                               |
| `POST /emails`                   | `audience`, `requestKey`       | HTTP 202 with `runId`; inspect history for delivery status                                            |
| `POST /reminders`                | `localTime`, `requestKey`      | New reminder; always targets missing decisions                                                        |
| `PUT /reminders/{reminderId}`    | `localTime`                    | Updated pending reminder                                                                              |
| `DELETE /reminders/{reminderId}` | —                              | Cancelled pending reminder                                                                            |

`localTime` uses `YYYY-MM-DDTHH:mm` in the classroom timezone. Storage uses UTC. `requestKey` is a client-generated UUID (16–80 alphanumeric/hyphen characters accepted); reuse it when retrying the same logical request. A new intentional send needs a new key. Edits and cancellations return 409 if the reminder has already started. Organization-mismatched challenges return 404.

## Delivery and operation

No backfill is required. The new `ChallengeEmail` collection stores schedules and runs separately from challenges. Its unique organization/challenge/request-key index must be created by the normal Mongoose index setup. Notifications reference the run through `challengeEmailRunId` and have deterministic recipient IDs.

The lifecycle worker must be enabled and the email worker running. `SEND_EMAIL=true` enables delivery; existing sender and host settings are reused. When delivery is disabled or notifications suppressed, attempted emails are recorded as skipped rather than silently held for later delivery. Preview templates in the admin email preview tool as `challenge-announcement` and `challenge-reminder`.

Run claims use five-minute leases. Interrupted dispatches recover on a later lifecycle check, and partial queue failures retry up to five dispatch attempts. Existing email queue retries handle delivery failures. History distinguishes queued, sent (accepted by the provider), skipped, failed, and pending notifications. A failed dispatch exposes its error and leaves already queued recipients intact. Monitor exhausted failed runs in history and worker logs; no automatic resend occurs after exhaustion.

Deduplication prevents repeated requests and worker claims from creating duplicate recipient jobs. As with the existing email pipeline, a process crash after provider acceptance but before recording success can still cause a delivery retry; SendGrid delivery is not an exactly-once transaction with MongoDB.
