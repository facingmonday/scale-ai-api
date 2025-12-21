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

- **Models**: `Store`, `StoreVariableValue`
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

### Authentication Routes

#### `GET /v1/auth/me`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get authenticated admin user info

### User Profile Routes (`/v1/me`)

#### `GET /v1/me`

- **Auth**: `requireMemberAuth()`
- **Description**: Get current user profile

#### `PATCH /v1/me`

- **Auth**: `requireMemberAuth()`
- **Description**: Update current user profile

#### `POST /v1/me/organizations`

- **Auth**: `requireMemberAuth()`
- **Description**: Create organization for current user

#### `PUT /v1/me/organizations/:id`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update organization

### Members Routes (`/v1/members`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `POST /v1/members`

- **Description**: Create a new member

#### `GET /v1/members`

- **Description**: Get all members

#### `GET /v1/members/search`

- **Description**: Search members

#### `GET /v1/members/stats`

- **Description**: Get member statistics

#### `GET /v1/members/:id`

- **Description**: Get member by ID

#### `PUT /v1/members/:id`

- **Description**: Update member

#### `DELETE /v1/members/:id`

- **Description**: Remove member

#### `PUT /v1/members/:id/organization-membership`

- **Description**: Update organization membership

#### `POST /v1/members/add-existing`

- **Description**: Add existing Clerk user to organization

#### `POST /v1/members/export`

- **Description**: Export members as CSV

### Organizations Routes (`/v1/organizations`)

#### `POST /v1/organizations`

- **Auth**: `requireMemberAuth()`
- **Description**: Create a new organization

### Notifications Routes (`/v1/notifications`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/notifications`

- **Description**: Get all notifications

#### `GET /v1/notifications/web`

- **Description**: Get web notifications

#### `GET /v1/notifications/unread-count`

- **Description**: Get unread notification count

#### `POST /v1/notifications`

- **Description**: Create notification

#### `PUT /v1/notifications/status`

- **Description**: Update all notifications status

#### `PUT /v1/notifications/:id`

- **Description**: Update notification status

### OpenAI Routes (`/v1/openai`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `POST /v1/openai/completion`

- **Description**: Get AI text completion

#### `POST /v1/openai/generate`

- **Description**: Generate image

#### `POST /v1/openai/analyze-image`

- **Description**: Analyze image (file upload)

#### `POST /v1/openai/transcribe-audio`

- **Description**: Transcribe audio (file upload)

### Utils Routes (`/v1/utils`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/utils/transcribe-video`

- **Description**: Transcribe video

#### `POST /v1/utils/event-objects-from-json`

- **Description**: Create event objects from JSON

#### `POST /v1/utils/event-objects-from-text`

- **Description**: Create event objects from text

#### `POST /v1/utils/event-objects-from-image`

- **Description**: Create event objects from image (file upload)

### Classroom Routes (`/v1/admin/class`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `POST /v1/admin/class`

- **Description**: Create a new classroom
- **Body**: `{ name, description }`

#### `GET /v1/admin/class/:classroomId/dashboard`

- **Description**: Get class dashboard with stats

#### `POST /v1/admin/class/:classroomId/invite`

- **Description**: Invite student to class via email
- **Body**: `{ email }`

### Enrollment Routes

#### Student Routes

##### `POST /v1/class/:classroomId/join`

- **Auth**: `requireMemberAuth()`
- **Description**: Student joins a class

#### Admin Routes

##### `GET /v1/admin/class/:classroomId/roster`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get class roster (all enrolled students)

##### `DELETE /v1/admin/class/:classroomId/student/:userId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Remove student from class (soft delete)

### Store Routes

#### Student Routes

##### `POST /v1/student/store`

- **Auth**: `requireMemberAuth()`
- **Description**: Create store for authenticated student
- **Body**: `{ classroomId, shopName, storeType, dailyCapacity, deliveryRatio, startingBalance?, variables? }`

##### `GET /v1/student/store?classroomId=...`

- **Auth**: `requireMemberAuth()`
- **Description**: Get student's store for a class

#### Admin Routes

##### `GET /v1/admin/class/:classroomId/store/:userId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get student's store (admin view)

### VariableDefinition Routes (`/v1/admin/variables`)

