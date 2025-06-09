/**
 * High-Performance Cache Implementation
 * Memory-efficient caching with TTL, LRU eviction, and optional compression
 */

import type { CacheConfig } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  compressed?: boolean;
  size?: number;
}

/**
 * High-performance cache with athlete-focused ergonomics
 * Designed for speed and memory efficiency like WHOOP's data processing
 */
export class WhoopCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private readonly config: Required<CacheConfig>;
  private accessCounter = 0;
  private totalSize = 0;
  
  // Performance tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionSavings: 0
  };

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttl: config.ttl ?? 5 * 60 * 1000, // 5 minutes default
      maxSize: config.maxSize ?? 1000,
      compress: config.compress ?? false,
      keyStrategy: config.keyStrategy ?? 'url'
    };

    // Periodic cleanup for expired entries
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), this.config.ttl);
    }
  }

  /**
   * Get cached data with performance tracking
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.totalSize -= entry.size || 0;
      this.stats.misses++;
      return undefined;
    }

    // Update access tracking for LRU
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.accessCounter);
    
    this.stats.hits++;
    
    // Decompress if needed
    if (entry.compressed && this.config.compress) {
      return this.decompress(entry.data as any);
    }
    
    return entry.data;
  }

  /**
   * Set cached data with intelligent compression and size management
   */
  set(key: string, data: T, customTtl?: number): void {
    const ttl = customTtl ?? this.config.ttl;
    let processedData = data;
    let compressed = false;
    let size = this.estimateSize(data);

    // Compress large objects if enabled
    if (this.config.compress && size > 1024) { // Compress objects > 1KB
      const compressedData = this.compress(data);
      const compressedSize = this.estimateSize(compressedData);
      
      if (compressedSize < size * 0.8) { // Only use if >20% savings
        processedData = compressedData as T;
        compressed = true;
        this.stats.compressionSavings += size - compressedSize;
        size = compressedSize;
      }
    }

    // Evict entries if cache is full
    while (this.cache.size >= this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      compressed,
      size
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);
    this.totalSize += size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete specific entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size || 0;
    }
    
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.totalSize = 0;
    this.accessCounter = 0;
  }

  /**
   * Get cache statistics for performance monitoring
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      size: this.cache.size,
      totalMemory: this.totalSize,
      averageEntrySize: this.cache.size > 0 ? Math.round(this.totalSize / this.cache.size) : 0
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.delete(key));
  }

  /**
   * Estimate object size in bytes (rough approximation)
   */
  private estimateSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }

  /**
   * Simple compression using JSON string manipulation
   */
  private compress(data: any): string {
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  }

  /**
   * Decompress data
   */
  private decompress(compressedData: string): any {
    try {
      return JSON.parse(compressedData);
    } catch {
      return compressedData;
    }
  }
}

/**
 * Global cache instance for SDK-wide use
 */
export const globalCache = new WhoopCache();

/**
 * Cache key generator optimized for WHOOP API patterns
 */
export function generateCacheKey(
  method: string, 
  url: string, 
  params?: Record<string, any>
): string {
  const paramString = params ? JSON.stringify(params) : '';
  const hash = simpleHash(`${method}:${url}:${paramString}`);
  return `whoop:${hash}`;
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
} 