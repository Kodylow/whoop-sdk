/**
 * API Response Type Definitions
 * WHOOP API response types for all endpoints
 */

import type { ScoreState, TimezoneOffset, PaginatedResponse } from './base';

// Cycle Types
export interface CycleScore {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface Cycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end?: string;
  timezone_offset: TimezoneOffset;
  score_state: ScoreState;
  score?: CycleScore;
}

export interface PaginatedCycleResponse extends PaginatedResponse<Cycle> {}

// Recovery Types
export interface RecoveryScore {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage?: number;
  skin_temp_celsius?: number;
}

export interface Recovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: ScoreState;
  score?: RecoveryScore;
}

export interface PaginatedRecoveryResponse extends PaginatedResponse<Recovery> {}

// Sleep Types
export interface SleepNeeded {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
}

export interface SleepStageSummary {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

export interface SleepScore {
  stage_summary: SleepStageSummary;
  sleep_needed: SleepNeeded;
  respiratory_rate?: number;
  sleep_performance_percentage?: number;
  sleep_consistency_percentage?: number;
  sleep_efficiency_percentage?: number;
}

export interface Sleep {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: TimezoneOffset;
  nap: boolean;
  score_state: ScoreState;
  score?: SleepScore;
}

export interface PaginatedSleepResponse extends PaginatedResponse<Sleep> {}

// User Types
export interface UserBodyMeasurement {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export interface UserBasicProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

// Workout Types
export interface ZoneDuration {
  zone_zero_milli?: number;
  zone_one_milli?: number;
  zone_two_milli?: number;
  zone_three_milli?: number;
  zone_four_milli?: number;
  zone_five_milli?: number;
}

export interface WorkoutScore {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_duration: ZoneDuration;
}

export interface Workout {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: TimezoneOffset;
  sport_id: number;
  score_state: ScoreState;
  score?: WorkoutScore;
}

export interface PaginatedWorkoutResponse extends PaginatedResponse<Workout> {}

// Convenience Types for Common Use Cases
export interface CurrentRecoveryResult {
  /** The current cycle data */
  cycle: Cycle;
  /** Recovery data if available */
  recovery: Recovery | null;
  /** Helper flags for easy checking */
  status: {
    /** Whether the user is still calibrating (new users) */
    isCalibrating: boolean;
    /** Whether recovery data is available */
    hasRecovery: boolean;
    /** Whether the recovery score is fully calculated */
    isScored: boolean;
    /** Whether we're still waiting for the score */
    isPending: boolean;
    /** Whether the cycle cannot be scored */
    isUnscorable: boolean;
  };
}

export interface UserSummary {
  profile: UserBasicProfile;
  bodyMeasurement?: UserBodyMeasurement;
  /** Latest cycle if available */
  currentCycle?: Cycle;
  /** Current recovery if available */
  currentRecovery?: Recovery;
}

// Date range helpers
export interface DateRange {
  start: string; // ISO 8601 format
  end: string;   // ISO 8601 format
}

// Common query params with better defaults
export interface WhoopQueryParams {
  /** Limit number of results (1-50, default: 25) */
  limit?: number;
  /** Start date in ISO 8601 format */
  start?: string;
  /** End date in ISO 8601 format */
  end?: string;
  /** Next page token for pagination */
  nextToken?: string;
} 