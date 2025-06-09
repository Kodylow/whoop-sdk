/**
 * API Error Classes
 * Error classes for HTTP responses and API-specific errors
 */

import { WhoopError } from './base';

/**
 * API-related errors from WHOOP service
 */
export class WhoopAPIError extends WhoopError {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, cause);
  }

  static fromResponse(status: number, body: any): WhoopAPIError {
    const message = body?.message || body?.error_description || `HTTP ${status} Error`;
    const code = body?.error || body?.code || 'API_ERROR';
    const details = typeof body === 'object' ? body : undefined;
    
    return new WhoopAPIError(status, code, message, details);
  }

  /**
   * Check if error is a specific HTTP status
   */
  is(status: number): boolean {
    return this.status === status;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Authentication and authorization errors
 */
export class WhoopAuthError extends WhoopAPIError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(401, 'AUTH_ERROR', message, details, cause);
  }
}

/**
 * Rate limiting errors
 */
export class WhoopRateLimitError extends WhoopAPIError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfter?: number,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(429, 'RATE_LIMIT_ERROR', message, details, cause);
  }
}

/**
 * Resource not found errors
 */
export class WhoopNotFoundError extends WhoopAPIError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>, cause?: Error) {
    super(404, 'NOT_FOUND', message, details, cause);
  }
}

/**
 * Request validation errors
 */
export class WhoopValidationError extends WhoopAPIError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(400, 'VALIDATION_ERROR', message, details, cause);
  }
} 