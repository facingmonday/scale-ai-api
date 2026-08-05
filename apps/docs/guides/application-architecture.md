# SCALE LXP Application Architecture

This document describes the SCALE LXP API architecture, runtime components, external dependencies, data stores, queues, and primary data flows. It is intended for engineering onboarding, security reviews, vendor assessments, and HECVAT-style architecture documentation.

## System Overview

SCALE LXP is a classroom-based supply chain simulation platform. Instructors create classes, define store and scenario variables, publish weekly scenarios, enter global outcomes, and review student results. Students create stores, submit weekly decisions, and view simulation results. Background workers use queue-based processing and OpenAI to calculate individualized ledger entries.

The platform includes a React frontend and three deployable Express applications that share service, model, middleware, queue, email, and OpenAI libraries:

- **Web app:** Student/instructor UI under `apps/web/` (Vite SPA, separate `package.json`, deployed as a DigitalOcean static site).
- **API service:** Main REST API under `apps/api/`.
- **Webhooks service:** External webhook receiver under `apps/webhooks/`.
- **Workers service:** Background queue and scheduled job processor under `apps/workers/`.

The web app is not part of the shared Express codebase; it calls the API over HTTPS with Clerk-authenticated requests.

Supporting tools include a simulation CLI and an email preview app, but they are not part of the primary production request path.

## High-Level Container Diagram

```mermaid
flowchart LR
  Student[Student Browser]
  Instructor[Instructor Browser]
  ClerkUI[Clerk Hosted/Auth UI]

  Web[Web App\napps/web\nReact SPA Static Site]
  StaticHosting[DigitalOcean App Platform\nStatic Site]

  subgraph SCALE[SCALE LXP Backend]
    API[API Service\napps/api\nExpress REST API]
    Webhooks[Webhooks Service\napps/webhooks\nExternal Events]
    Workers[Workers Service\napps/workers\nBull Processors + Cron]
    Services[Domain Services\nservices/*]
    Models[Mongoose Models\nservices/**/*.model.js]
    Queues[Bull Queues\nlib/queues]
  end

  Mongo[(MongoDB)]
  Redis[(Redis\nBull Queue Store)]
  Clerk[Clerk\nAuth + Orgs]
  OpenAI[OpenAI\nSimulation + AI APIs]
  SendGrid[SendGrid\nTransactional Email]
  Spaces[DigitalOcean Spaces\nObject Storage]
  Hosting[DigitalOcean App Platform\nDocker Runtime]

  Student -->|HTTPS| Web
  Instructor -->|HTTPS| Web
  Web -->|HTTPS API requests| API
  Web -. deployed on .-> StaticHosting
  Student -->|sign in/session| ClerkUI
  Instructor -->|sign in/session| ClerkUI
  ClerkUI --> Clerk

  API --> Services
  Services --> Models
  Models --> Mongo
  Services --> Queues
  Queues --> Redis

  Webhooks --> Services
  Webhooks --> Models
  Webhooks --> Mongo
  Clerk -->|Svix webhooks| Webhooks

  Workers --> Queues
  Workers --> Services
  Workers --> Models
  Workers --> Mongo
  Workers --> OpenAI
  Workers --> SendGrid

  Services --> OpenAI
  Services --> SendGrid
  Services --> Spaces
  API -. deployed on .-> Hosting
  Webhooks -. deployed on .-> Hosting
  Workers -. deployed on .-> Hosting
```

## Runtime Component Diagram

