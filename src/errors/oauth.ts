/**
 * OAuth Error Classes
 * Error classes for OAuth 2.0 authentication flow
 */

import { WhoopError } from './base';

/**
 * OAuth-specific errors
 */
export class WhoopOAuthError extends WhoopError {
  readonly code = 'OAUTH_ERROR';
  
  constructor(
    message: string,
    public readonly oauthError?: string,
    public readonly oauthErrorDescription?: string,
    cause?: Error
  ) {
    super(message, cause);
  }
} 