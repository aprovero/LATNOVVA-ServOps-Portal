/**
 * Attendance V2 Client Architecture Types
 * Clean forward-only models for Attendance V2 PWA and offline client engine.
 */

export type AttendanceEventType = 'CLOCK_IN' | 'CLOCK_OUT';
export type AttendanceWorkType = 'ON_SITE' | 'HOME_OFFICE';
export type GeofenceStatus = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN' | 'BYPASS_AUTHORIZED' | 'NOT_APPLICABLE';

export type EventQueueStatus = 
  | 'QUEUED'
  | 'SYNCING'
  | 'ACKED'
  | 'RETRYABLE'
  | 'CONFLICT'
  | 'REJECTED'
  | 'DEPENDENCY_FAILED'
  | 'MEDIA_PENDING'
  | 'COMPLETE';

export type ActiveShiftState = 'ACTIVE' | 'CLOSED_LOCAL' | 'RETIRED';

export type MediaSyncStatus = 
  | 'PENDING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'FAILED_RETRYABLE'
  | 'REJECTED';

/**
 * Full 29-field client evidence envelope
 */
export interface AttendanceEvidenceEnvelope {
  event_id: string;
  shift_id: string;
  personnel_id: string;
  project_id: string;
  event_type: AttendanceEventType;
  work_type: AttendanceWorkType;
  device_event_timestamp: string;
  timezone_offset_minutes: number;
  device_id: string;
  device_platform: string;
  client_app_version: string;
  client_release_id: number;
  client_commit_hash: string;
  attendance_protocol_version: number;
  created_offline: boolean;
  offline_lease_id: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  gps_verified: boolean;
  geofence_status: GeofenceStatus;
  geofence_distance_meters: number | null;
  geofence_version_id: string | null;
  face_verified: boolean;
  face_bypass_reason: string | null;
  is_manual_adjustment: boolean;
  adjustment_reason: string | null;
  reported_departure_timestamp: string | null;
  worker_explanation: string | null;
}

/**
 * Queued physical event in IndexedDB
 */
export interface QueuedAttendanceEvent extends AttendanceEvidenceEnvelope {
  causal_sequence: number;
  sync_status: EventQueueStatus;
  retry_count: number;
  last_attempted_at?: string;
  error_message?: string;
  server_receipt_at?: string;
  created_at: string;
}

/**
 * Durable active shift record in IndexedDB
 */
export interface DurableActiveShift {
  shift_id: string;
  clock_in_event_id: string;
  personnel_id: string;
  project_id: string;
  work_type: AttendanceWorkType;
  started_at: string;
  timezone_offset_minutes: number;
  created_offline: boolean;
  offline_lease_id?: string | null;
  geofence_version_id?: string | null;
  protocol_version: number;
  client_release_id: number;
  state: ActiveShiftState;
  clock_out_event_id?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Offline lease record in IndexedDB
 */
export interface CachedOfflineLease {
  lease_id: string;
  auth_user_id: string;
  personnel_id: string;
  subsidiary: string;
  valid_from: string;
  valid_until: string;
  attendance_protocol_version: number;
  client_release_id: number;
  client_app_version: string;
  device_id: string;
  is_revoked: boolean;
  cached_at: string;
  scopes: Array<{
    project_id: string;
    project_name?: string;
    geofence_version_id: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    accuracy_threshold_meters: number;
    warehouse_bypass_allowed: boolean;
    home_office_allowed: boolean;
    secondary_locations?: Array<{
      location_id: string;
      location_name: string;
      latitude: number;
      longitude: number;
      radius_meters: number;
      accuracy_threshold_meters: number;
    }>;
  }>;
}

/**
 * Cached project geofence version in IndexedDB
 */
export interface CachedProjectGeofence {
  project_id: string;
  geofence_version_id: string;
  version_number: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  accuracy_threshold_meters: number;
  warehouse_bypass_allowed: boolean;
  home_office_allowed: boolean;
  effective_from: string;
  cached_at: string;
}

/**
 * Event-bound media blob in IndexedDB
 */
export interface CachedMediaBlob {
  media_id: string;
  event_id: string;
  shift_id: string;
  personnel_id: string;
  subsidiary: string;
  media_type: 'SELFIE';
  data_base64: string;
  mime_type: string;
  byte_size: number;
  sha256_hash: string;
  sync_status: MediaSyncStatus;
  remote_storage_path?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Attendance V2 Client Config
 */
export interface AttendanceV2ClientConfig {
  protocol_version: number;
  client_release_id: number;
  client_app_version: string;
  client_commit_hash: string;
  device_id: string;
  device_platform: string;
}
