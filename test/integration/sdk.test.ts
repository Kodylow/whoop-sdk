/**
 * SDK Integration Tests
 * End-to-end tests for the WHOOP SDK
 */

import { WhoopSDK } from '../../src/index';
import nock from 'nock';

describe('WhoopSDK Integration Tests', () => {
  let sdk: WhoopSDK;
  const baseUrl = 'https://api.prod.whoop.com/developer';

  beforeEach(() => {
    // Clean up any existing interceptors
    nock.cleanAll();
    
    // Initialize SDK with test configuration
    sdk = new WhoopSDK({
      baseUrl,
      oauth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:8080/callback'
      },
      performance: {
        cache: {
          ttl: 5000,
          maxSize: 100,
          compress: false
        },
        deduplication: {
          enabled: true,
          windowMs: 100,
          maxConcurrent: 5
        },
        hooks: {
          onCacheHit: jest.fn(),
          onSlowRequest: jest.fn()
        },
        slowRequestThreshold: 1000
      }
    });

    // Set test tokens
    sdk.setTokens({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read:profile read:cycles read:recovery read:sleep read:workouts offline'
    });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Authentication Flow', () => {
    it('should generate valid authorization URL', () => {
      const authUrl = sdk.getAuthorizationUrl(['read:profile', 'read:cycles']);
      
      expect(authUrl).toContain('https://api.prod.whoop.com/oauth/oauth2/auth');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=read%3Aprofile%20read%3Acycles');
    });

    it('should exchange authorization code for tokens', async () => {
      nock('https://api.prod.whoop.com')
        .post('/oauth/oauth2/token')
        .reply(200, {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read:profile offline'
        });

      const tokens = await sdk.exchangeCodeForTokens('test-auth-code');
      
      expect(tokens.access_token).toBe('new-access-token');
      expect(tokens.refresh_token).toBe('new-refresh-token');
    });

    it('should refresh access token', async () => {
      nock('https://api.prod.whoop.com')
        .post('/oauth/oauth2/token')
        .reply(200, {
          access_token: 'refreshed-access-token',
          refresh_token: 'refreshed-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read:profile offline'
        });

      const tokens = await sdk.refreshAccessToken();
      
      expect(tokens.access_token).toBe('refreshed-access-token');
    });
  });

  describe('User Profile Operations', () => {
    it('should fetch user profile', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(200, global.testData.userProfile);

      const profile = await sdk.user.getProfile();
      
      expect(profile.user_id).toBe(12345);
      expect(profile.first_name).toBe('Test');
      expect(profile.last_name).toBe('Athlete');
    });

    it('should fetch body measurements', async () => {
      nock(baseUrl)
        .get('/v1/user/measurement/body')
        .reply(200, global.testData.bodyMeasurements);

      const measurements = await sdk.user.getBodyMeasurements();
      
      expect(measurements.height_meter).toBe(1.75);
      expect(measurements.weight_kilogram).toBe(70.5);
    });

    it('should handle user profile errors gracefully', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(404, { error: 'User not found' });

      await expect(sdk.user.getProfile()).rejects.toThrow('User not found');
    });
  });

  describe('Cycles Operations', () => {
    it('should fetch cycles with parameters', async () => {
      nock(baseUrl)
        .get('/v1/cycle')
        .query({ limit: 5, start: '2024-01-01T00:00:00.000Z' })
        .reply(200, global.testData.cycleData);

      const cycles = await sdk.cycles.getCycles({
        limit: 5,
        start: '2024-01-01T00:00:00.000Z'
      });

      expect(cycles.data).toHaveLength(1);
      expect(cycles.data[0].id).toBe(1001);
      expect(cycles.data[0].score.strain).toBe(15.2);
    });

    it('should fetch single cycle by ID', async () => {
      nock(baseUrl)
        .get('/v1/cycle/1001')
        .reply(200, global.testData.cycleData.data[0]);

      const cycle = await sdk.cycles.getCycle(1001);
      
      expect(cycle.id).toBe(1001);
      expect(cycle.score.strain).toBe(15.2);
    });

    it('should handle paginated cycles', async () => {
      const page1 = {
        data: [global.testData.cycleData.data[0]],
        next_token: 'page2-token'
      };
      
      const page2 = {
        data: [{ ...global.testData.cycleData.data[0], id: 1002 }],
        next_token: null
      };

      nock(baseUrl)
        .get('/v1/cycle')
        .query({ limit: 1 })
        .reply(200, page1);

      nock(baseUrl)
        .get('/v1/cycle')
        .query({ limit: 1, nextToken: 'page2-token' })
        .reply(200, page2);

      const allCycles = [];
      for await (const cycle of sdk.cycles.getCyclesIterable({ limit: 1 })) {
        allCycles.push(cycle);
      }

      expect(allCycles).toHaveLength(2);
      expect(allCycles[0].id).toBe(1001);
      expect(allCycles[1].id).toBe(1002);
    });
  });

  describe('Recovery Operations', () => {
    it('should fetch recovery data', async () => {
      nock(baseUrl)
        .get('/v1/recovery')
        .reply(200, global.testData.recoveryData);

      const recovery = await sdk.recovery.getRecovery();
      
      expect(recovery.data).toHaveLength(1);
      expect(recovery.data[0].score.recovery_score).toBe(85);
    });

    it('should fetch recovery by cycle ID', async () => {
      nock(baseUrl)
        .get('/v1/recovery/1001')
        .reply(200, global.testData.recoveryData.data[0]);

      const recovery = await sdk.recovery.getRecoveryForCycle(1001);
      
      expect(recovery.cycle_id).toBe(1001);
      expect(recovery.score.recovery_score).toBe(85);
    });
  });

  describe('Sleep Operations', () => {
    it('should fetch sleep data', async () => {
      nock(baseUrl)
        .get('/v1/activity/sleep')
        .reply(200, global.testData.sleepData);

      const sleep = await sdk.sleep.getSleep();
      
      expect(sleep.data).toHaveLength(1);
      expect(sleep.data[0].score.sleep_performance_percentage).toBe(88);
    });

    it('should fetch sleep by ID', async () => {
      nock(baseUrl)
        .get('/v1/activity/sleep/2001')
        .reply(200, global.testData.sleepData.data[0]);

      const sleep = await sdk.sleep.getSleepById(2001);
      
      expect(sleep.id).toBe(2001);
      expect(sleep.score.sleep_efficiency_percentage).toBe(94);
    });
  });

  describe('Workout Operations', () => {
    it('should fetch workout data', async () => {
      nock(baseUrl)
        .get('/v1/activity/workout')
        .reply(200, global.testData.workoutData);

      const workouts = await sdk.workouts.getWorkouts();
      
      expect(workouts.data).toHaveLength(1);
      expect(workouts.data[0].score.strain).toBe(12.8);
    });

    it('should fetch workout by ID', async () => {
      nock(baseUrl)
        .get('/v1/activity/workout/3001')
        .reply(200, global.testData.workoutData.data[0]);

      const workout = await sdk.workouts.getWorkout(3001);
      
      expect(workout.id).toBe(3001);
      expect(workout.score.average_heart_rate).toBe(145);
    });
  });

  describe('Performance Optimizations', () => {
    it('should cache GET requests', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .once()
        .reply(200, global.testData.userProfile);

      // First request
      const profile1 = await sdk.user.getProfile();
      
      // Second request should be cached
      const profile2 = await sdk.user.getProfile();
      
      expect(profile1).toEqual(profile2);
      expect(nock.isDone()).toBe(true); // Nock ensures only one request was made
    });

    it('should deduplicate simultaneous requests', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .once()
        .reply(200, global.testData.userProfile);

      // Start multiple requests simultaneously
      const promises = [
        sdk.user.getProfile(),
        sdk.user.getProfile(),
        sdk.user.getProfile()
      ];

      const results = await Promise.all(promises);
      
      // All should have the same result
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
      expect(nock.isDone()).toBe(true); // Only one actual request
    });

    it('should provide performance statistics', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(200, global.testData.userProfile);

      await sdk.user.getProfile();
      
      const stats = sdk.getPerformanceStats();
      
      expect(stats.cache).toBeDefined();
      expect(stats.deduplication).toBeDefined();
      expect(stats.cache.size).toBeGreaterThan(0);
    });

    it('should trigger slow request monitoring', async () => {
      const slowRequestSpy = jest.fn();
      
      const slowSdk = new WhoopSDK({
        baseUrl,
        performance: {
          hooks: {
            onSlowRequest: slowRequestSpy
          },
          slowRequestThreshold: 100 // Very low threshold
        }
      });

      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .delay(200) // Simulate slow request
        .reply(200, global.testData.userProfile);

      await slowSdk.user.getProfile();
      
      expect(slowRequestSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting with retry', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(429, { error: 'Rate limit exceeded', retry_after: 1 })
        .get('/v1/user/profile/basic')
        .reply(200, global.testData.userProfile);

      const profile = await sdk.user.getProfile();
      
      expect(profile.user_id).toBe(12345);
    });

    it('should handle network errors', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .replyWithError('Network error');

      await expect(sdk.user.getProfile()).rejects.toThrow('Network error');
    });

    it('should handle authentication errors', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(401, { error: 'Unauthorized' });

      await expect(sdk.user.getProfile()).rejects.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom cache TTL', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .twice()
        .reply(200, global.testData.userProfile);

      // First request
      await sdk.user.getProfile();
      
      // Fast forward past cache TTL
      jest.advanceTimersByTime(6000);
      
      // Second request should hit the API again
      await sdk.user.getProfile();
      
      expect(nock.isDone()).toBe(true);
    });

    it('should allow disabling cache for specific requests', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .twice()
        .reply(200, global.testData.userProfile);

      // Both requests should hit API
      await sdk.user.getProfile({ skipCache: true });
      await sdk.user.getProfile({ skipCache: true });
      
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on reset', async () => {
      nock(baseUrl)
        .get('/v1/user/profile/basic')
        .reply(200, global.testData.userProfile);

      await sdk.user.getProfile();
      
      const statsBefore = sdk.getPerformanceStats();
      expect(statsBefore.cache.size).toBeGreaterThan(0);
      
      sdk.reset();
      
      const statsAfter = sdk.getPerformanceStats();
      expect(statsAfter.cache.size).toBe(0);
    });
  });
}); 