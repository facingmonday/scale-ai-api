---
trigger: model_decision
description: When creating new files for the application, follow this structure.
---

# Application File Structure & Naming Guidelines

When creating new files in this repository, follow these structural rules:

## Backend Services (`services/`)
Every new service directory under `services/` must follow the Service Structure pattern:
- `index.js` - Defines routes and registers middleware.
- `[service-name].controller.js` - Contains request handlers.
- `[service-name].model.js` - Defines Mongoose schema (must extend `baseSchema` using `.add(baseSchema)`).
- `lib/` (optional) - Service-specific utilities.

## Directory Layout
- `apps/web/` - React frontend (Vite).
- `apps/api/` - API entry point.
- `apps/workers/` - Background workers entry point.
- `apps/webhooks/` - Webhook handlers entry point.
- `lib/` - Shared backend utility libraries.
- `middleware/` - Shared Express middleware.
