/**
 * Attendance V2 Client Engine
 * Implements transactional client punch generation, offline queueing,
 * active shift lifecycle, timezone reconstruction, and replay engine.
 */

import {
  AttendanceEvidenceEnvelope,
  QueuedAttendanceEvent,
  DurableActiveShift,
  AttendanceV2ClientConfig,
  AttendanceWorkType,
  GeofenceStatus
} from './types';
import { AttendanceV2Database, attendanceV2Db } from './db';

export interface TransportClient {
  recordAttendanceEvent(event: AttendanceEvidenceEnvelope): Promise<{
    success: boolean;
    status: string;
    event_id?: string;
    shift_id?: string;
    error?: string;
  }>;
  syncAttendanceEvents(events: AttendanceEvidenceEnvelope[]): Promise<
    Array<{
      event_id: string;
      shift_id: string;
      event_type: string;
      outcome: {
        success: boolean;
        status: string;
        error?: string;
      };
    }>
  >;
}

export class AttendanceV2ClientEngine {
  private db: AttendanceV2Database;
  private config: AttendanceV2ClientConfig;
  private transport?: TransportClient;

  constructor(
    config: AttendanceV2ClientConfig,
    db: AttendanceV2Database = attendanceV2Db,
    transport?: TransportClient
  ) {
    this.config = config;
    this.db = db;
    this.transport = transport;
  }

  public setTransport(transport: TransportClient) {
    this.transport = transport;
  }

  /**
   * Captures current timezone offset in minutes as LOCAL - UTC.
   * e.g. Mexico City (UTC-6) -> -360
   */
  public getLocalTimezoneOffsetMinutes(): number {
    return -new Date().getTimezoneOffset();
  }

  /**
   * Reconstructs user-facing local wall-clock time from UTC timestamp and offset.
   * Returns ISO string formatted to local wall-clock representation.
   */
  public reconstructLocalTimestamp(utcIsoString: string, offsetMinutes: number): string {
    const utcDate = new Date(utcIsoString);
    const localMs = utcDate.getTime() + offsetMinutes * 60 * 1000;
    const localDate = new Date(localMs);
    return localDate.toISOString().replace('Z', '') + (offsetMinutes >= 0 ? '+' : '-') + 
      String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0') + ':' + 
      String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  }

  /**
   * Checks if an error is a genuine network/transport disconnection.
   * HTTP 401, 403, 409, 422, etc. are business/authorization failures, NOT offline conditions.
   */
  public isGenuineNetworkFailure(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    const isNetwork = 
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('networkerror') ||
      msg.includes('networkunreachable') ||
      msg.includes('econnrefused') ||
      msg.includes('connection timed out') ||
      msg.includes('timeout') ||
      msg.includes('aborterror') ||
      err.name === 'AbortError' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND';
    return isNetwork;
  }

