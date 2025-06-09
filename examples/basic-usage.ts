/**
 * WHOOP SDK - Basic Usage Examples
 * 
 * This file demonstrates the most common patterns for using the WHOOP SDK
 * in real-world applications. These examples follow the official Whoop API
 * documentation patterns.
 */

import { WhoopSDK, getRecommendedScopes, WhoopAuthError } from '../src';

// ===============================
// 1. SETUP - Choose your method
// ===============================

// Method A: If you already have tokens (easiest)
const whoopWithTokens = WhoopSDK.withTokens(
  'your-access-token',
  'your-refresh-token'
);

// Method B: OAuth flow for new users
const whoopOAuth = new WhoopSDK({
  oauth: {
    clientId: process.env.WHOOP_CLIENT_ID!,
    clientSecret: process.env.WHOOP_CLIENT_SECRET!,
    redirectUri: process.env.WHOOP_REDIRECT_URI!,
    scopes: getRecommendedScopes(), // ['read:profile', 'read:cycles', 'read:recovery', 'offline']
  }
});

// Method C: For server-side apps with multiple users
function createUserClient(userId: string, userTokens: { accessToken: string; refreshToken?: string }) {
  return WhoopSDK.forUser(userId, userTokens);
}

// ===============================
// 2. GETTING CURRENT RECOVERY (Most Common Use Case)
// ===============================

async function getCurrentRecoveryExample() {
  try {
    // This implements the official Whoop 2-step pattern:
    // 1. Get current cycle
    // 2. Get recovery for that cycle
    const recovery = await whoopWithTokens.getCurrentRecovery();

    console.log('=== Current Recovery Status ===');
    console.log('Has recovery data:', recovery.status.hasRecovery);
    console.log('User is calibrating:', recovery.status.isCalibrating);
    console.log('Score is ready:', recovery.status.isScored);
    console.log('Score is pending:', recovery.status.isPending);
    console.log('Cannot be scored:', recovery.status.isUnscorable);

    // Handle different states
    if (recovery.status.isCalibrating) {
      console.log('💡 User is still calibrating. Recovery scores will be available in a few days.');
      return;
    }

    if (recovery.status.isPending) {
      console.log('⏳ Recovery score is being calculated. Check back later.');
      return;
    }

    if (recovery.status.isUnscorable) {
      console.log('❌ This cycle cannot be scored by Whoop (insufficient data).');
      return;
    }

    if (recovery.status.hasRecovery && recovery.status.isScored) {
      const score = recovery.recovery!.score!;
      console.log('✅ Recovery data available:');
      console.log(`   Recovery Score: ${score.recovery_score}%`);
      console.log(`   Resting HR: ${score.resting_heart_rate} bpm`);
      console.log(`   HRV RMSSD: ${score.hrv_rmssd_milli.toFixed(1)} ms`);
      
      if (score.spo2_percentage) {
        console.log(`   SpO2: ${score.spo2_percentage.toFixed(1)}%`);
      }
      
      if (score.skin_temp_celsius) {
        console.log(`   Skin Temp: ${score.skin_temp_celsius.toFixed(1)}°C`);
      }
    } else {
      console.log('📊 No recovery data available for current cycle.');
    }

    // Also show current cycle info
    const cycle = recovery.cycle;
    console.log('\n=== Current Cycle Info ===');
    console.log(`Cycle ID: ${cycle.id}`);
    console.log(`Started: ${cycle.start}`);
    console.log(`Strain: ${cycle.score?.strain ?? 'Not yet available'}`);

  } catch (error) {
    console.error('Failed to get recovery data:', error);
  }
}

// ===============================
// 3. USER SUMMARY
// ===============================

async function getUserSummaryExample() {
  try {
    const summary = await whoopWithTokens.getUserSummary();

    console.log('=== User Summary ===');
    console.log(`Name: ${summary.profile.first_name} ${summary.profile.last_name}`);
    console.log(`Email: ${summary.profile.email}`);
    console.log(`User ID: ${summary.profile.user_id}`);

    if (summary.bodyMeasurement) {
      console.log('\n=== Body Measurements ===');
      console.log(`Height: ${summary.bodyMeasurement.height_meter}m`);
      console.log(`Weight: ${summary.bodyMeasurement.weight_kilogram}kg`);
      console.log(`Max HR: ${summary.bodyMeasurement.max_heart_rate} bpm`);
    }

    if (summary.currentRecovery) {
      console.log('\n=== Current Status ===');
      console.log(`Recovery Score: ${summary.currentRecovery.score?.recovery_score}%`);
    }

    if (summary.currentCycle) {
      console.log(`Current Strain: ${summary.currentCycle.score?.strain}`);
    }

  } catch (error) {
    console.error('Failed to get user summary:', error);
  }
}

// ===============================
// 4. RECOVERY TRENDS
// ===============================

