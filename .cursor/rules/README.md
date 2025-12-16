SCALE.ai
Backend API Developer Specification

Tech Stack: Node.js, Express, MongoDB, Mongoose
Auth: Clerk
AI: OpenAI (JSON-structured responses)
Email: SendGrid

1. System Overview

SCALE.ai is a classroom-based supply chain simulation platform.

Each week:

Students submit decisions for their pizza shop.

Instructors/Admins define a scenario and a single global outcome.

AI calculates individualized results per student.

Results are written to a ledger and shown on dashboards.

The system is learning-only:

No grades

No bankruptcy lockouts

Students can go negative

Instructors can override anything

2. Server Architecture
   apps/
   ├─ api/
   │ └─ index.js
   ├─ email-preview/
   │ ├─ fixtures/
   │ └─ index.js
   ├─ webhooks/
   │ └─ index.js
   └─ workers/
   └─ index.js
   constants/
   ├─ errors.js
   └─ statuses.js
   lib/
   ├─ emails/
   │ ├─ reactRenderer.js
   │ ├─ renderer.js
   │ └─ templates/
   ├─ openai/
   │ ├─ completion.js
   │ ├─ image.js
   │ ├─ index.js
   │ ├─ text.js
   │ └─ voice.js
   ├─ queues/
   │ ├─ email-worker.js
   │ ├─ pdf-worker.js
   │ ├─ push-worker.js
   │ └─ sms-worker.js
   ├─ sendGrid/
   │ ├─ index.js
   │ └─ sendEmail.js
   ├─ baseSchema.js
   ├─ clerk-helpers.js
   ├─ routes.js
   ├─ s3.js
   ├─ spaces.js
   └─ utils.js
   middleware/
   └─ auth.js
   models/
   └─ index.js
   services/
   ├─ auth/
   ├─ cron/
   ├─ me/
   │ └─ controllers/
   ├─ members/
   ├─ notifications/
   ├─ openai/
   │ └─ lib/
   ├─ organizations/
   ├─ utils/
   ├─ webhooks/
   │ ├─ clerk/
   │ ├─ stripe/
   │ └─ telnyx/
   └─ workers/
   └─ lib/

3. Authentication & Authorization
   Auth Provider

Clerk handles authentication.

Backend validates Clerk JWT on every request.

Roles

admin – instructor / TA

member – student

Middleware
authMiddleware
requireAdmin

4. Core API Concepts
   Key Entities

Class

Store (one per student per class)

Scenario

ScenarioOutcome (global)

Submission (weekly student input)

LedgerEntry (final result)

VariableDefinition + VariableValue

Achievements

Upgrades

5. API Endpoints
   🔐 Clerk Webhooks

POST /api/webhooks/clerk

Handles:

user.created

user.updated

user.deleted

Creates or updates User records.

👩‍🎓 Student APIs
Get student dashboard

GET /api/student/dashboard

Returns:

Store info

Active scenario

Submission status

Latest ledger entry

Leaderboard snapshot

Achievements

Upgrades

Create / update store

POST /api/student/store

{
"shopName": "Campus Slice",
"storeType": "outdoor",
"dailyCapacity": 100,
"deliveryRatio": 0.4
}

Get current scenario

GET /api/student/scenario/current

Submit weekly decisions

POST /api/student/submission

{
"scenarioId": "abc123",
"variables": {
"preparedPizzas": 600,
"staffingLevel": "normal"
}
}

Get ledger history

GET /api/student/ledger

🧑‍🏫 Admin APIs
Create scenario

POST /api/admin/scenario

{
"title": "Back to School Rush",
"description": "Students return to campus",
"variables": {
"demandMultiplier": 1.3,
"forecast": "Sunny"
}
}

Set global outcome

POST /api/admin/scenario/:id/outcome

{
"actualWeather": "Rainy",
"demandShift": 0.85,
"randomEventsEnabled": true,
"notes": "Storms all week"
}

Preview AI outcomes

POST /api/admin/scenario/:id/preview

Runs AI without writing ledger entries.

Approve outcomes

POST /api/admin/scenario/:id/approve

Runs AI for all students

Writes LedgerEntry records

Triggers achievements and upgrades

Rerun outcomes

POST /api/admin/scenario/:id/rerun

Deletes existing ledger entries and recalculates.

Edit ledger entry

PUT /api/admin/ledger/:ledgerId

Allows manual override.

6. Variable System (Dynamic)
   VariableDefinition

Defines questions/inputs.

Fields:

key

label

appliesTo: store | scenario | submission

dataType

defaultValue

min / max

required

VariableValue

Stores answers.

Stored separately for:

Store

Scenario

Submission

Ledger (derived)

7. AI Simulation Service
   aiService.runSimulation()

Input:

Store variables

Scenario variables

Global outcome

Student submission

Ledger history

Enabled upgrades

Random events flag

Calls OpenAI with structured prompt.

OpenAI Response Schema
{
"week": number,
"sales": number,
"waste": number,
"profit": number,
"balanceAfter": number,
"randomEvent": string | null,
"summary": string
}

8. Ledger Logic

Ledger entries are:

One per student per scenario

Editable by admin

Used for:

Leaderboards

Achievements

Upgrade unlocks

9. Leaderboards

Computed dynamically from ledger data.

Metrics:

Total profit

Weekly profit

Waste efficiency

Recovery score

No leaderboard data is stored.

10. Achievements & Upgrades
    Achievements

Automatically evaluated on ledger write

Stored in UserAchievement

Upgrades

Unlocked based on conditions

Included in AI input

Affect future calculations

11. Email Notifications (SendGrid)

Triggered events:

Scenario published

Results approved

Class invite

Emails are logged to EmailLog.

12. Error Handling

Centralized error middleware

AI failures return preview errors

Admin approval blocked if validation fails

13. Performance Notes

AI calls are synchronous

Preview and approve endpoints separated

Can batch students per scenario

Ledger writes are transactional per student

14. Security Considerations

Clerk JWT verification on every route

Admin-only routes enforced

No student access to other students’ data

No export endpoints for students

15. What This Enables

Thousands of concurrent classes

Minimal instructor workload

High replayability

AI-driven differentiation

Fully configurable without code changes