  /**
   * Clock-In Flow
   * Generates stable shift_id and event_id before transmission.
   * Creates durable active shift record.
   */
  public async clockIn(params: {
    personnel_id: string;
    project_id: string;
    work_type: AttendanceWorkType;
    latitude?: number | null;
    longitude?: number | null;
    accuracy_meters?: number | null;
    gps_verified: boolean;
    geofence_status: GeofenceStatus;
    geofence_distance_meters?: number | null;
    geofence_version_id?: string | null;
    face_verified: boolean;
    face_bypass_reason?: string | null;
    force_offline?: boolean;
  }): Promise<{
    success: boolean;
    status: string;
    shift_id: string;
    event_id: string;
    created_offline: boolean;
    error?: string;
  }> {
    // 1. Check if user already has an active shift
    const existingActive = await this.db.getCurrentActiveShiftForPersonnel(params.personnel_id);
    if (existingActive) {
      return {
        success: false,
        status: 'ACTIVE_SHIFT_CONFLICT',
        shift_id: existingActive.shift_id,
        event_id: existingActive.clock_in_event_id,
        created_offline: false,
        error: 'Personnel already has an active open shift.'
      };
    }

    // 2. Generate stable UUIDs before network call
    const shiftId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const nowUtc = new Date().toISOString();
    const tzOffset = this.getLocalTimezoneOffsetMinutes();

    let createdOffline = false;
    let offlineLeaseId: string | null = null;
    let geofenceVersionId = params.geofence_version_id || null;

    // 3. Check offline mode / lease requirement
    const isBrowserOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
    if (params.force_offline || isBrowserOffline) {
      createdOffline = true;
      const lease = await this.db.getLatestOfflineLeaseForPersonnel(params.personnel_id);
      if (!lease) {
        return {
          success: false,
          status: 'REJECTED',
          shift_id: shiftId,
          event_id: eventId,
          created_offline: true,
          error: 'No active offline lease available for offline Clock-In.'
        };
      }
      offlineLeaseId = lease.lease_id;

      // Validate project scope
      const scope = lease.scopes.find((s) => s.project_id === params.project_id);
      if (!scope) {
        return {
          success: false,
          status: 'REJECTED',
          shift_id: shiftId,
          event_id: eventId,
          created_offline: true,
          error: 'Target project is not scoped in current offline lease.'
        };
      }
      geofenceVersionId = scope.geofence_version_id;
    }

    // 4. Construct 29-field evidence envelope
    const envelope: AttendanceEvidenceEnvelope = {
      event_id: eventId,
      shift_id: shiftId,
      personnel_id: params.personnel_id,
      project_id: params.project_id,
      event_type: 'CLOCK_IN',
      work_type: params.work_type,
      device_event_timestamp: nowUtc,
      timezone_offset_minutes: tzOffset,
      device_id: this.config.device_id,
      device_platform: this.config.device_platform,
      client_app_version: this.config.client_app_version,
      client_release_id: this.config.client_release_id,
      client_commit_hash: this.config.client_commit_hash,
      attendance_protocol_version: this.config.protocol_version,
      created_offline: createdOffline,
      offline_lease_id: offlineLeaseId,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      accuracy_meters: params.accuracy_meters ?? null,
      gps_verified: params.gps_verified,
      geofence_status: params.geofence_status,
      geofence_distance_meters: params.geofence_distance_meters ?? null,
      geofence_version_id: geofenceVersionId,
      face_verified: params.face_verified,
      face_bypass_reason: params.face_verified ? null : (params.face_bypass_reason || 'UNSPECIFIED_BYPASS'),
      is_manual_adjustment: false,
      adjustment_reason: null,
      reported_departure_timestamp: null,
      worker_explanation: null
    };

    // 5. Create active shift entry in IndexedDB
    const activeShift: DurableActiveShift = {
      shift_id: shiftId,
      clock_in_event_id: eventId,
      personnel_id: params.personnel_id,
      project_id: params.project_id,
      work_type: params.work_type,
      started_at: nowUtc,
      timezone_offset_minutes: tzOffset,
      created_offline: createdOffline,
      offline_lease_id: offlineLeaseId,
      geofence_version_id: geofenceVersionId,
      protocol_version: this.config.protocol_version,
      client_release_id: this.config.client_release_id,
      state: 'ACTIVE',
      created_at: nowUtc,
      updated_at: nowUtc
    };
    await this.db.saveActiveShift(activeShift);

    // 6. Attempt online submission if not forced offline
    if (!createdOffline && this.transport) {
      try {
        const res = await this.transport.recordAttendanceEvent(envelope);
        if (res.success) {
          // ACKed by server
          const queued: QueuedAttendanceEvent = {
            ...envelope,
            causal_sequence: 1,
            sync_status: 'ACKED',
            retry_count: 0,
            server_receipt_at: new Date().toISOString(),
            created_at: nowUtc
          };
          await this.db.saveQueuedEvent(queued);

          return {
            success: true,
            status: res.status || 'APPLIED',
            shift_id: shiftId,
            event_id: eventId,
            created_offline: false
          };
        } else {
          // Server returned explicit failure (403, 409, 422, etc.)
          // Clean up local shift so worker is not left stuck in uncommitted active shift
          await this.db.deleteActiveShift(shiftId);
          return {
            success: false,
            status: res.status || 'REJECTED',
            shift_id: shiftId,
            event_id: eventId,
            created_offline: false,
            error: res.error || 'Server rejected Clock-In'
          };
        }
      } catch (err: any) {
        if (this.isGenuineNetworkFailure(err)) {
          // Genuine transport drop -> transition to offline creation mode
          createdOffline = true;
          envelope.created_offline = true;
          activeShift.created_offline = true;
          await this.db.saveActiveShift(activeShift);
        } else {
          // Hard client/runtime error -> do not queue
          await this.db.deleteActiveShift(shiftId);
          throw err;
        }
      }
    }

    // 7. Queue event locally for later replay
    const queuedEvent: QueuedAttendanceEvent = {
      ...envelope,
      causal_sequence: 1,
      sync_status: 'QUEUED',
      retry_count: 0,
      created_at: nowUtc
    };
    await this.db.saveQueuedEvent(queuedEvent);

    return {
      success: true,
      status: 'QUEUED_OFFLINE',
      shift_id: shiftId,
      event_id: eventId,
      created_offline: true
    };
  }