```mermaid
flowchart TB
  subgraph Apps[Deployable Apps]
    WebApp[apps/web\nVite React SPA]
    API[apps/api/index.js\nMain Express API]
    Webhooks[apps/webhooks/index.js\nWebhook Express API]
    Workers[apps/workers/index.js\nWorker Express App + Bull Board]
    SimCLI[apps/sim-cli\nSimulation CLI]
    EmailPreview[apps/email-preview\nEmail Template Preview]
  end

  subgraph Shared[Shared Backend Code]
    Router[services/index.js\n/v1 Router]
    Middleware[middleware/auth.js\nClerk Auth + RBAC]
    Domain[Domain Controllers + Services\nservices/*]
    ModelLoader[models/index.js\nAuto-load Mongoose Models]
    QueueLib[lib/queues\nQueue Definitions + Workers]
    EmailLib[lib/sendGrid + lib/emails\nEmail Rendering + Sending]
    OpenAILib[lib/openai + services/openai\nOpenAI Client + AI Routes]
    StorageLib[lib/spaces.js + lib/s3.js\nS3-Compatible Uploads]
  end

  subgraph Persistence[Persistence + Infrastructure]
    Mongo[(MongoDB)]
    Redis[(Redis)]
  end

  API --> Router
  API --> Middleware
  API --> ModelLoader
  Router --> Domain
  Domain --> Mongo
  Domain --> QueueLib
  Domain --> EmailLib
  Domain --> OpenAILib
  Domain --> StorageLib

  Webhooks --> Domain
  Webhooks --> ModelLoader
  Webhooks --> Mongo

  Workers --> QueueLib
  Workers --> ModelLoader
  Workers --> Domain
  QueueLib --> Redis
  QueueLib --> Mongo

  SimCLI --> Domain
  EmailPreview --> EmailLib
```

## Primary Components

| Component | Location | Responsibility | Primary Data In | Primary Data Out |
| --- | --- | --- | --- | --- |
| API service | `apps/api/` | Serves the `/v1` REST API, applies Clerk middleware, connects to MongoDB, and mounts domain routes. | Browser requests, Clerk session claims, JSON payloads | JSON responses, MongoDB writes, queue jobs |
| Webhooks service | `apps/webhooks/` | Receives external provider events, currently Clerk webhooks. | Signed provider webhooks | Member, organization, and membership synchronization records |
| Workers service | `apps/workers/` | Runs Bull processors, scheduled jobs, and Bull Board queue UI. | Redis queue jobs, cron definitions, MongoDB records | Ledger entries, job status updates, email sends, OpenAI batch updates |
| Domain services | `services/*` | Implements application business logic by domain. | Authenticated requests, worker jobs, webhook events | Domain model reads/writes, queued work, external API calls |
| Mongoose model loader | `models/index.js` | Registers every `*.model.js` file under `services/`. | Service model definitions | Registered MongoDB models |
| Auth middleware | `middleware/auth.js` | Enforces authentication, organization context, role checks, and member/org hydration. | Clerk identity and request context | Authorized request context or rejected request |
| Queue library | `lib/queues/` | Defines Bull queues and worker processors. | Enqueued jobs, Redis configuration | Worker execution, job lifecycle updates |
| OpenAI integration | `lib/openai/`, `services/openai/`, `services/ledger/` | Provides general AI endpoints and simulation outcome generation. | Prompts, simulation context, ledger history, images/audio where applicable | Structured AI responses, ledger values, auxiliary AI outputs |
| Email integration | `lib/sendGrid/`, `lib/emails/` | Renders email templates and sends transactional email through SendGrid. | Notification records, template props | Email delivery requests and delivery status |
| Object storage | `lib/spaces.js`, `lib/s3.js` | Uploads files to DigitalOcean Spaces or S3-compatible storage. | Uploaded files or image buffers | Public or stored object URLs |
| MongoDB | External | Primary system of record for users, organizations, classrooms, scenarios, submissions, jobs, ledgers, notifications, cron jobs, and variables. | Mongoose reads/writes | Persisted application state |
| Redis | External | Queue backing store for Bull. | Queue job payloads and metadata | Worker-readable jobs and queue state |
| Clerk | External | User authentication, organizations, memberships, and webhook events. | User sessions, org changes, membership events | Auth claims, webhook events |
| SendGrid | External | Transactional email provider. | Rendered email content and recipients | Delivered email or provider error |
| OpenAI | External | AI simulation and auxiliary AI capabilities. | Structured prompts and request payloads | JSON simulation results or AI-generated outputs |

## Domain Model Map

```mermaid
erDiagram
  Organization ||--o{ Member : contains
  Organization ||--o{ Classroom : owns
  Organization ||--o{ StoreType : defines
  Organization ||--o{ ClassroomTemplate : defines
  Organization ||--o{ VariableDefinition : defines

  Classroom ||--o{ Enrollment : has
  Classroom ||--o{ Store : contains
  Classroom ||--o{ Scenario : contains
  Classroom ||--o{ ScenarioOutcome : has

  Member ||--o{ Enrollment : joins
  Member ||--o{ Store : owns
  Member ||--o{ Submission : submits

  StoreType ||--o{ Store : templates
  Store ||--o{ VariableValue : has
  VariableDefinition ||--o{ VariableValue : describes

  Scenario ||--o{ Submission : receives
  Scenario ||--o{ ScenarioOutcome : resolves
  Scenario ||--o{ SimulationJob : creates
  Scenario ||--o{ SimulationBatch : groups

  Submission ||--o{ VariableValue : has
  ScenarioOutcome ||--o{ VariableValue : has
  SimulationJob ||--o{ LedgerEntry : produces
  SimulationBatch ||--o{ SimulationJob : contains
  Store ||--o{ LedgerEntry : records
  Member ||--o{ Notification : receives
  CronJob ||--o{ WorkerExecution : schedules
```

