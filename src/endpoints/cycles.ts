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
  CurrentRecoveryResult,
  WhoopQueryParams,
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
  async getById(
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
   * Get recovery for a specific cycle, returning null if not found
   * This is safer than getRecovery() which throws on 404
   */
  async getRecoverySafe(
    cycleId: number | string,
    options?: RequestOptions
  ): Promise<Recovery | null> {
    try {
      return await this.getRecovery(cycleId, options);
    } catch (error: any) {
      // Return null for 404 (no recovery data), but re-throw other errors
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get the user's current recovery score following the official pattern
   * This implements the two-step process from Whoop's documentation:
   * 1. Get the current (latest) cycle
   * 2. Get recovery for that cycle if it exists
   * 
   * Returns comprehensive status information to handle all edge cases:
   * - New users who are calibrating
   * - Cycles without recovery data
   * - Pending vs scored vs unscorable states
   */
  async getCurrentRecovery(options?: RequestOptions): Promise<CurrentRecoveryResult> {
    // Step 1: Get the user's current (latest) cycle
    const cyclesResponse = await this.list({ limit: 1 }, options);
    
    if (!cyclesResponse.records || cyclesResponse.records.length === 0) {
      throw new Error('No cycles found for user. This may be a new user who hasn\'t started tracking yet.');
    }

    const currentCycle = cyclesResponse.records[0]!; // Safe because we checked length above

    // Step 2: Get recovery for the current cycle (if it exists)
    const recovery = await this.getRecoverySafe(currentCycle.id, options);

    // Determine status flags for easy consumption
    const status = {
      hasRecovery: recovery !== null,
      isCalibrating: recovery?.score?.user_calibrating ?? false,
      isScored: recovery?.score_state === 'SCORED',
      isPending: recovery?.score_state === 'PENDING_SCORE',
      isUnscorable: recovery?.score_state === 'UNSCORABLE',
    };

    return {
      cycle: currentCycle,
      recovery,
      status,
    };
  }

  /**
   * Get recent cycles with their recovery data
   * This is a convenience method that fetches cycles and their recovery data in parallel
   */
  async getRecentCyclesWithRecovery(
    params: { 
      limit?: number;
      days?: number; // Alternative to start/end dates
      start?: string;
      end?: string;
    } = {},
    options?: RequestOptions
  ): Promise<Array<{ cycle: Cycle; recovery: Recovery | null }>> {
    const { limit = 7, days, start, end } = params;
    
    let queryParams: WhoopQueryParams = { limit };
    
    // If days is specified, calculate start date
    if (days && !start && !end) {
      const now = new Date();
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      queryParams.start = startDate.toISOString();
      queryParams.end = now.toISOString();
    } else if (start || end) {
      if (start) queryParams.start = start;
      if (end) queryParams.end = end;
    }

    const cyclesResponse = await this.list(queryParams, options);
    
    // Fetch recovery data for all cycles in parallel
    const cyclesWithRecovery = await Promise.all(
      cyclesResponse.records.map(async (cycle: Cycle) => {
        const recovery = await this.getRecoverySafe(cycle.id, options);
        return { cycle, recovery };
      })
    );

    return cyclesWithRecovery;
  }

  /**
   * Get cycles within a date range with helper method
   */
  async getCyclesInDateRange(
    dateRange: { start: string; end: string },
    options?: RequestOptions
  ): Promise<PaginatedCycleResponse> {
    return this.list({
      start: dateRange.start,
      end: dateRange.end,
      limit: 50, // Max limit for efficiency
    }, options);
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

  /**
   * Iterator that yields cycles with their recovery data
   * This is more expensive than iterate() but provides complete data
   */
  async *iterateWithRecovery(
    params: Omit<PaginationParams, 'nextToken'> = {},
    options?: RequestOptions
  ): AsyncIterableIterator<{ cycle: Cycle; recovery: Recovery | null }> {
    for await (const cycle of this.iterate(params, options)) {
      const recovery = await this.getRecoverySafe(cycle.id, options);
      yield { cycle, recovery };
    }
  }
} 