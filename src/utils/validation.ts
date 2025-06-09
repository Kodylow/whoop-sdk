/**
 * Validation Utilities
 * Parameter validation and configuration checking functions
 */

import type { PaginationParams } from '../types';
import { WhoopConfigError } from '../errors';

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): void {
  if (params.limit !== undefined) {
    if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 25) {
      throw new WhoopConfigError('Limit must be an integer between 1 and 25');
    }
  }

  if (params.start && !isValidISODate(params.start)) {
    throw new WhoopConfigError('Start time must be a valid ISO 8601 date string');
  }

  if (params.end && !isValidISODate(params.end)) {
    throw new WhoopConfigError('End time must be a valid ISO 8601 date string');
  }

  if (params.start && params.end && new Date(params.start) > new Date(params.end)) {
    throw new WhoopConfigError('Start time must be before end time');
  }
}

/**
 * Validate ISO 8601 date string
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString === date.toISOString();
}

/**
 * Validate ID parameter
 */
export function validateId(id: number | string, name: string): number {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  
  if (!Number.isInteger(numId) || numId < 1) {
    throw new WhoopConfigError(`${name} must be a positive integer`);
  }
  
  return numId;
} 