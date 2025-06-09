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

// Debug logging utility
const log = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WHOOP-SDK-USER] [${level}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

/**
 * User endpoint handler
 */
export class UserEndpoint extends BaseEndpoint {
  /**
   * Get user's basic profile information
   */
  async getProfile(options?: RequestOptions): Promise<UserBasicProfile> {
    log('INFO', '👤 Fetching user profile...');
    
    try {
      const profile = await this.http.get<UserBasicProfile>('/v1/user/profile/basic', options);
      
      log('INFO', '✅ User profile retrieved successfully', {
        userId: profile.user_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email ? 'provided' : 'not provided'
      });
      
      return profile;
    } catch (error) {
      log('ERROR', '💥 Failed to fetch user profile', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user's body measurements
   */
  async getBodyMeasurement(options?: RequestOptions): Promise<UserBodyMeasurement> {
    log('INFO', '📏 Fetching user body measurements...');
    
    try {
      const bodyMeasurement = await this.http.get<UserBodyMeasurement>('/v1/user/measurement/body', options);
      
      log('INFO', '✅ Body measurements retrieved successfully', {
        heightM: bodyMeasurement.height_meter,
        weightKg: bodyMeasurement.weight_kilogram,
        maxHeartRate: bodyMeasurement.max_heart_rate
      });
      
      return bodyMeasurement;
    } catch (error) {
      log('ERROR', '💥 Failed to fetch body measurements', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get a comprehensive user summary including profile, measurements, and current status
   * This is a convenience method that combines multiple API calls for a complete picture
   */
  async getSummary(options?: RequestOptions): Promise<UserSummary> {
    log('INFO', '📊 Fetching comprehensive user summary...');
    
    try {
      // Fetch profile (required)
      log('DEBUG', '👤 Getting user profile for summary...');
      const profile = await this.getProfile(options);
      
      // Fetch optional data in parallel
      log('DEBUG', '🔄 Fetching optional data in parallel...');
      const [bodyMeasurement, currentRecoveryResult] = await Promise.allSettled([
        this.getBodyMeasurement(options).catch((error: any) => {
          log('WARN', '⚠️ Body measurement unavailable for summary', {
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }),
        // Access cycles endpoint through the parent SDK
        (this.http as any).sdk?.cycles?.getCurrentRecovery(options).catch((error: any) => {
          log('WARN', '⚠️ Current recovery unavailable for summary', {
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        })
      ]);

      const summary: UserSummary = {
        profile,
      };

      // Add body measurement if available
      if (bodyMeasurement.status === 'fulfilled' && bodyMeasurement.value) {
        summary.bodyMeasurement = bodyMeasurement.value;
        log('DEBUG', '✅ Body measurement added to summary');
      } else {
        log('DEBUG', '⚠️ Body measurement not available for summary');
      }

      // Add current cycle and recovery if available
      if (currentRecoveryResult.status === 'fulfilled' && currentRecoveryResult.value) {
        summary.currentCycle = currentRecoveryResult.value.cycle;
        summary.currentRecovery = currentRecoveryResult.value.recovery;
        log('DEBUG', '✅ Current cycle and recovery added to summary');
      } else {
        log('DEBUG', '⚠️ Current cycle and recovery not available for summary');
      }

      log('INFO', '✅ User summary completed successfully', {
        hasProfile: !!summary.profile,
        hasBodyMeasurement: !!summary.bodyMeasurement,
        hasCurrentCycle: !!summary.currentCycle,
        hasCurrentRecovery: !!summary.currentRecovery
      });

      return summary;
    } catch (error) {
      log('ERROR', '💥 Failed to fetch user summary', {
        error: error instanceof Error ? error.message : String(error)
      });
      // If we can't get the basic profile, that's a critical error
      throw error;
    }
  }

  /**
   * Check if user is a new user (still calibrating)
   * This is a quick way to determine if the user needs to complete calibration
   */
  async isNewUser(options?: RequestOptions): Promise<boolean> {
    log('INFO', '🆕 Checking if user is new (calibrating)...');
    
    try {
      // Try to get current recovery to check calibration status
      log('DEBUG', '🔍 Getting current recovery to check calibration status...');
      const currentRecovery = await (this.http as any).sdk?.cycles?.getCurrentRecovery(options);
      const isCalibrating = currentRecovery?.status?.isCalibrating ?? false;
      
      log('INFO', `${isCalibrating ? '🔄' : '✅'} User calibration status`, {
        isCalibrating,
        hasRecoveryData: !!currentRecovery
      });
      
      return isCalibrating;
    } catch (error) {
      log('WARN', '⚠️ Could not determine calibration status - assuming new user', {
        error: error instanceof Error ? error.message : String(error)
      });
      // If we can't get recovery data, assume they might be a new user
      return true;
    }
  }

  /**
   * Revoke user's OAuth access
   */
  async revokeAccess(options?: RequestOptions): Promise<void> {
    log('INFO', '🗑️ Revoking user OAuth access...');
    
    try {
      await this.http.delete<void>('/v1/user/access', options);
      
      log('INFO', '✅ User OAuth access revoked successfully');
    } catch (error) {
      log('ERROR', '💥 Failed to revoke user OAuth access', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
} 