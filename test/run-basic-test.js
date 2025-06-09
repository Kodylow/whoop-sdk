#!/usr/bin/env node
/**
 * Basic WHOOP SDK Test Runner
 * A simple test script to validate the performance optimizations work correctly
 */

const { WhoopCache, RequestDeduplicator, generateCacheKey, generateDedupKey } = require('../dist/utils');

console.log('🩺 WHOOP SDK Basic Test Runner');
console.log('===============================\n');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  totalTests++;
  try {
    console.log(`🧪 Testing: ${name}`);
    testFn();
    passedTests++;
    console.log(`✅ ${name} - PASSED\n`);
  } catch (error) {
    failedTests++;
    console.error(`❌ ${name} - FAILED: ${error.message}\n`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    }
  };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cache Performance Tests
test('Cache Basic Operations', () => {
  const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
  
  // Set and get
  cache.set('test-key', { data: 'test-value' });
  const result = cache.get('test-key');
  
  expect(result.data).toBe('test-value');
  expect(cache.has('test-key')).toBe(true);
  expect(cache.has('non-existent')).toBe(false);
});

test('Cache Statistics', () => {
  const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
  
  // Generate some cache hits and misses
  cache.set('key1', 'value1');
  cache.get('key1'); // Hit
  cache.get('key2'); // Miss
  cache.get('key1'); // Hit
  
  const stats = cache.getStats();
  expect(stats.hits).toBe(2);
  expect(stats.misses).toBe(1);
  expect(stats.hitRate).toBeGreaterThan(50);
});

test('Cache Key Generation', () => {
  const key1 = generateCacheKey('GET', '/api/test', { param: 'value' });
  const key2 = generateCacheKey('GET', '/api/test', { param: 'value' });
  const key3 = generateCacheKey('GET', '/api/test', { param: 'different' });
  
  expect(key1).toBe(key2); // Same parameters should generate same key
  expect(key1 !== key3).toBe(true); // Different parameters should generate different keys
  expect(key1.startsWith('whoop:')).toBe(true);
});

// Deduplication Tests
test('Deduplication Basic Operations', async () => {
  const deduplicator = new RequestDeduplicator({ enabled: true, windowMs: 1000 });
  
  let callCount = 0;
  const mockRequest = async () => {
    callCount++;
    await sleep(10);
    return { result: 'success', callNumber: callCount };
  };
  
  // Execute two identical requests simultaneously
  const promise1 = deduplicator.execute('test-key', mockRequest);
  const promise2 = deduplicator.execute('test-key', mockRequest);
  
  const [result1, result2] = await Promise.all([promise1, promise2]);
  
  // Both should return the same result (deduplication working)
  expect(result1.callNumber).toBe(1);
  expect(result2.callNumber).toBe(1);
  expect(callCount).toBe(1); // Only one actual call should be made
});

test('Deduplication Statistics', async () => {
  const deduplicator = new RequestDeduplicator({ enabled: true, windowMs: 1000 });
  
  const mockRequest = async () => {
    await sleep(5);
    return 'result';
  };
  
  // Execute some requests
  await deduplicator.execute('key1', mockRequest);
  
  const promise1 = deduplicator.execute('key2', mockRequest);
  const promise2 = deduplicator.execute('key2', mockRequest); // This should be deduplicated
  
  await Promise.all([promise1, promise2]);
  
  const stats = deduplicator.getStats();
  expect(stats.dedupedRequests).toBeGreaterThan(0);
});

test('Deduplication Key Generation', () => {
  const key1 = generateDedupKey('POST', '/api/test', { data: 'payload' });
  const key2 = generateDedupKey('POST', '/api/test', { data: 'payload' });
  const key3 = generateDedupKey('POST', '/api/test', { data: 'different' });
  
  expect(key1).toBe(key2); // Same parameters should generate same key
  expect(key1 !== key3).toBe(true); // Different parameters should generate different keys
});

// Performance Benchmarks
test('Cache Performance Benchmark', () => {
  const cache = new WhoopCache({ ttl: 10000, maxSize: 1000 });
  const testData = { large: 'x'.repeat(1000) };
  
  cache.set('perf-test', testData);
  
  // Measure cache access time
  const iterations = 1000;
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    cache.get('perf-test');
  }
  
  const end = Date.now();
  const avgTime = (end - start) / iterations;
  
  console.log(`   ⚡ Average cache access time: ${avgTime.toFixed(3)}ms`);
  expect(avgTime).toBeLessThan(1); // Should be very fast
});

test('Key Generation Performance Benchmark', () => {
  const iterations = 10000;
  
  // Test cache key generation
  const start1 = Date.now();
  for (let i = 0; i < iterations; i++) {
    generateCacheKey('GET', `/api/test/${i}`, { param: i });
  }
  const end1 = Date.now();
  const cacheKeyAvg = (end1 - start1) / iterations;
  
  // Test dedup key generation
  const start2 = Date.now();
  for (let i = 0; i < iterations; i++) {
    generateDedupKey('POST', `/api/test/${i}`, { data: `payload-${i}` });
  }
  const end2 = Date.now();
  const dedupKeyAvg = (end2 - start2) / iterations;
  
  console.log(`   ⚡ Cache key generation: ${cacheKeyAvg.toFixed(4)}ms per key`);
  console.log(`   ⚡ Dedup key generation: ${dedupKeyAvg.toFixed(4)}ms per key`);
  
  expect(cacheKeyAvg).toBeLessThan(0.1);
  expect(dedupKeyAvg).toBeLessThan(0.1);
});

