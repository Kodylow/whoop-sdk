/**
 * OAuth Type Definitions
 * OAuth 2.0 related types for authentication
 */

// OAuth Types
export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;
  scopes?: string[];
}

// Scopes
export type WhoopScope = 
  | 'read:recovery'
  | 'read:cycles' 
  | 'read:workout'
  | 'read:sleep'
  | 'read:profile'
  | 'read:body_measurement'
  | 'offline';

export const WHOOP_SCOPES: Record<string, WhoopScope> = {
  RECOVERY: 'read:recovery',
  CYCLES: 'read:cycles',
  WORKOUT: 'read:workout',
  SLEEP: 'read:sleep',
  PROFILE: 'read:profile',
  BODY_MEASUREMENT: 'read:body_measurement',
  OFFLINE: 'offline',
} as const; 