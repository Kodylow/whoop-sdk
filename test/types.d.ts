/**
 * Test Type Definitions
 * Global types for Jest and test utilities
 */

declare global {
  // Jest globals
  var jest: typeof import('jest');
  var describe: typeof import('@jest/globals').describe;
  var it: typeof import('@jest/globals').it;
  var test: typeof import('@jest/globals').test;
  var expect: typeof import('@jest/globals').expect;
  var beforeAll: typeof import('@jest/globals').beforeAll;
  var beforeEach: typeof import('@jest/globals').beforeEach;
  var afterAll: typeof import('@jest/globals').afterAll;
  var afterEach: typeof import('@jest/globals').afterEach;

  // Test data globals
  var testData: {
    validTokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
    userProfile: {
      user_id: number;
      email: string;
      first_name: string;
      last_name: string;
    };
    cycleData: any;
    recoveryData: any;
    sleepData: any;
    workoutData: any;
    bodyMeasurements: any;
  };

  // Test helpers
  var createMockResponse: (data: any, status?: number, headers?: Record<string, string>) => any;
  var createMockErrorResponse: (status: number, message: string) => any;

  // Performance mock
  var performance: {
    now: jest.MockedFunction<() => number>;
  };

  // Fetch mock
  var fetch: jest.MockedFunction<typeof fetch>;
}

export {}; 