> Note: The diagram expresses logical relationships used by the application. Exact schema fields and cardinality are defined in the Mongoose models under `services/**/*.model.js`.

## API Request Data Flow

```mermaid
sequenceDiagram
  autonumber
  participant Browser as Student/Instructor Browser
  participant Clerk as Clerk
  participant API as API Service
  participant Auth as Auth Middleware
  participant Service as Domain Service
  participant Mongo as MongoDB
  participant Redis as Redis/Bull
  participant External as External Provider

  Browser->>Clerk: Authenticate user and select organization
  Clerk-->>Browser: Session token and org context
  Browser->>API: HTTPS request to /v1/* with session
  API->>Auth: Validate request context
  Auth->>Clerk: Resolve user when needed
  Auth->>Mongo: Hydrate or create Member/Organization records
  Auth-->>API: Authorized request context
  API->>Service: Route to controller/service
  Service->>Mongo: Read or write domain records
  opt Async work required
    Service->>Redis: Enqueue Bull job
  end
  opt External operation required
    Service->>External: Call OpenAI, SendGrid, Clerk, or storage
  end
  Service-->>API: Domain result
  API-->>Browser: JSON response
```

### API Flow Description

1. A student or instructor authenticates through Clerk and receives a session token and organization context.
2. The browser sends an HTTPS request to the API service under `/v1`.
3. The API service runs Clerk middleware and route-specific authorization checks.
4. `middleware/auth.js` validates the identity, resolves organization context, checks roles, and ensures local `Member` and `Organization` records exist when required.
5. The request is routed through `services/index.js` into the appropriate domain controller.
6. Domain services read from and write to MongoDB through Mongoose models.
7. If the request requires asynchronous processing, the service enqueues a Bull job in Redis.
8. If the request requires an external provider, the service calls the relevant integration, such as OpenAI, SendGrid, Clerk, or object storage.
9. The API service returns the domain result as JSON.

## Core Simulation Data Flow

The simulation flow is the most important cross-component workflow. It begins with instructor scenario management and ends with student-visible ledger entries.

```mermaid
sequenceDiagram
  autonumber
  participant Instructor as Instructor
  participant API as API Service
  participant Scenario as Scenario Services
  participant Mongo as MongoDB
  participant OutcomeQ as scenario-outcome-processing Queue
  participant Worker as Workers Service
  participant JobService as Job Service
  participant SimQ as simulation or simulation-batch Queue
  participant OpenAI as OpenAI
  participant Ledger as Ledger Service
  participant Student as Student

  Instructor->>API: Create classroom, variables, store types, and scenario
  API->>Scenario: Persist classroom/scenario configuration
  Scenario->>Mongo: Save Classroom, VariableDefinition, StoreType, Scenario

  Student->>API: Create store and submit decisions
  API->>Scenario: Validate membership, scenario, and submission payload
  Scenario->>Mongo: Save Store, VariableValue, Submission

  Instructor->>API: Enter or publish scenario outcome
  API->>Scenario: Save global outcome
  Scenario->>Mongo: Save ScenarioOutcome and outcome variables
  Scenario->>OutcomeQ: Enqueue outcome processing job

  OutcomeQ->>Worker: Process outcome job
  Worker->>Mongo: Load scenario, classroom, stores, submissions, policy, history
  Worker->>JobService: Create simulation jobs
  JobService->>Mongo: Save SimulationJob records

  alt Direct simulation mode
    JobService->>SimQ: Enqueue one job per student/store
    SimQ->>Worker: Process simulation job
    Worker->>OpenAI: Send simulation context and schema
    OpenAI-->>Worker: Structured simulation result
    Worker->>Ledger: Create ledger entry
    Ledger->>Mongo: Save LedgerEntry and job status
  else Batch simulation mode
    JobService->>SimQ: Enqueue simulation batch
    Worker->>OpenAI: Submit OpenAI Batch request
    Worker->>Mongo: Save SimulationBatch status
    Worker->>OpenAI: Poll or retrieve batch results
    OpenAI-->>Worker: Batch output records
    Worker->>Ledger: Create ledger entries from batch output
    Ledger->>Mongo: Save LedgerEntry records and job statuses
  end

  Student->>API: View results and leaderboard
  API->>Mongo: Read LedgerEntry and class summary data
  API-->>Student: Simulation results, narrative, rankings, and history
```

