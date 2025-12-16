# Ticket Reminder System - Digital Ocean App Platform

This system provides database-driven cron job scheduling for Digital Ocean App Platform without requiring PM2. It includes a ticket reminder worker that sends emails to ticket holders the day before their events.

## System Architecture

The system consists of several components:

1. **CronJob Model** - Database-driven job configuration (`../services/cron/`)
2. **ServiceWorkerRegistry** - Registry of available workers (no file paths needed) (`workers/ServiceWorkerRegistry.js`)
3. **ServiceRunner** - Worker execution engine with integrated worker methods (`workers/ServiceRunner.js`)
4. **Cron App** - Main scheduling service with health checks and auto job management (`workers/cron-app.js`)
5. **Worker Classes** - Actual worker implementations (`workers/lib/`)
   - **Ticket Reminder Worker** - Email reminder functionality (`workers/lib/ticket-reminder-worker.js`)
   - **Daily Stats Worker** - Organization statistics emails (`workers/lib/daily-stats-worker.js`)

## Quick Start

### 1. Install Dependencies

All required dependencies are already included in package.json:

```bash
npm install
```

### 2. Seed Email Templates

```bash
# Templates are automatically seeded at startup when running the cron app
# No manual seeding required!

# Note: Cron jobs are automatically created/updated when the app starts
```

### 3. Test the System

```bash
# Test the ticket reminder worker standalone
npm run reminder-worker

# Test the daily stats worker standalone (optionally with org ID)
npm run stats-worker [organizationId]

# Or run the full cron app (recommended)
npm run cron-app
```

### 4. Deploy to Digital Ocean App Platform

Set the following environment variables in your App Platform configuration:

```
WORKERS_ENABLED=true
MONGO_SCHEME=mongodb+srv
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_HOSTNAME=your_cluster.mongodb.net
MONGO_DB=your_database_name
SEND_EMAIL=true
API_URL=your_api_url
SCALE_COM_HOST=your_frontend_url
PORT=3010
```

Use `npm run cron-app` as your run command in App Platform.

## Workers

### Ticket Reminder Worker

Sends reminder emails to ticket holders the day before their events.

- **Schedule**: Daily at 10 AM CST (3 PM UTC)
- **Type**: System-wide (runs across all organizations)
- **Template**: `ticket-reminder`
- **File**: `workers/lib/ticket-reminder-worker.js`

### Daily Stats Worker

Sends comprehensive daily statistics emails to organization administrators.

- **Schedule**: Daily at 8 AM CST (1 PM UTC)
- **Type**: Organization-specific
- **Template**: `daily-stats`
- **File**: `workers/lib/daily-stats-worker.js`
- **Features**:
  - Ticket sales and revenue metrics
  - Check-in activity tracking
  - Upcoming events overview
  - Team activity summaries
  - Payment method analytics
  - Performance highlights and suggested actions

## How It Works

### Automatic Template Seeding

The system automatically seeds required email templates at startup:

- **When**: Every time the main app starts (via `index.js`)
- **Source**: `seeds/templates.json` file
- **Templates**: `ticket-reminder`, `order-created`, `tickets-generated`, `daily-stats`
- **Behavior**: Creates missing templates, updates existing ones
- **Logging**: Detailed seeding statistics in startup logs

This ensures that all required email templates are always available without manual intervention.

### Database-Driven Jobs

Jobs are stored in the `cronjobs` collection with this structure:

```javascript
// System-wide job (runs across all organizations)
{
  jobName: "Ticket Reminder Worker",
  workerType: "ticket-reminder",
  schedule: "0 15 * * *", // 10 AM CST (3 PM UTC)
  timezone: "America/Chicago",
  enabled: true,
  isSystemJob: true,
  organization: null,
}

// Organization-specific job (runs per organization)
{
  jobName: "Daily Stats Worker",
  workerType: "daily-stats",
  schedule: "0 13 * * *", // 8 AM CST (1 PM UTC)
  timezone: "America/Chicago",
  enabled: true,
  isSystemJob: false,
  organization: ObjectId("..."), // specific organization
}
```

