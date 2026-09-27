import { supabase } from './supabase';

/**
 * Telemetry & Metrics Instrumentation for Punch Normalization Architecture
 * Tracks success/failure, idempotency, queue metrics without logging sensitive evidence.
 * Pushes events centrally to Supabase database so metrics leave the client.
 */

export interface TelemetryMetrics {
  normalizedPunchRpcSuccess: number;
  normalizedPunchRpcConflict: number;
  normalizedPunchRpcFailure: number;
  idempotentReplay: number;
  storageUploadSuccess: number;
  storageUploadFailure: number;
  mediaAttachmentSuccess: number;
  mediaAttachmentFailure: number;
  pendingQueueDepth: number;
  oldestPendingQueueAgeMs: number;
}

const metrics: TelemetryMetrics = {
  normalizedPunchRpcSuccess: 0,
  normalizedPunchRpcConflict: 0,
  normalizedPunchRpcFailure: 0,
  idempotentReplay: 0,
  storageUploadSuccess: 0,
  storageUploadFailure: 0,
  mediaAttachmentSuccess: 0,
  mediaAttachmentFailure: 0,
  pendingQueueDepth: 0,
  oldestPendingQueueAgeMs: 0
};

async function sendCentralTelemetry(eventType: string, details: any) {
  try {
    // Send event centrally to database exception log with TELEMETRY prefix
    await (supabase as any).from('mx_migration_exceptions').insert({
      timesheet_id: '00000000-0000-0000-0000-000000000000',
      array_index: 0,
      error_code: `TELEMETRY_${eventType}`,
      safe_details: JSON.stringify(details)
    });
  } catch (e) {
    // Non-blocking telemetry delivery
    console.warn('[Telemetry] Central emit warning:', e);
  }
}

export const telemetry = {
  recordRpcSuccess: (isIdempotentReplay = false) => {
    metrics.normalizedPunchRpcSuccess++;
    if (isIdempotentReplay) {
      metrics.idempotentReplay++;
    }
    console.log(`[Telemetry] RPC Success (Total: ${metrics.normalizedPunchRpcSuccess}, Replays: ${metrics.idempotentReplay})`);
    sendCentralTelemetry('RPC_SUCCESS', {
      totalSuccess: metrics.normalizedPunchRpcSuccess,
      isIdempotentReplay
    });
  },

  recordRpcConflict: (punchId: string) => {
    metrics.normalizedPunchRpcConflict++;
    console.warn(`[Telemetry] RPC Conflict for punchId ${punchId}`);
    sendCentralTelemetry('RPC_CONFLICT', { punchId, totalConflicts: metrics.normalizedPunchRpcConflict });
  },

  recordRpcFailure: (errorReason: string) => {
    metrics.normalizedPunchRpcFailure++;
    console.error(`[Telemetry] RPC Failure: ${errorReason}`);
    sendCentralTelemetry('RPC_FAILURE', { errorReason, totalFailures: metrics.normalizedPunchRpcFailure });
  },

  recordStorageUploadSuccess: () => {
    metrics.storageUploadSuccess++;
    console.log(`[Telemetry] Storage Upload Success (Total: ${metrics.storageUploadSuccess})`);
    sendCentralTelemetry('STORAGE_SUCCESS', { totalStorageSuccess: metrics.storageUploadSuccess });
  },

  recordStorageUploadFailure: (errorReason: string) => {
    metrics.storageUploadFailure++;
    console.error(`[Telemetry] Storage Upload Failure: ${errorReason}`);
    sendCentralTelemetry('STORAGE_FAILURE', { errorReason, totalStorageFailures: metrics.storageUploadFailure });
  },

  recordMediaAttachmentSuccess: () => {
    metrics.mediaAttachmentSuccess++;
    console.log(`[Telemetry] Media Attachment Success (Total: ${metrics.mediaAttachmentSuccess})`);
    sendCentralTelemetry('ATTACH_SUCCESS', { totalAttachSuccess: metrics.mediaAttachmentSuccess });
  },

  recordMediaAttachmentFailure: (errorReason: string) => {
    metrics.mediaAttachmentFailure++;
    console.error(`[Telemetry] Media Attachment Failure: ${errorReason}`);
    sendCentralTelemetry('ATTACH_FAILURE', { errorReason, totalAttachFailures: metrics.mediaAttachmentFailure });
  },

  updateQueueMetrics: (depth: number, oldestAgeMs: number) => {
    metrics.pendingQueueDepth = depth;
    metrics.oldestPendingQueueAgeMs = oldestAgeMs;
    sendCentralTelemetry('QUEUE_METRICS', { depth, oldestAgeMs });
  },

  getMetrics: (): Readonly<TelemetryMetrics> => {
    return { ...metrics };
  },

  resetMetrics: () => {
    metrics.normalizedPunchRpcSuccess = 0;
    metrics.normalizedPunchRpcConflict = 0;
    metrics.normalizedPunchRpcFailure = 0;
    metrics.idempotentReplay = 0;
    metrics.storageUploadSuccess = 0;
    metrics.storageUploadFailure = 0;
    metrics.mediaAttachmentSuccess = 0;
    metrics.mediaAttachmentFailure = 0;
    metrics.pendingQueueDepth = 0;
    metrics.oldestPendingQueueAgeMs = 0;
  }
};
