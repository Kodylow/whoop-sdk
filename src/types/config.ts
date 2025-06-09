/**
 * SDK Configuration Type Definitions
 * Configuration options for the WHOOP SDK with performance optimizations
 */

import type { OAuthConfig, OAuthTokens } from './oauth';
import type { RequestOptions } from './base';
import type { 
  CacheConfig, 
  RequestDedupe, 
  PerformanceHooks, 
  MemoryConfig, 
  ConnectionConfig 
} from './performance';

// SDK Configuration
export interface WhoopSDKConfig {
  accessToken?: string;
  refreshToken?: string;
  baseUrl?: string;
  oauth?: OAuthConfig;
  defaultRequestOptions?: RequestOptions;
  onTokenRefresh?: (tokens: OAuthTokens) => void | Promise<void>;
  
  // Performance Configuration
  performance?: {
    /** Response caching configuration */
    cache?: CacheConfig;
    /** Request deduplication settings */
    deduplication?: RequestDedupe;
    /** Performance monitoring hooks */
    hooks?: PerformanceHooks;
    /** Memory management options */
    memory?: MemoryConfig;
    /** Connection optimization */
    connection?: ConnectionConfig;
    /** Slow request threshold in ms */
    slowRequestThreshold?: number;
    /** Enable performance profiling */
    profiling?: boolean;
  };
} 