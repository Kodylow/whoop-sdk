/**
 * WHOOP TypeScript SDK
 * Production-ready SDK for the WHOOP API
 */

import type { 
  WhoopSDKConfig, 
  OAuthConfig, 
  OAuthTokens, 
  WhoopScope,
  RequestOptions,
  CurrentRecoveryResult,
  UserSummary,
} from './types';
import { WhoopHttpClient } from './client/http';
import { WhoopOAuthClient } from './auth/oauth';
import { createEndpoints, type WhoopEndpoints } from './endpoints';
import { WhoopConfigError } from './errors';

/**
 * Main WHOOP SDK Client
 * 
 * @example
 * ```typescript
 * // Initialize with OAuth config for new authentication flow
 * const whoop = new WhoopSDK({
 *   oauth: {
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     redirectUri: 'https://your-app.com/callback',
 *     scopes: ['read:profile', 'read:cycles', 'read:recovery', 'offline']
 *   }
 * });
 * 
 * // Start OAuth flow
 * const authUrl = whoop.auth.getAuthorizationUrl();
 * 
 * // Exchange code for tokens
 * const tokens = await whoop.auth.exchangeCodeForTokens(code);
 * 
 * // Or initialize with existing tokens
 * const whoop = WhoopSDK.withTokens(accessToken, refreshToken);
 * 
 * // Get current recovery (most common use case)
 * const recovery = await whoop.getCurrentRecovery();
 * console.log(`Recovery: ${recovery.recovery?.score?.recovery_score}%`);
 * 
 * // Get user summary
 * const summary = await whoop.getUserSummary();
 * console.log(`Hello ${summary.profile.first_name}!`);
 * ```
 */
export class WhoopSDK {
  public readonly http: WhoopHttpClient;
  public readonly auth: WhoopOAuthClient | undefined;
  
  // Endpoint handlers
  public readonly cycles: WhoopEndpoints['cycles'];
  public readonly recovery: WhoopEndpoints['recovery'];
  public readonly sleep: WhoopEndpoints['sleep'];
  public readonly workouts: WhoopEndpoints['workouts'];
  public readonly user: WhoopEndpoints['user'];

  constructor(config: WhoopSDKConfig = {}) {
    // Initialize HTTP client
    this.http = new WhoopHttpClient(config);
    
    // Initialize OAuth client if config provided
    this.auth = this.http.getOAuthClient();
    
    // Initialize endpoint handlers
    const endpoints = createEndpoints(this.http);
    this.cycles = endpoints.cycles;
    this.recovery = endpoints.recovery;
    this.sleep = endpoints.sleep;
    this.workouts = endpoints.workouts;
    this.user = endpoints.user;
  }

  // === Token Management ===

  /**
   * Set OAuth tokens
   */
  public setTokens(tokens: OAuthTokens): void {
    this.http.setTokens(tokens);
  }

  /**
   * Get current OAuth tokens
   */
  public getTokens(): OAuthTokens | undefined {
    return this.http.getTokens();
  }

  /**
   * Clear stored tokens
   */
  public clearTokens(): void {
    this.http.clearTokens();
  }

  /**
   * Check if the client is authenticated
   */
  public isAuthenticated(): boolean {
    return this.http.isAuthenticated();
  }

  // === Convenience Methods for Common Use Cases ===

  /**
   * Get the user's current recovery score
   * This is the most common use case - implements the two-step process from Whoop docs
   */
  public async getCurrentRecovery(options?: RequestOptions): Promise<CurrentRecoveryResult> {
    return this.cycles.getCurrentRecovery(options);
  }

  /**
   * Get comprehensive user information including current status
   */
  public async getUserSummary(options?: RequestOptions): Promise<UserSummary> {
    return this.user.getSummary(options);
  }

  /**
   * Check if user is new and still calibrating
   */
  public async isUserCalibrating(options?: RequestOptions): Promise<boolean> {
    try {
      const recovery = await this.getCurrentRecovery(options);
      return recovery.status.isCalibrating;
    } catch {
      return true; // Assume calibrating if we can't determine
    }
  }

  /**
   * Get recent recovery scores with easy filtering
   */
  public async getRecentRecoveryScores(
    days: number = 7,
    options?: RequestOptions
  ): Promise<Array<{
    date: string;
    recoveryScore: number | null;
    isCalibrating: boolean;
    strain: number | null;
  }>> {
    const cyclesWithRecovery = await this.cycles.getRecentCyclesWithRecovery({ days }, options);
    
    return cyclesWithRecovery.map(({ cycle, recovery }) => ({
      date: cycle.start,
      recoveryScore: recovery?.score?.recovery_score ?? null,
      isCalibrating: recovery?.score?.user_calibrating ?? false,
      strain: cycle.score?.strain ?? null,
    }));
  }