// Integration Test
test('Combined Cache and Deduplication', async () => {
  const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
  const deduplicator = new RequestDeduplicator({ enabled: true, windowMs: 200 });
  
  let apiCallCount = 0;
  const mockApiCall = async (id) => {
    apiCallCount++;
    await sleep(10);
    return { id, data: `result-${id}`, timestamp: Date.now() };
  };
  
  const performRequest = async (id) => {
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
  
  // Make multiple requests with some duplicates
  const numRequests = 50;
  const numUniqueIds = 10;
  
  const promises = Array.from({ length: numRequests }, (_, i) => 
    performRequest(i % numUniqueIds)
  );
  
  const start = Date.now();
  const results = await Promise.all(promises);
  const end = Date.now();
  
  const totalTime = end - start;
  const avgTime = totalTime / numRequests;
  
  console.log(`   ⚡ Processed ${numRequests} requests in ${totalTime}ms (${avgTime.toFixed(2)}ms avg)`);
  console.log(`   📊 API calls saved: ${numRequests - apiCallCount} (${((1 - apiCallCount/numRequests) * 100).toFixed(1)}%)`);
  
  expect(results.length).toBe(numRequests);
  expect(apiCallCount).toBeLessThan(numRequests); // Should have saved API calls
  expect(avgTime).toBeLessThan(10); // Should be fast with optimizations
});

// Run all tests
async function runTests() {
  console.log('🚀 Starting performance optimization tests...\n');
  
  const startTime = Date.now();
  
  // Note: We need to run async tests sequentially to avoid interference
  await new Promise(resolve => {
    // Run synchronous tests first
    test('Cache Basic Operations', () => {
      const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
      cache.set('test-key', { data: 'test-value' });
      const result = cache.get('test-key');
      expect(result.data).toBe('test-value');
    });
    
    test('Cache Statistics', () => {
      const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');
      cache.get('key1');
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
    
    test('Cache Key Generation', () => {
      const key1 = generateCacheKey('GET', '/api/test', { param: 'value' });
      const key2 = generateCacheKey('GET', '/api/test', { param: 'value' });
      expect(key1).toBe(key2);
    });
    
    test('Cache Performance Benchmark', () => {
      const cache = new WhoopCache({ ttl: 10000, maxSize: 1000 });
      cache.set('perf-test', { data: 'test' });
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.get('perf-test');
      }
      const avgTime = (Date.now() - start) / 1000;
      console.log(`   ⚡ Average cache access time: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(1);
    });
    
    test('Key Generation Performance Benchmark', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        generateCacheKey('GET', `/api/test/${i}`, { param: i });
      }
      const avgTime = (Date.now() - start) / 1000;
      console.log(`   ⚡ Key generation: ${avgTime.toFixed(4)}ms per key`);
      expect(avgTime).toBeLessThan(0.1);
    });
    
    resolve();
  });
  
  // Run async tests
  await test('Deduplication Basic Operations', async () => {
    const deduplicator = new RequestDeduplicator({ enabled: true, windowMs: 1000 });
    let callCount = 0;
    const mockRequest = async () => {
      callCount++;
      await sleep(10);
      return { callNumber: callCount };
    };
    
    const [result1, result2] = await Promise.all([
      deduplicator.execute('test-key', mockRequest),
      deduplicator.execute('test-key', mockRequest)
    ]);
    
    expect(result1.callNumber).toBe(1);
    expect(result2.callNumber).toBe(1);
    expect(callCount).toBe(1);
  });
  
  await test('Combined Optimization Test', async () => {
    const cache = new WhoopCache({ ttl: 5000, maxSize: 100 });
    const deduplicator = new RequestDeduplicator({ enabled: true, windowMs: 200 });
    
    let apiCallCount = 0;
    const mockApiCall = async (id) => {
      apiCallCount++;
      await sleep(5);
      return { id, data: `result-${id}` };
    };
    
    const performRequest = async (id) => {
      const cacheKey = generateCacheKey('GET', `/api/test/${id}`);
      const cached = cache.get(cacheKey);
      if (cached) return cached;
      
      const result = await deduplicator.execute(
        generateDedupKey('GET', `/api/test/${id}`), 
        () => mockApiCall(id)
      );
      cache.set(cacheKey, result);
      return result;
    };
    
    const promises = Array.from({ length: 20 }, (_, i) => performRequest(i % 5));
    const results = await Promise.all(promises);
    
    console.log(`   📊 API calls saved: ${20 - apiCallCount} out of 20 requests`);
    expect(results.length).toBe(20);
    expect(apiCallCount).toBeLessThan(20);
  });
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log('='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Time: ${totalTime}ms`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Your WHOOP SDK performance optimizations are working perfectly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Check if we're being run directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test run failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests }; 