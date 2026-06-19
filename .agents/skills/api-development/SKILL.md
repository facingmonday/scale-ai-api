---
name: api-development
description: "Build, secure, and integrate backend REST API routes and services."
---

# API Development Skill

This skill guides you through implementing and registering backend Express REST API routes, schemas, and controllers under the `services/` directory.

## Core Development Workflow

### 1. Define Mongoose Model
Create `[service-name].model.js` extending the `baseSchema` to ensure automatic multi-tenancy:
```javascript
const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const schema = new mongoose.Schema({
  // fields here
}).add(baseSchema);

// Define compound unique indexes scoped to organization
schema.index({ organization: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("ModelName", schema);
```

### 2. Implement Controller Request Handlers
Create `[service-name].controller.js` to process requests:
- Always enforce multi-tenancy by filtering query selectors using `organization: req.organization._id`.
- Catch validation or cast errors and return appropriate HTTP status codes (e.g., `400 Bad Request` or `500 Internal Server Error`).

### 3. Setup Router and Routes
Create `index.js` to declare routes and hook middleware:
```javascript
const express = require("express");
const controller = require("./[service-name].controller");
const router = express.Router();
const { requireAuth, checkRole } = require("../../middleware/auth");

router.use(requireAuth(), checkRole("org:admin"));

router.get("/", controller.get);
router.post("/", controller.create);

module.exports = router;
```

### 4. Register the Service
Add the service mounting declaration inside `services/index.js`:
```javascript
router.use("/[kebab-case-name]", require("./[service-name]"));
```

## Best Practices
- Keep controllers thin; place complex business logic in Mongoose static methods or instance methods.
- Verify that every query is scoped to the active organization.
