/**
 * Base Endpoint Handler
 * Foundation class for all WHOOP API endpoint handlers
 */

import { WhoopHttpClient } from '../client/http';

/**
 * Base endpoint handler
 */
export abstract class BaseEndpoint {
  constructor(protected readonly http: WhoopHttpClient) {}
} 