  /**
   * Clock-Out Flow
   * Targets exact existing shift_id from active shift store.
   * Transitions active shift to CLOSED_LOCAL immediately.
   */
  public async clockOut(params: {
    shift_id: string;
    personnel_id: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy_meters?: number | null;
    gps_verified: boolean;
    geofence_status: GeofenceStatus;
    geofence_distance_meters?: number | null;
    face_verified: boolean;
    face_bypass_reason?: string | null;
    is_forgotten_clockout?: boolean;
    reported_departure_timestamp?: string | null;
    worker_explanation?: string | null;
    force_offline?: boolean;
  }): Promise<{
    success: boolean;
    status: string;
    shift_id: string;
    event_id: string;
    error?: string;
  }> {
    // 1. Locate active shift by exact shift_id
    const activeShift = await this.db.getActiveShift(params.shift_id);
    if (!activeShift) {
      return {
        success: false,
        status: 'SHIFT_NOT_FOUND',
        shift_id: params.shift_id,
        event_id: '',
        error: 'No active shift found with specified shift_id.'
      };
    }

    if (activeShift.personnel_id !== params.personnel_id) {
      return {
        success: false,
        status: 'REJECTED',
        shift_id: params.shift_id,
        event_id: '',
        error: 'Active shift belongs to different personnel.'
      };
    }

    const eventId = crypto.randomUUID();
    const nowUtc = new Date().toISOString();
    const tzOffset = this.getLocalTimezoneOffsetMinutes();

    const isBrowserOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
    let createdOffline = Boolean(params.force_offline || isBrowserOffline);
    let offlineLeaseId = activeShift.offline_lease_id || null;
    if (createdOffline && !offlineLeaseId) {
      const lease = await this.db.getLatestOfflineLeaseForPersonnel(params.personnel_id);
      if (lease) {
        offlineLeaseId = lease.lease_id;
      }
    }

    // 2. Mark shift as CLOSED_LOCAL immediately to prevent double clock-out
    activeShift.state = 'CLOSED_LOCAL';
    activeShift.clock_out_event_id = eventId;
    activeShift.closed_at = nowUtc;
    await this.db.saveActiveShift(activeShift);

    // 3. Construct 29-field evidence envelope
    const isForgotten = Boolean(params.is_forgotten_clockout);
    const envelope: AttendanceEvidenceEnvelope = {
      event_id: eventId,
      shift_id: params.shift_id,
      personnel_id: params.personnel_id,
      project_id: activeShift.project_id,
      event_type: 'CLOCK_OUT',
      work_type: activeShift.work_type,
      device_event_timestamp: nowUtc,
      timezone_offset_minutes: tzOffset,
      device_id: this.config.device_id,
      device_platform: this.config.device_platform,
      client_app_version: this.config.client_app_version,
      client_release_id: this.config.client_release_id,
      client_commit_hash: this.config.client_commit_hash,
      attendance_protocol_version: this.config.protocol_version,
      created_offline: createdOffline,
      offline_lease_id: offlineLeaseId,
      latitude: isForgotten ? null : (params.latitude ?? null),
      longitude: isForgotten ? null : (params.longitude ?? null),
      accuracy_meters: isForgotten ? null : (params.accuracy_meters ?? null),
      gps_verified: isForgotten ? false : params.gps_verified,
      geofence_status: isForgotten ? 'NOT_APPLICABLE' : params.geofence_status,
      geofence_distance_meters: isForgotten ? null : (params.geofence_distance_meters ?? null),
      geofence_version_id: isForgotten ? null : (activeShift.geofence_version_id || null),
      face_verified: params.face_verified,
      face_bypass_reason: params.face_verified ? null : (params.face_bypass_reason || 'UNSPECIFIED_BYPASS'),
      is_manual_adjustment: isForgotten,
      adjustment_reason: isForgotten ? 'FORGOTTEN_CLOCKOUT' : null,
      reported_departure_timestamp: isForgotten ? (params.reported_departure_timestamp || null) : null,
      worker_explanation: isForgotten ? (params.worker_explanation || null) : null
    };

    // 4. Attempt online submission if transport available
    if (!createdOffline && this.transport) {
      try {
        const res = await this.transport.recordAttendanceEvent(envelope);
        if (res.success) {
          // Authoritative server ACK -> retire active shift
          activeShift.state = 'RETIRED';
          await this.db.saveActiveShift(activeShift);

          const queued: QueuedAttendanceEvent = {
            ...envelope,
            causal_sequence: 2,
            sync_status: 'COMPLETE',
            retry_count: 0,
            server_receipt_at: new Date().toISOString(),
            created_at: nowUtc
          };
          await this.db.saveQueuedEvent(queued);

          return {
            success: true,
            status: res.status || 'APPLIED',
            shift_id: params.shift_id,
            event_id: eventId
          };
        } else {
          // Server rejected -> keep active shift in CLOSED_LOCAL / RETRYABLE state for recovery
          return {
            success: false,
            status: res.status || 'REJECTED',
            shift_id: params.shift_id,
            event_id: eventId,
            error: res.error || 'Server rejected Clock-Out'
          };
        }
      } catch (err: any) {
        if (this.isGenuineNetworkFailure(err)) {
          createdOffline = true;
          envelope.created_offline = true;
        } else {
          throw err;
        }
      }
    }

    // 5. Queue event locally for later replay
    const queuedEvent: QueuedAttendanceEvent = {
      ...envelope,
      causal_sequence: 2,
      sync_status: 'QUEUED',
      retry_count: 0,
      created_at: nowUtc
    };
    await this.db.saveQueuedEvent(queuedEvent);

    return {
      success: true,
      status: 'QUEUED_OFFLINE',
      shift_id: params.shift_id,
      event_id: eventId
    };
  }

