/**
 * Performance Type Definitions
 * Types for optimization features like caching, request deduplication, and performance monitoring
 */

// Cache Configuration
export interface CacheConfig {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Enable cache compression */
  compress?: boolean;
  /** Cache key strategy */
  keyStrategy?: 'url' | 'custom';
}

// Request Deduplication
export interface RequestDedupe {
  /** Enable request deduplication */
  enabled?: boolean;
  /** Deduplication window in milliseconds */
  windowMs?: number;
  /** Maximum concurrent requests per endpoint */
  maxConcurrent?: number;
}

// Performance Monitoring
export interface PerformanceMetrics {
  /** Request start time */
  startTime: number;
  /** Request end time */
  endTime: number;
  /** Request duration in milliseconds */
  duration: number;
  /** Response size in bytes */
  responseSize?: number;
  /** Cache hit/miss */
  cacheStatus: 'hit' | 'miss' | 'skip';
  /** Retry count */
  retryCount: number;
  /** Network error count */
  errorCount: number;
}

// Performance Hooks
export interface PerformanceHooks {
  /** Called before request */
  onRequestStart?: (url: string, options: any) => void;
  /** Called after request completion */
  onRequestEnd?: (metrics: PerformanceMetrics) => void;
  /** Called on cache hit */
  onCacheHit?: (key: string, data: any) => void;
  /** Called on performance threshold breach */
  onSlowRequest?: (metrics: PerformanceMetrics) => void;
}

// Optimization Hints
export interface OptimizationHints {
  /** Prefetch related data */
  prefetch?: string[];
  /** Request priority */
  priority?: 'low' | 'normal' | 'high';
  /** Enable request batching */
  batch?: boolean;
  /** Background refresh */
  backgroundRefresh?: boolean;
}

// Memory Management
export interface MemoryConfig {
  /** Enable WeakRef for large objects */
  useWeakRefs?: boolean;
  /** Garbage collection hints */
  gcHints?: boolean;
  /** Object pooling for frequent allocations */
  objectPooling?: boolean;
}

// Connection Optimization
export interface ConnectionConfig {
  /** HTTP/2 server push hints */
  serverPush?: boolean;
  /** Connection keep-alive */
  keepAlive?: boolean;
  /** Request pipelining */
  pipelining?: boolean;
  /** DNS prefetch hints */
  dnsPrefetch?: boolean;
} 