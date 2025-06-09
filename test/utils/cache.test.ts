/**
 * Cache Utility Tests
 * Tests for the high-performance cache implementation
 */

import { WhoopCache, generateCacheKey } from '../../src/utils/cache';

describe('WhoopCache', () => {
  let cache: WhoopCache;

  beforeEach(() => {
    cache = new WhoopCache({
      ttl: 1000, // 1 second for testing
      maxSize: 3,
      compress: false
    });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test', value: 123 };
      cache.set('test-key', testData);
      
      const result = cache.get('test-key');
      expect(result).toEqual(testData);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('exists', 'value');
      
      expect(cache.has('exists')).toBe(true);
      expect(cache.has('not-exists')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('delete-me', 'value');
      expect(cache.has('delete-me')).toBe(true);
      
      const deleted = cache.delete('delete-me');
      expect(deleted).toBe(true);
      expect(cache.has('delete-me')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', () => {
      cache.set('expire-me', 'value');
      expect(cache.get('expire-me')).toBe('value');
      
      // Fast forward time beyond TTL
      jest.advanceTimersByTime(1500);
      
      expect(cache.get('expire-me')).toBeUndefined();
    });

    it('should support custom TTL per entry', () => {
      cache.set('custom-ttl', 'value', 2000); // 2 seconds
      
      // Advance past default TTL but not custom TTL
      jest.advanceTimersByTime(1500);
      expect(cache.get('custom-ttl')).toBe('value');
      
      // Advance past custom TTL
      jest.advanceTimersByTime(1000);
      expect(cache.get('custom-ttl')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when maxSize is reached', () => {
      // Fill cache to capacity
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add another entry, should evict key2 (least recently used)
      cache.set('key4', 'value4');
      
      expect(cache.has('key1')).toBe(true); // Still exists (recently used)
      expect(cache.has('key2')).toBe(false); // Evicted (least recently used)
      expect(cache.has('key3')).toBe(true); // Still exists
      expect(cache.has('key4')).toBe(true); // Newly added
    });
  });

  describe('Compression', () => {
    it('should compress large objects when enabled', () => {
      const compressedCache = new WhoopCache({
        ttl: 5000,
        maxSize: 10,
        compress: true
      });

      // Large object that should trigger compression
      const largeObject = {
        data: 'x'.repeat(2000), // 2KB of data
        numbers: Array.from({ length: 100 }, (_, i) => i)
      };

      compressedCache.set('large-object', largeObject);
      const result = compressedCache.get('large-object');
      
      expect(result).toEqual(largeObject);
    });
  });

  describe('Performance Statistics', () => {
    it('should track cache statistics', () => {
      // Trigger some hits and misses
      cache.set('hit-me', 'value');
      cache.get('hit-me'); // Hit
      cache.get('miss-me'); // Miss
      cache.get('hit-me'); // Hit
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(67); // 2/3 * 100, rounded
      expect(stats.size).toBe(1);
    });

    it('should track memory usage', () => {
      const stats1 = cache.getStats();
      expect(stats1.totalMemory).toBe(0);
      
      cache.set('memory-test', { data: 'test'.repeat(100) });
      
      const stats2 = cache.getStats();
      expect(stats2.totalMemory).toBeGreaterThan(0);
      expect(stats2.averageEntrySize).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should handle cleanup of expired entries', () => {
      cache.set('expire1', 'value1');
      cache.set('expire2', 'value2');
      
      // Fast forward to trigger cleanup
      jest.advanceTimersByTime(2000);
      
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent cache keys', () => {
    const key1 = generateCacheKey('GET', '/api/test', { param: 'value' });
    const key2 = generateCacheKey('GET', '/api/test', { param: 'value' });
    
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different parameters', () => {
    const key1 = generateCacheKey('GET', '/api/test', { param: 'value1' });
    const key2 = generateCacheKey('GET', '/api/test', { param: 'value2' });
    
    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different methods', () => {
    const key1 = generateCacheKey('GET', '/api/test');
    const key2 = generateCacheKey('POST', '/api/test');
    
    expect(key1).not.toBe(key2);
  });

  it('should handle missing parameters', () => {
    const key = generateCacheKey('GET', '/api/test');
    expect(key).toMatch(/^whoop:/);
  });
}); 