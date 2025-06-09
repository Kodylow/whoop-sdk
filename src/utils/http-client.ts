/**
 * High-Performance HTTP Client
 * Optimized HTTP client with caching, deduplication, and performance monitoring
 * Built for athlete-grade performance like WHOOP's hardware
 */

import type { RequestOptions, PaginatedResponse } from '../types';
import type { PerformanceMetrics, OptimizationHints } from '../types';
import { WhoopCache, generateCacheKey } from './cache';
import { RequestDeduplicator, generateDedupKey } from './deduplication';
import { buildUrl, createTimeoutSignal, combineSignals, getUserAgent } from './http';
import { withRetry } from './retry';
import { createErrorFromResponse } from '../errors/factory';

interface HttpClientConfig {
  baseUrl: string;
  cache?: WhoopCache;
  deduplicator?: RequestDeduplicator;
  defaultTimeout?: number;
  enableCompression?: boolean;
  enablePrefetch?: boolean;
  performanceHooks?: {
    onRequestStart?: (url: string, options: any) => void;
    onRequestEnd?: (metrics: PerformanceMetrics) => void;
    onCacheHit?: (key: string, data: any) => void;
    onSlowRequest?: (metrics: PerformanceMetrics) => void;
  };
  slowRequestThreshold?: number;
}

/**
 * Optimized HTTP Client for WHOOP API
 * Performance-focused with intelligent caching and request optimization
 */
export class OptimizedHttpClient {
  private cache: WhoopCache;
  private deduplicator: RequestDeduplicator;
  private config: Required<Omit<HttpClientConfig, 'cache' | 'deduplicator' | 'performanceHooks'>> & {
    performanceHooks?: HttpClientConfig['performanceHooks'];
  };
  private prefetchQueue = new Set<string>();
  
  // Performance tracking
  private metrics = {
    totalRequests: 0,
    cachedRequests: 0,
    dedupedRequests: 0,
    avgResponseTime: 0,
    slowRequests: 0
  };

  constructor(config: HttpClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      defaultTimeout: config.defaultTimeout ?? 30000,
      enableCompression: config.enableCompression ?? true,
      enablePrefetch: config.enablePrefetch ?? true,
      slowRequestThreshold: config.slowRequestThreshold ?? 2000,
      performanceHooks: config.performanceHooks
    };

    this.cache = config.cache ?? new WhoopCache({
      ttl: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      compress: true
    });

