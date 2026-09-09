# Student submission receipts

Each successful student submission and update schedules a receipt after the HTTP
response finishes (or the client disconnects). Receipt processing cannot change
the submission response. Automated decisions and historical saves do not generate
receipts.

Receipts contain a snapshot of the saved decision variables and challenge answers,
classroom/challenge names, save time in the classroom timezone, and the notification
ID as a receipt number. Delivery uses the snapshot, not the latest decision values.
Each update gets a separate receipt; delivery order is not guaranteed, so the saved
time identifies which copy is newer.

## Delivery and controls

The existing `SEND_EMAIL=true` setting enables delivery. Existing challenge
notification suppression and student email preferences also apply, including a
fresh check immediately before sending. Missing recipients or email addresses are
skipped. Skipped receipts are not automatically resent when settings change.

There is no receipt-specific environment switch. Turning off `SEND_EMAIL` also
stops other email delivery.

Receipts are stored in `Notification` with `templateSlug: "decision-receipt"` and
`decisionReceipt` metadata. They bypass the generic notification post-save enqueue
hook; the receipt service owns eligibility checking and enqueueing.

The email worker runs a non-overlapping recovery sweep every minute, oldest first,
for up to 100 Pending receipts. It queues records with no existing queue job.
Delivery uses the existing three attempts with exponential backoff. Exhausted
failures stay Failed and are available for manual retry in the existing queue
dashboard; recovery never restarts them automatically. Retry the existing job to
retain its notification ID and original snapshot.

`Sent` means the email provider accepted the message, not confirmed inbox delivery.
The accepted limitations are a possible lost receipt if the API stops between the
save and receipt recording, and a possible duplicate if provider acceptance succeeds
but recording that outcome fails. A receipt is not a replacement for transactional
decision storage or version history.

## Verification and deployment

Use the `decision-receipt` fixture in the existing admin email preview tool. HTML
and plain text include escaped answers and preserve line breaks.

Run focused tests:

```sh
node --require ./test/helpers/env.js --test --test-force-exit --test-concurrency=1 services/decision/decisionReceipt.test.js services/decision/decisionReceipt.integration.test.js services/challenge/challengeEmail.test.js services/challenge/challengeEmail.integration.test.js services/notifications/emailDelivery.test.js
```

Test staging with email provider calls stubbed or a controlled staging recipient.
Deploy the worker/template/model support before the API controller hooks, leaving
production `SEND_EMAIL` unchanged. API hooks start creating receipts for all eligible
classrooms immediately upon deployment. Worker shutdown stops the recovery timer
and waits for its in-flight sweep before closing queues.

Monitor receipt notifications by status and the existing email queue. Receipt
service failure logs include stage and identifying IDs, without student answers or
authentication tokens. The decision-value replacement defect is outside this change.
