# Job API (Admin) — Frontend Integration Guide

These endpoints power a **Job List** page + **Job Detail** page for instructors/admins to monitor and manage simulation processing.

## Base URL + Auth

- **Base path**: `/api/admin/job`
- **Auth**: requires Clerk auth + org role **`org:admin`** (`services/job/index.js`)

## Data model: `SimulationJob`

A **SimulationJob** represents “run the simulation for one student’s submission in one scenario”.

### Fields you’ll see

- **`_id`**: job id
- **`classroomId`**: class id
- **`scenarioId`**: scenario id
- **`submissionId`**: submission id (may be `null` for older jobs)
- **`userId`**: member id (student) — list endpoint populates name fields
- **`status`**: `"pending" | "running" | "completed" | "failed"`
- **`attempts`**: how many times the job was started (DB-level; increments when marked running)
- **`error`**: latest error message (string), if any
- **`startedAt`**, **`completedAt`**
- **`dryRun`**: boolean (preview runs)

### Status semantics

- **`pending`**: ready to run (or waiting for retry)
- **`running`**: currently being processed
- **`completed`**: succeeded
- **`failed`**: only after **Bull retries are exhausted** (final failure)

> Note: during retries you may see `status: "pending"` but with `error` set to the most recent transient failure.

## Endpoints

### 1) List jobs for a scenario

**GET** `/api/admin/job/scenario/:scenarioId`

Use this for the **Job List page** (Scenario scope).

**Response**

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "scenarioId": "...",
      "classroomId": "...",
      "submissionId": "...",
      "userId": { "_id": "...", "firstName": "...", "lastName": "..." },
      "status": "pending|running|completed|failed",
      "attempts": 0,
      "error": null,
      "startedAt": null,
      "completedAt": null,
      "dryRun": false
    }
  ]
}
```

**UI guidance**

- **Filtering**: by `status`, plus text search across `userId.firstName/lastName`
- **Sorting** (suggested): failed → running → pending → completed
- **Auto-refresh**: poll every 3–10s while any job is `pending` or `running`

### 2) Job detail

**GET** `/api/admin/job/:jobId`

Use for the **Job Detail page**.

**Response**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "scenarioId": "...",
    "classroomId": "...",
    "submissionId": "...",
    "userId": "...",
    "status": "failed",
    "attempts": 2,
    "error": "OpenAI request failed: ...",
    "startedAt": "...",
    "completedAt": "..."
  }
}
```

**UI guidance**

- show status badge + full `error` with copy button
- show timestamps + attempts
- link out to scenario/submission/student when you have ids

### 3) Retry a failed job

**POST** `/api/admin/job/:jobId/retry`

Use for:

- Retry button on Job Detail page
- Inline retry action in Job List rows (only for `status === "failed"`)

**Behavior**

- Resets the job (`pending`, clears error/timestamps)
- Starts processing asynchronously

**Response**

```json
{ "success": true, "message": "Job queued for retry", "data": { "...job fields..." } }
```

**UI guidance**

- after retry, optimistically set the row/status to `pending`
- poll job detail until `completed` or `failed`

### 4) Manually process pending jobs (global)

**POST** `/api/admin/job/process-pending`

Body:

```json
{ "limit": 10 }
```

**What it does**

- Processes up to `limit` SimulationJobs currently marked `pending` (not scenario-scoped).

**Response**

```json
{
  "success": true,
  "message": "Processed N jobs",
  "data": [
    { "success": true, "job": { "...job..." }, "result": null },
    { "success": false, "jobId": "...", "error": "..." }
  ]
}
```

**UI guidance**

- Treat as an “Advanced/Admin ops” action, not a normal instructor workflow button.

## Errors / permissions

- **403**: not org admin
- **404**: job/scenario not found
- **500**: server error (show the returned `error` message)

## Recommended pages

### Job List (Scenario scope)

Example route: `/scenarios/:scenarioId/jobs`

- Call **GET** `/api/admin/job/scenario/:scenarioId`
- Table columns: student, status, attempts, last error (truncate), startedAt/completedAt, actions (view, retry)

### Job Detail

Example route: `/jobs/:jobId`

- Call **GET** `/api/admin/job/:jobId`
- Allow retry via **POST** `/api/admin/job/:jobId/retry` (only if failed)

---

## Batch API (when SIMULATION_MODE=batch)

When using OpenAI Batch API, scenarios stay in **processing** state until the batch completes. Use these endpoints to monitor and control batch jobs.

### Scenario batch state

- **`batchProcessingStatus`**: `null` | `processing` | `completed` | `failed` | `expired` | `cancelled`
- **`batch`** (on scenario): latest SimulationBatch with `openaiRequestCounts`, `openaiExpiresAt`, etc.
- **`availableActions`**: suggested admin actions (e.g. cancel batch, rerun)

### Get batch status (detailed)

**GET** `/api/admin/scenarios/:scenarioId/batch-status`

Query: `?refresh=true` to fetch latest from OpenAI (for stuck-batch diagnosis).

**Response**

```json
{
  "success": true,
  "data": {
    "scenarioId": "...",
    "batchProcessingStatus": "processing",
    "batch": {
      "_id": "...",
      "status": "in_progress",
      "openaiBatchId": "batch_xxx",
      "jobCount": 25,
      "openaiRequestCounts": { "total": 25, "completed": 0, "failed": 0 },
      "openaiInProgressAt": "...",
      "openaiExpiresAt": "...",
      "lastPolledAt": "...",
      "pollCount": 3,
      "openaiRaw": { "status": "...", "request_counts": {...}, "expires_at": ... }
    },
    "availableActions": [
      { "id": "cancelBatch", "label": "Cancel batch (close without results)" },
      { "id": "cancelBatchAndRerun", "label": "Cancel and rerun scenario" }
    ]
  }
}
```

**UI guidance**

- **request_counts**: If `completed` stays at 0 for hours, batch may be stuck (see [OpenAI community](https://community.openai.com/t/batch-api-degraded-since-march-4-stuck-at-0-progress-expiring-after-partial-completion/1375809/3))
- **openaiExpiresAt**: Batch expires after 24h; show countdown if processing

### Cancel batch only

**POST** `/api/admin/scenarios/:scenarioId/cancel-batch`

Cancels the in-progress OpenAI batch and closes the scenario (no results). Use when batch is stuck.

**Response**

```json
{
  "success": true,
  "message": "Batch cancelled. Scenario has been closed.",
  "data": { "cancelled": true, "openaiBatchId": "batch_xxx" }
}
```

### Cancel batch and rerun

**POST** `/api/admin/scenarios/:scenarioId/cancel-batch-and-rerun`

Cancels the batch, resets jobs, and starts a new batch submit. Use to retry after a stuck/failed batch.


