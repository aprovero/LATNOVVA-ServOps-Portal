/**
 * Attendance V2 Client Engine
 * Implements transactional client punch generation, offline queueing,
 * active shift lifecycle, timezone reconstruction, and replay engine.
 */

import type {
  AttendanceEvidenceEnvelope,
  QueuedAttendanceEvent,
  DurableActiveShift,
  AttendanceV2ClientConfig,
  AttendanceWorkType,
  GeofenceStatus
} from './types';
import { AttendanceV2Database, attendanceV2Db } from './db.ts';

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

export interface SyncOfflineQueueResult {
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
}

const STALE_SYNCING_MS = 2 * 60 * 1000;
const CROSS_TAB_SYNC_LOCK_NAME = 'latnovva_attendance_v2_sync_lock';
const ACK_STATUSES = new Set(['APPLIED', 'ALREADY_APPLIED', 'ALREADY_RECORDED', 'IDEMPOTENT_DUPLICATE']);
const PERMANENT_REJECTION_STATUSES = new Set([
  'IMMUTABLE_EVENT_PAYLOAD_MISMATCH',
  'REJECTED',
  'REJECTED_TERMINATED',
  'REJECTED_OUTSIDE_GEOFENCE',
  'SHIFT_NOT_FOUND',
  'TERMINATED',
  'UNAUTHORIZED',
  'FORBIDDEN',
]);

export class AttendanceV2ClientEngine {
  private db: AttendanceV2Database;
  private config: AttendanceV2ClientConfig;
  private transport?: TransportClient;
  private activeSyncPromise: Promise<SyncOfflineQueueResult> | null = null;
  private rerunSyncRequested = false;
  private syncInProgress = false;
  private syncStateListeners = new Set<(syncing: boolean) => void>();

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
   * Returns true while a single-flight offline queue synchronization run is active.
   */
  public isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * Subscribes to single-flight synchronization state transitions.
   * Returns an unsubscribe function.
   */
  public onSyncStateChange(listener: (syncing: boolean) => void): () => void {
    this.syncStateListeners.add(listener);
    return () => {
      this.syncStateListeners.delete(listener);
    };
  }

