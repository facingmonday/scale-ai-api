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


