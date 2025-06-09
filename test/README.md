# WHOOP SDK Test Suite

Comprehensive testing suite for the high-performance WHOOP TypeScript SDK, including unit tests, integration tests, performance benchmarks, and a full OAuth flow test runner.

## 🏗️ Test Structure

### **Unit Tests**
- **`utils/cache.test.ts`** - High-performance cache system tests
- **`utils/deduplication.test.ts`** - Request deduplication system tests  
- **`performance.test.ts`** - Performance optimization benchmarks
- **`setup.ts`** - Jest configuration and test utilities

### **Integration Tests**
- **`integration/sdk.test.ts`** - End-to-end SDK functionality tests
- **`test-run.ts`** - Complete OAuth flow and API testing script

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy the configuration template and add your WHOOP app credentials:

```bash
cp test/config.example.env .env
```

Edit `.env` with your values:
```bash
# Required: Get these from https://developer.whoop.com
WHOOP_CLIENT_ID=your_client_id_here
WHOOP_CLIENT_SECRET=your_client_secret_here

# Optional: Customize redirect URI if needed
WHOOP_REDIRECT_URI=http://localhost:8080/api/whoop/callback
```

### 3. Run Tests

**Unit Tests:**
```bash
npm test
```

**Performance Tests:**
```bash
npm test -- performance.test.ts
```

**Integration Test Runner:**
```bash
npm run test:integration
```

**With Coverage:**
```bash
npm run test:coverage
```

## 📊 Test Categories

### **Unit Tests**

#### Cache System Tests
- ✅ Basic CRUD operations
- ✅ TTL (Time To Live) expiration
- ✅ LRU (Least Recently Used) eviction
- ✅ Compression for large objects
- ✅ Performance statistics tracking
- ✅ Memory management and cleanup

#### Deduplication System Tests  
- ✅ Basic request deduplication
- ✅ Error handling and propagation
- ✅ Concurrency control and limiting
- ✅ Request cancellation
- ✅ Configuration options
- ✅ Performance statistics
- ✅ Request batching with priorities

#### Performance Benchmarks
- ⚡ Sub-millisecond cache access times
- ⚡ Efficient memory usage with compression
- ⚡ Scalability with large datasets
- ⚡ High-frequency request handling
- ⚡ Key generation performance
- ⚡ Memory cleanup efficiency

### **Integration Tests**

#### Complete SDK Testing
- 🔐 OAuth 2.0 authentication flow
- 👤 User profile and body measurements
- 🔄 Cycles data retrieval
- 😴 Sleep data analysis
- 💚 Recovery metrics
- 🏃 Workout tracking
- ⚡ Performance optimizations validation
- 🛡️ Error handling scenarios

## 🧪 Integration Test Runner

The integration test runner (`test-run.ts`) provides a comprehensive testing experience that mirrors the Python reference implementation:

### Features
- **🔐 Complete OAuth Flow** - Automated browser-based authentication
- **🌐 Local Callback Server** - Handles OAuth redirects automatically  
- **📊 Performance Monitoring** - Real-time cache and deduplication metrics
- **🔧 Troubleshooting** - Detailed error messages and configuration tips
- **📈 Test Reporting** - Success rates, warnings, and performance statistics

### Running the Integration Test

```bash
npm run test:integration
```

**What it does:**
1. 🚀 Starts a local callback server
2. 🌐 Opens your browser for WHOOP authentication
3. 🔑 Exchanges authorization code for tokens
4. 🧪 Tests all API endpoints with real data
5. ⚡ Validates performance optimizations
6. 📊 Reports comprehensive test results

### Sample Output

