/**
 * Tests for SDK Improvements
 * 
 * This test file validates the new convenience methods and
 * user-friendly features added to the WHOOP SDK.
 */

import { WhoopSDK, getRecommendedScopes, getAvailableScopes } from '../src';

describe('WHOOP SDK Improvements', () => {
  let mockTokens: any;
  let whoop: WhoopSDK;

  beforeEach(() => {
    mockTokens = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'read:profile read:cycles read:recovery offline'
    };

    // Mock fetch for all tests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Static Factory Methods', () => {
    it('should create SDK instance with tokens using withTokens()', () => {
      const sdk = WhoopSDK.withTokens('access-token', 'refresh-token');
      expect(sdk).toBeInstanceOf(WhoopSDK);
      expect(sdk.isAuthenticated()).toBe(true);
    });

    it('should create SDK instance for specific user', () => {
      const sdk = WhoopSDK.forUser('user-123', {
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      });
      expect(sdk).toBeInstanceOf(WhoopSDK);
    });

    it('should handle optional refresh token', () => {
      const sdk = WhoopSDK.withTokens('access-token');
      expect(sdk).toBeInstanceOf(WhoopSDK);
    });
  });

  describe('Convenience Methods', () => {
    beforeEach(() => {
      whoop = WhoopSDK.withTokens('access-token', 'refresh-token');
    });

    it('should get current recovery with status flags', async () => {
      // Mock the cycle and recovery responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: 12345,
              user_id: 123,
              start: '2024-01-15T00:00:00Z',
              score_state: 'SCORED',
              score: { strain: 12.5 }
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cycle_id: 12345,
            score_state: 'SCORED',
            score: {
              user_calibrating: false,
              recovery_score: 75,
              resting_heart_rate: 52,
              hrv_rmssd_milli: 45.2
            }
          })
        });

      const result = await whoop.getCurrentRecovery();

      expect(result.cycle.id).toBe(12345);
      expect(result.recovery).not.toBeNull();
      expect(result.status.hasRecovery).toBe(true);
      expect(result.status.isCalibrating).toBe(false);
      expect(result.status.isScored).toBe(true);
      expect(result.status.isPending).toBe(false);
      expect(result.status.isUnscorable).toBe(false);
    });

    it('should handle calibrating user', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: 12345,
              score_state: 'SCORED'
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cycle_id: 12345,
            score_state: 'SCORED',
            score: {
              user_calibrating: true,
              recovery_score: 0,
              resting_heart_rate: 52,
              hrv_rmssd_milli: 45.2
            }
          })
        });

      const result = await whoop.getCurrentRecovery();
      expect(result.status.isCalibrating).toBe(true);
    });

    it('should handle no recovery data (404)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: 12345,
              score_state: 'SCORED'
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({})
        });

      const result = await whoop.getCurrentRecovery();
      expect(result.recovery).toBeNull();
      expect(result.status.hasRecovery).toBe(false);
    });

    it('should check if user is calibrating', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{
              id: 12345,
              score_state: 'SCORED'
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            cycle_id: 12345,
            score_state: 'SCORED',
            score: {
              user_calibrating: true,
              recovery_score: 0
            }
          })
        });

      const isCalibrating = await whoop.isUserCalibrating();
      expect(isCalibrating).toBe(true);
    });

    it('should get recent recovery scores', async () => {
      // Mock cycles response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: 1, start: '2024-01-15T00:00:00Z', score: { strain: 10 } },
              { id: 2, start: '2024-01-14T00:00:00Z', score: { strain: 12 } }
            ]
          })
        })
        // Mock recovery responses
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            score: { recovery_score: 75, user_calibrating: false }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            score: { recovery_score: 80, user_calibrating: false }
          })
        });

      const recentScores = await whoop.getRecentRecoveryScores(2);
      
      expect(recentScores).toHaveLength(2);
      expect(recentScores[0].recoveryScore).toBe(75);
      expect(recentScores[1].recoveryScore).toBe(80);
      expect(recentScores[0].strain).toBe(10);
    });
  });

  describe('Helper Functions', () => {
    it('should return recommended scopes', () => {
      const recommended = getRecommendedScopes();
      expect(recommended).toEqual(['read:profile', 'read:cycles', 'read:recovery', 'offline']);
    });

    it('should return available scopes with descriptions', () => {
      const available = getAvailableScopes();
      expect(available).toBeInstanceOf(Array);
      expect(available[0]).toHaveProperty('scope');
      expect(available[0]).toHaveProperty('description');
      
      const profileScope = available.find(s => s.scope === 'read:profile');
      expect(profileScope?.description).toContain('profile');
    });
  });

  describe('Enhanced Endpoint Methods', () => {
    beforeEach(() => {
      whoop = WhoopSDK.withTokens('access-token', 'refresh-token');
    });

    it('should get recovery safely (returning null for 404)', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: () => Promise.resolve({})
        });

      const recovery = await whoop.cycles.getRecoverySafe(12345);
      expect(recovery).toBeNull();
    });

    it('should get recent cycles with recovery', async () => {
      // Mock cycles response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 1, start: '2024-01-15T00:00:00Z' }]
          })
        })
        // Mock recovery response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            score: { recovery_score: 75 }
          })
        });

      const result = await whoop.cycles.getRecentCyclesWithRecovery({ limit: 1 });
      
      expect(result).toHaveLength(1);
      expect(result[0].cycle.id).toBe(1);
      expect(result[0].recovery?.score?.recovery_score).toBe(75);
    });

    it('should calculate date range for days parameter', async () => {
      const spy = jest.spyOn(whoop.cycles, 'list');
      spy.mockResolvedValue({ data: [], next_token: undefined });

      await whoop.cycles.getRecentCyclesWithRecovery({ days: 7 });

      const callArgs = spy.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs!.start).toBeDefined();
      expect(callArgs!.end).toBeDefined();
      
      const startDate = new Date(callArgs!.start!);
      const endDate = new Date(callArgs!.end!);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.abs(diffDays - 7)).toBeLessThan(1); // Allow for small time differences
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(() => {
      whoop = WhoopSDK.withTokens('access-token', 'refresh-token');
    });

    it('should handle no cycles found', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: []
          })
        });

      await expect(whoop.getCurrentRecovery()).rejects.toThrow('No cycles found');
    });

    it('should return true for calibrating when recovery fails', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'));

      const isCalibrating = await whoop.isUserCalibrating();
      expect(isCalibrating).toBe(true);
    });
  });
}); 