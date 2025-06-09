/**
 * WHOOP OAuth2 Authentication Handler
 * Comprehensive OAuth2 flow implementation with token management
 */

import { ErrorFactory, WhoopAuthError, WhoopOAuthError } from '../errors';
import type { OAuthConfig, OAuthTokens, WhoopScope } from '../types';
import { buildUrl, DEFAULT_BASE_URL } from '../utils';

// Debug logging utility
const log = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WHOOP-SDK-OAUTH] [${level}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

/**
 * OAuth2 authentication manager for WHOOP API
 */
export class WhoopOAuthClient {
  private readonly config: Required<OAuthConfig>;
  private tokens: OAuthTokens | undefined = undefined;
  private refreshPromise: Promise<OAuthTokens> | undefined = undefined;

  constructor(config: OAuthConfig) {
    log('INFO', '🔐 Initializing WhoopOAuthClient', {
      clientIdLength: config.clientId?.length,
      clientSecretLength: config.clientSecret?.length,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      baseUrl: config.baseUrl
    });

    this.config = {
      baseUrl: DEFAULT_BASE_URL.replace('/developer', ''),
      scopes: ['read:profile', 'offline'],
      ...config,
    };

    log('DEBUG', '⚙️ OAuth configuration processed', {
      finalBaseUrl: this.config.baseUrl,
      finalScopes: this.config.scopes,
      clientIdPrefix: this.config.clientId?.substring(0, 8) + '...'
    });

    this.validateConfig();
  }

  /**
   * Validate OAuth configuration
   */
  private validateConfig(): void {
    log('DEBUG', '🔍 Validating OAuth configuration...');

    if (!this.config.clientId) {
      log('ERROR', '❌ Client ID validation failed');
      throw new WhoopOAuthError('Client ID is required');
    }

    if (!this.config.clientSecret) {
      log('ERROR', '❌ Client secret validation failed');
      throw new WhoopOAuthError('Client secret is required');
    }

    if (!this.config.redirectUri) {
      log('ERROR', '❌ Redirect URI validation failed');
      throw new WhoopOAuthError('Redirect URI is required');
    }

    try {
      const parsedUrl = new URL(this.config.redirectUri);
      log('DEBUG', '✅ Redirect URI is valid', {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        pathname: parsedUrl.pathname
      });
    } catch (urlError) {
      log('ERROR', '❌ Redirect URI validation failed', {
        redirectUri: this.config.redirectUri,
        error: urlError instanceof Error ? urlError.message : String(urlError)
      });
      throw new WhoopOAuthError('Redirect URI must be a valid URL');
    }

    log('INFO', '✅ OAuth configuration validated successfully');
  }

  /**
   * Generate authorization URL for OAuth2 flow
   */
  public getAuthorizationUrl(options: {
    state?: string;
    scopes?: WhoopScope[];
  } = {}): string {
    const { state, scopes = this.config.scopes } = options;

    log('INFO', '🌐 Generating authorization URL', {
      state: state ? 'provided' : 'none',
      scopes,
      redirectUri: this.config.redirectUri
    });

    const params: Record<string, string> = {
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
    };

    if (state) {
      params.state = state;
    }

    const authUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/auth', params);
    
    log('DEBUG', '🔗 Authorization URL generated', {
      url: authUrl,
      paramsCount: Object.keys(params).length
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access tokens
   */
  public async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    log('INFO', '🔄 Starting authorization code exchange', {
      codeLength: code.length,
      codePrefix: code.substring(0, 10) + '...'
    });

    const tokenUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/token');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    log('DEBUG', '📤 Sending token exchange request', {
      tokenUrl,
      grantType: 'authorization_code',
      redirectUri: this.config.redirectUri,
      clientIdPrefix: this.config.clientId?.substring(0, 8) + '...'
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

      log('DEBUG', '📥 Token exchange response received', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      const data = await response.json();

      if (!response.ok) {
        log('ERROR', '❌ Token exchange failed', {
          status: response.status,
          error: data.error,
          errorDescription: data.error_description,
          responseData: data
        });

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

      log('INFO', '✅ Token exchange successful', {
        tokenType: tokens.token_type,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
        hasRefreshToken: !!tokens.refresh_token,
        accessTokenLength: tokens.access_token?.length
      });

      this.tokens = tokens;
      return tokens;
    } catch (error) {
      if (error instanceof WhoopOAuthError) {
        log('ERROR', '💥 OAuth error during token exchange', {
          errorMessage: error.message
        });
        throw error;
      }
      
      log('ERROR', '💥 Network error during token exchange', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken?: string): Promise<OAuthTokens> {
    const tokenToRefresh = refreshToken || this.tokens?.refresh_token;

    log('INFO', '🔄 Starting token refresh', {
      hasProvidedToken: !!refreshToken,
      hasStoredToken: !!this.tokens?.refresh_token,
      tokenToUseLength: tokenToRefresh?.length
    });

    if (!tokenToRefresh) {
      log('ERROR', '❌ No refresh token available for refresh');
      throw new WhoopAuthError('No refresh token available');
    }

    // Prevent concurrent refresh attempts
    if (this.refreshPromise) {
      log('DEBUG', '⏳ Concurrent refresh attempt detected, waiting for existing refresh...');
      return this.refreshPromise;
    }

    log('DEBUG', '🚀 Starting new refresh operation');
    this.refreshPromise = this.performTokenRefresh(tokenToRefresh);

    try {
      const tokens = await this.refreshPromise;
      this.tokens = tokens;
      
      log('INFO', '✅ Token refresh completed successfully', {
        newTokenType: tokens.token_type,
        newExpiresIn: tokens.expires_in
      });
      
      return tokens;
    } catch (refreshError) {
      log('ERROR', '💥 Token refresh failed', {
        error: refreshError instanceof Error ? refreshError.message : String(refreshError)
      });
      throw refreshError;
    } finally {
      this.refreshPromise = undefined;
      log('DEBUG', '🧹 Refresh promise cleared');
    }
  }

  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(refreshToken: string): Promise<OAuthTokens> {
    log('DEBUG', '🔄 Performing token refresh request', {
      refreshTokenLength: refreshToken.length,
      refreshTokenPrefix: refreshToken.substring(0, 10) + '...'
    });

    const tokenUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/token');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    log('DEBUG', '📤 Sending refresh token request', {
      tokenUrl,
      grantType: 'refresh_token',
      clientIdPrefix: this.config.clientId?.substring(0, 8) + '...'
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

      log('DEBUG', '📥 Refresh token response received', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      const data = await response.json();

      if (!response.ok) {
        log('ERROR', '❌ Token refresh request failed', {
          status: response.status,
          error: data.error,
          errorDescription: data.error_description,
          responseData: data
        });

        throw new WhoopAuthError(
          data.error_description || data.error || 'Token refresh failed',
          data
        );
      }

      log('INFO', '✅ Token refresh request successful', {
        hasNewAccessToken: !!data.access_token,
        hasNewRefreshToken: !!data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type
      });

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expires_in: data.expires_in,
        token_type: data.token_type || 'Bearer',
        scope: data.scope || this.config.scopes.join(' '),
      };
    } catch (error) {
      if (error instanceof WhoopAuthError) {
        log('ERROR', '💥 Auth error during token refresh', {
          errorMessage: error.message
        });
        throw error;
      }
      
      log('ERROR', '💥 Network error during token refresh', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Revoke access token
   */
  public async revokeToken(token?: string): Promise<void> {
    const tokenToRevoke = token || this.tokens?.access_token;

    log('INFO', '🗑️ Starting token revocation', {
      hasProvidedToken: !!token,
      hasStoredToken: !!this.tokens?.access_token,
      tokenToRevokeLength: tokenToRevoke?.length
    });

    if (!tokenToRevoke) {
      log('ERROR', '❌ No token available to revoke');
      throw new WhoopAuthError('No token available to revoke');
    }

    const revokeUrl = buildUrl(this.config.baseUrl, '/oauth/oauth2/revoke');

    const body = new URLSearchParams({
      token: tokenToRevoke,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    log('DEBUG', '📤 Sending token revocation request', {
      revokeUrl,
      clientIdPrefix: this.config.clientId?.substring(0, 8) + '...',
      tokenPrefix: tokenToRevoke.substring(0, 10) + '...'
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

      log('DEBUG', '📥 Token revocation response received', {
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        
        log('ERROR', '❌ Token revocation failed', {
          status: response.status,
          error: data.error,
          errorDescription: data.error_description,
          responseData: data
        });

        throw new WhoopAuthError(
          data.error_description || data.error || 'Token revocation failed',
          data
        );
      }

      // Clear stored tokens if we revoked the current access token
      if (token === this.tokens?.access_token || !token) {
        this.tokens = undefined;
        log('INFO', '🧹 Cleared stored tokens after revocation');
      }

      log('INFO', '✅ Token revocation successful');
    } catch (error) {
      if (error instanceof WhoopAuthError) {
        log('ERROR', '💥 Auth error during token revocation', {
          errorMessage: error.message
        });
        throw error;
      }
      
      log('ERROR', '💥 Network error during token revocation', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Set tokens manually (e.g., from storage)
   */
  public setTokens(tokens: OAuthTokens): void {
    log('INFO', '🎫 Setting tokens manually', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      accessTokenLength: tokens.access_token?.length
    });

    this.tokens = tokens;
    
    log('DEBUG', '✅ Tokens set successfully');
  }

  /**
   * Get current tokens
   */
  public getTokens(): OAuthTokens | undefined {
    const hasTokens = !!this.tokens;
    
    log('DEBUG', '📋 Retrieving current tokens', {
      hasTokens,
      tokenType: this.tokens?.token_type,
      hasAccessToken: !!this.tokens?.access_token,
      hasRefreshToken: !!this.tokens?.refresh_token
    });

    return this.tokens;
  }

  /**
   * Check if tokens are expired
   */
  public isTokenExpired(tokens?: OAuthTokens): boolean {
    const currentTokens = tokens || this.tokens;
    
    log('DEBUG', '⏰ Checking token expiration', {
      hasTokens: !!currentTokens,
      hasExpiresIn: !!currentTokens?.expires_in,
      expiresIn: currentTokens?.expires_in
    });
    
    if (!currentTokens) {
      log('DEBUG', '❌ No tokens available - considering expired');
      return true;
    }

    // If no expires_in, assume token is still valid
    if (!currentTokens.expires_in) {
      log('DEBUG', '✅ No expiration time - considering valid');
      return false;
    }

    // Add buffer of 5 minutes before expiration
    const bufferMs = 5 * 60 * 1000;
    const expirationTime = Date.now() + (currentTokens.expires_in * 1000) - bufferMs;
    const isExpired = Date.now() >= expirationTime;
    
    log('DEBUG', `${isExpired ? '❌' : '✅'} Token expiration check result`, {
      isExpired,
      expiresIn: currentTokens.expires_in,
      bufferMinutes: 5,
      currentTime: new Date().toISOString(),
      expirationTime: new Date(expirationTime).toISOString()
    });
    
    return isExpired;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  public async getValidAccessToken(): Promise<string> {
    log('DEBUG', '🔑 Getting valid access token...');

    if (!this.tokens) {
      log('ERROR', '❌ No tokens available for access token retrieval');
      throw new WhoopAuthError('No tokens available. Please authenticate first.');
    }

    log('DEBUG', '🔍 Checking if current token needs refresh...');
    
    if (this.isTokenExpired(this.tokens)) {
      log('INFO', '🔄 Token is expired, refreshing...');
      const refreshedTokens = await this.refreshAccessToken();
      
      log('INFO', '✅ Token refreshed, returning new access token', {
        newTokenLength: refreshedTokens.access_token.length
      });
      
      return refreshedTokens.access_token;
    }

    log('DEBUG', '✅ Current token is valid, returning access token', {
      tokenLength: this.tokens.access_token.length,
      tokenPrefix: this.tokens.access_token.substring(0, 10) + '...'
    });

    return this.tokens.access_token;
  }

  /**
   * Clear stored tokens
   */
  public clearTokens(): void {
    const hadTokens = !!this.tokens;
    
    log('INFO', '🗑️ Clearing stored tokens', {
      hadTokens,
      hadAccessToken: !!this.tokens?.access_token,
      hadRefreshToken: !!this.tokens?.refresh_token
    });

    this.tokens = undefined;
    
    log('DEBUG', '✅ Tokens cleared successfully');
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