    this.deduplicator = config.deduplicator ?? new RequestDeduplicator({
      enabled: true,
      windowMs: 100,
      maxConcurrent: 10
    });
  }

  /**
   * High-performance GET request with full optimization
   */
  async get<T>(
    path: string, 
    options: RequestOptions & OptimizationHints = {}
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Optimized POST request
   */
  async post<T>(
    path: string, 
    data?: any, 
    options: RequestOptions & OptimizationHints = {}
  ): Promise<T> {
    return this.request<T>('POST', path, data, options);
  }

  /**
   * Optimized PUT request
   */
  async put<T>(
    path: string, 
    data?: any, 
    options: RequestOptions & OptimizationHints = {}
  ): Promise<T> {
    return this.request<T>('PUT', path, data, options);
  }

  /**
   * Optimized DELETE request
   */
  async delete<T>(
    path: string, 
    options: RequestOptions & OptimizationHints = {}
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * High-performance paginated request with intelligent prefetching
   */
  async *paginatedRequest<T>(
    path: string,
    options: RequestOptions & OptimizationHints = {}
  ): AsyncIterableIterator<T> {
    let nextToken = options.nextToken;
    let pageCount = 0;
    const maxPrefetch = 2; // Prefetch up to 2 pages ahead

    while (true) {
      const requestOptions = { ...options };
      if (nextToken) {
        requestOptions.nextToken = nextToken;
      }
      
      // Prefetch next pages in background
      if (this.config.enablePrefetch && pageCount < maxPrefetch) {
        this.schedulePrefetch(path, requestOptions);
      }

      const response = await this.get<PaginatedResponse<T>>(path, requestOptions);
      
      for (const item of response.data) {
        yield item;
      }

      nextToken = response.next_token;
      if (!nextToken) break;
      
      pageCount++;
    }
  }

  /**
   * Batch multiple requests for optimal performance
   */
  async batch<T>(requests: Array<{
    method: string;
    path: string;
    data?: any;
    options?: RequestOptions & OptimizationHints;
  }>): Promise<T[]> {
    // Group requests by priority
    const priorityGroups = {
      high: [] as typeof requests,
      normal: [] as typeof requests,
      low: [] as typeof requests
    };

    requests.forEach(req => {
      const priority = req.options?.priority ?? 'normal';
      priorityGroups[priority].push(req);
    });

    // Execute in priority order with optimal concurrency
    const results: T[] = [];
    
    for (const priority of ['high', 'normal', 'low'] as const) {
      const group = priorityGroups[priority];
      if (group.length === 0) continue;

      const batchPromises = group.map(req => 
        this.request<T>(req.method as any, req.path, req.data, req.options)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Core optimized request method
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options: RequestOptions & OptimizationHints = {}
  ): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    // Build full URL
    const url = buildUrl(this.config.baseUrl, path, options.params);
    
    // Generate cache and deduplication keys
    const cacheKey = generateCacheKey(method, url, data);
    const dedupKey = generateDedupKey(method, url, data);

    // Performance hooks
    this.config.performanceHooks?.onRequestStart?.(url, options);

    // Check cache for GET requests
    if (method === 'GET' && !options.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.cachedRequests++;
        this.config.performanceHooks?.onCacheHit?.(cacheKey, cached);
        return cached;
      }
    }

    // Execute with deduplication
    const result = await this.deduplicator.execute(
      dedupKey,
      () => this.executeRequest<T>(method, url, data, options),
      {
        priority: options.priority ?? 'normal',
        skipDedup: options.skipCache ?? false
      }
    );

    // Cache successful GET responses
    if (method === 'GET' && !options.skipCache) {
      const ttl = options.cacheTtl ?? undefined;
      this.cache.set(cacheKey, result, ttl);
    }

    // Performance tracking
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const metrics: PerformanceMetrics = {
      startTime,
      endTime,
      duration,
      responseSize: this.estimateSize(result),
      cacheStatus: method === 'GET' ? 'miss' : 'skip',
      retryCount: 0,
      errorCount: 0
    };

    // Track slow requests
    if (duration > this.config.slowRequestThreshold) {
      this.metrics.slowRequests++;
      this.config.performanceHooks?.onSlowRequest?.(metrics);
    }

    // Update average response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + duration) / 
      this.metrics.totalRequests;

    this.config.performanceHooks?.onRequestEnd?.(metrics);

    // Schedule prefetch if hints provided
    if (options.prefetch) {
      options.prefetch.forEach(prefetchPath => {
        this.schedulePrefetch(prefetchPath, { ...options, priority: 'low' });
      });
    }

    return result;
  }

  /**
   * Execute the actual HTTP request with retry logic
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': getUserAgent(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      requestOptions.body = JSON.stringify(data);
    }

    // Setup timeout and abort signals
    const timeoutSignal = createTimeoutSignal(options.timeout ?? this.config.defaultTimeout);
    requestOptions.signal = combineSignals(timeoutSignal, options.signal);

    // Enable compression if supported
    if (this.config.enableCompression) {
      (requestOptions.headers as any)['Accept-Encoding'] = 'gzip, deflate, br';
    }

    // Execute with retry logic
    return withRetry(async () => {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw await createErrorFromResponse(response);
      }

      return response.json();
    }, {
      maxAttempts: options.maxRetries ?? 3,
      baseDelayMs: options.retryDelay ?? 1000,
      maxDelayMs: 10000,
      signal: requestOptions.signal
    });
  }

  /**
   * Schedule prefetch for future requests
   */
  private schedulePrefetch(path: string, options: RequestOptions & OptimizationHints): void {
    if (this.prefetchQueue.has(path)) return;

    this.prefetchQueue.add(path);
    
    // Execute prefetch with low priority after short delay
    setTimeout(() => {
      this.get(path, { ...options, priority: 'low' })
        .catch(() => {}) // Ignore prefetch errors
        .finally(() => this.prefetchQueue.delete(path));
    }, 100);
  }

  /**
   * Estimate response size for performance tracking
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.metrics,
      cache: this.cache.getStats(),
      deduplication: this.deduplicator.getStats(),
      prefetchQueue: this.prefetchQueue.size
    };
  }

  /**
   * Clear all caches and reset performance counters
   */
  reset(): void {
    this.cache.clear();
    this.deduplicator.clear();
    this.prefetchQueue.clear();
    
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      dedupedRequests: 0,
      avgResponseTime: 0,
      slowRequests: 0
    };
  }
} 