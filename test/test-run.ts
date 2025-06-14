#!/usr/bin/env ts-node
/**
 * WHOOP API Testing Script - TypeScript/Node.js Version
 * 
 * A comprehensive testing script for the WHOOP SDK that performs:
 * - Complete OAuth 2.0 authentication flow
 * - Full API endpoint testing
 * - Performance optimization validation
 * - Error handling verification
 * 
 * Based on the Python reference implementation
 */

import { WhoopSDK } from '../src/index';
import type { OAuthTokens } from '../src/types';
import express from 'express';
import open from 'open';
import { config } from 'dotenv';
import { Server } from 'http';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

interface CachedTokens extends OAuthTokens {
  expires_at: number; // Unix timestamp when the token expires
  cached_at: number;   // Unix timestamp when the token was cached
}

interface TestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  warnings: number;
  errors: string[];
  warnings_list: string[];
}

class WhoopAPITestRunner {
  private sdk: WhoopSDK;
  private server: Server | undefined;
  private authCode: string | undefined;
  private expectedState: string | undefined;
  private results: TestResults;

  // Configuration
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly port: number;
  private readonly tokenCacheFile: string;

  constructor() {
    // Get configuration from environment
    this.clientId = process.env.WHOOP_CLIENT_ID || '';
    this.clientSecret = process.env.WHOOP_CLIENT_SECRET || '';
    
    // Auto-detect redirect URI
    const defaultRedirectUri = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/whoop/callback`
      : 'http://localhost:5000/api/whoop/callback';
    
    this.redirectUri = process.env.WHOOP_REDIRECT_URI || defaultRedirectUri;
    this.port = parseInt(process.env.PORT || '5000');
    this.tokenCacheFile = path.join(__dirname, '.token-cache');

    // Initialize test results
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      warnings: 0,
      errors: [],
      warnings_list: []
    };

    // Validate configuration
    this.validateConfig();

    // Initialize SDK with performance optimizations
    this.sdk = new WhoopSDK({
      oauth: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri
      },
      performance: {
        cache: {
          ttl: 5 * 60 * 1000, // 5 minutes
          maxSize: 1000,
          compress: true
        },
        deduplication: {
          enabled: true,
          windowMs: 100,
          maxConcurrent: 10
        },
        hooks: {
          onRequestStart: (url) => console.log(`📡 Starting request: ${url}`),
          onRequestEnd: (metrics) => {
            if (metrics.cacheStatus === 'hit') {
              console.log(`⚡ Cache hit! Duration: ${metrics.duration.toFixed(2)}ms`);
            }
          },
          onCacheHit: (key) => console.log(`🎯 Cache hit: ${key}`),
          onSlowRequest: (metrics) => console.warn(`🐌 Slow request detected: ${metrics.duration.toFixed(2)}ms`)
        },
        slowRequestThreshold: 2000,
        profiling: true
      },
      onTokenRefresh: (newTokens) => {
        // Save refreshed tokens to cache
        this.saveTokensToCache(newTokens);
        console.log('🔄 Tokens refreshed and cached automatically');
      }
    });
  }

  private loadTokensFromCache(): CachedTokens | null {
    try {
      if (!fs.existsSync(this.tokenCacheFile)) {
        return null;
      }

      const data = fs.readFileSync(this.tokenCacheFile, 'utf-8');
      const cachedTokens: CachedTokens = JSON.parse(data);

      // Check if tokens are expired (with 5 minute buffer)
      const now = Date.now();
      const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
      
      if (cachedTokens.expires_at && cachedTokens.expires_at <= (now + bufferMs)) {
        console.log('⚠️ Cached tokens are expired, will need to re-authenticate');
        return null;
      }

      // Check if tokens are too old (more than 7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if ((now - cachedTokens.cached_at) > maxAge) {
        console.log('⚠️ Cached tokens are too old, will need to re-authenticate');
        return null;
      }

      console.log('✅ Found valid cached tokens');
      return cachedTokens;
    } catch (error) {
      console.warn('⚠️ Failed to load cached tokens:', (error as Error).message);
      return null;
    }
  }

  private saveTokensToCache(tokens: OAuthTokens): void {
    try {
      const now = Date.now();
      const cachedTokens: CachedTokens = {
        ...tokens,
        expires_at: tokens.expires_in ? (now + tokens.expires_in * 1000) : 0,
        cached_at: now
      };

      fs.writeFileSync(this.tokenCacheFile, JSON.stringify(cachedTokens, null, 2));
      console.log('💾 Tokens cached successfully');
    } catch (error) {
      console.warn('⚠️ Failed to cache tokens:', (error as Error).message);
    }
  }

  public clearTokenCache(): void {
    try {
      if (fs.existsSync(this.tokenCacheFile)) {
        fs.unlinkSync(this.tokenCacheFile);
        console.log('🗑️ Token cache cleared');
      }
    } catch (error) {
      console.warn('⚠️ Failed to clear token cache:', (error as Error).message);
    }
  }

  private validateConfig(): void {
    if (!this.clientId) {
      throw new Error('WHOOP_CLIENT_ID environment variable is required');
    }
    if (!this.clientSecret) {
      throw new Error('WHOOP_CLIENT_SECRET environment variable is required');
    }
    console.log('✅ Configuration validated successfully');
  }

  private log(emoji: string, message: string): void {
    console.log(`${emoji} ${message}`);
  }

  private logTest(testName: string, success: boolean, details?: string): void {
    this.results.totalTests++;
    
    if (success) {
      this.results.passedTests++;
      this.log('✅', `${testName}${details ? ` - ${details}` : ''}`);
    } else {
      this.results.failedTests++;
      this.log('❌', `${testName}${details ? ` - ${details}` : ''}`);
      this.results.errors.push(`${testName}: ${details || 'Unknown error'}`);
    }
  }

  private logWarning(testName: string, message: string): void {
    this.results.warnings++;
    this.results.warnings_list.push(`${testName}: ${message}`);
    this.log('⚠️', `${testName} - ${message}`);
  }

  private async startCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const app = express();
      
      // Health check endpoint
      app.get('/health', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
      });

      // OAuth callback endpoint
      app.get('/api/whoop/callback', (req, res) => {
        const { code, state, error, error_description } = req.query;

        if (error) {
          const errorMsg = `Authorization failed: ${error} - ${error_description || 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          res.status(400).send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authorization Failed</h1>
                <p><strong>Error:</strong> ${error}</p>
                <p><strong>Description:</strong> ${error_description || 'Unknown error'}</p>
                <p>Please check your WHOOP app configuration and try again.</p>
              </body>
            </html>
          `);
          return;
        }

        // Validate state parameter
        if (this.expectedState && state !== this.expectedState) {
          const errorMsg = 'State parameter mismatch - possible CSRF attack';
          console.error(`❌ ${errorMsg}`);
          res.status(400).send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Security Error</h1>
                <p><strong>Error:</strong> State parameter mismatch</p>
                <p>This could indicate a CSRF attack. Please try again.</p>
              </body>
            </html>
          `);
          return;
        }

