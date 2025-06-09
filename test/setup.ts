/**
 * Jest Test Setup
 * Common configurations and global mocks for all tests
 */

// Mock global fetch if not available
global.fetch = global.fetch || jest.fn();

// Mock performance.now for consistent timing in tests
global.performance = global.performance || {
  now: jest.fn(() => Date.now())
};

// Mock setTimeout and clearTimeout for timer tests
jest.useFakeTimers();

// Setup global test data
global.testData = {
  // Mock OAuth tokens
  validTokens: {
    access_token: 'test_access_token_123',
    refresh_token: 'test_refresh_token_456',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'read:profile read:cycles read:recovery read:sleep read:workouts offline'
  },

  // Mock user profile
  userProfile: {
    user_id: 12345,
    email: 'athlete@example.com',
    first_name: 'Test',
    last_name: 'Athlete'
  },

  // Mock cycle data
  cycleData: {
    records: [
      {
        id: 1001,
        user_id: 12345,
        created_at: '2024-01-15T06:00:00.000Z',
        updated_at: '2024-01-16T06:00:00.000Z',
        start: '2024-01-15T06:00:00.000Z',
        end: '2024-01-16T06:00:00.000Z',
        timezone_offset: '-08:00',
        score_state: 'SCORED',
        score: {
          strain: 15.2,
          average_heart_rate: 78,
          max_heart_rate: 180
        }
      }
    ],
    next_token: null
  },

  // Mock recovery data
  recoveryData: {
    records: [
      {
        cycle_id: 1001,
        sleep_id: 2001,
        user_id: 12345,
        created_at: '2024-01-16T06:00:00.000Z',
        updated_at: '2024-01-16T06:00:00.000Z',
        score_state: 'SCORED',
        score: {
          user_calibrating: false,
          recovery_score: 85,
          resting_heart_rate: 45,
          hrv_rmssd_milli: 42.5
        }
      }
    ],
    next_token: null
  },

  // Mock sleep data
  sleepData: {
    records: [
      {
        id: 2001,
        user_id: 12345,
        created_at: '2024-01-15T22:00:00.000Z',
        updated_at: '2024-01-16T06:00:00.000Z',
        start: '2024-01-15T22:00:00.000Z',
        end: '2024-01-16T06:00:00.000Z',
        timezone_offset: '-08:00',
        nap: false,
        score_state: 'SCORED',
        score: {
          stage_summary: {
            total_in_bed_time_milli: 28800000,
            total_awake_time_milli: 1800000,
            total_no_data_time_milli: 0,
            total_light_sleep_time_milli: 14400000,
            total_slow_wave_sleep_time_milli: 7200000,
            total_rem_sleep_time_milli: 5400000,
            sleep_cycle_count: 5,
            disturbance_count: 12
          },
          sleep_needed: {
            baseline_milli: 28800000,
            need_from_sleep_debt_milli: 3600000,
            need_from_recent_strain_milli: 1800000,
            need_from_recent_nap_milli: 0
          },
          respiratory_rate: 14.2,
          sleep_performance_percentage: 88,
          sleep_consistency_percentage: 92,
          sleep_efficiency_percentage: 94
        }
      }
    ],
    next_token: null
  },

  // Mock workout data
  workoutData: {
    records: [
      {
        id: 3001,
        user_id: 12345,
        created_at: '2024-01-15T08:00:00.000Z',
        updated_at: '2024-01-15T09:30:00.000Z',
        start: '2024-01-15T08:00:00.000Z',
        end: '2024-01-15T09:30:00.000Z',
        timezone_offset: '-08:00',
        sport_id: 1,
        score_state: 'SCORED',
        score: {
          strain: 12.8,
          average_heart_rate: 145,
          max_heart_rate: 180,
          kilojoule: 1250.5,
          percent_recorded: 98.5,
          distance_meter: 8047.2,
          altitude_gain_meter: 125.3,
          altitude_change_meter: 45.7,
          zone_duration: {
            zone_zero_milli: 0,
            zone_one_milli: 300000,
            zone_two_milli: 1800000,
            zone_three_milli: 2700000,
            zone_four_milli: 900000,
            zone_five_milli: 600000
          }
        }
      }
    ],
    next_token: null
  },

  // Mock body measurements
  bodyMeasurements: {
    height_meter: 1.75,
    weight_kilogram: 70.5,
    max_heart_rate: 190
  }
};

// Helper function to create mock Response
global.createMockResponse = (data: any, status: number = 200, headers: Record<string, string> = {}) => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Map(Object.entries({
      'content-type': 'application/json',
      ...headers
    })),
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    clone: jest.fn()
  } as any;
};

// Helper function to create mock error response
global.createMockErrorResponse = (status: number, message: string) => {
  return global.createMockResponse(
    { error: message, status },
    status
  );
};

// Console.warn override for cleaner test output
const originalWarn = console.warn;
console.warn = (message: string, ...args: any[]) => {
  if (message.includes('Warning:') || message.includes('[WARN]')) {
    return; // Suppress warnings in tests
  }
  originalWarn(message, ...args);
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Restore real timers after all tests
afterAll(() => {
  jest.useRealTimers();
}); 