### Worker Registry

The `ServiceWorkerRegistry` maintains available workers:

```javascript
// System-wide workers (run across all organizations)
"ticket-reminder" - Sends reminder emails day before events

// Organization-specific workers
"daily-stats" - Sends daily statistics emails to organization administrators

// Additional workers (examples)
"email-digest" - Daily/weekly organization summaries
"cart-cleanup" - Cleanup old organization data
```

### Dynamic Scheduling

The cron app:

- Automatically creates/updates system jobs on startup
- Loads enabled jobs from database on startup
- Reschedules jobs every 15 minutes to pick up changes
- Provides health check endpoints
- Tracks job execution statistics

## Health Check Endpoints

The cron app provides health check endpoints for Digital Ocean App Platform:

```bash
# Basic health check
GET /
# Returns: { status: "healthy", timestamp: "...", scheduledJobs: 2 }

# Detailed status
GET /status
# Returns: Full system status including active jobs, registry info

# Manual job trigger (for testing)
POST /trigger/ticket-reminder
# Body: { organizationId: "optional" }
```

## Configuration

### Environment Variables

| Variable          | Description                          | Default  |
| ----------------- | ------------------------------------ | -------- |
| `WORKERS_ENABLED` | Enable/disable worker scheduling     | `true`   |
| `MONGO_SCHEME`    | MongoDB scheme (mongodb/mongodb+srv) | Required |
| `MONGO_USERNAME`  | MongoDB username                     | Required |
| `MONGO_PASSWORD`  | MongoDB password                     | Required |
| `MONGO_HOSTNAME`  | MongoDB hostname/cluster             | Required |
| `MONGO_DB`        | MongoDB database name                | Required |
| `SEND_EMAIL`      | Actually send emails (vs. dry run)   | `false`  |
| `PORT`            | Health check server port             | `3010`   |
| `API_URL`         | Base API URL for links               | Required |
| `SCALE_COM_HOST`  | Frontend URL for wallet links        | Required |

### Timezone Configuration

The system uses Central Time (America/Chicago) by default. To change:

1. Update the timezone in `ServiceWorkerRegistry.js` for default workers
2. Update database records via the admin interface or API
3. The cron app automatically picks up timezone changes

### Adding New Workers

1. Create your worker class following the pattern in `lib/ticket-reminder-worker.js`

2. Register it in `ServiceWorkerRegistry.js`:

```javascript
this.registerWorker("my-worker", {
  name: "My Custom Worker",
  description: "Does custom work",
  isSystemWorker: false, // true for system-wide
  requiresOrganization: true,
  defaultSchedule: "0 9 * * *",
  enabled: false, // Enable per organization
});
```

3. Add your worker to `ServiceRunner.js`:

```javascript
// Add case to executeWorker method
case "my-worker":
  return await this.runMyCustomWorker(organizationId);

// Add the worker method
async runMyCustomWorker(organizationId = null) {
  try {
    const MyCustomWorker = require("./lib/my-custom-worker");
    const worker = new MyCustomWorker();

    const result = await worker.runAsService(organizationId);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      // Return standardized format based on your worker's stats
      itemsProcessed: result.stats.itemsProcessed,
      errors: result.stats.errors,
      duration: result.stats ? Date.now() - result.stats.startTime.getTime() : 0,
    };
  } catch (error) {
    throw new Error(`My custom worker failed: ${error.message}`);
  }
}
```

4. Restart the cron app - it will automatically create database records

## Monitoring

### Logs

The cron app provides detailed logging:

```
🚀 Starting Kikits Cron Service...
✅ Connected to MongoDB
🔧 Ensuring default system jobs exist...
➕ Created default job for: Ticket Reminder Worker
📊 Found 1 enabled jobs in database
✅ Scheduled: Ticket Reminder Worker (0 15 * * *) (system-wide)
🌐 Health check server listening on port 3010

# Job execution logs
🎯 Executing cron job: Ticket Reminder Worker
📧 Processing reminder for Order 507f...
✅ Reminder sent successfully for Order 507f...
📊 Found 5 orders that need reminder notifications
✅ Job completed successfully
```