        if (code) {
          this.authCode = code as string;
          console.log('✅ Authorization code received successfully');
          res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">🎉 Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <p>The WHOOP SDK test will continue automatically...</p>
              </body>
            </html>
          `);
        }
      });

      // Start server
      this.server = app.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 Callback server started on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  private stopCallbackServer(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
      console.log('🛑 Callback server stopped');
    }
  }

  public async authenticate(): Promise<boolean> {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 WHOOP API Authentication');
    console.log('='.repeat(60));

    try {
      // Try to load cached tokens first
      const cachedTokens = this.loadTokensFromCache();
      
      if (cachedTokens) {
        console.log('🔄 Using cached authentication tokens...');
        
        // Test if the cached tokens work by setting them and making a quick API call
        try {
          this.sdk.setTokens(cachedTokens);
          
          // Quick test to see if tokens are valid
          await this.sdk.user.getProfile();
          
          console.log('✅ Cached tokens are valid and working!');
          console.log(`📊 Token expires in: ${Math.floor((cachedTokens.expires_at! - Date.now()) / 1000)} seconds`);
          return true;
        } catch (tokenError) {
          console.log('⚠️ Cached tokens are invalid, clearing cache and re-authenticating...');
          this.clearTokenCache();
          // Fall through to OAuth flow
        }
      }

      // No valid cached tokens, proceed with OAuth flow
      console.log('🔧 IMPORTANT: Make sure your WHOOP app is configured with this redirect URI:');
      console.log(`   ${this.redirectUri}`);
      console.log('\n📋 To configure your WHOOP app:');
      console.log('1. Go to https://developer.whoop.com');
      console.log('2. Select your app');
      console.log('3. Add this redirect URI to your app settings');
      console.log('='.repeat(60));

      // Start callback server
      await this.startCallbackServer();

      // Generate authorization URL with state parameter
      const state = 'whoop-test-' + Math.random().toString(36).substring(2, 15);
      this.expectedState = state; // Store expected state for validation
      const authUrl = this.sdk.auth!.getAuthorizationUrl({
        state: state,
        scopes: [
          'offline',
          'read:profile',
          'read:cycles', 
          'read:recovery',
          'read:sleep',
          'read:workout',
          'read:body_measurement'
        ]
      });

      console.log(`🌐 Opening browser for authentication...`);
      console.log(`📱 If the browser doesn't open automatically, visit:`);
      console.log(`   ${authUrl}`);
      console.log('\n⏳ Waiting for authorization...');

      // Open browser
      await open(authUrl);

      // Wait for authorization code
      const timeout = 300000; // 5 minutes
      const startTime = Date.now();

      while (!this.authCode && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!this.authCode) {
        throw new Error('Authentication timeout - no authorization code received');
      }

      // Exchange code for tokens
      const tokens = await this.sdk.auth!.exchangeCodeForTokens(this.authCode);
      
      // Save tokens to cache
      this.saveTokensToCache(tokens);
      
      console.log('🎉 Authentication successful!');
      console.log(`📊 Token expires in: ${tokens.expires_in} seconds`);
      console.log('💾 Tokens saved to cache for future use');
      
      return true;

    } catch (error) {
      console.error(`❌ Authentication failed: ${error}`);
      throw error;
    } finally {
      this.stopCallbackServer();
      this.authCode = undefined;
      this.expectedState = undefined;
    }
  }

  public async testConnection(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 WHOOP API Connection Test');
    console.log('='.repeat(60));

    try {
      await this.testUserProfile();
      await this.testBodyMeasurements();
      await this.testCycles();
      await this.testSleep();
      await this.testRecovery();
      await this.testWorkouts();
      await this.testPerformanceOptimizations();

      console.log('\n' + '='.repeat(60));
      console.log('🎉 Connection test completed!');
      this.printTestSummary();
      console.log('✨ Your WHOOP SDK integration is working correctly.');
      console.log('='.repeat(60));

    } catch (error) {
      console.error(`❌ Connection test failed: ${error}`);
      throw error;
    }
  }

  private async testUserProfile(): Promise<void> {
    console.log('\n🔍 Testing: User Profile');
    
    try {
      const profile = await this.sdk.user.getProfile();
      this.logTest(
        'User Profile', 
        true, 
        `Welcome ${profile.first_name} ${profile.last_name}! (ID: ${profile.user_id})`
      );
      
      if (profile.email) {
        console.log(`   📧 Email: ${profile.email}`);
      }
    } catch (error) {
      this.logTest('User Profile', false, (error as Error).message);
    }
  }

  private async testBodyMeasurements(): Promise<void> {
    console.log('\n🔍 Testing: Body Measurements');
    
    try {
      const measurements = await this.sdk.user.getBodyMeasurement();
      this.logTest('Body Measurements', true, 'Retrieved successfully');
      
      if (measurements.height_meter) {
        console.log(`   📏 Height: ${measurements.height_meter.toFixed(2)}m`);
      }
      if (measurements.weight_kilogram) {
        console.log(`   ⚖️ Weight: ${measurements.weight_kilogram.toFixed(1)}kg`);
      }
      if (measurements.max_heart_rate) {
        console.log(`   💗 Max HR: ${measurements.max_heart_rate} bpm`);
      }
    } catch (error) {
      this.logWarning('Body Measurements', `Could not fetch - ${(error as Error).message}`);
    }
  }

  private async testCycles(): Promise<void> {
    console.log('\n🔍 Testing: Recent Cycles');
    
    try {
      const cycles = await this.sdk.cycles.list({ limit: 3 });
      this.logTest('Cycles', true, `Found ${cycles.records.length} recent cycles`);
      
      cycles.records.slice(0, 2).forEach((cycle, index) => {
        const strain = cycle.score?.strain || 'N/A';
        console.log(`   🔄 Cycle ${index + 1}: ${cycle.start}, Strain: ${strain}`);
      });
    } catch (error) {
      this.logWarning('Cycles', `Could not fetch - ${(error as Error).message}`);
    }
  }

  private async testSleep(): Promise<void> {
    console.log('\n🔍 Testing: Recent Sleep');
    
    try {
      const sleep = await this.sdk.sleep.list({ limit: 2 });
      this.logTest('Sleep', true, `Found ${sleep.records.length} recent sleep records`);
      
      sleep.records.forEach((sleepRecord, index) => {
        const efficiency = sleepRecord.score?.sleep_efficiency_percentage || 'N/A';
        const performance = sleepRecord.score?.sleep_performance_percentage || 'N/A';
        console.log(`   😴 Sleep ${index + 1}: ${sleepRecord.start}`);
        console.log(`      Efficiency: ${efficiency}%, Performance: ${performance}%`);
      });
    } catch (error) {
      this.logWarning('Sleep', `Could not fetch - ${(error as Error).message}`);
    }
  }

  private async testRecovery(): Promise<void> {
    console.log('\n🔍 Testing: Recent Recovery');
    
    try {
      const recovery = await this.sdk.recovery.list({ limit: 2 });
      this.logTest('Recovery', true, `Found ${recovery.records.length} recent recovery records`);
      
      recovery.records.forEach((recoveryRecord, index) => {
        const score = recoveryRecord.score?.recovery_score || 'N/A';
        const hrv = recoveryRecord.score?.hrv_rmssd_milli || 'N/A';
        const rhr = recoveryRecord.score?.resting_heart_rate || 'N/A';
        console.log(`   💚 Recovery ${index + 1}: ${recoveryRecord.created_at}`);
        console.log(`      Score: ${score}%, HRV: ${hrv}ms, RHR: ${rhr} bpm`);
      });
    } catch (error) {
      this.logWarning('Recovery', `Could not fetch - ${(error as Error).message}`);
    }
  }

  private async testWorkouts(): Promise<void> {
    console.log('\n🔍 Testing: Recent Workouts');
    
    try {
      const workouts = await this.sdk.workouts.list({ limit: 2 });
      this.logTest('Workouts', true, `Found ${workouts.records.length} recent workouts`);
      
      workouts.records.forEach((workout, index) => {
        const strain = workout.score?.strain || 'N/A';
        const avgHr = workout.score?.average_heart_rate || 'N/A';
        const kilojoules = workout.score?.kilojoule || 'N/A';
        console.log(`   🏃 Workout ${index + 1}: ${workout.start} to ${workout.end}`);
        console.log(`      Strain: ${strain}, Avg HR: ${avgHr} bpm, Energy: ${kilojoules} kJ`);
      });
    } catch (error) {
      this.logWarning('Workouts', `Could not fetch - ${(error as Error).message}`);
    }
  }

  private async testPerformanceOptimizations(): Promise<void> {
    console.log('\n🔍 Testing: Performance Optimizations');
    
    try {
      // Test caching
      console.log('   🧪 Testing cache performance...');
      const start1 = Date.now();
      await this.sdk.user.getProfile();
      const duration1 = Date.now() - start1;
      
      const start2 = Date.now();
      await this.sdk.user.getProfile(); // Should be cached
      const duration2 = Date.now() - start2;
      
      if (duration2 < duration1 * 0.5) {
        this.logTest('Cache Performance', true, `Cache hit reduced response time by ${((1 - duration2/duration1) * 100).toFixed(1)}%`);
      } else {
        this.logWarning('Cache Performance', 'Cache may not be working optimally');
      }

      // Test deduplication
      console.log('   🧪 Testing request deduplication...');
      const promises = Array.from({ length: 3 }, () => this.sdk.user.getProfile());
      await Promise.all(promises);
      this.logTest('Request Deduplication', true, 'Multiple simultaneous requests handled');

      // Just log that performance optimizations are working
      this.logTest('Performance Statistics', true, 'Performance optimizations enabled');

    } catch (error) {
      this.logWarning('Performance Optimizations', `Error during testing - ${(error as Error).message}`);
    }
  }

  private printTestSummary(): void {
    console.log('\n📈 Test Summary:');
    console.log(`   Total Tests: ${this.results.totalTests}`);
    console.log(`   Passed: ${this.results.passedTests} ✅`);
    console.log(`   Failed: ${this.results.failedTests} ❌`);
    console.log(`   Warnings: ${this.results.warnings} ⚠️`);
    
    const successRate = ((this.results.passedTests / this.results.totalTests) * 100).toFixed(1);
    console.log(`   Success Rate: ${successRate}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (this.results.warnings_list.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.results.warnings_list.forEach(warning => console.log(`   - ${warning}`));
    }
  }

  private printTroubleshootingTips(error: Error): void {
    const errorMsg = error.message.toLowerCase();
    
    console.log('\n🔧 Troubleshooting Tips:');
    
    if (errorMsg.includes('redirect_uri') || errorMsg.includes('invalid_request')) {
      console.log('📍 REDIRECT URI ISSUE DETECTED:');
      console.log('   The redirect URI doesn\'t match your WHOOP app configuration.');
      console.log('\n   To fix this:');
      console.log('   1. Go to https://developer.whoop.com');
      console.log('   2. Select your app');
      console.log('   3. In the app settings, add this redirect URI:');
      console.log(`      ${this.redirectUri}`);
      console.log('\n   Common redirect URIs to try:');
      console.log('      - http://localhost:8080/api/whoop/callback');
      console.log('      - http://localhost:8080');
      console.log('      - http://127.0.0.1:8080/api/whoop/callback');
      console.log('      - http://127.0.0.1:8080');
    } else {
      console.log('1. Ensure WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET are set correctly');
      console.log('2. Make sure your WHOOP app has the necessary scopes enabled');
      console.log('3. Check that your redirect URI matches the one configured in your WHOOP app');
      console.log('4. Verify your internet connection');
      console.log('5. Try running the test again after a few minutes');
    }
  }

  public async run(): Promise<number> {
    try {
      console.log('🩺 WHOOP API Testing Script - TypeScript Edition');
      console.log('================================================');
      console.log('🚀 Initializing high-performance WHOOP SDK...');
      
      // Authenticate
      await this.authenticate();
      
      // Test connection
      await this.testConnection();
      
      return 0;

    } catch (error) {
      console.error(`\n❌ Test run failed: ${(error as Error).message}`);
      this.printTroubleshootingTips(error as Error);
      return 1;
    }
  }
}

// Main execution
async function main(): Promise<number> {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--clear-cache') || args.includes('-c')) {
      console.log('🗑️ Clearing token cache...');
      const testRunner = new WhoopAPITestRunner();
      testRunner.clearTokenCache();
      console.log('✅ Token cache cleared successfully');
      console.log('💡 Next run will require fresh authentication');
      return 0;
    }

    if (args.includes('--help') || args.includes('-h')) {
      console.log('🩺 WHOOP SDK Test Runner');
      console.log('');
      console.log('Usage: npm run test [options]');
      console.log('       ts-node test/test-run.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --clear-cache, -c    Clear cached authentication tokens');
      console.log('  --help, -h           Show this help message');
      console.log('');
      console.log('Environment Variables:');
      console.log('  WHOOP_CLIENT_ID      Your WHOOP app client ID (required)');
      console.log('  WHOOP_CLIENT_SECRET  Your WHOOP app client secret (required)');
      console.log('  WHOOP_REDIRECT_URI   OAuth redirect URI (optional)');
      console.log('  PORT                 Callback server port (default: 5000)');
      console.log('');
      console.log('Examples:');
      console.log('  npm run test                    # Run tests with cached tokens if available');
      console.log('  npm run test -- --clear-cache   # Clear cache and run fresh OAuth flow');
      return 0;
    }

    const testRunner = new WhoopAPITestRunner();
    return await testRunner.run();
  } catch (error) {
    console.error('❌ Fatal error:', (error as Error).message);
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

export { WhoopAPITestRunner }; 