### Simulation Flow Description

1. The instructor creates or configures classroom data, including store types, variable definitions, and scenarios.
2. Students enroll in the classroom, create stores, and submit weekly scenario decisions.
3. The instructor enters the scenario outcome. This outcome applies globally, while each student impact depends on store setup, submission choices, and ledger history.
4. The scenario outcome controller persists the outcome and enqueues a `scenario-outcome-processing` job.
5. The workers service loads the scenario, classroom, enrolled stores, submissions, missing-submission policy, and relevant history.
6. Missing submissions are handled according to classroom policy. The worker can create default submissions, forward previous decisions, use AI-generated defaults, skip entries, or require instructor review depending on configured behavior.
7. `JobService` creates `SimulationJob` records for each student/store that should receive a result.
8. In direct mode, jobs are processed through the `simulation` queue. Each job sends a structured prompt to OpenAI and writes one `LedgerEntry`.
9. In batch mode, the system creates a `SimulationBatch`, submits work to the OpenAI Batch API, tracks provider status, ingests output, and writes ledger entries.
10. Students and instructors retrieve ledger entries, summaries, history, and leaderboard data through the API.

## Webhook Data Flow

```mermaid
sequenceDiagram
  autonumber
  participant Clerk as Clerk
  participant Webhooks as Webhooks Service
  participant Verify as Svix Verification
  participant Controller as Clerk Webhook Controller
  participant Mongo as MongoDB

  Clerk->>Webhooks: Send signed user/org/membership event
  Webhooks->>Verify: Verify Svix headers and payload
  Verify-->>Webhooks: Trusted event or reject
  Webhooks->>Controller: Dispatch event by type
  Controller->>Mongo: Create, update, or deactivate Member/Organization records
  Controller-->>Webhooks: Processing result
  Webhooks-->>Clerk: 2xx response
```

### Webhook Flow Description

1. Clerk sends signed webhook events to the webhooks service under `/v1/webhooks/clerk`.
2. The webhook middleware verifies the event signature using Svix.
3. Trusted events are routed to the Clerk webhook controller.
4. User, organization, and membership events synchronize local `Member` and `Organization` records in MongoDB.
5. The webhooks service returns a success response to Clerk after processing.

## Queue and Worker Data Flow

```mermaid
flowchart LR
  API[API Service]
  Domain[Domain Services]
  Redis[(Redis)]
  Workers[Workers Service]
  Mongo[(MongoDB)]
  OpenAI[OpenAI]
  SendGrid[SendGrid]

  subgraph Queues[Bull Queues]
    EmailQ[email-sending]
    SimulationQ[simulation]
    BatchQ[simulation-batch]
    OutcomeQ[scenario-outcome-processing]
    PdfQ[pdf-generation\ncurrently disabled]
    SmsQ[sms\ncurrently disabled]
    PushQ[push\ncurrently disabled]
  end

  API --> Domain
  Domain --> EmailQ
  Domain --> OutcomeQ
  Domain --> SimulationQ
  Domain --> BatchQ
  EmailQ --> Redis
  OutcomeQ --> Redis
  SimulationQ --> Redis
  BatchQ --> Redis
  PdfQ -. optional .-> Redis
  SmsQ -. optional .-> Redis
  PushQ -. optional .-> Redis

  Redis --> Workers
  Workers --> Mongo
  Workers --> OpenAI
  Workers --> SendGrid
```

### Queue Flow Description

- `email-sending` processes notification email delivery through SendGrid.
- `scenario-outcome-processing` starts scenario closeout work after an instructor saves an outcome.
- `simulation` processes individual simulation jobs in direct mode.
- `simulation-batch` submits, tracks, and ingests OpenAI Batch API work in batch mode.
- `pdf-generation`, `sms`, and `push` workers exist in the codebase but are currently disabled or not part of the active production flow based on worker registration.