#### `POST /v1/admin/variables`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create variable definition
- **Body**: `{ classroomId, key, label, description?, appliesTo, dataType, inputType?, options?, defaultValue?, min?, max?, required?, affectsCalculation? }`

#### `PUT /v1/admin/variables/:key?classroomId=...`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update variable definition

#### `GET /v1/admin/variables?classroomId=...&appliesTo=...`

- **Auth**: `requireAuth()` (admin or enrolled user)
- **Description**: Get variable definitions (filtered by appliesTo if provided)

#### `DELETE /v1/admin/variables/:key?classroomId=...`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Delete variable definition (soft delete)

### Scenario Routes

#### Admin Routes

##### `POST /v1/admin/scenario`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create a new scenario
- **Body**: `{ classroomId, title, description?, variables? }`
- **Note**: Automatically queues email notifications to all enrolled students

##### `PUT /v1/admin/scenarios/:scenarioId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update scenario (before publish/close)

##### `POST /v1/admin/scenarios/:scenarioId/publish`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Publish scenario to students

##### `POST /v1/admin/scenarios/:scenarioId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Set global scenario outcome
- **Body**: `{ actualWeather?, demandShift?, notes?, randomEventsEnabled? }`

##### `POST /v1/admin/scenarios/:scenarioId/preview`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Preview AI outcomes (does not write ledger entries)
- **Status**: Placeholder - requires AI Service

##### `POST /v1/admin/scenarios/:scenarioId/approve`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Approve scenario and run AI simulation
- **Status**: Placeholder - requires AI Service and Ledger Service

##### `POST /v1/admin/scenarios/:scenarioId/rerun`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Rerun scenario (delete ledger entries and recalculate)
- **Status**: Placeholder - requires AI Service and Ledger Service

#### Student Routes

##### `GET /v1/student/scenario/current?classroomId=...`

- **Auth**: `requireMemberAuth()`
- **Description**: Get current active scenario for student

### Submission Routes

#### Student Routes

##### `POST /v1/student/submission`

- **Auth**: `requireMemberAuth()`
- **Description**: Submit weekly decisions
- **Body**: `{ scenarioId, variables }`
- **Note**: Validates variables, enforces submission order

##### `GET /v1/student/submission/status?scenarioId=...`

- **Auth**: `requireMemberAuth()`
- **Description**: Get submission status for a scenario

#### Admin Routes

##### `GET /v1/admin/scenarios/:scenarioId/submissions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all submissions for a scenario (with missing submissions list)

### Webhook Routes (`/v1/webhooks`)

#### Clerk Webhooks

##### `POST /v1/webhooks/clerk`

- **Auth**: Webhook signature verification
- **Description**: Handles Clerk webhook events (user.created, user.updated, user.deleted)

#### Stripe Webhooks

##### `POST /v1/webhooks/stripe`

- **Auth**: Webhook signature verification
- **Description**: Handles Stripe webhook events

#### Telnyx Webhooks

##### `POST /v1/webhooks/telnyx`

- **Auth**: Webhook signature verification
- **Description**: Handles Telnyx SMS webhook events

##### `GET /v1/webhooks/telnyx/stats/:eventId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get SMS delivery stats

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
- **StoreVariableValue** - Dynamic store variables
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

- **Email Sending** - Email notifications
- **PDF Generation** - PDF document generation
- **SMS Sending** - SMS notifications
- **Push Sending** - Push notifications

### Queue Monitoring

Bull Board is available at `/admin/queues` on the workers service (requires basic auth in production).

## Email Templates

Email templates are built with **React Email** and located in `lib/emails/templates/`.

### Available Templates

- `ScenarioCreatedEmail` - Notifies students when a new scenario is created
- `DailyStatsEmail` - Daily statistics report
- `EventInvitationEmail` - Event invitations
- `OrderCreatedEmail` - Order confirmation
- `OrderCancelledEmail` - Order cancellation
- `TicketClaimedEmail` - Ticket claim notification
- `TicketReminderEmail` - Ticket reminder
- `TicketsGeneratedEmail` - Tickets generated notification
- `TicketTemplateEmail` - Ticket template
- `ShareTemplateEmail` - Template sharing

### Previewing Templates

Fixtures for email preview are in `apps/email-preview/fixtures/`. Run `npm run email:preview` to preview templates.

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
