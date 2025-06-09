/**
 * Performance Optimization Tests
 * Tests specifically for cache, deduplication, and performance features
 */

import { WhoopCache, RequestDeduplicator, generateCacheKey, generateDedupKey } from '../src/utils';

describe('Performance Optimizations', () => {
  describe('Cache Performance', () => {
    let cache: WhoopCache;

    beforeEach(() => {
      cache = new WhoopCache({
        ttl: 1000,
        maxSize: 100,
        compress: true
      });
    });

    it('should provide sub-millisecond cache access', () => {
      const testData = { large: 'x'.repeat(10000) };
      
      // Store data
      cache.set('perf-test', testData);
      
      // Measure cache access time
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        cache.get('perf-test');
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Should be very fast (< 0.1ms per access)
      expect(avgTime).toBeLessThan(0.1);
    });

    it('should efficiently handle memory usage with compression', () => {
      const largeData = {
        data: 'x'.repeat(5000),
        array: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };

      // Test without compression
      const uncompressedCache = new WhoopCache({ compress: false });
      uncompressedCache.set('large', largeData);
      const uncompressedStats = uncompressedCache.getStats();

      // Test with compression
      const compressedCache = new WhoopCache({ compress: true });
      compressedCache.set('large', largeData);
      const compressedStats = compressedCache.getStats();

      // Compression should reduce memory usage
      expect(compressedStats.compressionSavings).toBeGreaterThan(0);
    });

    it('should scale efficiently with many entries', () => {
      const numEntries = 1000;
      const startTime = performance.now();

      // Add many entries
      for (let i = 0; i < numEntries; i++) {
        cache.set(`key-${i}`, { id: i, data: `value-${i}` });
      }

      const midTime = performance.now();

      // Retrieve all entries
      for (let i = 0; i < numEntries; i++) {
        cache.get(`key-${i}`);
      }

      const endTime = performance.now();

      const insertTime = (midTime - startTime) / numEntries;
      const retrieveTime = (endTime - midTime) / numEntries;

      // Should be very fast operations
      expect(insertTime).toBeLessThan(1); // < 1ms per insert
      expect(retrieveTime).toBeLessThan(0.1); // < 0.1ms per retrieve

      console.log(`Cache Performance: Insert: ${insertTime.toFixed(3)}ms, Retrieve: ${retrieveTime.toFixed(3)}ms`);
    });
  });

  describe('Deduplication Performance', () => {
    let deduplicator: RequestDeduplicator;

    beforeEach(() => {
      deduplicator = new RequestDeduplicator({
        enabled: true,
        windowMs: 100,
        maxConcurrent: 10
      });
    });

    it('should handle high-frequency duplicate requests efficiently', async () => {
      let callCount = 0;
      const mockRequest = jest.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: 'test', call: callCount };
      });

      const numRequests = 100;
      const startTime = performance.now();

      // Fire many identical requests
      const promises = Array.from({ length: numRequests }, () => 
        deduplicator.execute('test-key', mockRequest)
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // All should return the same result (deduplication working)
      expect(results.every((r: any) => r.call === 1)).toBe(true);
      
      // Only one actual call should have been made
      expect(mockRequest).toHaveBeenCalledTimes(1);

      const totalTime = endTime - startTime;
      console.log(`Deduplication handled ${numRequests} requests in ${totalTime.toFixed(2)}ms`);
    });

    it('should efficiently manage concurrent request limits', async () => {
      const requests: Promise<any>[] = [];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const mockRequest = jest.fn().mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentCount--;
        return { timestamp: Date.now() };
      });

      // Start many requests with different keys
      for (let i = 0; i < 20; i++) {
        requests.push(deduplicator.execute(`key-${i}`, mockRequest));
      }

      await Promise.all(requests);

      // Should respect max concurrent limit
      expect(maxConcurrent).toBeLessThanOrEqual(10);
      
      const stats = deduplicator.getStats();
      expect(stats.maxConcurrentRequests).toBeLessThanOrEqual(10);
    });
  });

  describe('Key Generation Performance', () => {
    it('should generate cache keys efficiently', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        generateCacheKey('GET', `/api/test/${i}`, { param: i });
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.01); // < 0.01ms per generation
      console.log(`Cache key generation: ${avgTime.toFixed(4)}ms per key`);
    });

    it('should generate deduplication keys efficiently', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        generateDedupKey('POST', `/api/test/${i}`, { data: `payload-${i}` });
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      expect(avgTime).toBeLessThan(0.01); // < 0.01ms per generation
      console.log(`Dedup key generation: ${avgTime.toFixed(4)}ms per key`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle cache cleanup efficiently', () => {
      const cache = new WhoopCache({
        ttl: 100, // Very short TTL
        maxSize: 1000
      });

      // Fill cache
      for (let i = 0; i < 500; i++) {
        cache.set(`key-${i}`, { data: `value-${i}`.repeat(100) });
      }

      const statsBefore = cache.getStats();
      expect(statsBefore.size).toBe(500);

      // Wait for TTL expiration
      jest.advanceTimersByTime(200);

      // Access cache to trigger cleanup
      cache.get('non-existent');

      const statsAfter = cache.getStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.totalMemory).toBe(0);
    });

    it('should handle LRU eviction efficiently with large datasets', () => {
      const cache = new WhoopCache({
        ttl: 10000,
        maxSize: 100 // Small cache
      });

      const startTime = performance.now();

      // Add more items than cache can hold
      for (let i = 0; i < 500; i++) {
        cache.set(`key-${i}`, { id: i, data: 'x'.repeat(1000) });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should maintain size limit
      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(100);
      expect(stats.evictions).toBeGreaterThan(0);

      // Should be efficient even with evictions
      expect(totalTime).toBeLessThan(100); // < 100ms for 500 operations

      console.log(`LRU eviction handled 500 items in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Integration Performance', () => {
    it('should handle combined cache and deduplication efficiently', async () => {
      const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
      const deduplicator = new RequestDeduplicator({ 
        enabled: true, 
        windowMs: 100,
        maxConcurrent: 5 
      });

      let apiCallCount = 0;
      const mockApiCall = jest.fn().mockImplementation(async (id: number) => {
        apiCallCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id, data: `result-${id}`, timestamp: Date.now() };
      });

      const performRequest = async (id: number) => {
        const cacheKey = generateCacheKey('GET', `/api/test/${id}`);
        const dedupKey = generateDedupKey('GET', `/api/test/${id}`);

        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        // Use deduplicator for API call
        const result = await deduplicator.execute(dedupKey, () => mockApiCall(id));
        
        // Store in cache
        cache.set(cacheKey, result);
        
        return result;
      };

      const numRequests = 100;
      const numUniqueIds = 10;
      const startTime = performance.now();

      // Make many requests with some duplicates
      const promises = Array.from({ length: numRequests }, (_, i) => 
        performRequest(i % numUniqueIds)
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // Should have made far fewer API calls due to caching and deduplication
      expect(apiCallCount).toBeLessThanOrEqual(numUniqueIds);
      expect(results).toHaveLength(numRequests);

      const totalTime = endTime - startTime;
      const avgTime = totalTime / numRequests;

      console.log(`Combined optimization: ${numRequests} requests in ${totalTime.toFixed(2)}ms (${avgTime.toFixed(2)}ms avg)`);
      console.log(`API calls saved: ${numRequests - apiCallCount} (${((1 - apiCallCount/numRequests) * 100).toFixed(1)}%)`);

      expect(avgTime).toBeLessThan(5); // Should be very fast with optimizations
    });
  });
}); 