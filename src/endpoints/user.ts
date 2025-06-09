/**
 * User Endpoint Handler
 * Handler for WHOOP user-related API endpoints
 */

import type {
  UserBasicProfile,
  UserBodyMeasurement,
  UserSummary,
  RequestOptions,
} from '../types';
import { BaseEndpoint } from './base';

/**
 * User endpoint handler
 */
export class UserEndpoint extends BaseEndpoint {
  /**
   * Get user's basic profile information
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
   * Get a comprehensive user summary including profile, measurements, and current status
   * This is a convenience method that combines multiple API calls for a complete picture
   */
  async getSummary(options?: RequestOptions): Promise<UserSummary> {
    try {
      // Fetch profile (required)
      const profile = await this.getProfile(options);
      
      // Fetch optional data in parallel
      const [bodyMeasurement, currentRecoveryResult] = await Promise.allSettled([
        this.getBodyMeasurement(options).catch(() => null),
        // Access cycles endpoint through the parent SDK
        (this.http as any).sdk?.cycles?.getCurrentRecovery(options).catch(() => null)
      ]);

      const summary: UserSummary = {
        profile,
      };

      // Add body measurement if available
      if (bodyMeasurement.status === 'fulfilled' && bodyMeasurement.value) {
        summary.bodyMeasurement = bodyMeasurement.value;
      }

      // Add current cycle and recovery if available
      if (currentRecoveryResult.status === 'fulfilled' && currentRecoveryResult.value) {
        summary.currentCycle = currentRecoveryResult.value.cycle;
        summary.currentRecovery = currentRecoveryResult.value.recovery;
      }

      return summary;
    } catch (error) {
      // If we can't get the basic profile, that's a critical error
      throw error;
    }
  }

  /**
   * Check if user is a new user (still calibrating)
   * This is a quick way to determine if the user needs to complete calibration
   */
  async isNewUser(options?: RequestOptions): Promise<boolean> {
    try {
      // Try to get current recovery to check calibration status
      const currentRecovery = await (this.http as any).sdk?.cycles?.getCurrentRecovery(options);
      return currentRecovery?.status?.isCalibrating ?? false;
    } catch (error) {
      // If we can't get recovery data, assume they might be a new user
      return true;
    }
  }

  /**
   * Revoke user's OAuth access
   */
  async revokeAccess(options?: RequestOptions): Promise<void> {
    await this.http.delete<void>('/v1/user/access', options);
  }
} 