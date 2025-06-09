/**
 * Base Type Definitions
 * Common types used throughout the WHOOP SDK
 */

// Base types
export type ScoreState = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
export type TimezoneOffset = string; // Format: '+hh:mm', '-hh:mm', or 'Z'

// Pagination
export interface PaginationParams {
  limit?: number;
  start?: string;
  end?: string;
  nextToken?: string;
}

export interface PaginatedResponse<T> {
  records: T[];
  next_token?: string;
}

// Request Options
export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  retries?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  nextToken?: string;
  skipCache?: boolean;
  cacheTtl?: number;
}

// API Error Types
export interface APIError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, any>;
} 