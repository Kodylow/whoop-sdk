/**
 * WHOOP API Endpoint Handlers
 * Re-exports all endpoint handlers from organized modules
 */

import { WhoopHttpClient } from '../client/http';

// Re-export all endpoint classes
export { BaseEndpoint } from './base';
export { CyclesEndpoint } from './cycles';
export { RecoveryEndpoint } from './recovery';
export { SleepEndpoint } from './sleep';
export { WorkoutsEndpoint } from './workouts';
export { UserEndpoint } from './user';

// Import for factory function
import { CyclesEndpoint } from './cycles';
import { RecoveryEndpoint } from './recovery';
import { SleepEndpoint } from './sleep';
import { WorkoutsEndpoint } from './workouts';
import { UserEndpoint } from './user';

/**
 * Collection of all endpoint handlers
 */
export interface WhoopEndpoints {
  cycles: CyclesEndpoint;
  recovery: RecoveryEndpoint;
  sleep: SleepEndpoint;
  workouts: WorkoutsEndpoint;
  user: UserEndpoint;
}

/**
 * Create endpoint handlers
 */
export function createEndpoints(http: WhoopHttpClient): WhoopEndpoints {
  return {
    cycles: new CyclesEndpoint(http),
    recovery: new RecoveryEndpoint(http),
    sleep: new SleepEndpoint(http),
    workouts: new WorkoutsEndpoint(http),
    user: new UserEndpoint(http),
  };
} 