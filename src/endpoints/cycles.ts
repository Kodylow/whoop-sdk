/**
 * Cycles Endpoint Handler
 * Handler for WHOOP cycles API endpoints
 */

import type {
  Cycle,
  PaginatedCycleResponse,
  Recovery,
  PaginationParams,
  RequestOptions,
} from '../types';
import { validateId, validatePaginationParams } from '../utils';
import { BaseEndpoint } from './base';

/**
 * Cycles endpoint handler
 */
export class CyclesEndpoint extends BaseEndpoint {
  /**
   * Get all physiological cycles for a user
   */
  async list(
    params: PaginationParams = {},
    options?: RequestOptions
  ): Promise<PaginatedCycleResponse> {
    validatePaginationParams(params);
    
    return this.http.get<PaginatedCycleResponse>('/v1/cycle', {
      query: params,
      ...options,
    });
  }

  /**
   * Get a specific cycle by ID
   */
  async get(
    cycleId: number | string,
    options?: RequestOptions
  ): Promise<Cycle> {
    const id = validateId(cycleId, 'Cycle ID');
    
    return this.http.get<Cycle>(`/v1/cycle/${id}`, options);
  }

  /**
   * Get recovery for a specific cycle
   */
  async getRecovery(
    cycleId: number | string,
    options?: RequestOptions
  ): Promise<Recovery> {
    const id = validateId(cycleId, 'Cycle ID');
    
    return this.http.get<Recovery>(`/v1/cycle/${id}/recovery`, options);
  }

  /**
   * Iterator for all cycles with automatic pagination
   */
  async *iterate(
    params: Omit<PaginationParams, 'nextToken'> = {},
    options?: RequestOptions
  ): AsyncIterableIterator<Cycle> {
    let nextToken: string | undefined;
    
    do {
      const listParams: PaginationParams = { ...params };
      if (nextToken) {
        listParams.nextToken = nextToken;
      }
      
      const response = await this.list(listParams, options);
      
      for (const cycle of response.records) {
        yield cycle;
      }
      
      nextToken = response.next_token;
    } while (nextToken);
  }
} 