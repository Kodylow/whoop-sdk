/**
 * Request Deduplication System
 * Prevents duplicate API calls and enables request batching for optimal performance
 */

import type { RequestDedupe } from '../types';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  resolvers: Array<(value: T) => void>;
  rejectors: Array<(error: any) => void>;
  abortController?: AbortController;
}

interface BatchRequest {
  url: string;
  options: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
}

/**
 * High-performance request deduplication manager
 * Inspired by WHOOP's efficient data collection patterns
 */
export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private batchQueue = new Map<string, BatchRequest[]>();
  private config: Required<RequestDedupe>;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestCounts = new Map<string, number>();
  
  // Performance metrics
  private stats = {
    dedupedRequests: 0,
    batchedRequests: 0,
    concurrentRequests: 0,
    maxConcurrentRequests: 0
  };

  constructor(config: RequestDedupe = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      windowMs: config.windowMs ?? 100, // 100ms deduplication window
      maxConcurrent: config.maxConcurrent ?? 10
    };
  }

  /**
   * Execute request with deduplication
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>,
    options: {
      priority?: 'low' | 'normal' | 'high';
      skipDedup?: boolean;
      timeout?: number;
    } = {}
  ): Promise<T> {
    if (!this.config.enabled || options.skipDedup) {
      return requestFn();
    }

    // Check if we're at max concurrent requests
    if (this.stats.concurrentRequests >= this.config.maxConcurrent) {
      await this.waitForSlot();
    }

    // Check for existing pending request
    const existing = this.pendingRequests.get(key);
    if (existing && this.isWithinWindow(existing.timestamp)) {
      this.stats.dedupedRequests++;
      return this.attachToExisting(existing);
    }

    // Create new request
    const abortController = new AbortController();
    const promise = this.executeWithMetrics(requestFn, abortController.signal);
    
    const pendingRequest: PendingRequest<T> = {
      promise,
      timestamp: Date.now(),
      resolvers: [],
      rejectors: [],
      abortController
    };

    this.pendingRequests.set(key, pendingRequest);
    this.stats.concurrentRequests++;
    this.stats.maxConcurrentRequests = Math.max(
      this.stats.maxConcurrentRequests,
      this.stats.concurrentRequests
    );

    try {
      const result = await promise;
      
      // Resolve any attached requests
      pendingRequest.resolvers.forEach(resolve => resolve(result));
      
      return result;
    } catch (error) {
      // Reject any attached requests
      pendingRequest.rejectors.forEach(reject => reject(error));
      throw error;
    } finally {
      this.pendingRequests.delete(key);
      this.stats.concurrentRequests--;
    }
  }

  /**
   * Batch similar requests for efficient processing
   */
  async executeBatch<T>(
    batchKey: string,
    url: string,
    options: any,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batch: BatchRequest = {
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        priority
      };

      // Add to batch queue
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, []);
      }
      
      this.batchQueue.get(batchKey)!.push(batch);

      // Schedule batch processing
      this.scheduleBatchProcessing(batchKey);
    });
  }

  /**
   * Cancel pending request
   */
  cancel(key: string): boolean {
    const pending = this.pendingRequests.get(key);
    if (pending?.abortController) {
      pending.abortController.abort();
      this.pendingRequests.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Get deduplication statistics
   */
  getStats() {
    return {
      ...this.stats,
      pendingRequests: this.pendingRequests.size,
      batchQueues: this.batchQueue.size,
      dedupSavings: Math.round((this.stats.dedupedRequests / 
        (this.stats.dedupedRequests + this.pendingRequests.size)) * 100) || 0
    };
  }

  /**
   * Clear all pending requests and batches
   */
  clear(): void {
    // Cancel all pending requests
    for (const [key, pending] of this.pendingRequests) {
      pending.abortController?.abort();
    }
    
    this.pendingRequests.clear();
    this.batchQueue.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer as any);
      this.batchTimer = null;
    }
  }

  /**
   * Check if timestamp is within deduplication window
   */
  private isWithinWindow(timestamp: number): boolean {
    return Date.now() - timestamp < this.config.windowMs;
  }

  /**
   * Attach to existing request
   */
  private attachToExisting<T>(existing: PendingRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      existing.resolvers.push(resolve);
      existing.rejectors.push(reject);
    });
  }

  /**
   * Execute request with performance metrics
   */
  private async executeWithMetrics<T>(
    requestFn: () => Promise<T>,
    signal: AbortSignal
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      if (signal.aborted) {
        throw new Error('Request was cancelled');
      }
      throw error;
    }
  }

  /**
   * Wait for available request slot
   */
  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (this.stats.concurrentRequests < this.config.maxConcurrent) {
          resolve();
        } else {
          setTimeout(checkSlot, 10);
        }
      };
      checkSlot();
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(batchKey: string): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch(batchKey);
      this.batchTimer = null;
    }, 50); // 50ms batch window
  }

  /**
   * Process batched requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batchQueue.get(batchKey);
    if (!batch || batch.length === 0) return;

    this.batchQueue.delete(batchKey);
    this.stats.batchedRequests += batch.length;

    // Sort by priority
    batch.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Process batch (simplified - would need API-specific batching logic)
    for (const request of batch) {
      try {
        // This would be replaced with actual batch API call
        const response = await fetch(request.url, request.options);
        const data = await response.json();
        request.resolve(data);
      } catch (error) {
        request.reject(error);
      }
    }
  }
}

/**
 * Global deduplicator instance
 */
export const globalDeduplicator = new RequestDeduplicator();

/**
 * Generate deduplication key for requests
 */
export function generateDedupKey(
  method: string,
  url: string,
  body?: any
): string {
  const bodyHash = body ? simpleHash(JSON.stringify(body)) : '';
  return `${method}:${url}:${bodyHash}`;
}

/**
 * Simple hash function for deduplication keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
} 