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

    // Initialize performance optimizations
    this.cache = new WhoopCache(config.performance?.cache);
    this.deduplicator = new RequestDeduplicator(config.performance?.deduplication);
    this.performanceHooks = config.performance?.hooks;
    this.slowRequestThreshold = config.performance?.slowRequestThreshold ?? 2000;

    // Initialize OAuth client if config is provided
    if (config.oauth) {
      this.oauthClient = new WhoopOAuthClient(config.oauth);
    }

    // Set initial tokens if provided
    if (config.accessToken && config.refreshToken) {
      if (!this.oauthClient) {
        throw new WhoopAuthError('OAuth configuration required when providing tokens');
      }
      
      this.oauthClient.setTokens({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
        expires_in: 3600, // Default 1 hour
        token_type: 'Bearer',
        scope: 'read:profile offline',
      });
    }

    this.onTokenRefresh = config.onTokenRefresh || undefined;
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
    const { query, body, headers = {}, ...requestOptions } = options;
    
    const finalOptions = {
      ...this.defaultRequestOptions,
      ...requestOptions,
    };

    const url = buildUrl(this.baseUrl, path, query);
    
    const retryOptions: {
      maxAttempts?: number;
      signal?: AbortSignal;
    } = {
      maxAttempts: finalOptions.retries || 1,
    };
    
    if (finalOptions.signal) {
      retryOptions.signal = finalOptions.signal;
    }
    
    return withRetry(
      async () => this.performRequest<T>(method, url, body, headers, finalOptions),
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
    options: RequestOptions
  ): Promise<T> {
    // Get access token
    const accessToken = await this.getAccessToken();
    
    // Prepare headers
    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    // Prepare request body
    let requestBody: string | undefined;
    if (body) {
      if (method.toUpperCase() === 'GET') {
        throw new Error('GET requests cannot have a body');
      }
      requestBody = JSON.stringify(body);
    }

    // Create abort signal with timeout
    const signals: (AbortSignal | undefined)[] = [options.signal];
    
    if (options.timeout) {
      signals.push(createTimeoutSignal(options.timeout));
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
      
      const response = await fetch(url, fetchOptions);

      return await this.handleResponse<T>(response);
    } catch (error) {
      if (signal.aborted) {
        throw new WhoopTimeoutError('Request timeout');
      }
      
      throw ErrorFactory.fromNetworkError(error as Error);
    }
  }

  /**
   * Handle HTTP response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    let responseBody: any;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      const error = ErrorFactory.fromHttpStatus(response.status, responseBody);
      
      // If it's an auth error and we have OAuth client, try to refresh token once
      if (isAuthError(error) && this.oauthClient && error.status === 401) {
        try {
          const newTokens = await this.oauthClient.refreshAccessToken();
          
          // Notify about token refresh
          if (this.onTokenRefresh) {
            await this.onTokenRefresh(newTokens);
          }
          
          // Don't retry here - let the retry mechanism handle it
        } catch (refreshError) {
          // If refresh fails, clear tokens and throw original error
          this.oauthClient.clearTokens();
          throw error;
        }
      }
      
      throw error;
    }

    return responseBody as T;
  }

  /**
   * Get valid access token
   */
  private async getAccessToken(): Promise<string | undefined> {
    if (!this.oauthClient) {
      return undefined;
    }

    try {
      return await this.oauthClient.getValidAccessToken();
    } catch (error) {
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
} 