```
🩺 WHOOP API Testing Script - TypeScript Edition
================================================
🚀 Initializing high-performance WHOOP SDK...
✅ Configuration validated successfully

============================================================
🔐 WHOOP API Authentication
============================================================
🔧 IMPORTANT: Make sure your WHOOP app is configured with this redirect URI:
   http://localhost:8080/api/whoop/callback

📋 To configure your WHOOP app:
1. Go to https://developer.whoop.com
2. Select your app
3. Add this redirect URI to your app settings
============================================================
🚀 Callback server started on port 8080
🌐 Opening browser for authentication...
📱 If the browser doesn't open automatically, visit:
   https://api.prod.whoop.com/oauth/oauth2/auth?...

⏳ Waiting for authorization...
✅ Authorization code received successfully
🎉 Authentication successful!
📊 Token expires in: 3600 seconds

============================================================
🧪 WHOOP API Connection Test
============================================================

🔍 Testing: User Profile
📡 Starting request: https://api.prod.whoop.com/developer/v1/user/profile/basic
✅ User Profile - Welcome John Athlete! (ID: 12345)
   📧 Email: john@example.com

🔍 Testing: Body Measurements
📡 Starting request: https://api.prod.whoop.com/developer/v1/user/measurement/body
✅ Body Measurements - Retrieved successfully
   📏 Height: 1.83m
   ⚖️ Weight: 75.2kg
   💗 Max HR: 190 bpm

🔍 Testing: Recent Cycles
📡 Starting request: https://api.prod.whoop.com/developer/v1/cycle?limit=3
✅ Cycles - Found 3 recent cycles
   🔄 Cycle 1: 2024-01-15T06:00:00.000Z, Strain: 15.2
   🔄 Cycle 2: 2024-01-14T06:00:00.000Z, Strain: 12.8

🔍 Testing: Recent Sleep
⚡ Cache hit! Duration: 1.23ms
🎯 Cache hit: whoop:abc123
✅ Sleep - Found 2 recent sleep records
   😴 Sleep 1: 2024-01-15T22:00:00.000Z
      Efficiency: 94%, Performance: 88%

🔍 Testing: Recent Recovery
✅ Recovery - Found 2 recent recovery records
   💚 Recovery 1: 2024-01-16T06:00:00.000Z
      Score: 85%, HRV: 42.5ms, RHR: 45 bpm

🔍 Testing: Recent Workouts
✅ Workouts - Found 2 recent workouts
   🏃 Workout 1: 2024-01-15T08:00:00.000Z to 2024-01-15T09:30:00.000Z
      Strain: 12.8, Avg HR: 145 bpm, Energy: 1250.5 kJ

🔍 Testing: Performance Optimizations
   🧪 Testing cache performance...
⚡ Cache hit! Duration: 0.45ms
✅ Cache Performance - Cache hit reduced response time by 87.3%
   🧪 Testing request deduplication...
✅ Request Deduplication - Multiple simultaneous requests handled
   📊 Performance Statistics:
      Cache hit rate: 78%
      Total requests: 12
      Cached requests: 4
      Average response time: 145.23ms
      Memory usage: 24KB
✅ Performance Statistics - All metrics collected successfully

============================================================
🎉 Connection test completed!

📈 Test Summary:
   Total Tests: 8
   Passed: 8 ✅
   Failed: 0 ❌
   Warnings: 0 ⚠️
   Success Rate: 100.0%

✨ Your WHOOP SDK integration is working correctly.
============================================================
```

## 🔧 Configuration

### OAuth App Setup
1. Go to [https://developer.whoop.com](https://developer.whoop.com)
2. Create or select your application
3. Add the redirect URI: `http://localhost:8080/api/whoop/callback`
4. Note your Client ID and Client Secret
5. Enable required scopes:
   - `offline` (for refresh tokens)
   - `read:profile`
   - `read:cycles`
   - `read:recovery`
   - `read:sleep`
   - `read:workouts`
   - `read:body_measurement`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WHOOP_CLIENT_ID` | Your WHOOP app client ID | Required |
| `WHOOP_CLIENT_SECRET` | Your WHOOP app client secret | Required |
| `WHOOP_REDIRECT_URI` | OAuth callback URL | `http://localhost:8080/api/whoop/callback` |
| `PORT` | Callback server port | `8080` |
| `WHOOP_BASE_URL` | API base URL | `https://api.prod.whoop.com/developer` |

### Performance Configuration

Performance optimizations can be configured via environment variables or programmatically:

```typescript
const sdk = new WhoopSDK({
  performance: {
    cache: {
      ttl: 5 * 60 * 1000,    // 5 minutes
      maxSize: 1000,          // 1000 entries
      compress: true          // Enable compression
    },
    deduplication: {
      enabled: true,          // Enable deduplication
      windowMs: 100,          // 100ms window
      maxConcurrent: 10       // Max 10 concurrent requests
    },
    hooks: {
      onCacheHit: (key) => console.log(`Cache hit: ${key}`),
      onSlowRequest: (metrics) => console.warn(`Slow request: ${metrics.duration}ms`)
    },
    slowRequestThreshold: 2000  // 2 second threshold
  }
});
```

## 🚨 Troubleshooting

### Common Issues

**"redirect_uri_mismatch" Error:**
- Ensure your redirect URI exactly matches the one configured in your WHOOP app
- Try common variations:
  - `http://localhost:8080/api/whoop/callback`
  - `http://localhost:8080`
  - `http://127.0.0.1:8080/api/whoop/callback`

**Port Already in Use:**
- Change the `PORT` environment variable
- Or find and stop the process using port 8080

**Authentication Timeout:**
- Increase timeout in test configuration
- Check your internet connection
- Verify your WHOOP app credentials

**Performance Test Failures:**
- Tests are designed for development environments
- CI/CD environments may have different performance characteristics
- Adjust thresholds in test configuration if needed

## 📊 Performance Expectations

The SDK is optimized for athlete-grade performance:

- **Cache Access:** < 0.1ms average
- **Cache Key Generation:** < 0.01ms per key
- **Request Deduplication:** 90%+ duplicate elimination
- **Memory Efficiency:** Automatic cleanup and compression
- **API Response Time:** Sub-second for cached requests
- **Concurrent Handling:** 10+ simultaneous requests

## 🎯 Testing Best Practices

1. **Use Real Credentials:** Integration tests require actual WHOOP API access
2. **Rate Limiting:** Be mindful of API rate limits during testing
3. **Environment Isolation:** Use separate test environments when possible
4. **Cache Testing:** Tests validate cache behavior with time manipulation
5. **Error Scenarios:** Tests cover network failures, timeouts, and API errors
6. **Performance Monitoring:** Real-time metrics help identify bottlenecks

## 📚 Additional Resources

- [WHOOP Developer Documentation](https://developer.whoop.com/docs)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Jest Testing Framework](https://jestjs.io/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

---

**Built with ❤️ for athletes who demand performance excellence, just like WHOOP.** 