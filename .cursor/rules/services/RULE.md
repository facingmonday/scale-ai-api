---
description: Rule to be used when creating a new service.
alwaysApply: false
---

# Service Structure Rule

## Overview

All services in the `services/` directory must follow a consistent structure pattern for maintainability and consistency.

## Required Files

### 1. `index.js` - Express Router

**Purpose**: Defines HTTP routes and middleware for the service

**Structure**:

```javascript
const express = require("express");
const controller = require("./[service-name].controller");
const router = express.Router();

const {
  requireAuth,
  checkRole,
  requireMemberAuth,
} = require("../../middleware/auth");

// Apply middleware (choose one pattern):
// Pattern 1: Apply to all routes
router.use(requireAuth(), checkRole("org:admin"));

// Pattern 2: Apply per route
router.get("/", requireAuth(), checkRole("org:admin"), controller.get);

// Route definitions (order matters - specific routes before :id routes)
router.get("/", controller.get); // List all
router.get("/:id", controller.show); // Get one
router.post("/", controller.create); // Create
router.put("/:id", controller.update); // Update (full)
router.patch("/:id", controller.update); // Update (partial)
router.delete("/:id", controller.destroy); // Delete

// Custom routes (before :id routes if they don't use :id)
router.get("/custom-endpoint", controller.customMethod);
router.post("/:id/custom-action", controller.customAction);

module.exports = router;
```

**Rules**:

- Must export an Express router
- Import controller from `./[service-name].controller`
- Use authentication middleware (`requireAuth`, `checkRole`, `requireMemberAuth`)
- Place specific routes (like `/chart-data`, `/export`) before parameterized routes (`/:id`)
- Register the service in `services/index.js` with `router.use("/[service-name]", require("./[service-name]"));`

### 2. `[service-name].controller.js` - Request Handlers

**Purpose**: Contains business logic and request/response handling

**Structure**:

```javascript
const [ServiceName]Model = require("./[service-name].model");
// Import other models/services as needed

// Standard CRUD operations
exports.get = async function (req, res, next) {
  try {
    const organizationId = req.organization._id;
    // Query logic
    const items = await [ServiceName]Model.find({ organization: organizationId });
    res.json(items);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.show = async function (req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization._id;
    const item = await [ServiceName]Model.findOne({ _id: id, organization: organizationId });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async function (req, res, next) {
  try {
    const organizationId = req.organization._id;
    const item = new [ServiceName]Model({
      ...req.body,
      organization: organizationId,
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error("Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.update = async function (req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization._id;
    const item = await [ServiceName]Model.findOneAndUpdate(
      { _id: id, organization: organizationId },
      { ...req.body, updatedDate: new Date() },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (error) {
    console.error("Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.destroy = async function (req, res, next) {
  try {
    const { id } = req.params;
    const organizationId = req.organization._id;
    const result = await [ServiceName]Model.deleteOne({ _id: id, organization: organizationId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Custom methods
exports.customMethod = async function (req, res, next) {
  // Custom logic
};
```

**Rules**:

- Use `exports.[methodName]` pattern for handler functions
- Always filter by `organization: req.organization._id` for multi-tenancy
- Handle errors consistently with try/catch
- Return appropriate HTTP status codes
- Validate input and handle Mongoose validation errors
- Use `req.organization` for organization-scoped endpoints
- Use `req.user` for user-scoped endpoints

### 3. `[service-name].model.js` - Mongoose Model

**Purpose**: Defines database schema and model methods

**Structure**:

```javascript
const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const [ServiceName]Schema = new mongoose.Schema({
  // Service-specific fields
  name: {
    type: String,
    required: true,
  },
  // Reference to other models
  relatedModel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RelatedModel",
  },
  // Nested objects
  metadata: {
    type: Map,
    of: String,
  },
  // Arrays
  tags: [{
    type: String,
  }],
}).add(baseSchema); // Always add baseSchema for multi-tenancy

// Indexes (for performance)
[ServiceName]Schema.index({ organization: 1, name: 1 });
[ServiceName]Schema.index({ organization: 1, createdDate: -1 });

// Virtuals
[ServiceName]Schema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Instance methods
[ServiceName]Schema.methods.doSomething = function() {
  // Instance method logic
};

// Static methods
[ServiceName]Schema.statics.findByOrganization = function(orgId) {
  return this.find({ organization: orgId });
};

// Shared utilities should be added as static methods or instance methods
// Static methods operate on the model/collection
[ServiceName]Schema.statics.sharedUtilityMethod = function(param1, param2) {
  // Shared business logic that can be reused across services
  return this.find({ /* query */ });
};

// Instance methods operate on individual documents
[ServiceName]Schema.methods.sharedInstanceMethod = function() {
  // Shared logic that operates on a single document
  return this.someProperty;
};

// Pre/post hooks (if needed)
[ServiceName]Schema.pre("save", async function(next) {
  // Pre-save logic
  next();
});

module.exports = mongoose.model("[ServiceName]", [ServiceName]Schema);
```

