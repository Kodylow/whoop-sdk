/**
 * Request Deduplication Tests
 * Tests for the request deduplication system
 */

import { RequestDeduplicator, generateDedupKey } from '../../src/utils/deduplication';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;
  let mockRequestFn: jest.Mock;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator({
      enabled: true,
      windowMs: 100, // 100ms window for testing
      maxConcurrent: 2 // Low limit for testing
    });
    mockRequestFn = jest.fn();
  });

  describe('Basic Deduplication', () => {
    it('should execute request when no duplicate exists', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      const result = await deduplicator.execute('test-key', mockRequestFn);
      
      expect(result).toBe('result');
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate identical requests within window', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      // Start both requests simultaneously
      const promise1 = deduplicator.execute('test-key', mockRequestFn);
      const promise2 = deduplicator.execute('test-key', mockRequestFn);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(mockRequestFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should not deduplicate requests outside the window', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      // First request
      await deduplicator.execute('test-key', mockRequestFn);
      
      // Advance time beyond window
      jest.advanceTimersByTime(150);
      
      // Second request should not be deduplicated
      await deduplicator.execute('test-key', mockRequestFn);
      
      expect(mockRequestFn).toHaveBeenCalledTimes(2);
    });

    it('should handle different keys separately', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      const promise1 = deduplicator.execute('key1', mockRequestFn);
      const promise2 = deduplicator.execute('key2', mockRequestFn);
      
      await Promise.all([promise1, promise2]);
      
      expect(mockRequestFn).toHaveBeenCalledTimes(2); // Different keys, no deduplication
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors to all attached requests', async () => {
      const error = new Error('Request failed');
      mockRequestFn.mockRejectedValue(error);
      
      const promise1 = deduplicator.execute('test-key', mockRequestFn);
      const promise2 = deduplicator.execute('test-key', mockRequestFn);
      
      await expect(promise1).rejects.toThrow('Request failed');
      await expect(promise2).rejects.toThrow('Request failed');
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed success and error scenarios', async () => {
      mockRequestFn.mockResolvedValueOnce('success');
      
      // First request succeeds
      const result = await deduplicator.execute('key1', mockRequestFn);
      expect(result).toBe('success');
      
      // Second request with different key fails
      mockRequestFn.mockRejectedValueOnce(new Error('Failed'));
      await expect(deduplicator.execute('key2', mockRequestFn)).rejects.toThrow('Failed');
    });
  });

  describe('Concurrency Control', () => {
    it('should limit concurrent requests', async () => {
      const delayedMock = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 50))
      );
      
      // Start 3 requests (max is 2)
      const promises = [
        deduplicator.execute('key1', delayedMock),
        deduplicator.execute('key2', delayedMock),
        deduplicator.execute('key3', delayedMock)
      ];
      
      // Third request should wait
      jest.advanceTimersByTime(25);
      expect(delayedMock).toHaveBeenCalledTimes(2);
      
      // Complete first two requests
      jest.advanceTimersByTime(50);
      
      // Third request should now start
      await Promise.all(promises);
      expect(delayedMock).toHaveBeenCalledTimes(3);
    });

    it('should handle slot availability correctly', async () => {
      const stats = deduplicator.getStats();
      expect(stats.concurrentRequests).toBe(0);
      
      const delayedMock = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 100))
      );
      
      // Start requests
      const promise1 = deduplicator.execute('key1', delayedMock);
      const promise2 = deduplicator.execute('key2', delayedMock);
      
      jest.advanceTimersByTime(10);
      const statsDuring = deduplicator.getStats();
      expect(statsDuring.concurrentRequests).toBe(2);
      
      await Promise.all([promise1, promise2]);
      
      const statsAfter = deduplicator.getStats();
      expect(statsAfter.concurrentRequests).toBe(0);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel pending requests', async () => {
      const delayedMock = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 100))
      );
      
      // Start request
      const promise = deduplicator.execute('cancel-key', delayedMock);
      
      // Cancel it
      const cancelled = deduplicator.cancel('cancel-key');
      expect(cancelled).toBe(true);
      
      // Request should be cancelled
      await expect(promise).rejects.toThrow('Request was cancelled');
    });

    it('should return false for non-existent cancellation', () => {
      const cancelled = deduplicator.cancel('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('Configuration Options', () => {
    it('should respect skipDedup option', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      // Both should execute despite same key
      const promise1 = deduplicator.execute('test-key', mockRequestFn, { skipDedup: true });
      const promise2 = deduplicator.execute('test-key', mockRequestFn, { skipDedup: true });
      
      await Promise.all([promise1, promise2]);
      
      expect(mockRequestFn).toHaveBeenCalledTimes(2);
    });

    it('should respect disabled configuration', async () => {
      const disabledDeduplicator = new RequestDeduplicator({ enabled: false });
      mockRequestFn.mockResolvedValue('result');
      
      const promise1 = disabledDeduplicator.execute('test-key', mockRequestFn);
      const promise2 = disabledDeduplicator.execute('test-key', mockRequestFn);
      
      await Promise.all([promise1, promise2]);
      
      expect(mockRequestFn).toHaveBeenCalledTimes(2); // No deduplication when disabled
    });
  });

  describe('Performance Statistics', () => {
    it('should track deduplication statistics', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      // First request
      await deduplicator.execute('key1', mockRequestFn);
      
      // Deduplicated request
      const promise1 = deduplicator.execute('key2', mockRequestFn);
      const promise2 = deduplicator.execute('key2', mockRequestFn);
      await Promise.all([promise1, promise2]);
      
      const stats = deduplicator.getStats();
      expect(stats.dedupedRequests).toBe(1);
      expect(stats.maxConcurrentRequests).toBeGreaterThan(0);
    });

    it('should calculate deduplication savings', async () => {
      mockRequestFn.mockResolvedValue('result');
      
      // Create multiple deduplicated requests
      const promises = Array.from({ length: 5 }, (_, i) => 
        deduplicator.execute('same-key', mockRequestFn)
      );
      
      await Promise.all(promises);
      
      const stats = deduplicator.getStats();
      expect(stats.dedupSavings).toBeGreaterThan(0);
    });
  });

  describe('Request Batching', () => {
    it('should batch similar requests', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ data: 'batched' })
      });
      
      // Mock global fetch for batch processing
      global.fetch = mockFetch;
      
      const promises = [
        deduplicator.executeBatch('batch1', '/api/test1', {}, 'normal'),
        deduplicator.executeBatch('batch1', '/api/test2', {}, 'high'),
        deduplicator.executeBatch('batch1', '/api/test3', {}, 'low')
      ];
      
      // Advance time to trigger batch processing
      jest.advanceTimersByTime(100);
      
      const results = await Promise.all(promises);
      
      // All requests should return data
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual({ data: 'batched' });
      });
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clear all pending requests and queues', async () => {
      const delayedMock = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 1000))
      );
      
      // Start some requests
      deduplicator.execute('key1', delayedMock);
      deduplicator.execute('key2', delayedMock);
      
      const statsBefore = deduplicator.getStats();
      expect(statsBefore.pendingRequests).toBeGreaterThan(0);
      
      // Clear everything
      deduplicator.clear();
      
      const statsAfter = deduplicator.getStats();
      expect(statsAfter.pendingRequests).toBe(0);
      expect(statsAfter.batchQueues).toBe(0);
    });
  });
});

describe('generateDedupKey', () => {
  it('should generate consistent deduplication keys', () => {
    const key1 = generateDedupKey('GET', '/api/test', { data: 'test' });
    const key2 = generateDedupKey('GET', '/api/test', { data: 'test' });
    
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different bodies', () => {
    const key1 = generateDedupKey('POST', '/api/test', { data: 'test1' });
    const key2 = generateDedupKey('POST', '/api/test', { data: 'test2' });
    
    expect(key1).not.toBe(key2);
  });

  it('should handle missing body', () => {
    const key1 = generateDedupKey('GET', '/api/test');
    const key2 = generateDedupKey('GET', '/api/test', undefined);
    
    expect(key1).toBe(key2);
  });

  it('should include method and URL in key generation', () => {
    const key1 = generateDedupKey('GET', '/api/test1');
    const key2 = generateDedupKey('POST', '/api/test2');
    
    expect(key1).not.toBe(key2);
  });
}); 