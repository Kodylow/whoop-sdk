/**
 * Test Type Definitions
 * Global types for Jest and test utilities
 */

declare global {
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
}

export {}; 