**Rules**:

- Must extend `baseSchema` using `.add(baseSchema)`
- Base schema provides: `organization`, `createdBy`, `createdDate`, `updatedBy`, `updatedDate`
- Create indexes for frequently queried fields
- Use `ref` for relationships to other models
- Define methods and statics as needed
- Use Mongoose hooks for lifecycle events
- **Shared utilities should be added as static methods or instance methods on the model**
  - Static methods: For operations on the collection/model (e.g., `Model.findByCustomCriteria()`)
  - Instance methods: For operations on individual documents (e.g., `document.calculateTotal()`)
  - This keeps utilities close to the data they operate on and makes them reusable across services
- **Service-specific utilities** (not shared) can go in `lib/` directory within the service
- Document complex utilities and methods

## Optional Files

### 4. `lib/` - Service-Specific Utilities

**Purpose**: Contains helper functions specific to this service that are NOT shared across services

**Structure**:

```
services/[service-name]/
  └── lib/
      ├── helper1.js
      ├── helper2.js
      └── README.md (optional)
```

**Rules**:

- Only include utilities specific to this service that are NOT shared with other services
- **Shared utilities should be added as static methods or instance methods on the model** (see Model section above)
- Service-specific business logic that doesn't fit in the model can go here
- Document complex utilities

### 5. `README.md` - Service Documentation

**Purpose**: Documents service-specific functionality

**Structure**:

```markdown
# [Service Name] Service

## Overview

Brief description of the service.

## Endpoints

- `GET /[service-name]` - List all
- `GET /[service-name]/:id` - Get one
- etc.

## Models

- [ServiceName] - Description

## Dependencies

- Other services/models this depends on
```

## Naming Conventions

- **Service directory**: `camelCase` (e.g., `eventInvitations`, `ticketTypes`)
- **Controller file**: `[service-name].controller.js` (e.g., `tickets.controller.js`)
- **Model file**: `[service-name].model.js` (e.g., `tickets.model.js`)
- **Model class**: `PascalCase` (e.g., `Ticket`, `EventInvitation`)
- **Route path**: `kebab-case` in `services/index.js` (e.g., `/event-invitations`)

## Service Registration

All services must be registered in `services/index.js`:

```javascript
router.use("/[kebab-case-name]", require("./[serviceName]"));
```

Example:

```javascript
router.use("/event-invitations", require("./eventInvitations"));
router.use("/ticket-types", require("./ticketTypes"));
```

## Authentication Patterns

### Organization-Scoped (Most Common)

```javascript
router.use(requireAuth(), checkRole("org:admin"));
// All routes require org admin role
```

### Per-Route Authentication

```javascript
router.get("/", requireAuth(), checkRole("org:admin"), controller.get);
router.post("/", requireMemberAuth(), controller.create); // Different auth
```

### Public Routes

```javascript
router.get("/public", controller.getPublic); // No auth middleware
```

## Error Handling

Controllers should handle errors consistently:

```javascript
try {
  // Logic
} catch (error) {
  console.error("Error:", error);
  if (error.name === "ValidationError") {
    return res.status(400).json({ error: error.message });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  res.status(500).json({ error: error.message });
}
```

## Multi-Tenancy

- Always filter queries by `organization: req.organization._id`
- Never expose data from other organizations
- Use `req.organization` from authentication middleware
- Base schema automatically includes `organization` field

## Best Practices

1. **Keep controllers thin**: Move complex logic to model methods (statics/instance methods) or service-specific utilities
2. **Add shared utilities to models**: Use static methods for collection-level operations and instance methods for document-level operations
3. **Validate input**: Use Mongoose validation and custom validators
4. **Use indexes**: Create indexes for frequently queried fields
5. **Handle errors**: Always use try/catch and return appropriate status codes
6. **Document complexity**: Add README.md for complex services
7. **Follow patterns**: Match existing service patterns for consistency
8. **Test organization isolation**: Ensure multi-tenancy works correctly
9. **Reusability**: If a utility might be used by multiple services, add it as a model method rather than in service-specific lib/
