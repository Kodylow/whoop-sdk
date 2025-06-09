/**
 * Retry Utilities
 * Retry logic with exponential backoff and error handling
 */

import { getRetryInfo } from '../errors';

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    signal
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable
      const retryInfo = getRetryInfo(error);
      if (!retryInfo.canRetry) {
        break;
      }

      // Calculate delay with exponential backoff
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
      const finalDelay = Math.min(
        retryInfo.delayMs || jitteredDelay,
        maxDelayMs
      );

      await sleep(finalDelay);
    }
  }

  throw lastError!;
} 