/**
 * WHOOP OAuth2 Authentication Handler
 * Comprehensive OAuth2 flow implementation with token management
 */

import type { OAuthConfig, OAuthTokens, WhoopScope } from '../types';
import { WhoopOAuthError, WhoopAuthError, ErrorFactory } from '../errors';
import { buildUrl, DEFAULT_BASE_URL } from '../utils';

/**
 * OAuth2 authentication manager for WHOOP API
 */
export class WhoopOAuthClient {
  private readonly config: Required<OAuthConfig>;
  private tokens: OAuthTokens | undefined = undefined;
  private refreshPromise: Promise<OAuthTokens> | undefined = undefined;

  constructor(config: OAuthConfig) {
    this.config = {
      baseUrl: DEFAULT_BASE_URL.replace('/developer', ''),
      scopes: ['read:profile', 'offline'],
      ...config,
    };

    this.validateConfig();
  }

  /**
   * Validate OAuth configuration
   */
  private validateConfig(): void {
    if (!this.config.clientId) {
      throw new WhoopOAuthError('Client ID is required');
    }

    if (!this.config.clientSecret) {
      throw new WhoopOAuthError('Client secret is required');
    }

    if (!this.config.redirectUri) {
      throw new WhoopOAuthError('Redirect URI is required');
    }

    try {
      new URL(this.config.redirectUri);
    } catch {
      throw new WhoopOAuthError('Redirect URI must be a valid URL');
    }
  }

  /**
   * Generate authorization URL for OAuth2 flow
   */
  public getAuthorizationUrl(options: {
    state?: string;
    scopes?: WhoopScope[];
  } = {}): string {
    const { state, scopes = this.config.scopes } = options;

    const params: Record<string, string> = {
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
    };

    if (state) {
      params.state = state;
    }

    return buildUrl(this.config.baseUrl, '/oauth/oauth2/auth', params);
  }

  /**
   * Exchange authorization code for access tokens
   */
  public async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const tokenUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/token');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new WhoopOAuthError(
          data.error_description || data.error || 'Token exchange failed',
          data.error,
          data.error_description
        );
      }

      const tokens: OAuthTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope || this.config.scopes.join(' '),
      };

      this.tokens = tokens;
      return tokens;
    } catch (error) {
      if (error instanceof WhoopOAuthError) {
        throw error;
      }
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken?: string): Promise<OAuthTokens> {
    const tokenToRefresh = refreshToken || this.tokens?.refresh_token;

    if (!tokenToRefresh) {
      throw new WhoopAuthError('No refresh token available');
    }

    // Prevent concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh(tokenToRefresh);

    try {
      const tokens = await this.refreshPromise;
      this.tokens = tokens;
      return tokens;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(refreshToken: string): Promise<OAuthTokens> {
    const tokenUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/token');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new WhoopAuthError(
          data.error_description || data.error || 'Token refresh failed',
          data
        );
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope || this.config.scopes.join(' '),
      };
    } catch (error) {
      if (error instanceof WhoopAuthError) {
        throw error;
      }
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Revoke access token
   */
  public async revokeToken(token?: string): Promise<void> {
    const tokenToRevoke = token || this.tokens?.access_token;

    if (!tokenToRevoke) {
      throw new WhoopAuthError('No token available to revoke');
    }

    const revokeUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/revoke');

    const body = new URLSearchParams({
      token: tokenToRevoke,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new WhoopAuthError(
          data.error_description || data.error || 'Token revocation failed',
          data
        );
      }

      // Clear stored tokens if we revoked the current access token
      if (token === this.tokens?.access_token || !token) {
        this.tokens = undefined;
      }
    } catch (error) {
      if (error instanceof WhoopAuthError) {
        throw error;
      }
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Set tokens manually (e.g., from storage)
   */
  public setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens
   */
  public getTokens(): OAuthTokens | undefined {
    return this.tokens;
  }

  /**
   * Check if tokens are expired
   */
  public isTokenExpired(tokens?: OAuthTokens): boolean {
    const currentTokens = tokens || this.tokens;
    
    if (!currentTokens) {
      return true;
    }

    // If no expires_in, assume token is still valid
    if (!currentTokens.expires_in) {
      return false;
    }

    // Add buffer of 5 minutes before expiration
    const bufferMs = 5 * 60 * 1000;
    const expirationTime = Date.now() + (currentTokens.expires_in * 1000) - bufferMs;
    
    return Date.now() >= expirationTime;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  public async getValidAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new WhoopAuthError('No tokens available. Please authenticate first.');
    }

    if (this.isTokenExpired(this.tokens)) {
      const refreshedTokens = await this.refreshAccessToken();
      return refreshedTokens.access_token;
    }

    return this.tokens.access_token;
  }

  /**
   * Clear stored tokens
   */
  public clearTokens(): void {
    this.tokens = undefined;
  }

  /**
   * Get OAuth configuration (without sensitive data)
   */
  public getConfig(): Omit<Required<OAuthConfig>, 'clientSecret'> {
    const { clientSecret, ...safeConfig } = this.config;
    return safeConfig;
  }
}

/**
 * Helper function to parse authorization callback
 */
export function parseAuthorizationCallback(url: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const result: { code?: string; state?: string; error?: string; errorDescription?: string } = {};
    
    const code = params.get('code');
    if (code) result.code = code;
    
    const state = params.get('state');
    if (state) result.state = state;
    
    const error = params.get('error');
    if (error) result.error = error;
    
    const errorDescription = params.get('error_description');
    if (errorDescription) result.errorDescription = errorDescription;

    return result;
  } catch {
    throw new WhoopOAuthError('Invalid callback URL');
  }
}

/**
 * Validate authorization callback response
 */
export function validateAuthorizationCallback(
  url: string,
  expectedState?: string
): { code: string; state?: string } {
  const parsed = parseAuthorizationCallback(url);

  if (parsed.error) {
    throw new WhoopOAuthError(
      parsed.errorDescription || parsed.error,
      parsed.error,
      parsed.errorDescription
    );
  }

  if (!parsed.code) {
    throw new WhoopOAuthError('Authorization code not found in callback');
  }

  if (expectedState && parsed.state !== expectedState) {
    throw new WhoopOAuthError('State parameter mismatch');
  }

  const result: { code: string; state?: string } = { code: parsed.code };
  if (parsed.state) result.state = parsed.state;

  return result;
} 