  /**
   * Get today's strain (if cycle is complete)
   */
  public async getTodaysStrain(options?: RequestOptions): Promise<number | null> {
    try {
      const recovery = await this.getCurrentRecovery(options);
      return recovery.cycle.score?.strain ?? null;
    } catch {
      return null;
    }
  }

  // === Static Factory Methods ===

  /**
   * Create a new SDK instance with different configuration
   */
  public static create(config: WhoopSDKConfig): WhoopSDK {
    return new WhoopSDK(config);
  }

  /**
   * Create SDK instance with existing tokens (no OAuth flow needed)
   * This is the easiest way to get started if you already have tokens
   */
  public static withTokens(
    accessToken: string,
    refreshToken?: string,
    config: Omit<WhoopSDKConfig, 'accessToken' | 'refreshToken'> = {}
  ): WhoopSDK {
    const sdkConfig: WhoopSDKConfig = {
      ...config,
      accessToken,
    };
    
    if (refreshToken) {
      sdkConfig.refreshToken = refreshToken;
    }
    
    return new WhoopSDK(sdkConfig);
  }

  /**
   * Create a new SDK instance configured for a specific user
   * This is ideal for server-side applications handling multiple users
   */
  public static forUser(
    userId: string,
    tokens: { accessToken: string; refreshToken?: string },
    config: Omit<WhoopSDKConfig, 'accessToken' | 'refreshToken'> = {}
  ): WhoopSDK {
    const sdkConfig: WhoopSDKConfig = {
      ...config,
      accessToken: tokens.accessToken,
    };
    
    if (tokens.refreshToken) {
      sdkConfig.refreshToken = tokens.refreshToken;
    }
    
    return new WhoopSDK(sdkConfig);
  }

  /**
   * Create an OAuth-only client for authentication flows
   */
  public static createOAuthClient(config: OAuthConfig): WhoopOAuthClient {
    return new WhoopOAuthClient(config);
  }
}

// Re-export all types and utilities
export * from './types';
export * from './errors';
export {
  validateId,
  validatePaginationParams,
  buildUrl,
  DEFAULT_BASE_URL,
} from './utils';
export { WhoopOAuthClient } from './auth/oauth';
export { WhoopHttpClient } from './client/http';
export { 
  CyclesEndpoint,
  RecoveryEndpoint, 
  SleepEndpoint,
  WorkoutsEndpoint,
  UserEndpoint,
  type WhoopEndpoints
} from './endpoints';

// Re-export OAuth utilities
export {
  parseAuthorizationCallback,
  validateAuthorizationCallback
} from './auth/oauth';

/**
 * Default export is the main SDK class
 */
export default WhoopSDK;

/**
 * Convenience function to create a new SDK instance
 */
export function createWhoopSDK(config: WhoopSDKConfig = {}): WhoopSDK {
  return new WhoopSDK(config);
}

/**
 * Quick setup with just access token (no OAuth flow)
 * @deprecated Use WhoopSDK.withTokens() instead
 */
export function createWhoopSDKWithToken(
  accessToken: string,
  refreshToken?: string,
  config: Omit<WhoopSDKConfig, 'accessToken' | 'refreshToken'> = {}
): WhoopSDK {
  return WhoopSDK.withTokens(accessToken, refreshToken, config);
}

/**
 * Quick OAuth client creation
 */
export function createOAuthClient(config: OAuthConfig): WhoopOAuthClient {
  return WhoopSDK.createOAuthClient(config);
}

/**
 * Get available OAuth scopes with descriptions
 */
export function getAvailableScopes(): Array<{ scope: WhoopScope; description: string }> {
  return [
    { scope: 'read:recovery', description: 'Access to recovery scores and HRV data' },
    { scope: 'read:cycles', description: 'Access to physiological cycles and strain data' },
    { scope: 'read:workout', description: 'Access to workout data and activities' },
    { scope: 'read:sleep', description: 'Access to sleep stages and sleep performance' },
    { scope: 'read:profile', description: 'Access to basic user profile information' },
    { scope: 'read:body_measurement', description: 'Access to body measurements (height, weight, etc.)' },
    { scope: 'offline', description: 'Enables refresh tokens for long-term access' }
  ];
}

/**
 * Get recommended scopes for most applications
 */
export function getRecommendedScopes(): WhoopScope[] {
  return ['read:profile', 'read:cycles', 'read:recovery', 'offline'];
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(config: OAuthConfig): void {
  if (!config.clientId) {
    throw new WhoopConfigError('clientId is required');
  }
  
  if (!config.clientSecret) {
    throw new WhoopConfigError('clientSecret is required');
  }
  
  if (!config.redirectUri) {
    throw new WhoopConfigError('redirectUri is required');
  }
  
  try {
    new URL(config.redirectUri);
  } catch {
    throw new WhoopConfigError('redirectUri must be a valid URL');
  }
  
  if (config.scopes && config.scopes.length === 0) {
    throw new WhoopConfigError('At least one scope is required');
  }
} 