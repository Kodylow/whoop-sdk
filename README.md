# WHOOP TypeScript SDK

A production-ready, beautifully typed TypeScript SDK for the WHOOP API.

## Installation

```bash
npm install @whoop/sdk
```

## Quick Start

```typescript
import { WhoopSDK } from '@whoop/sdk';

// Initialize with OAuth
const whoop = new WhoopSDK({
  oauth: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://your-app.com/callback',
    scopes: ['read:profile', 'read:cycles', 'offline']
  }
});

// Start OAuth flow
const authUrl = whoop.auth!.getAuthorizationUrl();

// After OAuth callback, use the API
const profile = await whoop.user.getProfile();
const cycles = await whoop.cycles.list({ limit: 10 });

// Iterate through data
for await (const cycle of whoop.cycles.iterate()) {
  console.log(`Strain: ${cycle.score?.strain}`);
}
```

## Features

- 🔐 Complete OAuth 2.0 flow with automatic token refresh
- 📊 Full API coverage (cycles, recovery, sleep, workouts, user data)
- 🚀 Comprehensive TypeScript types
- 🔄 Automatic pagination and iteration
- ⚡ Built-in retry logic and error handling
- 🌐 Works in Node.js and browser

## Testing

Run the integration test:

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
export WHOOP_REDIRECT_URI="http://localhost:3000/callback"

npm run test
```

## API Examples

```typescript
// Get user data
const profile = await whoop.user.getProfile();
const measurements = await whoop.user.getBodyMeasurement();

// Get cycles with date filtering
const cycles = await whoop.cycles.list({
  start: '2024-01-01T00:00:00Z',
  end: '2024-01-31T23:59:59Z',
  limit: 25
});

// Get specific data
const cycle = await whoop.cycles.get(cycleId);
const recovery = await whoop.cycles.getRecovery(cycleId);
const sleep = await whoop.sleep.get(sleepId);
const workout = await whoop.workouts.get(workoutId);

// Automatic iteration
for await (const recovery of whoop.recovery.iterate()) {
  console.log(`Recovery: ${recovery.score?.recovery_score}%`);
}
```

## Error Handling

```typescript
import { isWhoopAPIError, isRateLimitError, WhoopValidationError } from '@whoop/sdk';

try {
  const data = await whoop.cycles.list();
} catch (error) {
  if (error instanceof WhoopValidationError) {
    console.log('Validation error:', error.message);
  } else if (isRateLimitError(error)) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  }
}
```

## License

MIT 