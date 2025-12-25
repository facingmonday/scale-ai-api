# SCALE.ai API

A classroom-based supply chain simulation platform built with Node.js, Express, and MongoDB. Students manage pizza shops through weekly scenarios, with AI-driven outcomes calculated per student.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Services & Models](#services--models)
- [API Routes](#api-routes)
- [Authentication](#authentication)
- [Setup & Development](#setup--development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

## Overview

SCALE.ai is a learning platform where:

- **Instructors** create classes, define scenarios, and set global outcomes
- **Students** join classes, set up stores, and submit weekly decisions
- **AI** calculates individualized results based on store config, scenario, and student decisions
- **Results** are stored in a ledger and displayed on dashboards

### Key Features

- Multi-tenant (organization-scoped)
- Dynamic variable system (no hard-coded fields)
- AI-driven simulation outcomes
- Email notifications via SendGrid
- Queue-based job processing (Bull/Redis)
- Role-based access control (admin/member)

## Tech Stack

- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: Clerk
- **AI**: OpenAI
- **Email**: SendGrid
- **Queue**: Bull (Redis)
- **Email Templates**: React Email
- **Deployment**: DigitalOcean App Platform (Docker)

## Architecture

The application consists of three main services:

1. **API Service** (`apps/api/`) - Main REST API
2. **Webhooks Service** (`apps/webhooks/`) - External webhook handlers
3. **Workers Service** (`apps/workers/`) - Background job processing

All services share the same codebase and are deployed separately.

## Project Structure

```
scale-ai-api/
├── apps/
│   ├── api/              # Main API server
│   ├── webhooks/          # Webhook handlers
│   ├── workers/           # Background workers
│   └── email-preview/     # Email template preview
├── services/              # Business logic services
│   ├── auth/
│   ├── classroom/
│   ├── enrollment/
│   ├── store/
│   ├── variableDefinition/
│   ├── scenario/
│   ├── submission/
│   ├── members/
│   ├── organizations/
│   ├── notifications/
│   ├── openai/
│   ├── utils/
│   └── webhooks/
├── lib/                   # Shared utilities
│   ├── emails/           # Email templates
│   ├── queues/           # Queue workers
│   ├── sendGrid/         # Email sending
│   └── openai/           # AI integrations
├── middleware/           # Express middleware
├── models/              # Mongoose model loader
└── constants/           # Constants and enums
```

## Services & Models

### Core Services

#### Classroom Service

- **Model**: `Classroom` - Represents a course instance
- **Purpose**: Top-level container for all class-related data

#### Enrollment Service

- **Model**: `Enrollment` - Links users to classes with roles
- **Purpose**: Manages class membership and role-based access

#### Store Service

- **Models**: `Store`, `VariableValue`
- **Purpose**: Manages student business setup (one store per student per class)

#### VariableDefinition Service

- **Model**: `VariableDefinition`
- **Purpose**: Defines dynamic questions/variables for stores, scenarios, and submissions

#### Scenario Service

- **Models**: `Scenario`, `ScenarioOutcome`
- **Purpose**: Manages weekly simulation contexts and global outcomes

#### Submission Service

- **Model**: `Submission`
- **Purpose**: Collects weekly student decisions

### Supporting Services

- **Auth Service** - Authentication endpoints
- **Members Service** - User/member management
- **Organizations Service** - Organization management
- **Notifications Service** - Notification system
- **OpenAI Service** - AI integrations
- **Utils Service** - Utility endpoints
- **Webhooks Service** - External webhook handlers (Clerk, Stripe, Telnyx)

## API Routes

All routes are prefixed with `/v1` when accessed through the API service.

### Authentication Routes (`/v1/auth`)

#### `GET /v1/auth/me`

- **Auth**: `requireAuth({ organizationOptional: true })`
- **Description**: Get authenticated user info (works with or without organization context)

#### `POST /v1/auth/active-classroom`

- **Auth**: `requireAuth()`
- **Description**: Set active classroom for the current session

### User Profile Routes (`/v1/me`)

All routes require `requireMemberAuth()`.

#### `GET /v1/me`

- **Description**: Get current user profile

#### `PATCH /v1/me`

- **Description**: Update current user profile

#### `POST /v1/me/organizations`

- **Description**: Create organization for current user

#### `PUT /v1/me/organizations/:id`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update organization

### Members Routes (`/v1/members`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `POST /v1/members`

- **Description**: Create a new member

#### `GET /v1/members`

- **Description**: Get all members in the organization

#### `GET /v1/members/search`

- **Description**: Search members by name, email, or other criteria

#### `GET /v1/members/stats`

- **Description**: Get member statistics for the organization

#### `GET /v1/members/:id`

- **Description**: Get member by ID

#### `PUT /v1/members/:id`

- **Description**: Update member information

#### `DELETE /v1/members/:id`

- **Description**: Remove member from organization

#### `PUT /v1/members/:id/organization-membership`

- **Description**: Update organization membership (role, status, etc.)

#### `POST /v1/members/add-existing`

- **Description**: Add existing Clerk user to organization

#### `POST /v1/members/export`

- **Description**: Export members as CSV

### Organizations Routes (`/v1/organizations`)

#### `GET /v1/organizations`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all organizations for the authenticated user

#### `POST /v1/organizations`

- **Auth**: `requireMemberAuth()`
- **Description**: Create a new organization

#### `POST /v1/organizations/:organizationId/join`

- **Auth**: `requireMemberAuth()`
- **Description**: Join an organization

### Notifications Routes (`/v1/notifications`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/notifications`

- **Description**: Get all notifications for the organization

#### `GET /v1/notifications/web`

- **Description**: Get web notifications (filtered for web display)

#### `GET /v1/notifications/unread-count`

- **Description**: Get count of unread notifications

#### `POST /v1/notifications`

- **Description**: Create a new notification

#### `PUT /v1/notifications/status`

- **Description**: Update status for all notifications (bulk update)

#### `PUT /v1/notifications/:id`

- **Description**: Update status of a single notification (read, deleted, etc.)

### OpenAI Routes (`/v1/openai`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `POST /v1/openai/completion`

- **Description**: Get AI text completion using OpenAI API

#### `POST /v1/openai/generate`

- **Description**: Generate image using OpenAI DALL-E

#### `POST /v1/openai/analyze-image`

- **Description**: Analyze image using OpenAI Vision API (file upload required)
- **Body**: Multipart form data with `file` field

#### `POST /v1/openai/transcribe-audio`

- **Description**: Transcribe audio using OpenAI Whisper API (file upload required)
- **Body**: Multipart form data with `file` field

### Classroom Routes (`/v1/admin/class`)

#### `POST /v1/admin/class`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create a new classroom
- **Body**: `{ name, description }`

#### `GET /v1/admin/class`

- **Auth**: `requireAuth()`
- **Description**: Get all classrooms for the organization

#### `GET /v1/admin/class/:classroomId/dashboard`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get class dashboard with statistics and overview

#### `GET /v1/admin/class/student/:classroomId/dashboard`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get student dashboard view for a classroom

#### `POST /v1/admin/class/:classroomId/invite`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Invite student to class via email
- **Body**: `{ email }`

### Enrollment Routes (`/v1/enrollment`)

#### Student Routes

##### `POST /v1/enrollment/class/:classroomId/join`

- **Auth**: `requireMemberAuth()`
- **Description**: Student joins a class (creates enrollment)

##### `GET /v1/enrollment/my-classes`

- **Auth**: `requireAuth()`
- **Description**: Get all classes the authenticated user is enrolled in

#### Admin Routes

##### `GET /v1/enrollment/admin/class/:classroomId/roster`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get class roster (all enrolled students) with pagination
- **Query Params**: `page`, `pageSize`

##### `DELETE /v1/enrollment/admin/class/:classroomId/student/:userId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Remove student from class (soft delete enrollment)

### Store Routes

#### Student Routes

##### `POST /v1/student/store`

- **Auth**: `requireMemberAuth()`
- **Description**: Create store for authenticated student
- **Body**: `{ classroomId, shopName, storeType, dailyCapacity, deliveryRatio, startingBalance?, variables? }`

##### `PUT /v1/student/store`

- **Auth**: `requireMemberAuth()`
- **Description**: Update student's store
- **Query Params**: `classroomId` (required)

##### `GET /v1/student/store`

- **Auth**: `requireMemberAuth()`
- **Description**: Get student's store for a class
- **Query Params**: `classroomId` (required)

#### Admin Routes

##### `GET /v1/admin/class/:classroomId/store/:userId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get student's store (admin view)

### VariableDefinition Routes (`/v1/admin/variables`)

#### `POST /v1/admin/variables`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create variable definition
- **Body**: `{ classroomId, key, label, description?, appliesTo, dataType, inputType?, options?, defaultValue?, min?, max?, required?, affectsCalculation? }`

#### `PUT /v1/admin/variables/:key`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update variable definition
- **Query Params**: `classroomId` (required)

#### `GET /v1/admin/variables`

- **Auth**: `requireAuth()` (admin or enrolled user)
- **Description**: Get variable definitions
- **Query Params**: `classroomId`, `appliesTo` (optional filters)

#### `DELETE /v1/admin/variables/:key`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Delete variable definition (soft delete)
- **Query Params**: `classroomId` (required)

### Scenario Routes (`/v1/admin/scenarios` and `/v1/student/scenarios`)

#### Admin Routes

##### `POST /v1/admin/scenarios`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create a new scenario
- **Body**: `{ classroomId, title, description?, variables? }`
- **Note**: Automatically queues email notifications to all enrolled students

##### `GET /v1/admin/scenarios`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all scenarios for the organization

##### `GET /v1/admin/scenarios/current`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get current active scenario for admin view
- **Query Params**: `classroomId` (required)

##### `GET /v1/admin/scenarios/:id`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get scenario by ID

##### `PUT /v1/admin/scenarios/:scenarioId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update scenario (before publish/close)

##### `POST /v1/admin/scenarios/:scenarioId/publish`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Publish scenario to students (makes it visible and active)

##### `POST /v1/admin/scenarios/:scenarioId/unpublish`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Unpublish scenario (hide from students)

##### `POST /v1/admin/scenarios/:scenarioId/preview`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Preview AI outcomes for a scenario (does not write ledger entries)

##### `POST /v1/admin/scenarios/:scenarioId/rerun`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Rerun scenario (delete existing ledger entries and recalculate)

#### Student Routes

##### `GET /v1/student/scenarios`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all scenarios for a classroom
- **Query Params**: `classroomId` (required)

##### `GET /v1/student/scenarios/current`

- **Auth**: `requireMemberAuth()`
- **Description**: Get current active scenario for student
- **Query Params**: `classroomId` (required)

##### `GET /v1/student/scenarios/:id`

- **Auth**: `requireMemberAuth()`
- **Description**: Get scenario by ID (student view)

### ScenarioOutcome Routes (`/v1/admin/scenarioOutcomes` and `/v1/student/scenarioOutcomes`)

#### Admin Routes

##### `POST /v1/admin/scenarioOutcomes/:scenarioId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Set global scenario outcome (actual weather, demand shift, etc.)
- **Body**: `{ variables? }` (dynamic based on variable definitions)

##### `GET /v1/admin/scenarioOutcomes/:scenarioId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get scenario outcome for a scenario

##### `DELETE /v1/admin/scenarioOutcomes/:scenarioId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Delete scenario outcome

#### Student Routes

##### `GET /v1/student/scenarioOutcomes/:scenarioId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:member')`
- **Description**: Get scenario outcome (student view, after results are published)

### Submission Routes (`/v1/admin/submissions` and `/v1/student/submission`)

#### Student Routes

##### `POST /v1/student/submission`

- **Auth**: `requireMemberAuth()`
- **Description**: Submit weekly decisions for a scenario
- **Body**: `{ scenarioId, variables }` (variables are dynamic based on variable definitions)
- **Note**: Validates variables, enforces submission order

##### `PUT /v1/student/submission/:submissionId`

- **Auth**: `requireMemberAuth()`
- **Description**: Update existing submission (only before results are published)

##### `GET /v1/student/submission/status`

- **Auth**: `requireMemberAuth()`
- **Description**: Get submission status for a scenario
- **Query Params**: `scenarioId` (required)

##### `GET /v1/student/submissions`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all submissions for the authenticated student
- **Query Params**: `classroomId`, `scenarioId` (optional filters)

#### Admin Routes

##### `GET /v1/admin/submissions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all submissions (with filters)

##### `GET /v1/admin/submissions/:submissionId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get submission by ID

##### `GET /v1/admin/scenarios/:scenarioId/submissions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all submissions for a scenario (includes list of students who haven't submitted)

### Ledger Routes (`/v1/admin/ledger`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/admin/ledger/:classroomId/user/:userId`

- **Description**: Get ledger history for a specific user in a classroom

#### `GET /v1/admin/ledger/scenario/:scenarioId`

- **Description**: Get all ledger entries for a scenario

#### `GET /v1/admin/ledger/scenario/:scenarioId/user/:userId`

- **Description**: Get ledger entry for a specific scenario and user

#### `PATCH /v1/admin/ledger/:ledgerId/override`

- **Description**: Override a ledger entry (manually adjust values)

### Job Routes (`/v1/admin/job`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/admin/job/scenario/:scenarioId`

- **Description**: Get all jobs for a scenario (simulation processing jobs)

#### `GET /v1/admin/job/:jobId`

- **Description**: Get job by ID with status and details

#### `POST /v1/admin/job/:jobId/retry`

- **Description**: Retry a failed job

#### `POST /v1/admin/job/process-pending`

- **Description**: Manually trigger processing of pending jobs

### Webhook Routes (`/v1/webhooks`)

#### Clerk Webhooks

##### `POST /v1/webhooks/clerk`

- **Auth**: Webhook signature verification
- **Description**: Handles Clerk webhook events (user.created, user.updated, user.deleted)

### Health Check Routes

#### `GET /health-check`

- **Description**: Basic health check endpoint
- **Available on**: All services (API, Webhooks, Workers)

## Authentication

### Authentication Provider

- **Clerk** - Handles user authentication and JWT tokens
- Backend validates Clerk JWT on every request

### Roles

- **`org:admin`** - Instructor/TA (full access)
- **`member`** - Student (limited access)

### Middleware

- **`requireAuth()`** - Requires authenticated user with organization context
- **`requireMemberAuth()`** - Requires authenticated user (no org context required)
- **`checkRole(role)`** - Validates user has required role in organization

### Multi-Tenancy

All data is organization-scoped. Queries automatically filter by `organization: req.organization._id` to ensure data isolation.

## Setup & Development

### Prerequisites

- Node.js 18+
- MongoDB
- Redis (for queue processing)
- Clerk account (for authentication)
- SendGrid account (for emails)
- OpenAI API key (for AI features)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Install Puppeteer browsers (if not skipped)
npm run postinstall
```

### Environment Variables

See [Environment Variables](#environment-variables) section below.

### Development

```bash
# Start API service only
npm run dev:api

# Start webhooks service only
npm run dev:webhooks

# Start workers service only
npm run dev:workers

# Start all services concurrently
npm run dev:all
```

### Production

```bash
# Start API service
npm run start:api

# Start webhooks service
npm run start:webhooks

# Start workers service
npm run start:workers

# Start all services
npm run start:all
```

### Email Preview

```bash
# Preview email templates
npm run email:preview
```

## Deployment

The application is deployed on **DigitalOcean App Platform** using Docker.

### Dockerfile

The project includes a Dockerfile that:

- Uses Node.js 18 Alpine
- Installs Chromium for Puppeteer
- Sets up production environment
- Runs the service specified by `APP_NAME` environment variable

### Service Configuration

Set `APP_NAME` environment variable to:

- `api` - For API service
- `webhooks` - For webhooks service
- `workers` - For workers service

## Environment Variables

### Required

```bash
# MongoDB
MONGO_SCHEME=mongodb
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_HOSTNAME=your_host
MONGO_DB=your_database

# Clerk
CLERK_SECRET_KEY=your_clerk_secret_key

# Redis (for queues)
REDIS_URL=redis://your_redis_url

# SendGrid
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=SCALE.ai

# OpenAI
OPENAI_API_KEY=your_openai_key
```

### Optional

```bash
# Server Ports
PORT=1337                    # API service port
PORT_WEBHOOKS=1340          # Webhooks service port
PORT_WORKERS=1341           # Workers service port

# Application
NODE_ENV=production
SCALE_API_HOST=https://api.scale.ai
SCALE_COM_HOST=https://scale.ai
SCALE_API_VERSION=v1

# Workers
WORKERS_ENABLED=true

# Queue Admin (for Bull Board)
QUEUE_ADMIN_BASIC_AUTH_USER=admin
QUEUE_ADMIN_BASIC_AUTH_PASS=password

# Email
SEND_EMAIL=true             # Set to 'true' to actually send emails
```

## Models

### Core Models

- **Classroom** - Course instances
- **Enrollment** - User-class relationships with roles
- **Store** - Student business setup
- **VariableValue** - Dynamic variable values (store/scenario/submission/etc.)
- **VariableDefinition** - Dynamic variable definitions
- **Scenario** - Weekly simulation contexts
- **ScenarioOutcome** - Global scenario outcomes
- **Submission** - Weekly student decisions

### Supporting Models

- **Member** - User/member records (synced with Clerk)
- **Organization** - Organization records (synced with Clerk)
- **Notification** - Notification system

All models extend `baseSchema` which provides:

- `organization` - Organization reference (multi-tenancy)
- `createdBy` - Clerk user ID who created
- `createdDate` - Creation timestamp
- `updatedBy` - Clerk user ID who last updated
- `updatedDate` - Update timestamp

## Queue System

The application uses **Bull** (Redis-based queue) for background job processing.

### Queue Types

- **Simulation** - AI-driven simulation job processing (concurrency: 1)
- **Email Sending** - Email notifications
- **PDF Generation** - PDF document generation
- **SMS Sending** - SMS notifications
- **Push Sending** - Push notifications

### Queue Monitoring

Bull Board is available at `/admin/queues` on the workers service (requires basic auth in production).

## Submission Outcome & Simulation Processing

This section explains how student submissions are processed and how AI-driven simulation jobs are triggered and executed.

### Overview

The simulation processing flow consists of three main stages:

1. **Student Submissions** - Students submit their weekly decisions
2. **Scenario Outcome** - Instructor sets global outcome and triggers processing
3. **Job Processing** - Background jobs calculate results using AI

### Stage 1: Student Submissions

Students submit their weekly decisions for a published scenario via `POST /v1/student/submission`. Each submission includes:

- **Scenario ID** - The scenario being responded to
- **Variables** - Dynamic decision variables (e.g., `plannedProduction`, `staffingLevel`, `marketingSpend`)
- **Metadata** - Submission timestamp, user ID, classroom ID

**Submission States:**

- `pending` - Submitted, awaiting processing
- `processing` - Currently being processed by a job
- `completed` - Successfully processed, ledger entry created
- `failed` - Processing failed (can be retried)

**Validation:**

- Submissions are validated against variable definitions
- Scenario must be published and not closed
- Only one submission per student per scenario is allowed
- Submissions cannot be edited after scenario is closed

### Stage 2: Scenario Outcome & Job Creation

When an instructor sets the scenario outcome via `POST /v1/admin/scenarioOutcomes/:scenarioId/outcome`, the following happens automatically:

1. **Outcome Creation** - Global scenario outcome is created/updated with:
   - Dynamic outcome variables (e.g., `actualWeather`, `demandMultiplier`)
   - Notes and metadata
   - Random events enabled flag

2. **Job Creation** - For each student who submitted:
   - A `SimulationJob` document is created in MongoDB with status `pending`
   - Job is linked to the submission via `submissionId`
   - Job is enqueued in the Bull queue (Redis) for processing
   - Submission status is updated to `processing`

3. **Scenario Closure** - The scenario is automatically closed:
   - `isClosed` flag is set to `true`
   - Prevents new submissions
   - Prevents editing existing submissions

**Important Notes:**

- Jobs are **only created for students who have submitted**
- Missing submissions (students who didn't submit) are tracked separately
- Jobs are processed asynchronously in the background
- The API response returns immediately after job creation (does not wait for processing)

### Stage 3: Job Processing

Jobs are processed by the **Workers Service** using Bull queue with the following characteristics:

**Queue Configuration:**

- **Concurrency**: 1 job at a time (ensures ordering and prevents rate limiting)
- **Retries**: 3 attempts with exponential backoff (1s, 2s, 4s delays)
- **Failure Handling**: Failed jobs remain in queue for inspection

**Processing Flow:**

For each job, the worker:

1. **Fetches Context** - Gathers all required data:
   - **Store** - Student's store configuration and variables
   - **Scenario** - Scenario data with variables populated
   - **ScenarioOutcome** - Global outcome variables
   - **Submission** - Student's decision variables
   - **Ledger History** - Previous ledger entries (for cash continuity)

2. **Calls AI Service** - Sends context to OpenAI API:
   - Model: `gpt-4o` with temperature `0` (deterministic)
   - JSON schema enforced for structured output
   - Prompt includes all context and business rules
   - AI calculates: sales, revenue, costs, waste, profit, cash flow, inventory

3. **Writes Ledger Entry** - Creates ledger entry with:
   - Financial results (sales, revenue, costs, waste, net profit)
   - Cash flow (cashBefore, cashAfter)
   - Inventory changes (inventoryBefore, inventoryAfter)
   - Random event (if enabled and triggered)
   - Narrative summary
   - AI metadata (model, runId, timestamp)

4. **Updates Status** - Updates job and submission:
   - Job status: `pending` → `processing` → `completed`
   - Submission status: `processing` → `completed`
   - Links ledger entry to submission

**Error Handling:**

- If processing fails, job status is set to `failed`
- Error details are stored in job document
- Jobs can be manually retried via `POST /v1/admin/job/:jobId/retry`
- Failed jobs don't create ledger entries

### Missing Submissions

Students who don't submit are handled according to classroom policy:

- **Zero Action** (default) - No ledger entry created, balance carries forward
- **Auto Default** - Conservative default submission auto-generated (future feature)
- **Skip Week** - No ledger entry, balance carries forward
- **Instructor Review** - Instructor manually handles each missing submission

Missing submissions are tracked via `GET /v1/admin/scenarios/:scenarioId/submissions` which returns:

- List of submitted students
- List of missing students (who haven't submitted)

### Rerunning Scenarios

Instructors can rerun a scenario via `POST /v1/admin/scenarios/:scenarioId/rerun`:

1. **Deletes** existing ledger entries for the scenario
2. **Resets** all jobs to `pending` status
3. **Recreates** jobs for all submissions
4. **Processes** jobs automatically

This allows instructors to:

- Adjust scenario outcomes and recalculate
- Fix errors in calculations
- Test different outcome scenarios

### Job Monitoring

Instructors can monitor job status via:

- `GET /v1/admin/job/scenario/:scenarioId` - Get all jobs for a scenario
- `GET /v1/admin/job/:jobId` - Get specific job details
- `POST /v1/admin/job/:jobId/retry` - Retry a failed job
- `POST /v1/admin/job/process-pending` - Manually trigger processing

**Job States:**

- `pending` - Waiting to be processed
- `processing` - Currently being processed
- `completed` - Successfully completed, ledger entry created
- `failed` - Processing failed (can be retried)

### Ledger Entries

Each successful job creates a ledger entry that:

- Links to scenario, submission, and user
- Contains financial results and narrative
- Maintains cash continuity (cashAfter = cashBefore + netProfit)
- Can be overridden by instructors via `PATCH /v1/admin/ledger/:ledgerId/override`
- Includes AI metadata for audit trail

**Ledger Entry Fields:**

- `sales` - Units sold
- `revenue` - Total revenue
- `costs` - Total costs (production, staffing, etc.)
- `waste` - Units wasted
- `netProfit` - Revenue - Costs
- `cashBefore` - Starting cash balance
- `cashAfter` - Ending cash balance
- `inventoryBefore` - Starting inventory
- `inventoryAfter` - Ending inventory
- `randomEvent` - Random event description (if any)
- `summary` - Narrative summary of the week
- `overridden` - Whether instructor manually adjusted values

## Email Sending & Notifications

The system supports email notifications through two approaches: **direct email queuing** and **notification-based sending**. Both use React Email templates and SendGrid for delivery.

### Email Architecture

#### Components

1. **React Email Templates** (`lib/emails/templates/`) - Server-side rendered email templates
2. **Email Queue** (`lib/queues/email-worker.js`) - Bull/Redis queue for async email processing
3. **SendGrid Integration** (`lib/sendGrid/sendEmail.js`) - Email delivery service
4. **Notification Model** (`services/notifications/notifications.model.js`) - Structured notification system

#### Email Flow

```
1. Email Request → 2. Queue Job → 3. Worker Processes → 4. Render Template → 5. Send via SendGrid
```

### Direct Email Queuing

For simple, event-driven emails (e.g., scenario creation), emails are queued directly without creating notification records.

**Example: Scenario Creation Emails**

When a new scenario is created, the `Scenario` model's post-save hook automatically:
1. Finds all enrolled students in the classroom
2. Queues an email job for each student
3. Uses the `scenario-created` template with scenario, classroom, and member data

```javascript
// In scenario.model.js post-save hook
await enqueueEmailSending({
  recipient: { email, name, memberId },
  title: `New Scenario: ${scenario.title}`,
  templateSlug: "scenario-created",
  templateData: { scenario, classroom, member, organization, link },
  organizationId,
});
```

### Notification-Based Sending

For more structured notifications that need tracking, status, and multiple channels (email, SMS, push), use the Notification model.

**Notification Types:**
- `email` - Email notifications
- `sms` - SMS notifications (future)
- `push` - Push notifications (future)
- `web` - In-app notifications

**Notification Lifecycle:**

1. **Create Notification** - Create a Notification document with recipient, type, and template data
2. **Post-Save Hook** - Automatically queues the appropriate channel (email/SMS/push)
3. **Queue Processing** - Worker processes the job and sends the notification
4. **Status Tracking** - Notification status updated to "Sent" or "Failed"

**Example: Creating a Notification**

```javascript
const notification = new Notification({
  type: "email",
  recipient: {
    id: memberId,
    type: "Member",
    ref: "Member",
  },
  title: "Welcome to SCALE.ai",
  message: "You've been enrolled in a new class",
  templateSlug: "scenario-created",
  templateData: { scenario, classroom, member },
  organization: organizationId,
});

await notification.save(); // Automatically queues email via post-save hook
```

### Email Templates

Email templates are built with **React Email** and located in `lib/emails/templates/`.

#### Available Templates

- `scenario-created` - Notifies students when a new scenario is created

#### Template Structure

Templates are React components that receive `templateData` as props:

```jsx
function ScenarioCreatedEmail(props) {
  const { scenario, classroom, member, link } = props;
  // ... render email
}
```

#### Template Rendering

Templates are rendered server-side using `@react-email/render`:
- HTML version for email clients
- Plain text version for accessibility
- Both versions sent via SendGrid

#### Previewing Templates

Fixtures for email preview are in `apps/email-preview/fixtures/`. Run `npm run email:preview` to preview templates locally.

### Email Queue Configuration

**Queue Settings:**
- **Concurrency**: 2 jobs processed simultaneously
- **Priority**: Medium (priority: 3)
- **Delay**: 100ms between jobs (prevents bursts)
- **Retries**: Handled by Bull queue system

**Queue Monitoring:**
- Jobs tracked in Redis
- Failed jobs can be inspected and retried
- Status updates logged to console

### Email Sending Configuration

**Environment Variables:**
- `SEND_EMAIL` - Set to `"true"` to actually send emails (default: disabled for safety)
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Default sender email
- `SENDGRID_FROM_NAME` - Default sender name
- `SCALE_COM_HOST` - Base URL for email links
- `SCALE_API_HOST` - API host for unsubscribe links

**Safety Features:**
- If `SEND_EMAIL !== "true"`, emails are logged but not sent
- Unsubscribe links automatically included in emails
- Batch sending supported (up to 1000 recipients per batch)

### Recipient Resolution

The system resolves recipients based on type:

- **Member** - Looks up member in database, fetches email from Clerk
- **Guest** - Uses email from `templateData` (for users not yet in system)
- **Organization** - Uses organization contact info from Clerk

Recipient preferences are checked before sending (email/SMS/push preferences).

### Error Handling

- Failed email jobs are logged with error details
- Notification status updated to "Failed" with error message
- Jobs can be retried manually
- Errors don't block other email sends (Promise.allSettled used for batch sends)

### Best Practices

1. **Use Direct Queuing** for simple, event-driven emails (scenario creation, etc.)
2. **Use Notifications** for emails that need tracking, status, or multiple channels
3. **Always include unsubscribe links** (handled automatically)
4. **Test with `SEND_EMAIL=false`** in development
5. **Use React Email templates** for consistent, responsive email design
6. **Handle errors gracefully** - email failures shouldn't break core functionality

## Service Patterns

All services follow a consistent structure:

1. **`index.js`** - Express router with route definitions
2. **`[service-name].controller.js`** - Request handlers
3. **`[service-name].model.js`** - Mongoose model with static/instance methods
4. **`lib/`** (optional) - Service-specific utilities (only if not shared)

### Shared Utilities Pattern

Shared utilities are added as **static methods** or **instance methods** on models, not in separate service files. This keeps utilities close to the data they operate on and makes them reusable across services.

## Error Handling

All controllers follow consistent error handling:

- **400** - Validation errors, bad requests
- **401** - Unauthorized (not authenticated)
- **403** - Forbidden (insufficient permissions)
- **404** - Not found
- **409** - Conflict (duplicate resources)
- **500** - Server errors

## License

ISC