async function getRecoveryTrendsExample() {
  try {
    // Get last 7 days of recovery data
    const recentData = await whoopWithTokens.getRecentRecoveryScores(7);

    console.log('=== Recovery Trends (Last 7 Days) ===');
    recentData.forEach((day, index) => {
      const date = new Date(day.date).toLocaleDateString();
      const recovery = day.recoveryScore ? `${day.recoveryScore}%` : 'No data';
      const strain = day.strain ? day.strain.toFixed(1) : 'No data';
      
      console.log(`${date}: Recovery ${recovery}, Strain ${strain}`);
      
      if (day.isCalibrating) {
        console.log('  (User was calibrating)');
      }
    });

    // Calculate average recovery (excluding null values)
    const validRecoveryScores = recentData
      .map(d => d.recoveryScore)
      .filter((score): score is number => score !== null);
    
    if (validRecoveryScores.length > 0) {
      const avgRecovery = validRecoveryScores.reduce((a, b) => a + b, 0) / validRecoveryScores.length;
      console.log(`\nAverage Recovery: ${avgRecovery.toFixed(1)}%`);
    }

  } catch (error) {
    console.error('Failed to get recovery trends:', error);
  }
}

// ===============================
// 5. CYCLES WITH RECOVERY DATA
// ===============================

async function getCyclesWithRecoveryExample() {
  try {
    // Get last 30 days of cycles with their recovery data
    const cyclesWithRecovery = await whoopWithTokens.cycles.getRecentCyclesWithRecovery({ 
      days: 30 
    });

    console.log('=== Cycles with Recovery (Last 30 Days) ===');
    
    for (const { cycle, recovery } of cyclesWithRecovery) {
      const date = new Date(cycle.start).toLocaleDateString();
      const strain = cycle.score?.strain?.toFixed(1) ?? 'N/A';
      const recoveryScore = recovery?.score?.recovery_score ?? 'N/A';
      
      console.log(`${date} - Cycle ${cycle.id}:`);
      console.log(`  Strain: ${strain}`);
      console.log(`  Recovery: ${recoveryScore}%`);
      console.log(`  State: ${recovery?.score_state ?? cycle.score_state}`);
      
      if (recovery?.score?.user_calibrating) {
        console.log('  (Calibrating)');
      }
      console.log('');
    }

  } catch (error) {
    console.error('Failed to get cycles with recovery:', error);
  }
}

// ===============================
// 6. OAUTH FLOW EXAMPLE
// ===============================

async function oauthFlowExample() {
  try {
    // Step 1: Generate authorization URL
    const authUrl = whoopOAuth.auth!.getAuthorizationUrl({
      state: 'random-state-string', // For security
    });
    
    console.log('=== OAuth Flow ===');
    console.log('1. Redirect user to:', authUrl);
    
    // Step 2: Handle callback (you'll get this in your callback handler)
    // const authorizationCode = 'code-from-callback';
    // const tokens = await whoopOAuth.auth!.exchangeCodeForTokens(authorizationCode);
    
    // Step 3: Save tokens and create authenticated client
    // const authenticatedClient = WhoopSDK.withTokens(tokens.access_token, tokens.refresh_token);
    
  } catch (error) {
    console.error('OAuth flow error:', error);
  }
}

// ===============================
// 7. ERROR HANDLING
// ===============================

async function errorHandlingExample() {
  try {
    const recovery = await whoopWithTokens.getCurrentRecovery();
    console.log('Success!', recovery);
    
  } catch (error) {
    if (error instanceof WhoopAuthError) {
      console.log('Authentication failed - need to refresh token or re-authenticate');
    } else if ((error as any).status === 429) {
      console.log('Rate limited - slow down your requests');
    } else if ((error as any).status === 404) {
      console.log('Data not found - user might be new or have no data');
    } else {
      console.log('Unexpected error:', error);
    }
  }
}

// ===============================
// 8. CHECKING USER STATUS
// ===============================

async function checkUserStatusExample() {
  try {
    // Quick check if user is still calibrating
    const isCalibrating = await whoopWithTokens.isUserCalibrating();
    
    if (isCalibrating) {
      console.log('🔄 User is still calibrating');
      console.log('Recovery scores will be available in a few days');
      return;
    }

    // User is fully set up, proceed with normal operations
    console.log('✅ User is fully calibrated');
    const recovery = await whoopWithTokens.getCurrentRecovery();
    
    if (recovery.status.hasRecovery) {
      console.log(`Current recovery: ${recovery.recovery!.score!.recovery_score}%`);
    }
    
  } catch (error) {
    console.error('Failed to check user status:', error);
  }
}

// ===============================
// 9. RUN EXAMPLES
// ===============================

async function runAllExamples() {
  console.log('🎯 WHOOP SDK Examples\n');
  
  // Uncomment the examples you want to run:
  
  await getCurrentRecoveryExample();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await getUserSummaryExample();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await getRecoveryTrendsExample();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // await getCyclesWithRecoveryExample();
  // await oauthFlowExample();
  // await errorHandlingExample();
  // await checkUserStatusExample();
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  getCurrentRecoveryExample,
  getUserSummaryExample,
  getRecoveryTrendsExample,
  getCyclesWithRecoveryExample,
  oauthFlowExample,
  errorHandlingExample,
  checkUserStatusExample,
}; 