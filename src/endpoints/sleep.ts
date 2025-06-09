/**
 * Sleep Endpoint Handler
 * Handler for WHOOP sleep API endpoints
 */

import type {
  Sleep,
  PaginatedSleepResponse,
  PaginationParams,
  RequestOptions,
} from '../types';
import { validateId, validatePaginationParams } from '../utils';
import { BaseEndpoint } from './base';

/**
 * Sleep endpoint handler
 */
export class SleepEndpoint extends BaseEndpoint {
  /**
   * Get all sleeps for a user
   */
  async list(
    params: PaginationParams = {},
    options?: RequestOptions
  ): Promise<PaginatedSleepResponse> {
    validatePaginationParams(params);
    
    return this.http.get<PaginatedSleepResponse>('/v1/activity/sleep', {
      query: params,
      ...options,
    });
  }

  /**
   * Get a specific sleep by ID
   */
  async get(
    sleepId: number | string,
    options?: RequestOptions
  ): Promise<Sleep> {
    const id = validateId(sleepId, 'Sleep ID');
    
    return this.http.get<Sleep>(`/v1/activity/sleep/${id}`, options);
  }

  /**
   * Iterator for all sleeps with automatic pagination
   */
  async *iterate(
    params: Omit<PaginationParams, 'nextToken'> = {},
    options?: RequestOptions
  ): AsyncIterableIterator<Sleep> {
    let nextToken: string | undefined;
    
    do {
      const listParams: PaginationParams = { ...params };
      if (nextToken) {
        listParams.nextToken = nextToken;
      }
      
      const response = await this.list(listParams, options);
      
      for (const sleep of response.records) {
        yield sleep;
      }
      
      nextToken = response.next_token;
    } while (nextToken);
  }
} 