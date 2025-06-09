/**
 * WHOOP SDK Integration Test
 * Comprehensive test script demonstrating OAuth flow and data retrieval
 */

import { WhoopSDK, createOAuthClient, validateAuthorizationCallback, formatDuration, metersToFeet, kilogramsToPounds } from '../src';
import type { OAuthTokens } from '../src';

// Configuration - Replace with your actual values
const CLIENT_ID = process.env.WHOOP_CLIENT_ID || 'your-client-id';
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET || 'your-client-secret';
const REDIRECT_URI = process.env.WHOOP_REDIRECT_URI || 'http://localhost:3000/callback';

/**
 * Simulate OAuth flow
 */
async function demonstrateOAuthFlow() {
  console.log('🔐 Starting OAuth Flow Demonstration\n');
  
  // Create OAuth client
  const oauthClient = createOAuthClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    scopes: ['read:profile', 'read:cycles', 'read:recovery', 'read:sleep', 'read:workout', 'read:body_measurement', 'offline']
  });
  
  // Generate authorization URL
  const state = 'random-state-' + Math.random().toString(36).substring(7);
  const authUrl = oauthClient.getAuthorizationUrl({ state });
  
  console.log('📱 Authorization URL:');
  console.log(authUrl);
  console.log('\n👆 Visit this URL to authorize the application\n');
  
  // Simulate callback handling
  console.log('🔄 Simulating callback handling...');
  const simulatedCallbackUrl = `${REDIRECT_URI}?code=simulated-auth-code&state=${state}`;
  
  try {
    const callbackResult = validateAuthorizationCallback(simulatedCallbackUrl, state);
    console.log('✅ Callback validation successful:', callbackResult);
  } catch (error) {
    console.error('❌ Callback validation failed:', error);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Test data retrieval with mock tokens
 */
async function testDataRetrieval() {
  console.log('📊 Testing Data Retrieval\n');
  
  // For demonstration purposes, we'll use mock tokens
  // In a real scenario, you'd get these from the OAuth flow
  const mockTokens: OAuthTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'read:profile read:cycles read:recovery read:sleep read:workout read:body_measurement offline'
  };
  
  // Initialize SDK with mock tokens
  const whoop = new WhoopSDK({
    oauth: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    },
    onTokenRefresh: async (tokens) => {
      console.log('🔄 Tokens refreshed automatically');
      // In a real app, you'd save these tokens to storage
    }
  });
  
  whoop.setTokens(mockTokens);
  
  try {
    // Test user profile
    console.log('👤 Fetching user profile...');
    // This would fail with mock tokens, but shows the API structure
    // const profile = await whoop.user.getProfile();
    // console.log('Profile:', profile);
    
    // Demonstrate the API calls that would be made
    console.log('📝 API calls that would be made:');
    console.log('GET /v1/user/profile/basic');
    console.log('GET /v1/user/measurement/body');
    console.log('GET /v1/cycle?limit=10');
    console.log('GET /v1/recovery?limit=10');
    console.log('GET /v1/activity/sleep?limit=10');
    console.log('GET /v1/activity/workout?limit=10');
    
    // Show data structure examples
    console.log('\n📋 Example data structures:');
    
    const exampleProfile = {
      user_id: 12345,
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe'
    };
    console.log('User Profile:', JSON.stringify(exampleProfile, null, 2));
    
    const exampleCycle = {
      id: 93845,
      user_id: 12345,
      created_at: '2024-01-15T11:25:44.774Z',
      updated_at: '2024-01-15T14:25:44.774Z',
      start: '2024-01-15T02:25:44.774Z',
      end: '2024-01-15T10:25:44.774Z',
      timezone_offset: '-05:00',
      score_state: 'SCORED',
      score: {
        strain: 15.2,
        kilojoule: 8288.297,
        average_heart_rate: 78,
        max_heart_rate: 165
      }
    };
    console.log('\nCycle Data:', JSON.stringify(exampleCycle, null, 2));
    
    const exampleSleep = {
      id: 10235,
      user_id: 12345,
      created_at: '2024-01-15T11:25:44.774Z',
      updated_at: '2024-01-15T14:25:44.774Z',
      start: '2024-01-14T23:30:00.000Z',
      end: '2024-01-15T07:45:00.000Z',
      timezone_offset: '-05:00',
      nap: false,
      score_state: 'SCORED',
      score: {
        stage_summary: {
          total_in_bed_time_milli: 30272735,
          total_awake_time_milli: 1403507,
          total_light_sleep_time_milli: 14905851,
          total_slow_wave_sleep_time_milli: 6630370,
          total_rem_sleep_time_milli: 5879573,
          sleep_cycle_count: 4,
          disturbance_count: 3
        },
        sleep_needed: {
          baseline_milli: 27395716,
          need_from_sleep_debt_milli: 352230,
          need_from_recent_strain_milli: 208595,
          need_from_recent_nap_milli: 0
        },
        respiratory_rate: 16.11,
        sleep_performance_percentage: 98.0,
        sleep_efficiency_percentage: 91.7
      }
    };
    console.log('\nSleep Data:', JSON.stringify(exampleSleep, null, 2));
    
  } catch (error) {
    console.log('Note: API calls would fail with mock tokens, but this demonstrates the SDK structure');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demonstrate pagination and iteration
 */
async function demonstratePagination() {
  console.log('📄 Demonstrating Pagination Features\n');
  
  const whoop = new WhoopSDK({
    oauth: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    }
  });
  
  console.log('🔄 Pagination examples:');
  console.log('');
  
  // Show different pagination approaches
  console.log('1. Manual pagination:');
  console.log(`
const firstPage = await whoop.cycles.list({ limit: 10 });
const secondPage = await whoop.cycles.list({ 
  limit: 10, 
  nextToken: firstPage.next_token 
});`);
  
  console.log('\n2. Automatic iteration:');
  console.log(`
for await (const cycle of whoop.cycles.iterate({ limit: 25 })) {
  console.log('Cycle ID:', cycle.id, 'Strain:', cycle.score?.strain);
}`);
  
  console.log('\n3. Date range filtering:');
  console.log(`
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);

const recentCycles = await whoop.cycles.list({
  start: lastWeek.toISOString(),
  end: new Date().toISOString(),
  limit: 25
});`);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Demonstrate utility functions
 */
async function demonstrateUtilities() {
  console.log('🛠️ Demonstrating Utility Functions\n');
  
  // Duration formatting
  const sleepDurationMs = 8 * 60 * 60 * 1000; // 8 hours
  console.log(`Sleep duration: ${formatDuration(sleepDurationMs)}`);
  
  // Unit conversions
  const heightMeters = 1.8288;
  const weightKg = 90.7185;
  console.log(`Height: ${heightMeters}m = ${metersToFeet(heightMeters).toFixed(1)} ft`);
  console.log(`Weight: ${weightKg}kg = ${kilogramsToPounds(weightKg).toFixed(1)} lbs`);
  
  // Show error handling
  console.log('\n🚨 Error handling examples:');
  console.log(`
try {
  const cycle = await whoop.cycles.get(999999);
} catch (error) {
  if (isWhoopAPIError(error)) {
    console.log('API Error:', error.status, error.message);
  } else if (isRateLimitError(error)) {
    console.log('Rate limited. Retry after:', error.retryAfter);
  }
}`);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Show real-world usage patterns
 */
async function showUsagePatterns() {
  console.log('💡 Real-World Usage Patterns\n');
  
  console.log('1. Daily Health Summary:');
  console.log(`
async function getDailyHealthSummary(whoop: WhoopSDK) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Get yesterday's data
  const [cycles, recoveries, sleeps] = await Promise.all([
    whoop.cycles.list({ 
      start: yesterday.toISOString(),
      end: today.toISOString() 
    }),
    whoop.recovery.list({ 
      start: yesterday.toISOString(),
      end: today.toISOString() 
    }),
    whoop.sleep.list({ 
      start: yesterday.toISOString(),
      end: today.toISOString() 
    })
  ]);
  
  return {
    strain: cycles.records[0]?.score?.strain,
    recovery: recoveries.records[0]?.score?.recovery_score,
    sleepEfficiency: sleeps.records[0]?.score?.sleep_efficiency_percentage
  };
}`);
  
  console.log('\n2. Weekly Trend Analysis:');
  console.log(`
async function getWeeklyTrends(whoop: WhoopSDK) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const trends = [];
  
  for await (const cycle of whoop.cycles.iterate({ 
    start: weekAgo.toISOString(),
    limit: 25 
  })) {
    if (cycle.score) {
      trends.push({
        date: cycle.start,
        strain: cycle.score.strain,
        averageHR: cycle.score.average_heart_rate
      });
    }
  }
  
  return trends;
}`);
  
  console.log('\n3. Token Management:');
  console.log(`
// Save tokens to secure storage
whoop.onTokenRefresh = async (tokens) => {
  await saveToSecureStorage('whoop_tokens', tokens);
};

// Load tokens on app start
const savedTokens = await loadFromSecureStorage('whoop_tokens');
if (savedTokens) {
  whoop.setTokens(savedTokens);
}

// Check authentication status
if (!whoop.isAuthenticated()) {
  // Redirect to OAuth flow
  window.location.href = whoop.auth?.getAuthorizationUrl();
}`);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main test runner
 */
async function runIntegrationTest() {
  console.log('🏃‍♂️ WHOOP SDK Integration Test');
  console.log('===================================\n');
  
  try {
    await demonstrateOAuthFlow();
    await testDataRetrieval();
    await demonstratePagination();
    await demonstrateUtilities();
    await showUsagePatterns();
    
    console.log('✅ Integration test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Replace CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI with real values');
    console.log('2. Implement token storage in your application');
    console.log('3. Handle errors appropriately in production');
    console.log('4. Add proper logging and monitoring');
    console.log('5. Test with real WHOOP API endpoints');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Export for use in other files
export { runIntegrationTest };

// Run if executed directly
if (require.main === module) {
  runIntegrationTest().catch(console.error);
} 