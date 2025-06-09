/**
 * Recovery Endpoint Handler
 * Handler for WHOOP recovery API endpoints
 */

import type {
  Recovery,
  PaginatedRecoveryResponse,
  PaginationParams,
  RequestOptions,
} from '../types';
import { validatePaginationParams } from '../utils';
import { BaseEndpoint } from './base';

/**
 * Recovery endpoint handler
 */
export class RecoveryEndpoint extends BaseEndpoint {
  /**
   * Get all recoveries for a user
   */
  async list(
    params: PaginationParams = {},
    options?: RequestOptions
  ): Promise<PaginatedRecoveryResponse> {
    validatePaginationParams(params);
    
    return this.http.get<PaginatedRecoveryResponse>('/v1/recovery', {
      query: params,
      ...options,
    });
  }

  /**
   * Iterator for all recoveries with automatic pagination
   */
  async *iterate(
    params: Omit<PaginationParams, 'nextToken'> = {},
    options?: RequestOptions
  ): AsyncIterableIterator<Recovery> {
    let nextToken: string | undefined;
    
    do {
      const listParams: PaginationParams = { ...params };
      if (nextToken) {
        listParams.nextToken = nextToken;
      }
      
      const response = await this.list(listParams, options);
      
      for (const recovery of response.data) {
        yield recovery;
      }
      
      nextToken = response.next_token;
    } while (nextToken);
  }
} 