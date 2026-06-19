---
name: job-management
description: "Manage, debug, and monitor background simulation runs in the SCALE LXP platform."
---

# Job Management Skill

This skill guides you through checking, querying, and retrying simulation jobs processed by the background workers.

## Actions & Instructions

### 1. View Scenario Jobs
To check the execution status of all jobs for a specific scenario:
1. Make a `GET` request to `/api/admin/job/scenario/:scenarioId`.
2. Inspect the returned job list (checking `status`, `attempts`, and `error` fields).
3. Identify failed jobs where `status === "failed"`.

### 2. Inspect Single Job Details
To inspect detailed trace or error message for a specific job:
1. Make a `GET` request to `/api/admin/job/:jobId`.
2. Review the `error` message string (e.g., OpenAI failures, database connection errors).

### 3. Queue a Job Retry
To retry a failed job:
1. Make a `POST` request to `/api/admin/job/:jobId/retry`.
2. This resets the job status to `pending`, clears errors, and starts asynchronous processing in the Bull queue.
3. Optimistically set the UI representation to `pending` and poll the job details endpoint until completed or failed.

### 4. Troubleshoot Startup/Queue Failures
If jobs report "not found" or queue issues on startup:
1. Check if the local MongoDB database has been reset or wiped (e.g., after test runs) while the persistent Redis queue still contains old job IDs.
2. Flush the local Redis instance if needed:
   ```bash
   redis-cli flushall
   ```
