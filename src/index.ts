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
 * // Initialize with OAuth config
 * const whoop = new WhoopSDK({
 *   oauth: {
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     redirectUri: 'https://your-app.com/callback',
 *     scopes: ['read:profile', 'read:cycles', 'offline']
 *   }
 * });
 * 
 * // Start OAuth flow
 * const authUrl = whoop.auth.getAuthorizationUrl();
 * 
 * // Exchange code for tokens
 * const tokens = await whoop.auth.exchangeCodeForTokens(code);
 * 
 * // Use API endpoints
 * const profile = await whoop.user.getProfile();
 * const cycles = await whoop.cycles.list({ limit: 10 });
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

  /**
   * Create a new SDK instance with different configuration
   */
  public static create(config: WhoopSDKConfig): WhoopSDK {
    return new WhoopSDK(config);
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
export * from './utils';
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
 */
export function createWhoopSDKWithToken(
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
 * Quick OAuth client creation
 */
export function createOAuthClient(config: OAuthConfig): WhoopOAuthClient {
  return WhoopSDK.createOAuthClient(config);
}

/**
 * Get available OAuth scopes
 */
export function getAvailableScopes(): WhoopScope[] {
  return [
    'read:recovery',
    'read:cycles',
    'read:workout', 
    'read:sleep',
    'read:profile',
    'read:body_measurement',
    'offline'
  ];
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