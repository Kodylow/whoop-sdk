/**
 * Workouts Endpoint Handler
 * Handler for WHOOP workouts API endpoints
 */

import type {
  Workout,
  PaginatedWorkoutResponse,
  PaginationParams,
  RequestOptions,
} from '../types';
import { validateId, validatePaginationParams } from '../utils';
import { BaseEndpoint } from './base';

/**
 * Workouts endpoint handler
 */
export class WorkoutsEndpoint extends BaseEndpoint {
  /**
   * Get all workouts for a user
   */
  async list(
    params: PaginationParams = {},
    options?: RequestOptions
  ): Promise<PaginatedWorkoutResponse> {
    validatePaginationParams(params);
    
    return this.http.get<PaginatedWorkoutResponse>('/v1/activity/workout', {
      query: params,
      ...options,
    });
  }

  /**
   * Get a specific workout by ID
   */
  async getById(
    workoutId: number | string,
    options?: RequestOptions
  ): Promise<Workout> {
    const id = validateId(workoutId, 'Workout ID');
    
    return this.http.get<Workout>(`/v1/activity/workout/${id}`, options);
  }

  /**
   * Iterator for all workouts with automatic pagination
   */
  async *iterate(
    params: Omit<PaginationParams, 'nextToken'> = {},
    options?: RequestOptions
  ): AsyncIterableIterator<Workout> {
    let nextToken: string | undefined;
    
    do {
      const listParams: PaginationParams = { ...params };
      if (nextToken) {
        listParams.nextToken = nextToken;
      }
      
      const response = await this.list(listParams, options);
      
      for (const workout of response.records) {
        yield workout;
      }
      
      nextToken = response.next_token;
    } while (nextToken);
  }
} 