# Session Automatic Timeout System

## Overview

The system now includes automatic session timeout functionality that closes sessions after a configurable time limit. This replaces the old phase2-only timeout with a session-wide timeout.

## How It Works

### 1. Session Time Limit Setting

- **Setting Name**: `sessionLimitHours`
- **Default**: 24 hours
- **Range**: 1-168 hours (1 hour to 1 week)
- **Location**: Settings (accessible by super admins)

The timeout is calculated from the **session start time** (`session.startDate`), not from when phase 2 begins.

### 2. Automatic Checking

Sessions can be automatically closed in three ways:

#### A. On Page Load (New)
- **Automatic**: Every time a user loads the main page, a timeout check runs
- Location: `/pages/index.js` - `checkSessionTimeout()` function
- This ensures sessions are checked frequently without needing external cron
- Runs silently in the background
- Benefits: No setup needed, works immediately

#### B. On-Vote Checking (Existing)
- Every time a user votes, the system checks if the session should auto-close
- Checks two conditions:
  1. All active users have voted
  2. Session time limit exceeded
- Location: `/api/votes.js` - `checkAutoClose()` function

#### C. Periodic Checking (Optional)
- Dedicated API endpoint: `/api/check-session-timeout`
- Checks ALL active sessions for timeout
- Can be called manually or by a cron job
- Useful for deployments with low user activity

## Using the Timeout Checker

### Manual Check
You can manually trigger a timeout check by sending a POST or GET request:

```bash
# Using curl
curl -X POST http://localhost:3000/api/check-session-timeout

# Using browser (for testing)
# Just visit: http://localhost:3000/api/check-session-timeout
```

### Response Format
```json
{
  "message": "Checked 2 session(s), closed 1",
  "checked": 2,
  "closed": 1,
  "closedSessions": [
    {
      "sessionId": "...",
      "place": "Stockholm",
      "elapsedHours": "25.3",
      "limitHours": 24
    }
  ],
  "sessionLimitHours": 24
}
```

### Setting Up Automated Checking

**Note**: With the page-load checking feature, most deployments won't need external cron setup. The timeout check runs automatically whenever users visit the page.

However, for deployments with very low user activity, you can optionally set up periodic checking:

#### Option 1: Using a Cron Service (Recommended)

Use a free cron service like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Uptime Robot](https://uptimerobot.com) (set as HTTP monitor)

Configure it to call your endpoint every 5-15 minutes:
```
URL: https://your-domain.com/api/check-session-timeout
Method: GET or POST
Frequency: Every 10 minutes
```

#### Option 2: Server-Side Cron (if you have server access)

Add to your crontab:
```bash
# Check every 10 minutes
*/10 * * * * curl -X POST https://your-domain.com/api/check-session-timeout
```

#### Option 3: Vercel Cron (if hosting on Vercel)

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/check-session-timeout",
    "schedule": "*/10 * * * *"
  }]
}
```

## Changing the Time Limit

### As Super Admin:
1. Go to Admin Panel
2. Click on "Settings" tab
3. Find "Session Time Limit (hours)"
4. Enter desired hours (1-168)
5. Click "Save settings"

### Via API:
```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"sessionLimitHours": 48}'
```

## Migration from Old System

**Note**: The old `phase2DurationHours` field has been removed. If you have existing settings in the database with `phase2DurationHours`, you should update them to use `sessionLimitHours` instead. The system now exclusively uses `sessionLimitHours` with a default of 24 hours.

## Testing

To test the timeout system:

1. **Create a test session** with a short time limit:
   ```bash
   # Set limit to 1 hour
   curl -X PUT http://localhost:3000/api/settings \
     -H "Content-Type: application/json" \
     -d '{"sessionLimitHours": 1}'
   ```

2. **Wait or manually adjust the session's startDate** in the database

3. **Trigger a timeout check**:
   ```bash
   curl -X POST http://localhost:3000/api/check-session-timeout
   ```

4. **Verify** the session was closed

## Important Notes

- ⏰ Timeout is calculated from **total session time**, not just phase 2
- 🔄 Sessions still close when all users vote (regardless of time)
- 🎯 Only **active** sessions are checked for timeout
- 📊 Closed sessions are archived with top proposals saved
- 🔒 No authentication required for the timeout endpoint (it's a system function)

## Logging

The system logs timeout events:
```
[AUTO-CLOSE] ⏰ Session time limit exceeded (25.3h / 24h). Closing session...
[TIMEOUT CHECK] Session 123abc closed successfully. Saved 2 top proposals.
```

Monitor these logs to ensure the system is working correctly.
