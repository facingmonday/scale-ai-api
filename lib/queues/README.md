# Bull Queue System for SCALE LXP

This directory contains the Bull queue system implementation for handling email and simulation jobs asynchronously to prevent memory issues and improve performance.

## Overview

The queue system uses Redis as a backend and provides:

- **Email Sending Queue**: Handles email, SMS, and push notifications
- **Simulation Queues**: Handles simulation and outcome processing jobs
- **Bull Dashboard**: Web interface for monitoring queue status and jobs

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# Redis Configuration
REDIS_HOST=localhost          # Redis server host
REDIS_PORT=6379              # Redis server port
REDIS_PASSWORD=               # Redis password (leave empty if none)
REDIS_DB=0                   # Redis database number

# Workers Configuration
WORKERS_ENABLED=true         # Enable/disable the workers service
PORT_WORKERS=1341            # Port for the workers service
```

## Architecture

### Queue Types

1. **Email Sending Queue** (`email-sending`)
   - `email`: Send email notifications
   - `sms`: Send SMS notifications
   - `push`: Send push notifications

2. **Simulation Queue** (`simulation`)
   - Processing AI-driven student decision simulation outcomes

3. **Simulation Batch Queue** (`simulation-batch`)
   - Processing batch simulation executions

4. **Outcome Processing Queue** (`challenge-outcome-processing`)
   - Processing challenge outcomes

### Queue Workers

- **Email Worker** (`lib/queues/email-worker.js`): Processes notification sending jobs
- **Simulation Worker** (`lib/queues/simulation-worker.js`): Processes student decision outcome calculations

### Monitoring

- **Bull Dashboard**: Available at `/admin/queues` on the workers service
- **Health Check**: Available at `/` and `/status` on the workers service

## Usage

### Starting the Workers Service

```bash
npm run start:workers
```

### Accessing the Dashboard

Once the workers service is running, access the Bull dashboard at:

```
http://localhost:1341/admin/queues
```

### API Endpoints

- `GET /`: Health check with queue statistics
- `GET /status`: Detailed status information
- `GET /registry`: Worker registry information
- `POST /run/:workerType`: Manually execute a worker
- `POST /stop-all`: Stop all active jobs
- `GET /admin/queues`: Bull dashboard interface

## Integration

### Email Notifications

Instead of directly sending emails, use the queue system:

```javascript
// OLD: Direct email sending
await NotificationModel.sendEmailNotification(notification, receiver);

// NEW: Queue-based email sending (automatic via post-save hook)
const notification = new NotificationModel({...});
await notification.save(); // Automatically queues the email
```

## Queue Job Priorities

- **Email Sending**:
  - SMS: Priority 4 (higher urgency)
  - Email: Priority 3
  - Push notifications: Priority 2

## Error Handling

- Failed jobs are automatically retried up to 3 times with exponential backoff
- Job results are logged and stored in the database
- Queue statistics are available via the status endpoints

## Redis Setup

### Local Development

1. Install Redis locally:

   ```bash
   # macOS with Homebrew
   brew install redis
   brew services start redis

   # Ubuntu/Debian
   sudo apt-get install redis-server
   sudo systemctl start redis-server
   ```

2. Verify Redis is running:
   ```bash
   redis-cli ping
   ```

### Production

Use a managed Redis service like:

- Redis Labs
- AWS ElastiCache
- Google Cloud Memorystore
- Azure Cache for Redis

## Troubleshooting

### Queue Not Processing Jobs

1. Check Redis connection: `redis-cli ping`
2. Check workers service logs
3. Verify environment variables
4. Check queue dashboard for stuck jobs

### High Memory Usage

1. Monitor queue sizes via dashboard
2. Adjust concurrency settings if needed
3. Check for memory leaks in PDF generation code
4. Consider horizontal scaling of workers

### Job Failures

1. Check job logs in dashboard
2. Verify external service credentials (SendGrid, S3, etc.)
3. Check database connectivity
4. Review error messages in worker logs
