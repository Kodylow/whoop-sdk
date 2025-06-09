/**
 * User Endpoint Handler
 * Handler for WHOOP user API endpoints
 */

import type {
  UserBasicProfile,
  UserBodyMeasurement,
  RequestOptions,
} from '../types';
import { BaseEndpoint } from './base';

/**
 * User endpoint handler
 */
export class UserEndpoint extends BaseEndpoint {
  /**
   * Get user's basic profile
   */
  async getProfile(options?: RequestOptions): Promise<UserBasicProfile> {
    return this.http.get<UserBasicProfile>('/v1/user/profile/basic', options);
  }

  /**
   * Get user's body measurements
   */
  async getBodyMeasurement(options?: RequestOptions): Promise<UserBodyMeasurement> {
    return this.http.get<UserBodyMeasurement>('/v1/user/measurement/body', options);
  }

  /**
   * Revoke user's OAuth access
   */
  async revokeAccess(options?: RequestOptions): Promise<void> {
    await this.http.delete<void>('/v1/user/access', options);
  }
} 