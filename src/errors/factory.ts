/**
 * Error Factory and Utilities
 * Factory functions and utilities for creating and handling errors
 */

import { 
  WhoopError, 
  WhoopNetworkError, 
  WhoopTimeoutError 
} from './base';
import {
  WhoopAPIError,
  WhoopAuthError,
  WhoopRateLimitError,
  WhoopNotFoundError,
  WhoopValidationError
} from './api';
import { WhoopOAuthError } from './oauth';

/**
 * Error factory to create appropriate error types based on HTTP status
 */
export class ErrorFactory {
  static fromHttpStatus(status: number, body: any, cause?: Error): WhoopAPIError {
    switch (status) {
      case 400:
        return new WhoopValidationError(
          body?.message || 'Bad Request',
          body,
          cause
        );
      
      case 401:
        return new WhoopAuthError(
          body?.message || 'Unauthorized',
          body,
          cause
        );
      
      case 404:
        return new WhoopNotFoundError(
          body?.message || 'Not Found',
          body,
          cause
        );
      
      case 429:
        const retryAfter = body?.retry_after || body?.['retry-after'];
        return new WhoopRateLimitError(
          body?.message || 'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          body,
          cause
        );
      
      default:
        return WhoopAPIError.fromResponse(status, body);
    }
  }

  static fromNetworkError(error: Error): WhoopNetworkError {
    return new WhoopNetworkError(
      `Network error: ${error.message}`,
      error
    );
  }

  static fromTimeout(): WhoopTimeoutError {
    return new WhoopTimeoutError();
  }
}

/**
 * Type guard to check if an error is a WHOOP SDK error
 */
export function isWhoopError(error: unknown): error is WhoopError {
  return error instanceof WhoopError;
}

/**
 * Type guard to check if an error is a WHOOP API error
 */
export function isWhoopAPIError(error: unknown): error is WhoopAPIError {
  return error instanceof WhoopAPIError;
}

/**
 * Type guard to check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is WhoopRateLimitError {
  return error instanceof WhoopRateLimitError;
}

/**
 * Type guard to check if an error is an auth error
 */
export function isAuthError(error: unknown): error is WhoopAuthError {
  return error instanceof WhoopAuthError;
}

/**
 * Type guard to check if an error is an OAuth error
 */
export function isOAuthError(error: unknown): error is WhoopOAuthError {
  return error instanceof WhoopOAuthError;
}

/**
 * Extract retry information from error
 */
export function getRetryInfo(error: unknown): { canRetry: boolean; delayMs?: number } {
  if (isRateLimitError(error)) {
    return {
      canRetry: true,
      delayMs: error.retryAfter ? error.retryAfter * 1000 : 60000, // Default 1 minute
    };
  }

  if (isWhoopAPIError(error)) {
    // Retry on server errors but not client errors
    return {
      canRetry: error.isServerError(),
      delayMs: 1000, // 1 second default delay
    };
  }

  if (error instanceof WhoopNetworkError || error instanceof WhoopTimeoutError) {
    return {
      canRetry: true,
      delayMs: 1000,
    };
  }

  return { canRetry: false };
}

/**
 * Create error from HTTP response
 */
export async function createErrorFromResponse(response: Response): Promise<WhoopAPIError> {
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = { message: response.statusText };
  }
  
  return ErrorFactory.fromHttpStatus(response.status, body);
}

/**
 * Format error message for logging
 */
export function formatErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
} 