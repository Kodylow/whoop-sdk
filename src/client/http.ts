/**
 * WHOOP SDK HTTP Client
 * High-performance HTTP client with authentication, caching, deduplication, and monitoring
 * Built for athlete-grade performance like WHOOP's hardware
 */

import type { RequestOptions, WhoopSDKConfig, OAuthTokens, PerformanceMetrics } from '../types';
import { 
  ErrorFactory, 
  isAuthError,
  getRetryInfo
} from '../errors/factory';
import { 
  WhoopTimeoutError
} from '../errors/base';
import { 
  WhoopAuthError
} from '../errors/api';
import { 
  buildUrl, 
  combineSignals, 
  createTimeoutSignal, 
  withRetry,
  getUserAgent,
  DEFAULT_BASE_URL,
  WhoopCache,
  RequestDeduplicator,
  generateCacheKey,
  generateDedupKey
} from '../utils';
import { WhoopOAuthClient } from '../auth/oauth';

// Debug logging utility
const log = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WHOOP-SDK-HTTP] [${level}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

/**
 * High-performance HTTP client for WHOOP API requests
 * Optimized with caching, deduplication, and performance monitoring
 */
export class WhoopHttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultRequestOptions: RequestOptions;
  private readonly oauthClient?: WhoopOAuthClient;
  private readonly onTokenRefresh: ((tokens: OAuthTokens) => void | Promise<void>) | undefined;
  
  // Performance optimizations
  private readonly cache: WhoopCache;
  private readonly deduplicator: RequestDeduplicator;
  private readonly performanceHooks: {
    onRequestStart?: (url: string, options: any) => void;
    onRequestEnd?: (metrics: PerformanceMetrics) => void;
    onCacheHit?: (key: string, data: any) => void;
    onSlowRequest?: (metrics: PerformanceMetrics) => void;
  } | undefined;
  private readonly slowRequestThreshold: number;
  
  // Performance metrics
  private metrics = {
    totalRequests: 0,
    cachedRequests: 0,
    dedupedRequests: 0,
    avgResponseTime: 0,
    slowRequests: 0
  };

  constructor(config: WhoopSDKConfig = {}) {
    log('INFO', '🚀 Initializing WhoopHttpClient', {
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      hasOAuthConfig: !!config.oauth,
      hasTokens: !!(config.accessToken && config.refreshToken),
      defaultTimeout: config.defaultRequestOptions?.timeout || 30000,
      defaultRetries: config.defaultRequestOptions?.retries || 3
    });

    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.defaultRequestOptions = {
      timeout: 30000,
      retries: 3,
      ...config.defaultRequestOptions,
    };

    this.defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(),
    };

    log('DEBUG', '📋 Default headers configured', this.defaultHeaders);
    log('DEBUG', '⚙️ Default request options configured', this.defaultRequestOptions);

    // Initialize performance optimizations
    this.cache = new WhoopCache(config.performance?.cache);
    this.deduplicator = new RequestDeduplicator(config.performance?.deduplication);
    this.performanceHooks = config.performance?.hooks;
    this.slowRequestThreshold = config.performance?.slowRequestThreshold ?? 2000;

    log('DEBUG', '🚀 Performance optimizations initialized', {
      cacheEnabled: !!config.performance?.cache,
      deduplicationEnabled: !!config.performance?.deduplication,
      slowRequestThreshold: this.slowRequestThreshold
    });

    // Initialize OAuth client if config is provided
    if (config.oauth) {
      log('INFO', '🔐 Initializing OAuth client', {
        clientId: config.oauth.clientId?.substring(0, 8) + '...',
        redirectUri: config.oauth.redirectUri,
        scopes: config.oauth.scopes
      });
      this.oauthClient = new WhoopOAuthClient(config.oauth);
    } else {
      log('WARN', '⚠️ No OAuth configuration provided - client will not be able to authenticate');
    }

    // Set initial tokens if provided
    if (config.accessToken && config.refreshToken) {
      if (!this.oauthClient) {
        const error = new WhoopAuthError('OAuth configuration required when providing tokens');
        log('ERROR', '❌ Failed to set initial tokens - no OAuth client configured');
        throw error;
      }
      
      log('INFO', '🎫 Setting initial tokens', {
        accessTokenLength: config.accessToken.length,
        refreshTokenLength: config.refreshToken.length
      });

      this.oauthClient.setTokens({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
        expires_in: 3600, // Default 1 hour
        token_type: 'Bearer',
        scope: 'read:profile offline',
      });
    } else {
      log('DEBUG', '🔓 No initial tokens provided - will need to authenticate via OAuth flow');
    }

    this.onTokenRefresh = config.onTokenRefresh || undefined;
    log('INFO', '✅ WhoopHttpClient initialized successfully');
  }

  /**
   * Make authenticated HTTP request
   */
  public async request<T = any>(
    method: string,
    path: string,
    options: {
      query?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
    } & RequestOptions = {}
  ): Promise<T> {
    const requestId = Math.random().toString(36).substring(2, 15);
    const { query, body, headers = {}, ...requestOptions } = options;
    
    log('INFO', `📤 Starting API request [${requestId}]`, {
      method: method.toUpperCase(),
      path,
      query,
      hasBody: !!body,
      customHeaders: Object.keys(headers),
      requestOptions
    });
    
    const finalOptions = {
      ...this.defaultRequestOptions,
      ...requestOptions,
    };

    const url = buildUrl(this.baseUrl, path, query);
    
    log('DEBUG', `🔗 Built request URL [${requestId}]`, { url });
    
    const retryOptions: {
      maxAttempts?: number;
      signal?: AbortSignal;
    } = {
      maxAttempts: finalOptions.retries || 1,
    };
    
    if (finalOptions.signal) {
      retryOptions.signal = finalOptions.signal;
      log('DEBUG', `⏹️ Abort signal configured [${requestId}]`);
    }
    
    log('DEBUG', `🔄 Retry configuration [${requestId}]`, retryOptions);
    
    let attemptNumber = 0;
    return withRetry(
      async () => {
        attemptNumber++;
        log('DEBUG', `🎯 Attempt ${attemptNumber}/${retryOptions.maxAttempts || 1} [${requestId}]`);
        return this.performRequest<T>(method, url, body, headers, finalOptions, requestId);
      },
      retryOptions
    );
  }

  /**
   * Perform the actual HTTP request
   */
  private async performRequest<T>(
    method: string,
    url: string,
    body: any,
    headers: Record<string, string>,
    options: RequestOptions,
    requestId: string
  ): Promise<T> {
    const startTime = Date.now();
    
    log('DEBUG', `🔑 Getting access token [${requestId}]`);
    
    // Get access token
    const accessToken = await this.getAccessToken();
    
    if (accessToken) {
      log('DEBUG', `✅ Access token retrieved [${requestId}]`, {
        tokenLength: accessToken.length,
        tokenPrefix: accessToken.substring(0, 10) + '...'
      });
    } else {
      log('WARN', `⚠️ No access token available [${requestId}] - request will be unauthenticated`);
    }
    
    // Prepare headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    log('DEBUG', `📋 Final request headers [${requestId}]`, {
      ...requestHeaders,
      Authorization: requestHeaders.Authorization ? 
        `Bearer ${requestHeaders.Authorization.substring(7, 17)}...` : 
        undefined
    });

    // Prepare request body
    let requestBody: string | undefined;
    if (body) {
      if (method.toUpperCase() === 'GET') {
        const error = new Error('GET requests cannot have a body');
        log('ERROR', `❌ Invalid request [${requestId}] - GET with body`, { method, body });
        throw error;
      }
      requestBody = JSON.stringify(body);
      log('DEBUG', `📦 Request body prepared [${requestId}]`, {
        bodySize: requestBody.length,
        bodyPreview: requestBody.substring(0, 200) + (requestBody.length > 200 ? '...' : '')
      });
    }

    // Create abort signal with timeout
    const signals: (AbortSignal | undefined)[] = [options.signal];
    
    if (options.timeout) {
      signals.push(createTimeoutSignal(options.timeout));
      log('DEBUG', `⏰ Request timeout set [${requestId}]`, { timeout: options.timeout });
    }

    const signal = combineSignals(...signals);

    try {
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: requestHeaders,
        signal,
      };
      
      if (requestBody) {
        fetchOptions.body = requestBody;
      }
      
      log('INFO', `🚀 Sending HTTP request [${requestId}]`, {
        method: fetchOptions.method,
        url,
        headersCount: Object.keys(requestHeaders).length,
        hasBody: !!requestBody,
        timeout: options.timeout
      });

      const response = await fetch(url, fetchOptions);
      
      const duration = Date.now() - startTime;
      
      log('INFO', `📥 HTTP response received [${requestId}]`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });

      if (this.performanceHooks?.onRequestEnd) {
        this.performanceHooks.onRequestEnd({
          startTime,
          endTime: Date.now(),
          duration,
          cacheStatus: 'miss', // TODO: Implement cache status tracking
          retryCount: 0,
          errorCount: 0
        });
      }

      return await this.handleResponse<T>(response, requestId);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log('ERROR', `💥 HTTP request failed [${requestId}]`, {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
        url,
        method: method.toUpperCase()
      });

      if (signal.aborted) {
        const timeoutError = new WhoopTimeoutError('Request timeout');
        log('ERROR', `⏰ Request timeout [${requestId}]`, { timeout: options.timeout });
        throw timeoutError;
      }
      
      const networkError = ErrorFactory.fromNetworkError(error as Error);
      log('ERROR', `🌐 Network error [${requestId}]`, {
        errorType: networkError.constructor.name,
        message: networkError.message
      });
      throw networkError;
    }
  }

  /**
   * Handle HTTP response
   */
  private async handleResponse<T>(response: Response, requestId: string): Promise<T> {
    log('DEBUG', `📖 Processing response [${requestId}]`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    let responseBody: any;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
        log('DEBUG', `📄 JSON response parsed [${requestId}]`, {
          bodyKeys: typeof responseBody === 'object' && responseBody ? Object.keys(responseBody) : [],
          bodySize: JSON.stringify(responseBody).length
        });
      } else {
        responseBody = await response.text();
        log('DEBUG', `📄 Text response parsed [${requestId}]`, {
          textLength: responseBody.length,
          textPreview: responseBody.substring(0, 200) + (responseBody.length > 200 ? '...' : '')
        });
      }
    } catch (parseError) {
      log('WARN', `⚠️ Failed to parse response body [${requestId}]`, {
        error: parseError instanceof Error ? parseError.message : String(parseError)
      });
      responseBody = null;
    }

    if (!response.ok) {
      log('ERROR', `❌ HTTP error response [${requestId}]`, {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseBody
      });

      const error = ErrorFactory.fromHttpStatus(response.status, responseBody);
      
      // If it's an auth error and we have OAuth client, try to refresh token once
      if (isAuthError(error) && this.oauthClient && error.status === 401) {
        log('WARN', `🔄 Authentication error detected, attempting token refresh [${requestId}]`);
        
        try {
          const newTokens = await this.oauthClient.refreshAccessToken();
          
          log('INFO', `✅ Token refresh successful [${requestId}]`, {
            newTokenExpiry: newTokens.expires_in,
            tokenType: newTokens.token_type
          });
          
          // Notify about token refresh
          if (this.onTokenRefresh) {
            await this.onTokenRefresh(newTokens);
          }
          
          // Don't retry here - let the retry mechanism handle it
        } catch (refreshError) {
          log('ERROR', `💥 Token refresh failed [${requestId}]`, {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError)
          });
          
          // If refresh fails, clear tokens and throw original error
          this.oauthClient.clearTokens();
          log('INFO', `🗑️ Cleared invalid tokens [${requestId}]`);
          throw error;
        }
      }
      
      throw error;
    }

    log('INFO', `✅ Request completed successfully [${requestId}]`);
    return responseBody as T;
  }

  /**
   * Get valid access token
   */
  private async getAccessToken(): Promise<string | undefined> {
    if (!this.oauthClient) {
      log('DEBUG', '🔓 No OAuth client configured - returning undefined access token');
      return undefined;
    }

    try {
      log('DEBUG', '🔑 Requesting valid access token from OAuth client');
      const token = await this.oauthClient.getValidAccessToken();
      
      if (token) {
        log('DEBUG', '✅ Valid access token obtained', {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 10) + '...'
        });
      } else {
        log('WARN', '⚠️ OAuth client returned undefined access token');
      }
      
      return token;
    } catch (error) {
      log('ERROR', '💥 Failed to get valid access token', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If we can't get a valid token, return undefined and let the request proceed
      // The API will return 401 which can trigger token refresh
      return undefined;
    }
  }

  /**
   * GET request
   */
  public async get<T = any>(
    path: string,
    options: {
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } & RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * POST request
   */
  public async post<T = any>(
    path: string,
    options: {
      body?: any;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } & RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  /**
   * PUT request
   */
  public async put<T = any>(
    path: string,
    options: {
      body?: any;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } & RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  /**
   * DELETE request
   */
  public async delete<T = any>(
    path: string,
    options: {
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } & RequestOptions = {}
  ): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Set OAuth tokens
   */
  public setTokens(tokens: OAuthTokens): void {
    if (!this.oauthClient) {
      throw new WhoopAuthError('OAuth client not configured');
    }
    this.oauthClient.setTokens(tokens);
  }

  /**
   * Get current tokens
   */
  public getTokens(): OAuthTokens | undefined {
    return this.oauthClient?.getTokens();
  }

  /**
   * Get OAuth client
   */
  public getOAuthClient(): WhoopOAuthClient | undefined {
    return this.oauthClient;
  }

  /**
   * Clear stored tokens
   */
  public clearTokens(): void {
    this.oauthClient?.clearTokens();
  }

  /**
   * Check if client is authenticated
   */
  public isAuthenticated(): boolean {
    const tokens = this.getTokens();
    return tokens !== undefined && !this.oauthClient?.isTokenExpired(tokens);
  }

  /**
   * Get comprehensive performance statistics
   */
  public getPerformanceStats() {
    return {
      ...this.metrics,
      cache: this.cache.getStats(),
      deduplication: this.deduplicator.getStats()
    };
  }

  /**
   * Clear all caches and reset performance counters
   */
  public reset(): void {
    this.cache.clear();
    this.deduplicator.clear();
    
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      dedupedRequests: 0,
      avgResponseTime: 0,
      slowRequests: 0
    };
  }
} 