  private setSyncInProgress(active: boolean): void {
    if (this.syncInProgress === active) return;
    this.syncInProgress = active;
    for (const listener of this.syncStateListeners) {
      try {
        listener(active);
      } catch {
        // Listener errors must never disrupt sync lifecycle
      }
    }
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
   * PASS 15F / P0-3: Single authoritative offline lease validator used by ALL offline paths
   * (ClockIn explicit offline, ClockIn transport-drop catch, ClockOut explicit offline, ClockOut transport-drop catch).
   */
  private async validateOfflineLeaseOrReject(
    personnelId: string,
    projectId: string | null,
    requireScope: boolean
  ): Promise<{ ok: true; lease_id: string; geofence_version_id: string | null } | { ok: false; error: string }> {
    const lease = await this.db.getLatestOfflineLeaseForPersonnel(personnelId);
    if (!lease) {
      return { ok: false, error: 'No active offline lease available for offline attendance.' };
    }
    if (lease.is_revoked) {
      return { ok: false, error: 'Offline lease has been revoked.' };
    }
    const validUntilMs = Date.parse(lease.valid_until);
    if (!Number.isFinite(validUntilMs) || validUntilMs <= Date.now()) {
      return { ok: false, error: 'Offline lease has expired.' };
    }
    if (lease.personnel_id !== personnelId) {
      return { ok: false, error: 'Offline lease does not belong to current personnel.' };
    }
    if (!lease.device_id || lease.device_id !== this.config.device_id) {
      return { ok: false, error: 'Offline lease is bound to a different device.' };
    }

    if (requireScope && projectId) {
      const scopes = Array.isArray(lease.scopes) ? lease.scopes : [];
      const scope = scopes.find((s) => s.project_id === projectId);
      if (!scope) {
        return { ok: false, error: 'Target project is not scoped in current offline lease.' };
      }
      return { ok: true, lease_id: lease.lease_id, geofence_version_id: scope.geofence_version_id || null };
    }

    return { ok: true, lease_id: lease.lease_id, geofence_version_id: null };
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
      const now = Date.now();
      const shiftStartTime = new Date(existingActive.started_at).getTime();
      const shiftAgeHours = isNaN(shiftStartTime) ? 999 : (now - shiftStartTime) / (1000 * 60 * 60);

      if (shiftAgeHours > 14) {
        console.warn(`[AttendanceV2] Purging stale local active shift ${existingActive.shift_id} (age: ${shiftAgeHours.toFixed(1)}h, started: ${existingActive.started_at})`);
        await this.db.deleteActiveShift(existingActive.shift_id);
      } else {
        return {
          success: false,
          status: 'ACTIVE_SHIFT_CONFLICT',
          shift_id: existingActive.shift_id,
          event_id: existingActive.clock_in_event_id,
          created_offline: false,
          error: 'Personnel already has an active open shift.'
        };
      }
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
      const leaseCheck = await this.validateOfflineLeaseOrReject(params.personnel_id, params.project_id, true);
      if (!leaseCheck.ok) {
        return {
          success: false,
          status: 'REJECTED',
          shift_id: shiftId,
          event_id: eventId,
          created_offline: true,
          error: leaseCheck.error
        };
      }
      offlineLeaseId = leaseCheck.lease_id;
      geofenceVersionId = leaseCheck.geofence_version_id || geofenceVersionId;
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
      face_bypass_reason: params.face_verified ? null : (params.face_bypass_reason || null),
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
          // PASS 15F / P0-3: Network-drop fallback MUST enforce the exact same offline lease validator
          const leaseCheck = await this.validateOfflineLeaseOrReject(params.personnel_id, params.project_id, true);
          if (!leaseCheck.ok) {
            await this.db.deleteActiveShift(shiftId);
            return {
              success: false,
              status: 'REJECTED',
              shift_id: shiftId,
              event_id: eventId,
              created_offline: true,
              error: leaseCheck.error
            };
          }
          createdOffline = true;
          envelope.created_offline = true;
          envelope.offline_lease_id = leaseCheck.lease_id;
          envelope.geofence_version_id = leaseCheck.geofence_version_id || envelope.geofence_version_id;
          activeShift.created_offline = true;
          activeShift.offline_lease_id = leaseCheck.lease_id;
          activeShift.geofence_version_id = envelope.geofence_version_id;
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
    project_id?: string | null;
    work_type?: 'ON_SITE' | 'HOME_OFFICE';
    latitude?: number | null;
    longitude?: number | null;
    accuracy_meters?: number | null;
    gps_verified: boolean;
    geofence_status: GeofenceStatus;
    geofence_distance_meters?: number | null;
    face_verified: boolean;
    face_bypass_reason?: string | null;
    is_forgotten_clockout?: boolean;
    is_short_shift_discard?: boolean;
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
    const eventId = crypto.randomUUID();
    const nowUtc = new Date().toISOString();
    const tzOffset = this.getLocalTimezoneOffsetMinutes();

    // 1. Locate active shift by exact shift_id (PASS 15F Section 18: NEVER infer latest shift when shift_id is empty).
    if (!params.shift_id || !params.shift_id.trim()) {
      return {
        success: false,
        status: 'SHIFT_NOT_FOUND',
        shift_id: '',
        event_id: '',
        error: 'Explicit shift_id is required for Clock-Out.'
      };
    }

    let activeShift = await this.db.getActiveShift(params.shift_id);
    if (!activeShift) {
      // Fallback: Synthesize active shift when an explicit shift_id is provided so that
      // device switches, cache clears, or prior-day unclosed shifts can be closed on the authoritative server.
      activeShift = {
        shift_id: params.shift_id,
        personnel_id: params.personnel_id,
        clock_in_event_id: crypto.randomUUID(),
        project_id: params.project_id || '',
        work_type: params.work_type || 'ON_SITE',
        started_at: nowUtc,
        timezone_offset_minutes: tzOffset,
        created_offline: false,
        offline_lease_id: null,
        geofence_version_id: null,
        protocol_version: this.config.protocol_version,
        client_release_id: this.config.client_release_id,
        state: 'ACTIVE',
        created_at: nowUtc,
        updated_at: nowUtc
      };
      await this.db.saveActiveShift(activeShift);
    }
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
        shift_id: activeShift.shift_id,
        event_id: '',
        error: 'Active shift belongs to different personnel.'
      };
    }

    const effectiveShiftId = activeShift.shift_id;
    const effectiveProjectId = activeShift.project_id || params.project_id || '';
    const effectiveWorkType = activeShift.work_type || params.work_type || 'ON_SITE';