### Database Tracking

Each job execution is tracked in the database:

- `runCount` - Total executions
- `successCount` - Successful executions
- `errorCount` - Failed executions
- `lastRun` - Last execution timestamp
- `lastSuccess` - Last successful execution
- `lastError` - Last failure timestamp
- `lastErrorMessage` - Error details

### Health Monitoring

Monitor your deployment via:

```bash
# Check if service is running
curl https://your-app.ondigitalocean.app/

# Get detailed status
curl https://your-app.ondigitalocean.app/status

# Trigger manual test
curl -X POST https://your-app.ondigitalocean.app/trigger/ticket-reminder
```

## Troubleshooting

### No Jobs Scheduled

1. Check `WORKERS_ENABLED=true` in environment
2. Verify database connection
3. Restart the app (jobs are auto-created on startup)
4. Check logs for job loading errors

### Reminder Emails Not Sending

1. Verify `SEND_EMAIL=true` in environment
2. Check SendGrid configuration
3. Ensure "ticket-reminder" template exists in database
4. Verify orders have proper status and dates
5. Check notification status fields in orders

### Jobs Not Executing

1. Check job `enabled` status in database
2. Verify cron schedule format (5 parts: min hour day month dow)
3. Check timezone configuration
4. Look for execution errors in logs

### Database Connection Issues

1. Verify `MONGO_URI` environment variable
2. Check MongoDB authentication and network access
3. Ensure database user has read/write permissions

## Testing

### Manual Testing

```bash
# Test ticket reminder worker standalone
npm run reminder-worker

# Test daily stats worker standalone (all orgs)
npm run stats-worker

# Test daily stats worker for specific organization
npm run stats-worker 670e8b905f4526e213a18612

# Test specific worker via API
curl -X POST http://localhost:3010/trigger/ticket-reminder

# Test daily stats worker via API
curl -X POST http://localhost:3010/trigger/daily-stats

# Test with specific organization
curl -X POST http://localhost:3010/trigger/daily-stats \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "org_id_here"}'
```

### Create Test Data

```javascript
// Create an event happening tomorrow
db.events.updateOne(
  { _id: ObjectId("your-event-id") },
  { $set: { startDate: new Date(Date.now() + 24 * 60 * 60 * 1000) } }
);

// Ensure orders are in correct state
db.orders.updateMany(
  { event: ObjectId("your-event-id") },
  {
    $set: {
      status: "completed",
      ticketsPdfStatus: "generated",
      reminderNotificationStatus: "pending",
    },
  }
);
```

## Deployment to Digital Ocean App Platform

### App Configuration

Create an app with these settings:

**Source**: Your Git repository
**Run Command**: `npm run cron-app`
**Environment Variables**:

```
WORKERS_ENABLED=true
MONGO_SCHEME=mongodb+srv
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_HOSTNAME=your_cluster.mongodb.net
MONGO_DB=your_database_name
SEND_EMAIL=true
NODE_ENV=production
```

**Health Check**:

- Path: `/`
- Port: `3010`

### Scaling

The service is designed to run as a single instance to avoid duplicate job execution. Digital Ocean App Platform will automatically restart it if it fails.

For high availability, you could:

1. Run multiple instances with job locking mechanisms
2. Use external cron service (GitHub Actions, etc.) to trigger endpoints
3. Implement leader election for job scheduling

## Security

- **Health Endpoints**: Consider adding authentication for production
- **Manual Triggers**: The `/trigger/*` endpoints should be secured
- **Database Access**: Use read/write specific database users
- **Environment Variables**: Store sensitive values as encrypted environment variables

## Performance

- **Memory Usage**: ~50-100MB for the cron service
- **CPU Usage**: Minimal except during job execution
- **Database Load**: Light - only job metadata and occasional polling
- **Email Rate Limits**: Built-in delays prevent overwhelming SendGrid

The system is designed to be lightweight and efficient for Digital Ocean App Platform's resource constraints.
