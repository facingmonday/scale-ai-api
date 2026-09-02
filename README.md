# SCALE LXP API

## Start the Development Servers

From the repository root, use the standard development command to start the API, web app, and documentation server:

```bash
npm run dev
```

To start every local application service—including webhooks, workers, and the admin app—use:

```bash
npm run dev:all
```

Use `npm run dev:integrations` when local Stripe and Clerk webhook relays are also needed. See [Setup & Development](#setup--development) for first-time installation, environment configuration, and individual service commands.

A classroom-based supply chain simulation platform built with Node.js, Express, and MongoDB. Students manage pizza shops through weekly challenges, with AI-driven outcomes calculated per student.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture & Apps](#architecture--apps)
- [Project Structure](#project-structure)
- [Services & Models](#services--models)
- [API Routes](#api-routes)
- [Profile Types & Profiles](#profile-types--profiles)
- [Authentication](#authentication)
- [Setup & Development](#setup--development)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)

## Overview

SCALE LXP is a learning platform where:

- **Instructors** create classes, define challenges, and set global outcomes
- **Students** join classes, set up profiles, and submit weekly decisions
- **AI** calculates individualized results based on profile config, challenge context, and student decisions
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

## Architecture & Apps

The application consists of six deployable or development components inside the [apps](file:///Users/jasonprice/Apps/scale-ai-api/apps) directory:

1. **Web App** ([apps/web/](file:///Users/jasonprice/Apps/scale-ai-api/apps/web)) - React + Vite + TypeScript frontend. It is student/instructor UI (deployed as a static site on DigitalOcean).
2. **API Service** ([apps/api/](file:///Users/jasonprice/Apps/scale-ai-api/apps/api)) - Express/Node REST API service. It handles requests, interacts with MongoDB, and enqueues jobs to Redis.
3. **Webhooks Service** ([apps/webhooks/](file:///Users/jasonprice/Apps/scale-ai-api/apps/webhooks)) - Specialized webhook receiver handling external triggers (such as Clerk and Stripe webhooks).
4. **Workers Service** ([apps/workers/](file:///Users/jasonprice/Apps/scale-ai-api/apps/workers)) - Background queue worker service (Bull/Redis) processing simulations, batches, and emails, and managing cron jobs. Mounts the Bull Board UI at `/admin/queues`.
5. **Admin Developer App** ([apps/admin/](file:///Users/jasonprice/Apps/scale-ai-api/apps/admin)) - Local-only simulation runner and React Email preview tool.
6. **Docs App** ([apps/docs/](file:///Users/jasonprice/Apps/scale-ai-api/apps/docs)) - VitePress API and developer documentation.

Backend services share the same Node codebase and are deployed separately. The web app is a self-contained Vite project with its own `package.json` (not an npm workspace).

## Project Structure

```
scale-ai-api/
├── apps/
│   ├── web/               # React frontend (Vite, separate package.json)
│   ├── api/               # Main API server
│   ├── webhooks/          # Webhook handlers
│   ├── workers/           # Background workers
│   ├── admin/             # Local simulation runner and email preview
│   └── docs/              # VitePress documentation
├── services/              # Business logic services
│   ├── auth/
│   ├── challenge/         # Challenge creation and execution
│   ├── classroom/         # Classroom management
│   ├── classroomTemplate/ # Default classroom setups
│   ├── cron/              # Cron schedule models
│   ├── decision/          # Decision collection and validation
│   ├── enrollment/        # Student enrollment in classrooms
│   ├── job/               # Background simulation job models and workers
│   ├── join/              # Public join link processing
│   ├── ledger/            # Financial/metrics ledger entries
│   ├── licensing/         # License verification
│   ├── members/           # User records (synced from Clerk)
│   ├── metricDefinition/  # Custom metrics defined for classroom ledgers
│   ├── notifications/     # In-app notifications
│   ├── openai/            # OpenAI service calls
│   ├── organizations/     # Multi-tenant organization records
│   ├── outcome/           # Challenge global outcome definition
│   ├── profile/           # Student store profiles and overrides
│   ├── profileType/       # Templates for student stores (e.g. food truck)
│   ├── variableDefinition/# Dynamic variable schemas
│   ├── webhooks/          # Webhook business logic
│   └── workers/           # Background worker orchestration and registry
├── lib/                   # Shared utilities
│   ├── emails/            # Email templates
│   ├── queues/            # Queue workers
│   ├── sendGrid/          # Email sending
│   └── openai/            # AI integrations
├── middleware/            # Express middleware
├── models/                # Mongoose model loader
└── constants/             # Constants and enums
```

## Services & Models

### Core Services

#### Classroom Service

- **Model**: `Classroom` - Represents a course instance
- **Purpose**: Top-level container for all class-related data

#### Enrollment Service

- **Model**: `Enrollment` - Links users to classes with roles
- **Purpose**: Manages class membership and role-based access

#### Profile Service

- **Models**: `Profile`, `ProfileType`, `VariableValue`
- **Purpose**: Manages student business setup (one profile per student per class)
- **Profile Types**: Organization-scoped templates that define default variable values
- **Profiles**: Classroom-scoped student instances created from profile types

#### VariableDefinition Service

- **Model**: `VariableDefinition`
- **Purpose**: Defines dynamic questions/variables for profiles, challenges, and decisions

#### Challenge Service

- **Model**: `Challenge`
- **Purpose**: Manages weekly simulation contexts (formerly scenarios)

#### Outcome Service

- **Model**: `Outcome`
- **Purpose**: Manages weekly global outcome variables (formerly scenario outcomes)

#### Decision Service

- **Model**: `Decision`
- **Purpose**: Collects weekly student decisions (formerly submissions)

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

### Profile Routes

#### Student Routes

##### `POST /v1/student/profile`

- **Auth**: `requireMemberAuth()`
- **Description**: Create profile for authenticated student (formerly store)
- **Body**: `{ classroomId, shopName, storeDescription, storeLocation, profileType (ObjectId), variables? }`
- **See**: [Profile Types & Profiles](#profile-types--profiles) section for detailed documentation

##### `PUT /v1/student/profile`

- **Auth**: `requireMemberAuth()`
- **Description**: Update or create (upsert) student's profile (formerly store)
- **Body**: `{ classroomId, shopName?, storeDescription?, storeLocation?, profileType? (ObjectId), variables? }`
- **See**: [Profile Types & Profiles](#profile-types--profiles) section for detailed documentation

##### `GET /v1/student/profile`

- **Auth**: `requireMemberAuth()`
- **Description**: Get student's profile for a class (formerly store)
- **Query Params**: `classroomId` (required)

#### Admin Routes

##### `GET /v1/admin/class/:classroomId/profile/:userId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get student's profile (admin view, formerly store)

### ProfileType Routes (`/v1/admin/profile-types`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/admin/profile-types`

- **Description**: Get all profile types for the organization (formerly store types)

#### `GET /v1/admin/profile-types/:storeTypeId`

- **Description**: Get a specific profile type by ID

#### `POST /v1/admin/profile-types`

- **Description**: Create a new profile type
- **Body**: `{ key, label, description?, variables? }`

#### `PUT /v1/admin/profile-types/:storeTypeId`

- **Description**: Update a profile type
- **Body**: `{ label?, description?, variables? }`

#### `DELETE /v1/admin/profile-types/:storeTypeId`

- **Description**: Soft delete a profile type

#### `POST /v1/admin/profile-types/seed`

- **Description**: Seed default profile types for the organization (deprecated/removed)

**See**: [Profile Types & Profiles](#profile-types--profiles) section for detailed documentation.

### ProfileType Student Routes (`/v1/student/profile-types`)

#### `GET /v1/student/profile-types`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all active profile types for a classroom (for students to select when creating a profile)
- **Query Params**: `classroomId` (required)
- **Response**: Returns array of profile types with their variables populated
- **Note**: Only returns active profile types (inactive ones are hidden from students)

## Profile Types & Profiles

This section explains how profile types and profiles work, how to define variables, and how to set values. This is essential for building the frontend UI for profile configuration.

### Overview

**Profile Types** are organization-scoped templates that define default variable values for different types of profiles (e.g., "Food Truck", "Café", "Fine Dining"). Each organization can have its own set of profile types with customizable default values.

**Profiles** are student-specific business instances created from profile types. Each student can have one profile per classroom, and profiles inherit default values from their profile type but can be customized.

### Profile Types (Organization-Level)

Profile types are **organization-scoped** templates that define:

- **Basic Info**: `key` (unique identifier), `label` (display name), `description`
- **Default Variables**: All variable values stored in the `VariableValue` collection with `appliesTo: "profileType"`

#### Profile Type API Endpoints

##### Student Routes

##### `GET /v1/student/profile-types`

Get all active profile types for a classroom. Students use this to see available profile types when creating their profile.

**Query Parameters:**

- `classroomId` (required) - The classroom ID

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "profileTypeId",
      "key": "food_truck",
      "label": "Food Truck",
      "description": "A scrappy, mobile kitchen...",
      "variables": {
        "startingBalance": 5000,
        "startingInventory": 1000,
        "weeklyRent": 200,
        "maxDailyCapacity": 80,
        "staffRequired": 2,
        "weatherSensitivity": "high"
        // ... other variables
      },
      "isActive": true,
      "organization": "orgId",
      "createdDate": "2024-01-01T00:00:00.000Z",
      "updatedDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Note**: Only returns active profile types (inactive ones are hidden from students).

##### Admin Routes

All admin routes require `requireAuth()` and `checkRole("org:admin")`.

##### `GET /v1/admin/profile-types`

Get all profile types for the organization.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "profileTypeId",
      "key": "food_truck",
      "label": "Food Truck",
      "description": "A scrappy, mobile kitchen...",
      "variables": {
        "startingBalance": 5000,
        "startingInventory": 1000,
        "weeklyRent": 200,
        "maxDailyCapacity": 80,
        "staffRequired": 2,
        "weatherSensitivity": "high"
        // ... other variables
      },
      "isActive": true,
      "organization": "orgId",
      "createdDate": "2024-01-01T00:00:00.000Z",
      "updatedDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

##### `GET /v1/admin/profile-types/:profileTypeId`

Get a specific profile type by ID.

##### `POST /v1/admin/profile-types`

Create a new profile type.

**Request Body:**

```json
{
  "key": "food_truck",
  "label": "Food Truck",
  "description": "A scrappy, mobile kitchen...",
  "variables": {
    "startingBalance": 5000,
    "startingInventory": 1000,
    "weeklyRent": 200,
    "maxDailyCapacity": 80,
    "staffRequired": 2,
    "weatherSensitivity": "high"
    // ... any other variables
  }
}
```

**Note**: The `variables` object can contain any key-value pairs. These are stored as `VariableValue` documents with `appliesTo: "profileType"`.

##### `PUT /v1/admin/profile-types/:profileTypeId`

Update a profile type. You can update `label`, `description`, and `variables`.

**Request Body:**

```json
{
  "label": "Updated Food Truck",
  "description": "Updated description",
  "variables": {
    "startingBalance": 6000, // Updated value
    "newVariable": "newValue" // New variable added
    // Variables not included will be deleted
  }
}
```

**Important**: When updating `variables`, the entire object replaces the existing variables. Variables not included in the request will be deleted.

##### `DELETE /v1/admin/profile-types/:profileTypeId`

Soft delete a profile type (sets `isActive: false`).

##### `POST /v1/admin/profile-types/seed`

**Deprecated / removed**: profile type preset seeding is no longer supported. Create ProfileTypes (and their variables) via the ProfileType API/UI.

#### Profile Type Variables

Profile type variables are stored in the `VariableValue` collection with:

- `appliesTo: "profileType"`
- `ownerId: profileType._id`
- `variableKey: "startingBalance"` (or any key)
- `value: 5000` (the actual value)

Variables are automatically included in the response via the `variablePopulationPlugin`, which adds a `variables` object to the profile type when calling `toObject()` or `toJSON()`.

### Profiles (Student-Level)

Profiles are **classroom-scoped** and represent a student's business instance. Each student can have **one profile per classroom**.

#### Profile Structure

A profile contains:

- **Basic Info**: `shopName`, `storeDescription`, `storeLocation`
- **Profile Type Reference**: `profileType` (ObjectId reference to a `ProfileType`)
- **Variables**: Stored in `VariableValue` collection with `appliesTo: "profile"`

#### Profile Variable Value Precedence

When a profile is created, variable values are determined in this order (highest to lowest priority):

1. **Provided Values** - Values explicitly passed when creating/updating the profile
2. **Profile Type Values** - Default values stored on the selected ProfileType (via `VariableValue` with `appliesTo: "profileType"`)
3. **Variable Definition Defaults** - Default values from `VariableDefinition`

#### Profile API Endpoints

##### Student Routes

All student routes require `requireMemberAuth()`.

##### `POST /v1/student/profile`

Create a profile for the authenticated student.

**Request Body:**

```json
{
  "classroomId": "classroomId",
  "shopName": "Tony's Pizza",
  "storeDescription": "Best pizza in town",
  "storeLocation": "123 Main St",
  "profileType": "profileTypeId", // ObjectId of the profile type
  "variables": {
    "startingBalance": 6000, // Optional: override profile type default
    "customVariable": "value" // Optional: add custom variables
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile created successfully",
  "data": {
    "_id": "profileId",
    "shopName": "Tony's Pizza",
    "storeDescription": "Best pizza in town",
    "storeLocation": "123 Main St",
    "profileType": {
      "_id": "profileTypeId",
      "key": "food_truck",
      "label": "Food Truck"
    },
    "storeTypeKey": "food_truck", // For backward compatibility
    "storeTypeLabel": "Food Truck",
    "variables": {
      "startingBalance": 6000, // From provided values or profile type
      "startingInventory": 1000, // From profile type
      "weeklyRent": 200 // From profile type
      // ... all variables merged
    },
    "currentDetails": {
      "cashAfter": 6000,
      "inventoryAfter": 1000
      // ... ledger summary
    }
  }
}
```

##### `PUT /v1/student/profile`

Update or create (upsert) a profile.

**Request Body:** Same as `POST`, but `shopName`, `storeDescription`, `storeLocation`, and `profileType` are only required if creating a new profile.

**Note**: When updating `variables`, the entire object replaces existing variables. Variables not included will be deleted.

##### `GET /v1/student/profile?classroomId=classroomId`

Get the authenticated student's profile for a classroom.

**Response:** Same format as `POST` response.

##### Admin Routes

All admin routes require `requireAuth()` and `checkRole("org:admin")`.

##### `GET /v1/admin/class/:classroomId/profile/:userId`

Get a specific student's profile (admin view).

### Variable Definitions for Profiles

Variable definitions define the structure and validation rules for profile variables. They are **classroom-scoped** and apply to all profiles in that classroom.

#### Creating Variable Definitions

Use the VariableDefinition API to create definitions:

##### `POST /v1/admin/variables`

Create a variable definition for profiles.

**Request Body:**

```json
{
  "classroomId": "classroomId",
  "key": "startingBalance",
  "label": "Starting Balance",
  "description": "Initial cash available to the business",
  "appliesTo": "profile", // Must be "profile" for profile variables
  "dataType": "number",
  "inputType": "number", // or "slider"
  "defaultValue": 5000,
  "min": 0,
  "max": 100000,
  "required": true
}
```

**Field Descriptions:**

- `key` - Unique identifier (used in `variables` object)
- `label` - Display name for UI
- `description` - Help text/tooltip
- `appliesTo` - Must be `"profile"` for profile variables
- `dataType` - `"number"`, `"string"`, `"boolean"`, or `"select"`
- `inputType` - UI input type: `"text"`, `"number"`, `"slider"`, `"dropdown"`, `"checkbox"`, `"switch"`, etc.
- `defaultValue` - Default value if not provided
- `min`/`max` - Validation constraints (for numbers)
- `required` - Whether field is required

**Valid `dataType` and `inputType` combinations:**

- `dataType: "number"` → `inputType: "number"` or `"slider"`
- `dataType: "string"` → `inputType: "text"` or `"dropdown"`
- `dataType: "boolean"` → `inputType: "checkbox"` or `"switch"`
- `dataType: "select"` → `inputType: "dropdown"` (requires `options` array)

##### `GET /v1/admin/variables?classroomId=classroomId&appliesTo=profile`

Get all variable definitions for profiles in a classroom.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "defId",
      "key": "startingBalance",
      "label": "Starting Balance",
      "description": "Initial cash available",
      "appliesTo": "profile",
      "dataType": "number",
      "inputType": "number",
      "defaultValue": 5000,
      "min": 0,
      "max": 100000,
      "required": true,
      "isActive": true
    }
  ]
}
```

### Frontend Implementation Guide

#### 1. Profile Type Configuration UI (Admin)

**Step 1: Fetch Profile Types**

```javascript
GET /v1/admin/profile-types;
// Returns list of all profile types with their variables
```

**Step 2: Display Profile Types List**

- Show `label` and `description` for each profile type
- Display `variables` object (can be shown as key-value pairs or in a structured form)

**Step 3: Create/Edit Profile Type**

- Form fields: `key`, `label`, `description`
- Dynamic variables editor:
  - Allow adding/editing/removing variable key-value pairs
  - Variables can be any JSON-serializable values (numbers, strings, booleans, arrays, objects)
  - Store as `variables` object in request body

**Step 4: Delete Profile Type**

- Call `DELETE /v1/admin/profile-types/:profileTypeId`
- Note: This is a soft delete (`isActive: false`)

#### 2. Profile Creation UI (Student)

**Step 1: Fetch Available Profile Types**

```javascript
GET /v1/student/profile-types?classroomId={classroomId}
```

**Step 2: Fetch Variable Definitions**

```javascript
GET /v1/admin/variables?classroomId={classroomId}&appliesTo=profile
// Returns all variable definitions for profiles in this classroom
```

**Step 3: Display Profile Creation Form**

1. **Basic Fields:**
   - `shopName` (text input)
   - `storeDescription` (textarea)
   - `storeLocation` (text input)
   - `profileType` (dropdown/select from available profile types)

2. **Dynamic Variables Form:**
   - When a profile type is selected, fetch its variables
   - For each variable definition:
     - If variable exists in profile type's `variables`, use that as default
     - Otherwise, use `defaultValue` from variable definition
     - Render appropriate input based on `inputType`:
       - `number` → number input with min/max
       - `slider` → range slider
       - `text` → text input
       - `dropdown` → select dropdown (use `options` from definition)
       - `checkbox`/`switch` → checkbox/switch
   - Allow students to override defaults

**Step 4: Submit Profile Creation**

```javascript
POST /v1/student/profile
{
  "classroomId": "...",
  "shopName": "...",
  "storeDescription": "...",
  "storeLocation": "...",
  "profileType": "profileTypeId",
  "variables": {
    "startingBalance": 6000,  // Override profile type default
    "customVar": "value"      // Custom variable
  }
}
```

#### 3. Profile Edit UI (Student)

**Step 1: Fetch Current Profile**

```javascript
GET /v1/student/profile?classroomId={classroomId}
```

**Step 2: Display Edit Form**

- Pre-populate with current profile values
- Show profile type info (read-only, can't change after creation)
- Allow editing `shopName`, `storeDescription`, `storeLocation`
- Allow editing `variables` (same dynamic form as creation)

**Step 3: Submit Updates**

```javascript
PUT /v1/student/profile
{
  "classroomId": "...",
  "shopName": "Updated Name",
  "variables": {
    // Include ALL variables you want to keep
    // Variables not included will be deleted
  }
}
```

#### 4. Variable Definition Management UI (Admin)

**Step 1: Fetch Definitions**

```javascript
GET /v1/admin/variables?classroomId={classroomId}&appliesTo=profile
```

**Step 2: Create Definition Form**

- Fields: `key`, `label`, `description`, `dataType`, `inputType`, `defaultValue`, `min`, `max`, `required`
- If `dataType: "select"` or `inputType: "dropdown"`, show `options` array editor
- Validate `dataType`/`inputType` compatibility

**Step 3: Update Definition**

```javascript
PUT /v1/admin/variables/:key?classroomId={classroomId}
// Can update all fields except `key` (immutable)
```

**Step 4: Delete Definition**

```javascript
DELETE /v1/admin/variables/:key?classroomId={classroomId}
// Soft delete (sets isActive: false)
```

### Key Concepts for Frontend Developers

1. **Profile Types are Organization-Scoped**: Each organization has its own set of profile types. They're not shared across organizations.

2. **Profiles are Classroom-Scoped**: Each student has one profile per classroom. Profile variables are specific to that classroom's variable definitions.

3. **Variable Value Merging**: When creating a profile, values are merged from:
   - Provided values (highest priority)
   - Profile type defaults
   - Variable definition defaults (lowest priority)

4. **Variables are Dynamic**: The `variables` object can contain any key-value pairs. The structure is defined by variable definitions, but values can be any JSON-serializable data.

5. **Variable Updates Replace All**: When updating `variables` in a profile or profile type, the entire object replaces existing variables. Variables not included are deleted.

6. **Profile Type Variables vs Profile Variables**:
   - Profile type variables (`appliesTo: "profileType"`) are defaults/templates
   - Profile variables (`appliesTo: "profile"`) are actual values for a student's profile
   - Profile variables inherit from profile type variables when the profile is created

7. **Variable Definitions Define Structure**: Variable definitions (`appliesTo: "profile"`) define what variables are available, their types, validation rules, and UI hints. They don't store values.

### Example: Complete Profile Creation Flow

```javascript
// 1. Fetch profile types (for dropdown)
const profileTypes = await fetch(
  `/v1/student/profile-types?classroomId=${classroomId}`
);
// Returns: [{ _id: "...", key: "food_truck", label: "Food Truck", variables: {...} }]
// Note: Only returns active profile types

// 2. Fetch variable definitions (for form structure)
const definitions = await fetch(
  `/v1/admin/variables?classroomId=${classroomId}&appliesTo=profile`
);
// Returns: [{ key: "startingBalance", label: "Starting Balance", dataType: "number", ... }]

// 3. User selects profile type "food_truck"
const selectedProfileType = profileTypes.find((pt) => pt.key === "food_truck");

// 4. Build form with:
//    - Basic fields (shopName, etc.)
//    - For each definition, use:
//      - selectedProfileType.variables[def.key] as default (if exists)
//      - OR def.defaultValue
//    - Render input based on def.inputType

// 5. User fills form and submits
await fetch("/v1/student/profile", {
  method: "POST",
  body: JSON.stringify({
    classroomId: "xxx",
    shopName: "Tony's Pizza",
    storeDescription: "...",
    storeLocation: "...",
    profileType: selectedProfileType._id,
    variables: {
      startingBalance: 6000, // User overrode default of 5000
      // ... other variables from form
    },
  }),
});
```

### VariableDefinition Routes (`/v1/admin/variables`)

#### `POST /v1/admin/variables`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create variable definition
- **Body**: `{ classroomId, key, label, description?, appliesTo, dataType, inputType?, options?, defaultValue?, min?, max?, required? }`

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
- **Query Params**: `classroomId` (required)`

### Challenge Routes (`/v1/admin/challenges` and `/v1/student/challenges`)

#### Admin Routes

##### `POST /v1/admin/challenges`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Create a new challenge (formerly scenario)
- **Body**: `{ classroomId, title, description?, variables? }`
- **Note**: Automatically queues email notifications to all enrolled students

##### `GET /v1/admin/challenges`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all challenges for the organization

##### `GET /v1/admin/challenges/current`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get current active challenge for admin view
- **Query Params**: `classroomId` (required)
- **Notes**: Returns `200` with `{ success: true, data: null }` if there is no active challenge.

##### `GET /v1/admin/challenges/:id`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get challenge by ID

##### `PUT /v1/admin/challenges/:challengeId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update challenge (before publish/close)

##### `POST /v1/admin/challenges/:challengeId/publish`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Publish challenge to students (makes it visible and active)

##### `POST /v1/admin/challenges/:challengeId/unpublish`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Unpublish challenge (hide from students)

##### `POST /v1/admin/challenges/:challengeId/preview`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Preview AI outcomes for a challenge (does not write ledger entries)

##### `POST /v1/admin/challenges/:challengeId/rerun`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Rerun challenge (delete existing ledger entries and recalculate)

##### `POST /v1/admin/challenges/:challengeId/cancel-batch-and-rerun`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Cancel a running batch job and rerun the challenge

##### `POST /v1/admin/challenges/:challengeId/export`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Export challenge outcomes and details

##### `DELETE /v1/admin/challenges/:challengeId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Soft delete a challenge

#### Student Routes

##### `GET /v1/student/challenges`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all challenges for a classroom
- **Query Params**: `classroomId` (required)

##### `GET /v1/student/challenges/current`

- **Auth**: `requireMemberAuth()`
- **Description**: Get current active challenge for student
- **Query Params**: `classroomId` (required)
- **Notes**: Returns `200` with `{ success: true, data: null }` if there is no active (published) challenge.

##### `GET /v1/student/challenges/:id`

- **Auth**: `requireMemberAuth()`
- **Description**: Get challenge by ID (student view)

### Outcome Routes (`/v1/admin/outcomes` and `/v1/student/outcomes`)

#### Admin Routes

##### `POST /v1/admin/outcomes/:challengeId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Set global challenge outcome (actual weather, demand shift, etc.)
- **Body**: `{ variables? }` (dynamic based on variable definitions)

##### `POST /v1/admin/outcomes/:challengeId/outcome/draft`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Save draft of the challenge outcome

##### `POST /v1/admin/outcomes/:challengeId/outcome/approve`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Approve and finalize the challenge outcome

##### `GET /v1/admin/outcomes/:challengeId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get challenge outcome details
- **Notes**: Returns `200` with `{ success: true, data: null }` if an outcome hasn't been set yet.

##### `PUT /v1/admin/outcomes/:challengeId/outcome/variables`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Update outcome variables

##### `DELETE /v1/admin/outcomes/:challengeId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Delete challenge outcome

#### Student Routes

##### `GET /v1/student/outcomes/:challengeId/outcome`

- **Auth**: `requireAuth()`, `checkRole('org:member')`
- **Description**: Get challenge outcome (student view, after results are published)
- **Notes**: Returns `200` with `{ success: true, data: null }` if an outcome hasn't been set yet.

### Decision Routes (`/v1/admin/decisions` and `/v1/student/decision`)

#### Student Routes

##### `POST /v1/student/decision`

- **Auth**: `requireMemberAuth()`
- **Description**: Submit weekly decisions for a challenge (formerly submission)
- **Body**: `{ challengeId, variables }` (variables are dynamic based on variable definitions)
- **Note**: Validates variables, enforces submission order

##### `PUT /v1/student/decision/:decisionId`

- **Auth**: `requireMemberAuth()`
- **Description**: Update existing decision (only before results are published)

##### `GET /v1/student/decision/status`

- **Auth**: `requireMemberAuth()`
- **Description**: Get decision status for a challenge
- **Query Params**: `challengeId` (required)

##### `GET /v1/student/decisions`

- **Auth**: `requireMemberAuth()`
- **Description**: Get all decisions for the authenticated student
- **Query Params**: `classroomId`, `challengeId` (optional filters)

#### Admin Routes

##### `GET /v1/admin/decisions/:decisionId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get decision by ID

##### `POST /v1/admin/decisions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all decisions (with filters)

##### `GET /v1/admin/decisions/student/:studentId`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all decisions for a specific student

##### `GET /v1/admin/challenges/:challengeId/decisions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all decisions for a challenge (includes list of students who haven't submitted)

##### `GET /v1/admin/challenges/:challengeId/missing-decisions`

- **Auth**: `requireAuth()`, `checkRole('org:admin')`
- **Description**: Get all students who have not submitted decisions for a challenge

### Ledger Routes (`/v1/admin/ledger`)

All routes require `requireAuth()` and `checkRole('org:admin')` (instructors/TAs can write, other roles might read).

#### `GET /v1/admin/ledger/:classroomId/user/:userId`

- **Description**: Get ledger history for a specific user in a classroom

#### `GET /v1/admin/ledger/challenge/:challengeId`

- **Description**: Get all ledger entries for a challenge

#### `GET /v1/admin/ledger/challenge/:challengeId/user/:userId`

- **Description**: Get ledger entry for a specific challenge and user

#### `PATCH /v1/admin/ledger/:ledgerId/override`

- **Description**: Override a ledger entry (manually adjust values)

### Job Routes (`/v1/admin/job`)

All routes require `requireAuth()` and `checkRole('org:admin')`.

#### `GET /v1/admin/job/challenge/:challengeId`

- **Description**: Get all jobs for a challenge (simulation processing jobs)

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

# Copy local environment files
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
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

# Start all backend services concurrently
npm run dev:all

# Start the full app plus local Stripe and Clerk webhook relays
npm run dev:integrations

# API + web frontend together (http://localhost:1337 + http://localhost:5173)
npm run install:web   # first time
npm run dev

# Or run individually:
npm run dev:web
```

Set `VITE_CLERK_PUBLISHABLE_KEY` in `apps/web/.env.local`. Use `npm run dev:all` for API, webhooks, workers, and web together.

For Clerk webhooks, generate a stable relay token once:

```bash
npx clerk webhooks token
```

Store that `c_...` token as `CLERK_WEBHOOK_RELAY_TOKEN` in `.env.local`, then run `npm run dev:integrations`. Start it once, copy the stable Clerk relay URL it prints, and configure that URL in the Clerk Dashboard. The relay forwards it to the local `/v1/webhooks/clerk` endpoint. This replaces the recurring ngrok setup for Clerk. Stripe remains local through its own CLI relay.

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

Backend services are deployed on **DigitalOcean App Platform** using Docker. The web app is deployed as a **static site** component from `apps/web` (see [`apps/web/README.md`](apps/web/README.md) and [`.do/app.yaml`](.do/app.yaml)).

### Dockerfile

The project includes a Dockerfile that:

- Uses Node.js 18 Alpine
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
SENDGRID_FROM_NAME=SCALE LXP

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
SCALE_API_HOST=https://api.scalelxp.com
SCALE_COM_HOST=https://scalelxp.com
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
- **Profile** - Student business setup (formerly Store)
- **VariableValue** - Dynamic variable values (profile/challenge/decision/outcome)
- **VariableDefinition** - Dynamic variable definitions
- **Challenge** - Weekly simulation contexts (formerly Scenario)
- **Outcome** - Global challenge outcomes (formerly ScenarioOutcome)
- **Decision** - Weekly student decisions (formerly Submission)

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

- **Simulation** - AI-driven simulation job processing (env-configurable concurrency; defaults to 2)
- **Email Sending** - Email notifications
- **SMS Sending** - SMS notifications
- **Push Sending** - Push notifications

### Queue Monitoring

Bull Board is available at `/admin/queues` on the workers service (requires basic auth in production).

## Decision Outcome & Simulation Processing

This section explains how student decisions are processed and how AI-driven simulation jobs are triggered and executed.

### Overview

The simulation processing flow consists of three main stages:

1. **Student Decisions** - Students submit their weekly decisions
2. **Challenge Outcome** - Instructor sets global outcome and triggers processing
3. **Job Processing** - Background jobs calculate results using AI

### Stage 1: Student Decisions

Students submit their weekly decisions for a published challenge via `POST /v1/student/decision`. Each decision includes:

- **Challenge ID** - The challenge being responded to
- **Variables** - Dynamic decision variables (e.g., `plannedProduction`, `staffingLevel`, `marketingSpend`)
- **Metadata** - Decision timestamp, user ID, classroom ID

**Decision States:**

- `pending` - Submitted, awaiting processing
- `processing` - Currently being processed by a job
- `completed` - Successfully processed, ledger entry created
- `failed` - Processing failed (can be retried)

**Validation:**

- Decisions are validated against variable definitions
- Challenge must be published and not closed
- Only one decision per student per challenge is allowed
- Decisions cannot be edited after challenge is closed

### Stage 2: Challenge Outcome & Job Creation

When an instructor sets the challenge outcome via `POST /v1/admin/outcomes/:challengeId/outcome`, the following happens automatically:

1. **Outcome Creation** - Global challenge outcome is created/updated with:
   - Dynamic outcome variables (e.g., `actualWeather`, `demandMultiplier`)
   - Notes and metadata
   - Random events enabled flag

2. **Job Creation** - For each student who submitted:
   - A `SimulationJob` document is created in MongoDB with status `pending`
   - Job is linked to the decision via `decisionId`
   - Job is enqueued in the Bull queue (Redis) for processing
   - Decision status is updated to `processing`

3. **Challenge Closure** - The challenge is automatically closed:
   - `isClosed` flag is set to `true`
   - Prevents new decisions
   - Prevents editing existing decisions

**Important Notes:**

- Jobs are **only created for students who have submitted**
- Missing decisions (students who didn't submit) are tracked separately
- Jobs are processed asynchronously in the background
- The API response returns immediately after job creation (does not wait for processing)

### Stage 3: Job Processing

Jobs are processed by the **Workers Service** using Bull queue with the following characteristics:

**Queue Configuration:**

- **Concurrency**: Controlled by `SIMULATION_CONCURRENCY` (default: `2`). Increase gradually.
- **Optional rate limiting**: You can enable a Bull limiter for simulation jobs with:
  - `SIMULATION_RATE_LIMIT_MAX` (e.g. `10`)
  - `SIMULATION_RATE_LIMIT_DURATION_MS` (e.g. `60000` for per-minute)
- **Retries**: 3 attempts with exponential backoff (1s, 2s, 4s delays)
- **Failure Handling**: Failed jobs remain in queue for inspection

**Processing Flow:**

For each job, the worker:

1. **Fetches Context** - Gathers all required data:
   - **Profile** - Student's profile configuration and variables
   - **Challenge** - Challenge data with variables populated
   - **Outcome** - Global outcome variables
   - **Decision** - Student's decision variables
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

4. **Updates Status** - Updates job and decision:
   - Job status: `pending` → `processing` → `completed`
   - Decision status: `processing` → `completed`
   - Links ledger entry to decision

**Error Handling:**

- If processing fails, job status is set to `failed`
- Error details are stored in job document
- Jobs can be manually retried via `POST /v1/admin/job/:jobId/retry`
- Failed jobs don't create ledger entries

### Missing Decisions

Students who don't submit are handled according to classroom policy:

- **Zero Action** (default) - No ledger entry created, balance carries forward
- **Auto Default** - Conservative default decision auto-generated (future feature)
- **Skip Week** - No ledger entry, balance carries forward
- **Instructor Review** - Instructor manually handles each missing decision

Missing decisions are tracked via `GET /v1/admin/challenges/:challengeId/decisions` which returns:

- List of submitted students
- List of missing students (who haven't submitted)

### Rerunning Challenges

Instructors can rerun a challenge via `POST /v1/admin/challenges/:challengeId/rerun`:

1. **Deletes** existing ledger entries for the challenge
2. **Resets** all jobs to `pending` status
3. **Recreates** jobs for all decisions
4. **Processes** jobs automatically

This allows instructors to:

- Adjust challenge outcomes and recalculate
- Fix errors in calculations
- Test different outcome challenges

### Job Monitoring

Instructors can monitor job status via:

- `GET /v1/admin/job/challenge/:challengeId` - Get all jobs for a challenge
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

- Links to challenge, decision, and user
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

### Example Ledger Entry

```
{
    "_id" : ObjectId("69533dd3a2d760069510c3c5"),
    "classroomId" : ObjectId("694ecce9f4f7c85a1cac7a61"),
    "challengeId" : ObjectId("69533b5ca2d760069510c037"),
    "decisionId" : ObjectId("69533bc7a2d760069510c199"),
    "userId" : ObjectId("6947298125b16ceea4650339"),
    "sales" : NumberInt(50),
    "revenue" : NumberInt(950),
    "costs" : NumberInt(800),
    "waste" : NumberInt(10),
    "cashBefore" : NumberInt(3500),
    "cashAfter" : NumberInt(3650),
    "inventoryBefore" : NumberInt(1000),
    "inventoryAfter" : NumberInt(940),
    "netProfit" : NumberInt(150),
    "randomEvent" : null,
    "summary" : "In a week marked by input cost volatility, Fat Boys Pizza managed to maintain operations by reducing staffing and inventory supply. Despite poor weather, the street cart achieved a reasonable sales volume by setting a higher unit sale price. The strategy resulted in a modest net profit, highlighting the importance of flexibility in cost management.",
    "education" : {
        "demandForecast" : NumberInt(60),
        "demandActual" : NumberInt(50),
        "serviceLevel" : 0.833,
        "fillRate" : 0.833,
        "stockoutUnits" : NumberInt(10),
        "lostSalesUnits" : NumberInt(10),
        "backorderUnits" : NumberInt(0),
        "materialFlowByBucket" : {
            "refrigerated" : {
                "beginUnits" : NumberInt(500),
                "receivedUnits" : NumberInt(0),
                "usedUnits" : NumberInt(50),
                "wasteUnits" : NumberInt(5),
                "endUnits" : NumberInt(445)
            },
            "ambient" : {
                "beginUnits" : NumberInt(300),
                "receivedUnits" : NumberInt(0),
                "usedUnits" : NumberInt(0),
                "wasteUnits" : NumberInt(0),
                "endUnits" : NumberInt(300)
            },
            "notForResale" : {
                "beginUnits" : NumberInt(200),
                "receivedUnits" : NumberInt(0),
                "usedUnits" : NumberInt(0),
                "wasteUnits" : NumberInt(0),
                "endUnits" : NumberInt(200)
            }
        },
        "costBreakdown" : {
            "ingredientCost" : NumberInt(500),
            "laborCost" : NumberInt(200),
            "logisticsCost" : NumberInt(50),
            "tariffCost" : NumberInt(0),
            "holdingCost" : NumberInt(20),
            "overflowStorageCost" : NumberInt(0),
            "expediteCost" : NumberInt(0),
            "wasteDisposalCost" : NumberInt(30),
            "otherCost" : NumberInt(0)
        },
        "teachingNotes" : "The student effectively managed cost volatility by adjusting staffing and inventory levels, which helped maintain profitability despite increased input costs. The decision to set a higher sale price was crucial in offsetting the cost increases, though it did result in some lost sales due to price sensitivity. This challenge underscores the need for dynamic pricing strategies and cost control in volatile environments."
    },
    "aiMetadata" : {
        "model" : "gpt-4o",
        "runId" : "bc790ce5-2b6c-4a9a-bd1d-62e05f392f86",
        "generatedAt" : ISODate("2025-12-30T02:49:55.447+0000")
    },
    "calculationContext" : {
        "profileVariables" : {
            "label" : "Street Cart",
            "description" : "Ultra-lean operation with massive foot traffic swings and razor-thin margins.",
            "startingInventory" : NumberInt(1000),
            "weeklyRent" : NumberInt(50),
            "maxDailyCapacity" : NumberInt(60),
            "staffRequired" : NumberInt(1),
            "weatherSensitivity" : "very high",
            "mobility" : "very high",
            "vibe" : "gritty",
            "riskProfile" : "survival",
            "peakHours" : [
                "11:00-14:00"
            ],
            "customerPatience" : "very low",
            "marketingPower" : "location",
            "commonIssues" : [
                "weather shutdowns",
                "permits",
                "supply runouts"
            ],
            "growthCeiling" : "very low",
            "aiFlavor" : "scrappy decisions, cash flow panic, opportunistic selling"
        },
        "challengeVariables" : {
            "weather" : "Poor",
            "expected-demand" : "Average",
            "scenario-theme" : "Input Cost Volatility"
        },
        "decisionVariables" : {
            "staffing" : "Less than Average",
            "inventory-supply" : "Less Than Usual",
            "unit-sale-price" : NumberInt(19),
            "discount-intensity" : NumberInt(0)
        },
        "outcomeVariables" : {
            "randomEventChancePercent" : NumberInt(0),
            "notes" : "Higher costs exposed weak margin structures and punished businesses that failed to adapt. Those that adjusted pricing, moderated production, or prioritized cash protection weathered the volatility more effectively. This week highlights the importance of flexibility in cost management."
        },
        "priorState" : {
            "cashBefore" : NumberInt(3500),
            "inventoryBefore" : NumberInt(1000),
            "ledgerHistory" : [
                {
                    "challengeId" : ObjectId("694ed000f4f7c85a1cac7f4b"),
                    "challengeTitle" : "Back to School Week",
                    "netProfit" : NumberInt(400),
                    "cashAfter" : NumberInt(2900),
                    "_id" : ObjectId("69533dd3a2d760069510c3c6")
                },
                {
                    "challengeId" : ObjectId("69514a02ff5ba73716900561"),
                    "challengeTitle" : "Week 2 - Supply Crunch",
                    "netProfit" : NumberInt(-100),
                    "cashAfter" : NumberInt(2800),
                    "_id" : ObjectId("69533dd3a2d760069510c3c7")
                },
                {
                    "challengeId" : ObjectId("6952a32137727834f81df2d9"),
                    "challengeTitle" : "Week 2 – Demand Forecasting Variability",
                    "netProfit" : NumberInt(400),
                    "cashAfter" : NumberInt(3200),
                    "_id" : ObjectId("69533dd3a2d760069510c3c8")
                },
                {
                    "challengeId" : ObjectId("6952b2af37727834f81dfb9c"),
                    "challengeTitle" : "Week 4 - Labor Constraints",
                    "netProfit" : NumberInt(300),
                    "cashAfter" : NumberInt(3500),
                    "_id" : ObjectId("69533dd3a2d760069510c3c9")
                }
            ]
        },
        "prompt" : "[\n  {\n    \"role\": \"system\",\n    \"content\": \"You are the SCALE LXP simulation engine for a supply chain class using a pizza shop game. Calculate outcomes for one student based on profile configuration, challenge context, global outcome, and the student's decisions. Apply realistic business logic and environmental effects.\\n\\nReturn ONLY valid JSON matching the provided schema. You may invent reasonable intermediate numbers when needed. Also compute the required education metrics so instructors can explain results (service level, stockouts/lost sales, by-bucket material flow, and cost breakdown).\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"PROFILE CONFIGURATION:\\n{\\n  \\\"shopName\\\": \\\"Fat Boys Pizza\\\",\\n  \\\"profileType\\\": \\\"street_cart\\\",\\n  \\\"storeDescription\\\": \\\"Fat Boys Pizza is a high-volume street cart located on campus that specializes in selling pizza by the slice to students, staff, and late-night crowds. Operating with limited space and equipment, the business focuses on fast service, predictable demand peaks, and tight margins. Success depends on smart inventory planning, efficient labor scheduling, and pricing decisions that balance affordability with profitability. Fat Boys Pizza serves as an ideal real-world example of quick-service operations, where small changes in cost, demand, or waste can have an outsized impact on daily cash flow and overall performance.\\\",\\n  \\\"storeLocation\\\": \\\"All over campus and outside the bars late at night\\\",\\n  \\\"label\\\": \\\"Street Cart\\\",\\n  \\\"description\\\": \\\"Ultra-lean operation with massive foot traffic swings and razor-thin margins.\\\",\\n  \\\"startingBalance\\\": 2500,\\n  \\\"startingInventory\\\": 1000,\\n  \\\"weeklyRent\\\": 50,\\n  \\\"maxDailyCapacity\\\": 60,\\n  \\\"staffRequired\\\": 1,\\n  \\\"weatherSensitivity\\\": \\\"very high\\\",\\n  \\\"mobility\\\": \\\"very high\\\",\\n  \\\"vibe\\\": \\\"gritty\\\",\\n  \\\"riskProfile\\\": \\\"survival\\\",\\n  \\\"peakHours\\\": [\\n    \\\"11:00-14:00\\\"\\n  ],\\n  \\\"customerPatience\\\": \\\"very low\\\",\\n  \\\"marketingPower\\\": \\\"location\\\",\\n  \\\"commonIssues\\\": [\\n    \\\"weather shutdowns\\\",\\n    \\\"permits\\\",\\n    \\\"supply runouts\\\"\\n  ],\\n  \\\"growthCeiling\\\": \\\"very low\\\",\\n  \\\"aiFlavor\\\": \\\"scrappy decisions, cash flow panic, opportunistic selling\\\"\\n}\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"CHALLENGE:\\n{\\n  \\\"title\\\": \\\"Week 6 - Input Cost Volatility\\\",\\n  \\\"description\\\": \\\"Costs that were once stable begin to fluctuate unexpectedly. Key inputs increase in price, sometimes with little warning, compressing margins and increasing financial risk. Inventory purchased this week may cost significantly more than inventory purchased last week, forcing businesses to rethink pricing, output, or volume strategies. Vendor invoices rise faster than anticipated, and cash outflows accelerate. Decisions now require balancing customer price sensitivity against the need to protect margins. This challenge highlights how cost volatility can destabilize even well-run operations.\\\",\\n  \\\"variables\\\": {\\n    \\\"weather\\\": \\\"Poor\\\",\\n    \\\"expected-demand\\\": \\\"Average\\\",\\n    \\\"scenario-theme\\\": \\\"Input Cost Volatility\\\"\\n  }\\n}\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"GLOBAL CHALLENGE OUTCOME:\\n{\\n  \\\"notes\\\": \\\"Higher costs exposed weak margin structures and punished businesses that failed to adapt. Those that adjusted pricing, moderated production, or prioritized cash protection weathered the volatility more effectively. This week highlights the importance of flexibility in cost management.\\\",\\n  \\\"hiddenNotes\\\": \\\"\\\"\\n}\"\n  },\n  {\n    \"role\": \"user\",\n    \"content\": \"STUDENT DECISIONS:\\n{\\n  \\\"staffing\\\": \\\"Less than Average\\\",\\n  \\\"inventory-supply\\\": \\\"Less Than Usual\\\",\\n  \\\"unit-sale-price\\\": 19,\\n  \\\"discount-intensity\\\": 0\\n}\"\n  },\n  {\n    \"role\":\"user\",\n    \"content\": \"LEDGER HISTORY:\\n{\\n  \\\"entries\\\": [\\n    {\\n      \\\"challengeId\\\": \\\"694ed000f4f7c85a1cac7f4b\\\",\\n      \\\"challengeTitle\\\": \\\"Back to School Week\\\",\\n      \\\"netProfit\\\": 400,\\n      \\\"cashAfter\\\": 2900\\n    },\\n    {\\n      \\\"challengeId\\\": \\\"69514a02ff5ba73716900561\\\",\\n      \\\"challengeTitle\\\": \\\"Week 2 - Supply Crunch\\\",\\n      \\\"netProfit\\\": -100,\\n      \\\"cashAfter\\\": 2800\\n    },\\n    {\\n      \\\"challengeId\\\": \\\"6952a32137727834f81df2d9\\\",\\n      \\\"challengeTitle\\\": \\\"Week 2 – Demand Forecasting Variability\\\",\\n      \\\"netProfit\\\": 400,\\n      \\\"cashAfter\\\": 3200\\n    },\\n    {\\n      \\\"challengeId\\\": \\\"6952b2af37727834f81dfb9c\\\",\\n      \\\"challengeTitle\\\": \\\"Week 4 - Labor Constraints\\\",\\n      \\\"netProfit\\\": 300,\\n      \\\"cashAfter\\\": 3500\\n    }\\n  ]\\n}\"\n  }\n]"
    },
    "overridden" : false,
    "overriddenBy" : null,
    "overriddenAt" : null,
    "organization" : ObjectId("694573704c5eaf60ca44c365"),
    "createdBy" : "user_36u7M7ZRpCulCOpmaSLXYW4uKWr",
    "updatedBy" : "user_36u7M7ZRpCulCOpmaSLXYW4uKWr",
    "createdDate" : ISODate("2025-12-30T02:49:55.462+0000"),
    "updatedDate" : ISODate("2025-12-30T02:49:55.462+0000"),
    "__v" : NumberInt(0)
}
```

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

For simple, event-driven emails (e.g., challenge creation), emails are queued directly without creating notification records.

**Example: Challenge Creation Emails**

When a new challenge is created, the `Challenge` model's post-save hook automatically:

1. Finds all enrolled students in the classroom
2. Queues an email job for each student
3. Uses the `challenge-created` template with challenge, classroom, and member data

```javascript
// In services/challenge/challenge.model.js post-save hook
await enqueueEmailSending({
  recipient: { email, name, memberId },
  title: `New Challenge: ${challenge.title}`,
  templateSlug: "challenge-created",
  templateData: { challenge, classroom, member, organization, link },
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
  title: "Welcome to SCALE LXP",
  message: "You've been enrolled in a new class",
  templateSlug: "challenge-created",
  templateData: { challenge, classroom, member },
  organization: organizationId,
});

await notification.save(); // Automatically queues email via post-save hook
```

### Email Templates

Email templates are built with **React Email** and located in `lib/emails/templates/`.

#### Available Templates

- `challenge-created` - Notifies students when a new challenge is created

#### Template Structure

Templates are React components that receive `templateData` as props:

```jsx
function ChallengeCreatedEmail(props) {
  const { challenge, classroom, member, link } = props;
  // ... render email
}
```

#### Template Rendering

Templates are rendered server-side using `@react-email/render`:

- HTML version for email clients
- Plain text version for accessibility
- Both versions sent via SendGrid

#### Previewing Templates

Fixtures for email preview are in `apps/admin/fixtures/`. Run `npm run email:preview` to start the local admin preview server.

## Simulation Runner

The former `sim:cli` is now the local Admin Developer App. Start it with
`npm run dev:admin` and open `http://localhost:5174`.

The runner is intentionally restricted:

- It refuses `NODE_ENV=production`.
- It accepts only localhost requests and binds its API server to `127.0.0.1`.
- It refuses remote MongoDB hosts unless
  `SIMULATION_RUNNER_ALLOW_REMOTE_DATABASE=true` is explicitly set for an
  isolated, non-production test database.
- It creates local MongoDB simulation identities and never creates Clerk users.
- It only lists and reuses classrooms marked as simulation classrooms.
- It refuses a simulation classroom if any enrolled student is not marked as a
  simulation user.
- It caps runs at 100 simulated students and suppresses all challenge/result
  notifications for simulation runs.
- Completed runs can be cleaned up from the runner; cleanup refuses to proceed
  while simulation jobs are pending or running.

Both individual and batch modes require the workers service. A successful
runner response means the jobs were submitted; results finish asynchronously.

## Auto-Generate Decisions on Challenge Publish (LLM)

When an instructor publishes a challenge (`POST /v1/admin/challenges/:challengeId/publish`), the API can automatically create a **Decision for every enrolled student** by using a cheap OpenAI model with structured JSON output.

**Environment Variables:**

- `AUTO_GENERATE_SUBMISSIONS_ON_PUBLISH`: default `"true"`. Set to `"false"` to disable.
- `AUTO_SUBMISSION_MODEL`: default `"gpt-4o-mini"` (cheap).
- `AUTO_SUBMISSION_CONCURRENCY`: default `10` (parallel decision creation).

If `OPENAI_API_KEY` is not set, auto-generation is skipped.

### Email Queue Configuration

**Queue Settings:**

- **Concurrency**: 2 jobs processed simultaneously
- **Priority**: Medium (priority: 3)
- **Delay**: 100ms between jobs (prevents bursts)
- **Retries**: Handled by Bull queue system

**Rate limiting (recommended):**

To prevent bursts from hammering Clerk/SendGrid (e.g. publishing a challenge to a large class), the
`email-sending` Bull queue is **rate limited by default** to **1 job per 1000ms**.

- `EMAIL_RATE_LIMIT_MAX` (default: `1`) and `EMAIL_RATE_LIMIT_DURATION_MS` (default: `1000`) tune throughput.
- Set `EMAIL_RATE_LIMIT_MAX=0` to disable rate limiting entirely.
- `EMAIL_JOB_DELAY_MS` (default: `1000`) adds an additional per-job delay at enqueue time.

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

1. **Use Direct Queuing** for simple, event-driven emails (challenge creation, etc.)
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