  /**
   * Replays queued offline events in strict causal sequence grouped by shift.
   * Independent shifts are processed independently without cross-blocking.
   */
  public async syncOfflineQueue(): Promise<{
    processed_count: number;
    acked_count: number;
    failed_count: number;
    results: Array<{
      event_id: string;
      shift_id: string;
      event_type: string;
      status: string;
      error?: string;
    }>;
  }> {
    if (!this.transport) {
      throw new Error('TransportClient not configured on engine');
    }

    const allQueued = await this.db.getAllQueuedEvents();
    const pendingEvents = allQueued.filter(
      (e) => e.sync_status === 'QUEUED' || e.sync_status === 'RETRYABLE'
    );

    if (pendingEvents.length === 0) {
      return { processed_count: 0, acked_count: 0, failed_count: 0, results: [] };
    }

    // Group events by shift_id
    const shiftsMap = new Map<string, QueuedAttendanceEvent[]>();
    for (const ev of pendingEvents) {
      const list = shiftsMap.get(ev.shift_id) || [];
      list.push(ev);
      shiftsMap.set(ev.shift_id, list);
    }

    const results: Array<{
      event_id: string;
      shift_id: string;
      event_type: string;
      status: string;
      error?: string;
    }> = [];

    let ackedCount = 0;
    let failedCount = 0;

    // Process each shift independently
    for (const [, events] of shiftsMap.entries()) {
      // Sort strictly by local causal ordinal sequence (CLOCK_IN before CLOCK_OUT)
      events.sort((a, b) => a.causal_sequence - b.causal_sequence);

      let shiftHalted = false;

      for (const ev of events) {
        if (shiftHalted) {
          ev.sync_status = 'DEPENDENCY_FAILED';
          ev.error_message = 'Prior event in shift failed to synchronize';
          await this.db.saveQueuedEvent(ev);
          results.push({
            event_id: ev.event_id,
            shift_id: ev.shift_id,
            event_type: ev.event_type,
            status: 'DEPENDENCY_FAILED',
            error: ev.error_message
          });
          failedCount++;
          continue;
        }

        ev.sync_status = 'SYNCING';
        ev.last_attempted_at = new Date().toISOString();
        await this.db.saveQueuedEvent(ev);

        try {
          const res = await this.transport.recordAttendanceEvent(ev);

          if (res.success && (res.status === 'APPLIED' || res.status === 'ALREADY_APPLIED')) {
            ev.sync_status = 'ACKED';
            ev.server_receipt_at = new Date().toISOString();
            await this.db.saveQueuedEvent(ev);

            // If this was CLOCK_OUT, retire active shift
            if (ev.event_type === 'CLOCK_OUT') {
              const activeShift = await this.db.getActiveShift(ev.shift_id);
              if (activeShift) {
                activeShift.state = 'RETIRED';
                await this.db.saveActiveShift(activeShift);
              }
            }

            results.push({
              event_id: ev.event_id,
              shift_id: ev.shift_id,
              event_type: ev.event_type,
              status: res.status
            });
            ackedCount++;
          } else {
            // Server rejected
            ev.retry_count++;
            if (res.status === 'ACTIVE_SHIFT_CONFLICT' || res.status === 'CONFLICT') {
              ev.sync_status = 'CONFLICT';
            } else if (res.status === 'IMMUTABLE_EVENT_PAYLOAD_MISMATCH' || res.status === 'REJECTED') {
              ev.sync_status = 'REJECTED';
            } else {
              ev.sync_status = 'RETRYABLE';
            }
            ev.error_message = res.error || 'Server sync error';
            await this.db.saveQueuedEvent(ev);

            results.push({
              event_id: ev.event_id,
              shift_id: ev.shift_id,
              event_type: ev.event_type,
              status: ev.sync_status,
              error: ev.error_message
            });
            failedCount++;
            shiftHalted = true;
          }
        } catch (err: any) {
          ev.retry_count++;
          ev.sync_status = 'RETRYABLE';
          ev.error_message = String(err.message || err);
          await this.db.saveQueuedEvent(ev);

          results.push({
            event_id: ev.event_id,
            shift_id: ev.shift_id,
            event_type: ev.event_type,
            status: 'RETRYABLE',
            error: ev.error_message
          });
          failedCount++;
          shiftHalted = true;
        }
      }
    }

    return {
      processed_count: pendingEvents.length,
      acked_count: ackedCount,
      failed_count: failedCount,
      results
    };
  }
}