    const isBrowserOffline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine;
    let createdOffline = Boolean(params.force_offline || isBrowserOffline);
    let offlineLeaseId = activeShift.offline_lease_id || null;
    if (createdOffline) {
      const leaseCheck = await this.validateOfflineLeaseOrReject(params.personnel_id, effectiveProjectId || null, false);
      if (!leaseCheck.ok) {
        return {
          success: false,
          status: 'REJECTED',
          shift_id: effectiveShiftId,
          event_id: eventId,
          error: leaseCheck.error
        };
      }
      offlineLeaseId = offlineLeaseId || leaseCheck.lease_id;
    }

    // 2. Mark shift as CLOSED_LOCAL temporarily while submitting (rolled back on rejection)
    const previousState = activeShift.state;
    activeShift.state = 'CLOSED_LOCAL';
    activeShift.clock_out_event_id = eventId;
    activeShift.closed_at = nowUtc;
    await this.db.saveActiveShift(activeShift);

    // 3. Construct 29-field evidence envelope
    const isForgotten = Boolean(params.is_forgotten_clockout);
    const isShortDiscard = Boolean(params.is_short_shift_discard);
    const isBypassGps = isForgotten || isShortDiscard;
    const envelope: AttendanceEvidenceEnvelope = {
      event_id: eventId,
      shift_id: effectiveShiftId,
      personnel_id: params.personnel_id,
      project_id: effectiveProjectId,
      event_type: 'CLOCK_OUT',
      work_type: effectiveWorkType,
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
      latitude: isBypassGps ? null : (params.latitude ?? null),
      longitude: isBypassGps ? null : (params.longitude ?? null),
      accuracy_meters: isBypassGps ? null : (params.accuracy_meters ?? null),
      gps_verified: isBypassGps ? false : params.gps_verified,
      geofence_status: isBypassGps ? 'NOT_APPLICABLE' : params.geofence_status,
      geofence_distance_meters: isBypassGps ? null : (params.geofence_distance_meters ?? null),
      geofence_version_id: isBypassGps ? null : (activeShift.geofence_version_id || null),
      face_verified: params.face_verified,
      face_bypass_reason: params.face_verified ? null : (params.face_bypass_reason || null),
      is_manual_adjustment: isForgotten || isShortDiscard,
      adjustment_reason: isShortDiscard ? 'SHORT_SHIFT_DISCARD' : (isForgotten ? 'FORGOTTEN_CLOCKOUT' : null),
      reported_departure_timestamp: isForgotten ? (params.reported_departure_timestamp || null) : null,
      worker_explanation: (isForgotten || isShortDiscard) ? (params.worker_explanation || null) : null
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
            shift_id: effectiveShiftId,
            event_id: eventId
          };
        } else {
          // Roll back local state so user can retry cleanly
          activeShift.state = previousState;
          activeShift.clock_out_event_id = undefined;
          activeShift.closed_at = undefined;
          await this.db.saveActiveShift(activeShift);
          return {
            success: false,
            status: res.status || 'REJECTED',
            shift_id: effectiveShiftId,
            event_id: eventId,
            error: res.error || 'Server rejected Clock-Out'
          };
        }
      } catch (err: any) {
        if (this.isGenuineNetworkFailure(err)) {
          const leaseCheck = await this.validateOfflineLeaseOrReject(params.personnel_id, effectiveProjectId || null, false);
          if (!leaseCheck.ok) {
            activeShift.state = previousState;
            activeShift.clock_out_event_id = undefined;
            activeShift.closed_at = undefined;
            await this.db.saveActiveShift(activeShift);
            return {
              success: false,
              status: 'REJECTED',
              shift_id: effectiveShiftId,
              event_id: eventId,
              error: leaseCheck.error
            };
          }
          createdOffline = true;
          envelope.created_offline = true;
          envelope.offline_lease_id = envelope.offline_lease_id || leaseCheck.lease_id;
        } else {
          activeShift.state = previousState;
          activeShift.clock_out_event_id = undefined;
          activeShift.closed_at = undefined;
          await this.db.saveActiveShift(activeShift);
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
   *
   * V6-PEND-021: Dependency-aware retry distinguishes temporary prerequisite failures
   * (`DEPENDENCY_WAITING`) from permanent prerequisite rejections (`DEPENDENCY_FAILED`)
   * and automatically recovers both `DEPENDENCY_WAITING` and compatible stranded historical
   * `DEPENDENCY_FAILED` events once their prerequisites are authoritatively accepted.
   *
   * V6-PEND-022: Single-flight in-tab coordination with coalesced follow-up pass for newly
   * eligible work, plus Web Locks API (`navigator.locks`) cross-tab coordination when backed
   * by browser IndexedDB.
   */
  public async syncOfflineQueue(): Promise<SyncOfflineQueueResult> {
    if (!this.transport) {
      throw new Error('TransportClient not configured on engine');
    }

    if (this.activeSyncPromise) {
      this.rerunSyncRequested = true;
      return this.activeSyncPromise;
    }

    const run = this.executeSingleFlightSync();
    this.activeSyncPromise = run;
    return run;
  }

  private async executeSingleFlightSync(): Promise<SyncOfflineQueueResult> {
    this.setSyncInProgress(true);
    try {
      return await this.withCrossTabSyncLock(async () => {
        const aggregate: SyncOfflineQueueResult = {
          processed_count: 0,
          acked_count: 0,
          failed_count: 0,
          results: []
        };

        const MAX_COALESCED_PASSES = 5;
        const touchedAcrossRun = new Set<string>();

        for (let pass = 0; pass < MAX_COALESCED_PASSES; pass++) {
          this.rerunSyncRequested = false;
          const passResult = await this.runSingleSyncPass();
          aggregate.processed_count += passResult.processed_count;
          aggregate.acked_count += passResult.acked_count;
          aggregate.failed_count += passResult.failed_count;
          aggregate.results.push(...passResult.results);
          for (const id of passResult.touched_event_ids) {
            touchedAcrossRun.add(id);
          }

          if (!this.rerunSyncRequested) {
            break;
          }

          const hasNewWork = await this.hasUnattemptedEligibleWork(touchedAcrossRun);
          if (!hasNewWork) {
            this.rerunSyncRequested = false;
            break;
          }
        }

        return aggregate;
      });
    } finally {
      this.rerunSyncRequested = false;
      this.activeSyncPromise = null;
      this.setSyncInProgress(false);
    }
  }

  private async withCrossTabSyncLock<T>(fn: () => Promise<T>): Promise<T> {
    const canUseWebLocks =
      !this.db.isMemoryFallbackMode() &&
      typeof navigator !== 'undefined' &&
      typeof navigator.locks !== 'undefined' &&
      typeof navigator.locks.request === 'function';

    if (!canUseWebLocks) {
      return fn();
    }

    let entered = false;
    try {
      return await navigator.locks.request(
        CROSS_TAB_SYNC_LOCK_NAME,
        { mode: 'exclusive' },
        async () => {
          entered = true;
          return await fn();
        }
      );
    } catch (err) {
      if (entered) {
        throw err;
      }
      // Web Locks unavailable in restricted/opaque contexts; fall back to in-tab single-flight
      return fn();
    }
  }

  private isStaleSyncingEvent(ev: QueuedAttendanceEvent, staleSyncCutoffMs: number): boolean {
    if (ev.sync_status !== 'SYNCING') return false;
    if (!ev.last_attempted_at) return true;
    const attemptedMs = Date.parse(ev.last_attempted_at);
    return !Number.isFinite(attemptedMs) || attemptedMs < staleSyncCutoffMs;
  }

  private async hasUnattemptedEligibleWork(touchedEventIds: Set<string>): Promise<boolean> {
    const allQueued = await this.db.getAllQueuedEvents();
    const staleSyncCutoff = Date.now() - STALE_SYNCING_MS;

    const shiftsMap = new Map<string, QueuedAttendanceEvent[]>();
    for (const ev of allQueued) {
      const list = shiftsMap.get(ev.shift_id) || [];
      list.push(ev);
      shiftsMap.set(ev.shift_id, list);
    }

    for (const [, events] of shiftsMap.entries()) {
      events.sort((a, b) => a.causal_sequence - b.causal_sequence);
      let prerequisiteState: 'READY' | 'RETRYABLE_BLOCKED' | 'PERMANENTLY_BLOCKED' | 'IN_PROGRESS_BLOCKED' = 'READY';

      for (const ev of events) {
        if (ev.sync_status === 'ACKED' || ev.sync_status === 'COMPLETE') {
          continue;
        }
        if (ev.sync_status === 'FAILED_PERMANENT' || ev.sync_status === 'CONFLICT' || ev.sync_status === 'REJECTED') {
          prerequisiteState = 'PERMANENTLY_BLOCKED';
          continue;
        }
        if (ev.sync_status === 'SYNCING' && !this.isStaleSyncingEvent(ev, staleSyncCutoff)) {
          prerequisiteState = 'IN_PROGRESS_BLOCKED';
          continue;
        }

        if (prerequisiteState === 'READY') {
          const isEligibleStatus =
            ev.sync_status === 'QUEUED' ||
            ev.sync_status === 'RETRYABLE' ||
            ev.sync_status === 'DEPENDENCY_WAITING' ||
            ev.sync_status === 'DEPENDENCY_FAILED' ||
            this.isStaleSyncingEvent(ev, staleSyncCutoff);
          if (isEligibleStatus && !touchedEventIds.has(ev.event_id)) {
            return true;
          }
          prerequisiteState = 'RETRYABLE_BLOCKED';
        }
      }
    }

    return false;
  }

  private async runSingleSyncPass(): Promise<SyncOfflineQueueResult & { touched_event_ids: Set<string> }> {
    const allQueued = await this.db.getAllQueuedEvents();
    const staleSyncCutoff = Date.now() - STALE_SYNCING_MS;
    const touchedEventIds = new Set<string>();

    if (allQueued.length === 0) {
      return { processed_count: 0, acked_count: 0, failed_count: 0, results: [], touched_event_ids: touchedEventIds };
    }

    // Group ALL events by shift_id so prerequisite state is always evaluated accurately
    const shiftsMap = new Map<string, QueuedAttendanceEvent[]>();
    for (const ev of allQueued) {
      const list = shiftsMap.get(ev.shift_id) || [];
      list.push(ev);
      shiftsMap.set(ev.shift_id, list);
    }

    const results: SyncOfflineQueueResult['results'] = [];
    let processedCount = 0;
    let ackedCount = 0;
    let failedCount = 0;

    // Process each shift independently
    for (const [, events] of shiftsMap.entries()) {
      // Sort strictly by local causal ordinal sequence (CLOCK_IN before CLOCK_OUT)
      events.sort((a, b) => a.causal_sequence - b.causal_sequence);

      let prerequisiteState: 'READY' | 'RETRYABLE_BLOCKED' | 'PERMANENTLY_BLOCKED' | 'IN_PROGRESS_BLOCKED' = 'READY';

      for (const ev of events) {
        // 1. Already accepted by server
        if (ev.sync_status === 'ACKED' || ev.sync_status === 'COMPLETE') {
          continue;
        }

        // 2. Permanently rejected or conflicted — preserve evidence, never auto-retry
        if (ev.sync_status === 'FAILED_PERMANENT' || ev.sync_status === 'CONFLICT' || ev.sync_status === 'REJECTED') {
          prerequisiteState = 'PERMANENTLY_BLOCKED';
          continue;
        }

        // 3. Actively syncing (non-stale) — never duplicate or submit dependents ahead of it
        if (ev.sync_status === 'SYNCING' && !this.isStaleSyncingEvent(ev, staleSyncCutoff)) {
          prerequisiteState = 'IN_PROGRESS_BLOCKED';
          continue;
        }

        // 4. Existing DEPENDENCY_FAILED event:
        //    - If prerequisite is permanently failed -> keep DEPENDENCY_FAILED without retrying.
        //    - If prerequisite is temporarily blocked/in-progress -> reclassify to DEPENDENCY_WAITING.
        //    - If prerequisite is READY (all prior events ACKED/COMPLETE) -> recover & submit now!
        if (ev.sync_status === 'DEPENDENCY_FAILED') {
          if (prerequisiteState === 'PERMANENTLY_BLOCKED') {
            continue;
          }
          if (prerequisiteState === 'RETRYABLE_BLOCKED' || prerequisiteState === 'IN_PROGRESS_BLOCKED') {
            ev.sync_status = 'DEPENDENCY_WAITING';
            ev.error_message = 'Waiting for prior event in shift to synchronize';
            await this.db.saveQueuedEvent(ev);
            touchedEventIds.add(ev.event_id);
            results.push({
              event_id: ev.event_id,
              shift_id: ev.shift_id,
              event_type: ev.event_type,
              status: 'DEPENDENCY_WAITING',
              error: ev.error_message
            });
            processedCount++;
            failedCount++;
            continue;
          }
          // prerequisiteState === 'READY': fall through to submit recovered historical event
        }

        // 5. Eligible pending statuses: QUEUED, RETRYABLE, DEPENDENCY_WAITING, stale SYNCING, or recovered DEPENDENCY_FAILED
        const isEligibleStatus =
          ev.sync_status === 'QUEUED' ||
          ev.sync_status === 'RETRYABLE' ||
          ev.sync_status === 'DEPENDENCY_WAITING' ||
          ev.sync_status === 'DEPENDENCY_FAILED' ||
          this.isStaleSyncingEvent(ev, staleSyncCutoff);

        if (!isEligibleStatus) {
          continue;
        }

        // Enforce prerequisite gate before touching transport
        if (prerequisiteState === 'PERMANENTLY_BLOCKED') {
          ev.sync_status = 'DEPENDENCY_FAILED';
          ev.error_message = 'Blocked: prior event in shift was permanently rejected and requires management review';
          await this.db.saveQueuedEvent(ev);
          touchedEventIds.add(ev.event_id);
          results.push({
            event_id: ev.event_id,
            shift_id: ev.shift_id,
            event_type: ev.event_type,
            status: 'DEPENDENCY_FAILED',
            error: ev.error_message
          });
          processedCount++;
          failedCount++;
          continue;
        }

        if (prerequisiteState === 'RETRYABLE_BLOCKED' || prerequisiteState === 'IN_PROGRESS_BLOCKED') {
          ev.sync_status = 'DEPENDENCY_WAITING';
          ev.error_message = 'Waiting for prior event in shift to synchronize';
          await this.db.saveQueuedEvent(ev);
          touchedEventIds.add(ev.event_id);
          results.push({
            event_id: ev.event_id,
            shift_id: ev.shift_id,
            event_type: ev.event_type,
            status: 'DEPENDENCY_WAITING',
            error: ev.error_message
          });
          processedCount++;
          failedCount++;
          continue;
        }

        // 6. All prerequisites accepted — submit immutable 29-field envelope
        touchedEventIds.add(ev.event_id);
        processedCount++;
        ev.sync_status = 'SYNCING';
        ev.last_attempted_at = new Date().toISOString();
        await this.db.saveQueuedEvent(ev);

        try {
          // Strip local queue metadata to send a clean 29-field AttendanceEvidenceEnvelope
          const {
            causal_sequence: _cs,
            sync_status: _ss,
            retry_count: _rc,
            last_attempted_at: _la,
            server_receipt_at: _sr,
            error_message: _em,
            created_at: _ca,
            ...cleanEnvelope
          } = ev;
          const res = await this.transport!.recordAttendanceEvent(cleanEnvelope);

          if (res && res.success === true && typeof res.status === 'string' && ACK_STATUSES.has(res.status)) {
            ev.sync_status = 'ACKED';
            ev.server_receipt_at = new Date().toISOString();
            ev.error_message = undefined;
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
            // Server rejected or returned malformed/missing ACK — classify permanent vs retryable
            ev.retry_count++;
            const st = String(res?.status || '').toUpperCase();
            if (st === 'ACTIVE_SHIFT_CONFLICT' || st === 'CONFLICT') {
              ev.sync_status = 'CONFLICT';
              prerequisiteState = 'PERMANENTLY_BLOCKED';
            } else if (PERMANENT_REJECTION_STATUSES.has(st) || st.startsWith('REJECTED_')) {
              ev.sync_status = 'FAILED_PERMANENT';
              prerequisiteState = 'PERMANENTLY_BLOCKED';
            } else {
              ev.sync_status = 'RETRYABLE';
              prerequisiteState = 'RETRYABLE_BLOCKED';
            }
            ev.error_message = res?.error || 'Server sync error';
            await this.db.saveQueuedEvent(ev);

            results.push({
              event_id: ev.event_id,
              shift_id: ev.shift_id,
              event_type: ev.event_type,
              status: ev.sync_status,
              error: ev.error_message
            });
            failedCount++;
          }
        } catch (err: any) {
          ev.retry_count++;
          ev.sync_status = 'RETRYABLE';
          ev.error_message = String(err?.message || err);
          await this.db.saveQueuedEvent(ev);

          results.push({
            event_id: ev.event_id,
            shift_id: ev.shift_id,
            event_type: ev.event_type,
            status: 'RETRYABLE',
            error: ev.error_message
          });
          failedCount++;
          prerequisiteState = 'RETRYABLE_BLOCKED';
        }
      }
    }

    return {
      processed_count: processedCount,
      acked_count: ackedCount,
      failed_count: failedCount,
      results,
      touched_event_ids: touchedEventIds
    };
  }
}
