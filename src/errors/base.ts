/**
 * Base Error Classes
 * Foundation error classes for the WHOOP SDK
 */

/**
 * Base error class for all WHOOP SDK errors
 */
export abstract class WhoopError extends Error {
  readonly name: string;
  abstract readonly code: string;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Configuration errors
 */
export class WhoopConfigError extends WhoopError {
  readonly code = 'CONFIG_ERROR';
  
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Network and connectivity errors
 */
export class WhoopNetworkError extends WhoopError {
  readonly code = 'NETWORK_ERROR';
  
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Request timeout errors
 */
export class WhoopTimeoutError extends WhoopError {
  readonly code = 'TIMEOUT_ERROR';
  
  constructor(message: string = 'Request timeout', cause?: Error) {
    super(message, cause);
  }
} 