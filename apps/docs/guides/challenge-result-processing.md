# Challenge result processing

Each challenge has **Result processing** settings on its detail page. New challenges use **Individual** processing with **5 students at a time**. Existing challenges continue using **Batch** until an instructor changes them. Mock classrooms use these same controls.

- **Individual:** each student has a separate calculation. The next student starts when a slot becomes available, without waiting for the other students. Concurrency can be set from 1 to 20.
- **Batch:** the challenge is submitted together through the existing batch service. The concurrency value is retained but does not apply to Batch processing.

Settings can be changed before a calculation begins or between completed/failed runs. They are locked while preparation, queued work, calculation, or batch ingestion is active. Saving settings does not recalculate existing results; use the existing rerun action afterward. Individual failed-job retries retain their original run settings.

## Feedback and email

Processing settings do not change the feedback policy:

| Feedback release mode | Result visibility and email queueing                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Immediate             | Each student's result becomes available as it completes, with an email queued for that student.               |
| Delayed               | Wait for successful calculation completion and the scheduled release time; emails are queued at release.      |
| Manual                | Wait for successful calculation completion and the instructor's release action; emails are queued at release. |

Notification suppression and disabled email delivery remain respected.

## Deployment

1. Validate the backend tests and web build. Deploy matching API and worker versions together, first in development and then in production.
2. Pause new calculation triggers and stop the old workers gracefully. Allow active individual calculations to finish before switching worker versions. Existing provider batches can remain active and be polled by the new worker.
3. Run `node scripts/backfill-challenge-processing.js` with the target deployment environment to inspect missing settings. Run again with `--apply` to fill only missing mode/concurrency fields with `batch`/`5`. Explicit values are preserved. The application also treats missing legacy settings as Batch during the transition.
4. Start the new workers and resume calculation triggers. `SIMULATION_MODE` and `SIMULATION_CONCURRENCY` are retired and ignored. The shared worker has capacity for 20 jobs; the durable dispatcher enforces each challenge's own limit across workers.
5. Verify a mock challenge in Individual mode with five slots. Watch student jobs complete progressively, retry a failure, and verify the configured feedback release behavior.

Reservations survive restarts and are reconciled every 15 seconds. Slots remain reserved during automatic retry backoff. Job identifiers include the calculation run, and batch ingestion is serialized with cancellation/rerun to prevent an older run writing replacement results.

A pending-job API response acknowledges queued work. Poll the existing job endpoints for completion. No result, job, or ledger migration is performed by the settings backfill.