The workers service also supports scheduled jobs through Mongo-backed cron definitions and worker registry helpers.

## Notification and Email Data Flow

```mermaid
sequenceDiagram
  autonumber
  participant Service as Domain Service
  participant Mongo as MongoDB
  participant Redis as email-sending Queue
  participant Worker as Email Worker
  participant Renderer as React Email Renderer
  participant SendGrid as SendGrid
  participant User as Recipient

  Service->>Mongo: Create Notification record
  Service->>Redis: Enqueue email job
  Redis->>Worker: Deliver queued email job
  Worker->>Renderer: Render template with props
  Renderer-->>Worker: HTML/text email
  Worker->>SendGrid: Send email request
  SendGrid-->>User: Deliver email
  SendGrid-->>Worker: Provider response
  Worker->>Mongo: Update notification or job status when applicable
```

## Object Storage Data Flow

```mermaid
flowchart LR
  Browser[Browser or API Client]
  API[API Service]
  Multer[Multer / Upload Handler]
  Sharp[Sharp Image Processing\nwhen used]
  Spaces[DigitalOcean Spaces\nS3-Compatible Storage]
  Mongo[(MongoDB)]

  Browser -->|multipart upload or file payload| API
  API --> Multer
  API --> Sharp
  Multer --> Spaces
  Sharp --> Spaces
  Spaces -->|object URL/key| API
  API --> Mongo
  API -->|resource metadata| Browser
```

## Data Stores and Persistence

### MongoDB

MongoDB is the primary system of record. Mongoose models are registered through `models/index.js`, which loads model files from `services/**/*.model.js`.

Core persisted entities include:

- Organizations and members.
- Classrooms and enrollments.
- Store types, stores, variable definitions, and variable values.
- Scenarios, scenario outcomes, and submissions.
- Simulation jobs, simulation batches, and ledger entries.
- Notifications.
- Cron job definitions.

### Redis

Redis is used as the Bull queue backing store. It stores queue jobs, processing state, retries, delays, and job metadata for asynchronous workloads.

### Object Storage

DigitalOcean Spaces or another S3-compatible service stores uploaded files and generated or processed objects when those features are used.

## External Dependencies

| Provider | Purpose | Data Exchanged |
| --- | --- | --- |
| Clerk | Authentication, organizations, membership state, webhooks | User identity, organization IDs, roles, membership events |
| OpenAI | Simulation processing and auxiliary AI endpoints | Simulation context, prompts, structured output requests, AI responses |
| SendGrid | Transactional email | Recipient address, rendered template content, delivery metadata |
| DigitalOcean App Platform | Docker hosting for API, webhooks, and workers | Runtime configuration, application traffic, logs |
| DigitalOcean Spaces or S3-compatible storage | File and object storage | Uploaded files, generated objects, object keys/URLs |
| MongoDB provider | Primary database | Application records and operational state |
| Redis provider | Queue storage | Bull job payloads and processing metadata |

## Security and Control Boundaries

```mermaid
flowchart TB
  subgraph ClientBoundary[Client Boundary]
    Browser[Student/Instructor Browser]
  end

  subgraph IdentityBoundary[Identity Provider Boundary]
    Clerk[Clerk]
  end

  subgraph AppBoundary[SCALE LXP Application Boundary]
    API[API Service]
    Webhooks[Webhooks Service]
    Workers[Workers Service]
    Services[Domain Services]
  end

  subgraph DataBoundary[Data Persistence Boundary]
    Mongo[(MongoDB)]
    Redis[(Redis)]
    Storage[(Object Storage)]
  end

  subgraph VendorBoundary[External Processing Boundary]
    OpenAI[OpenAI]
    SendGrid[SendGrid]
  end

  Browser -->|HTTPS + Clerk session| API
  API -->|auth/session validation| Clerk
  Clerk -->|signed webhook| Webhooks
  API --> Services
  Webhooks --> Services
  Workers --> Services
  Services --> Mongo
  Services --> Redis
  Services --> Storage
  Services --> OpenAI
  Services --> SendGrid
```

Important control points:

- Browser traffic should use HTTPS.
- Clerk provides authentication and organization context.
- Application middleware enforces role and organization authorization.
- MongoDB stores application data and should be protected with provider encryption, network restrictions, and least-privilege credentials.
- Redis stores queue payloads and should be treated as sensitive because jobs may contain identifiers or processing context.
- OpenAI receives simulation context required to produce ledger outputs.
- SendGrid receives recipient and message data required for transactional email.
- Object storage may contain uploaded or generated files and should use restricted credentials and appropriate bucket permissions.

## End-to-End Data Flow Summary

1. **Identity creation and synchronization:** Users authenticate through Clerk. Clerk webhooks synchronize user, organization, and membership changes into MongoDB through the webhooks service.
2. **Classroom setup:** Instructors use the API to create organizations, classrooms, enrollments, store types, variable definitions, and scenarios. These records are stored in MongoDB.
3. **Student setup:** Students join classes, create stores, and save variable values. Store and enrollment data is persisted in MongoDB and scoped to the classroom and organization.
4. **Weekly submissions:** Students submit scenario decisions through the API. Submissions and their variable values are stored in MongoDB.
5. **Outcome entry:** Instructors enter global scenario outcomes. The API stores the outcome and enqueues outcome processing in Redis.
6. **Job creation:** Workers load the scenario, outcome, submissions, stores, class policy, and ledger history, then create simulation jobs or batches in MongoDB and Redis.
7. **AI processing:** Workers send required simulation context to OpenAI. Results return as structured data and are validated or converted into ledger entries.
8. **Ledger publication:** Ledger entries are stored in MongoDB and become available to students and instructors through the API.
9. **Notifications:** Domain services create notifications and enqueue email jobs. Workers render templates and send messages through SendGrid.
10. **Ongoing operations:** Workers process scheduled jobs, retries, queue monitoring, and background maintenance. Administrators can inspect worker state through Bull Board when enabled.

## Deployment View

```mermaid
flowchart LR
  subgraph DigitalOcean[DigitalOcean App Platform]
    APIContainer[API Container\nstart:api]
    WebhookContainer[Webhooks Container\nstart:webhooks]
    WorkerContainer[Workers Container\nstart:workers]
  end

  Mongo[(MongoDB)]
  Redis[(Redis)]
  Clerk[Clerk]
  OpenAI[OpenAI]
  SendGrid[SendGrid]
  Spaces[DigitalOcean Spaces]

  APIContainer --> Mongo
  APIContainer --> Redis
  APIContainer --> Clerk
  APIContainer --> OpenAI
  APIContainer --> SendGrid
  APIContainer --> Spaces

  WebhookContainer --> Mongo
  WebhookContainer --> Clerk

  WorkerContainer --> Mongo
  WorkerContainer --> Redis
  WorkerContainer --> OpenAI
  WorkerContainer --> SendGrid
```

## Operational Notes

- All three primary apps share the same repository and model definitions.
- The API and workers both connect to MongoDB because worker processors need direct access to simulation, job, and ledger data.
- Queue payloads should remain minimal and should generally reference MongoDB record IDs instead of duplicating large or sensitive records.
- Direct simulation mode processes one job per student/store. Batch mode groups work through OpenAI Batch API and tracks the batch lifecycle in MongoDB.
- The webhooks app is intentionally separated from the API app so provider events can be scaled, secured, and monitored independently.
- Email rendering is separated from email sending so templates can be previewed and tested independently.
- Disabled workers and unused integrations should not be represented as active production dependencies unless enabled in deployment and worker registration.

## Source Reference Map

| Area | Key Paths |
| --- | --- |
| API app | `apps/api/index.js` |
| Webhooks app | `apps/webhooks/index.js`, `services/webhooks/` |
| Workers app | `apps/workers/index.js`, `services/workers/` |
| Main service router | `services/index.js` |
| Auth middleware | `middleware/auth.js` |
| Queue definitions and workers | `lib/queues/` |
| Simulation jobs | `services/job/`, `lib/queues/simulation-worker.js`, `lib/queues/simulation-batch-worker.js`, `lib/queues/outcome-processing-worker.js` |
| Ledger generation | `services/ledger/` |
| OpenAI integration | `lib/openai/`, `services/openai/` |
| Email integration | `lib/sendGrid/`, `lib/emails/`, `services/notifications/` |
| Object storage | `lib/spaces.js`, `lib/s3.js` |
| Model registration | `models/index.js` |
| Domain models | `services/**/*.model.js` |
