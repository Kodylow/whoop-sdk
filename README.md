# WHOOP TypeScript SDK

A production-ready, user-friendly TypeScript SDK for the WHOOP API that makes working with fitness and recovery data simple and intuitive.

## Installation

```bash
npm install @whoop/sdk
```

## Quick Start

### If you already have tokens (easiest)

```typescript
import { WhoopSDK } from '@whoop/sdk';

// If you already have access tokens (from previous OAuth flow)
const whoop = WhoopSDK.withTokens('your-access-token', 'your-refresh-token');

// Get current recovery score (most common use case)
const recovery = await whoop.getCurrentRecovery();

if (recovery.status.hasRecovery && recovery.status.isScored) {
  console.log(`Recovery Score: ${recovery.recovery!.score!.recovery_score}%`);
  console.log(`Strain: ${recovery.cycle.score?.strain}`);
} else if (recovery.status.isCalibrating) {
  console.log('User is still calibrating - recovery scores not yet available');
}
```

### If you need to authenticate users (OAuth flow)

```typescript
import { WhoopSDK } from '@whoop/sdk';

// Set up OAuth configuration
const whoop = new WhoopSDK({
  oauth: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://your-app.com/callback',
    scopes: ['read:profile', 'read:cycles', 'read:recovery', 'offline']
  }
});

// Step 1: Get authorization URL
const authUrl = whoop.auth!.getAuthorizationUrl();
// Step 2: Exchange code for tokens (in your callback handler)
const tokens = await whoop.auth!.exchangeCodeForTokens(authorizationCode);
// Step 3: Use the SDK
const userSummary = await whoop.getUserSummary();
```

## Key Features

- 🎯 **User-Friendly**: Simplified patterns for common use cases like getting current recovery
- 🔐 **Complete OAuth 2.0**: Automatic token refresh and secure authentication  
- 🏃‍♂️ **Real-World Examples**: Based on actual Whoop API documentation patterns
- 📊 **Comprehensive Coverage**: All Whoop API endpoints with TypeScript types
- 🔄 **Smart Handling**: Automatic pagination, calibration states, and error scenarios
- ⚡ **High Performance**: Built-in caching, retry logic, and connection pooling
- 🌐 **Universal**: Works in Node.js and browser environments

## Testing

Run the integration test:

```bash
export WHOOP_CLIENT_ID="your-client-id"
export WHOOP_CLIENT_SECRET="your-client-secret"
export WHOOP_REDIRECT_URI="http://localhost:3000/callback"

npm run test
```

## Common Use Cases

### 1. Get Current Recovery Score (Most Common)

```typescript
// Implements the official Whoop API pattern
const recovery = await whoop.getCurrentRecovery();

console.log('Recovery Status:');
console.log('- Has Recovery Data:', recovery.status.hasRecovery);
console.log('- Is User Calibrating:', recovery.status.isCalibrating);
console.log('- Is Scored:', recovery.status.isScored);

if (recovery.recovery?.score) {
  console.log(`Recovery Score: ${recovery.recovery.score.recovery_score}%`);
  console.log(`HRV: ${recovery.recovery.score.hrv_rmssd_milli.toFixed(1)} ms`);
}
```

### 2. Get User Summary

```typescript
// Get comprehensive user info in one call
const summary = await whoop.getUserSummary();
console.log(`Welcome ${summary.profile.first_name}!`);

if (summary.currentRecovery) {
  console.log(`Today's Recovery: ${summary.currentRecovery.score?.recovery_score}%`);
}
```

### 3. Handle New Users (Calibration)

```typescript
const isCalibrating = await whoop.isUserCalibrating();

if (isCalibrating) {
  console.log('User is still calibrating. Recovery scores will be available in a few days.');
} else {
  const recovery = await whoop.getCurrentRecovery();
  // Process recovery data...
}
```

### 4. Get Recent Recovery Trends

```typescript
// Get last 7 days with easy formatting
const recentData = await whoop.getRecentRecoveryScores(7);

recentData.forEach(day => {
  console.log(`${day.date}: Recovery ${day.recoveryScore}%, Strain ${day.strain}`);
});
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