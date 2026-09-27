import { supabase } from './supabase';
import { telemetry } from './telemetry';
import { clearActiveShift } from './activeShiftManager';

export type PunchQueueState =
  | 'LOCAL_PENDING'
  | 'PUNCH_SYNCING'
  | 'PUNCH_SYNCED'
  | 'MEDIA_PENDING'
  | 'MEDIA_UPLOADING'
  | 'COMPLETE'
  | 'ERROR_RETRYABLE'
  | 'ERROR_CONFLICT';

export interface NormalizedPendingPunch {
  punchId: string;
  timestamp: string;
  date: string;
  type: 'clockIn' | 'clockOut';
  targetPersonnelId: string;
  timesheetId?: string;
  projectId?: string;
  workMode: 'On Site' | 'Home Office';
  lat?: number;
  lng?: number;
  accuracy?: number;
  timeSource?: 'gps' | 'device';
  manualAdjustment?: boolean;
  adjustmentNote?: string;
  faceVerified?: boolean;
  faceBypassReason?: string;
  isOutsourced?: boolean;
  outsourcedName?: string;
  isZombieClose?: boolean;
  gpsVerified?: boolean;
  
  // Media evidence
  selfieBase64?: string;
  selfieStoragePath?: string;
  signatureBase64?: string;
  signatureStoragePath?: string;
  
  // Queue state machine & retry metadata
  queueState: PunchQueueState;
  retryCount: number;
  lastAttempt?: string;
  lastError?: string;
  createdAt: string;
}

/**
 * Helper to convert Base64 string (data:image/jpeg;base64,... or raw base64) to Uint8Array / Blob
 */
export function base64ToBlob(base64Data: string, contentType = 'image/jpeg'): Blob {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * Process a single normalized punch queue item through the state machine.
 */
export async function processNormalizedPunchItem(
  item: NormalizedPendingPunch,
  subsidiary: string = 'MX'
): Promise<{ updatedItem: NormalizedPendingPunch; isComplete: boolean }> {
  const updatedItem: NormalizedPendingPunch = { ...item, lastAttempt: new Date().toISOString() };

  // ------------------------------------------------------------------------
  // STEP 1: Execute RPC record_clock_punch if not yet synced on server
  // ------------------------------------------------------------------------
  const needsRpcSync = ['LOCAL_PENDING', 'PUNCH_SYNCING', 'ERROR_RETRYABLE'].includes(updatedItem.queueState);

  if (needsRpcSync) {
    updatedItem.queueState = 'PUNCH_SYNCING';
    try {
      const { data, error } = await (supabase as any).rpc('record_clock_punch', {
        p_punch_id: updatedItem.punchId,
        p_timestamp: updatedItem.timestamp,
        p_type: updatedItem.type,
        p_date: updatedItem.date,
        p_target_personnel_id: updatedItem.targetPersonnelId,
        p_timesheet_id: updatedItem.timesheetId || null,
        p_project_id: updatedItem.projectId || null,
        p_work_mode: updatedItem.workMode || 'On Site',
        p_lat: updatedItem.lat ?? null,
        p_lng: updatedItem.lng ?? null,
        p_accuracy: updatedItem.accuracy ?? null,
        p_time_source: updatedItem.timeSource || 'device',
        p_manual_adjustment: updatedItem.manualAdjustment || false,
        p_adjustment_note: updatedItem.adjustmentNote || null,
        p_face_verified: updatedItem.faceVerified || false,
        p_face_bypass_reason: updatedItem.faceBypassReason || null,
        p_is_outsourced: updatedItem.isOutsourced || false,
        p_outsourced_name: updatedItem.outsourcedName || null,
        p_is_zombie_close: updatedItem.isZombieClose || false,
        p_gps_verified: updatedItem.gpsVerified || false,
        p_selfie_url: null,
        p_selfie_blob: null
      });

      if (error) {
        if (error.message?.includes('Conflict') || error.code === '23505') {
          updatedItem.queueState = 'ERROR_CONFLICT';
          updatedItem.lastError = error.message;
          telemetry.recordRpcConflict(updatedItem.punchId);
          return { updatedItem, isComplete: false };
        } else {
          throw error;
        }
      }

      if (data && data.success) {
        updatedItem.timesheetId = data.timesheet_id;
        telemetry.recordRpcSuccess(!!data.idempotent_retry);

        if (updatedItem.type === 'clockOut') {
          clearActiveShift(updatedItem.targetPersonnelId);
        }

        if (updatedItem.selfieBase64 || updatedItem.signatureBase64) {
          updatedItem.queueState = 'MEDIA_PENDING';
        } else {
          updatedItem.queueState = 'COMPLETE';
          return { updatedItem, isComplete: true };
        }
      }
    } catch (err: any) {
      updatedItem.retryCount++;
      updatedItem.lastError = err.message || String(err);
      updatedItem.queueState = 'ERROR_RETRYABLE';
      telemetry.recordRpcFailure(updatedItem.lastError || 'Unknown RPC failure');
      return { updatedItem, isComplete: false };
    }
  }

  // ------------------------------------------------------------------------
  // STEP 2: Process Selfie Media Upload & Attachment
  // ------------------------------------------------------------------------
  if (
    ['PUNCH_SYNCED', 'MEDIA_PENDING', 'MEDIA_UPLOADING', 'ERROR_RETRYABLE'].includes(updatedItem.queueState) &&
    updatedItem.timesheetId &&
    updatedItem.selfieBase64
  ) {
    updatedItem.queueState = 'MEDIA_UPLOADING';
    const selfiePath = `selfies/${subsidiary}/${updatedItem.targetPersonnelId}/${updatedItem.timesheetId}/${updatedItem.punchId}.jpg`;
    updatedItem.selfieStoragePath = selfiePath;

    try {
      const selfieBlob = base64ToBlob(updatedItem.selfieBase64, 'image/jpeg');
      const { error: uploadErr } = await supabase.storage
        .from('attendance-media')
        .upload(selfiePath, selfieBlob, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        telemetry.recordStorageUploadFailure(uploadErr.message);
        updatedItem.retryCount++;
        updatedItem.lastError = uploadErr.message;
        updatedItem.queueState = 'ERROR_RETRYABLE';
        return { updatedItem, isComplete: false };
      }

      telemetry.recordStorageUploadSuccess();

      // Call attachment RPC
      const { error: attachErr } = await (supabase as any).rpc('attach_worker_selfie', {
        p_punch_id: updatedItem.punchId,
        p_selfie_url: selfiePath,
        p_selfie_blob: null
      });

      if (attachErr) {
        telemetry.recordMediaAttachmentFailure(attachErr.message);
        updatedItem.retryCount++;
        updatedItem.lastError = attachErr.message;
        updatedItem.queueState = 'ERROR_RETRYABLE';
        return { updatedItem, isComplete: false };
      }

      telemetry.recordMediaAttachmentSuccess();
      delete updatedItem.selfieBase64; // Safely discard Base64 now that Storage attachment succeeded!
    } catch (mediaErr: any) {
      telemetry.recordStorageUploadFailure(mediaErr.message || String(mediaErr));
      updatedItem.retryCount++;
      updatedItem.lastError = mediaErr.message || String(mediaErr);
      updatedItem.queueState = 'ERROR_RETRYABLE';
      return { updatedItem, isComplete: false };
    }
  }

  // ------------------------------------------------------------------------
  // STEP 3: Process Supervisor Signature Upload & Attachment
  // ------------------------------------------------------------------------
  if (
    ['PUNCH_SYNCED', 'MEDIA_PENDING', 'MEDIA_UPLOADING', 'ERROR_RETRYABLE'].includes(updatedItem.queueState) &&
    updatedItem.timesheetId &&
    updatedItem.signatureBase64
  ) {
    updatedItem.queueState = 'MEDIA_UPLOADING';
    const sigPath = `signatures/${subsidiary}/${updatedItem.targetPersonnelId}/${updatedItem.timesheetId}/${updatedItem.punchId}.png`;
    updatedItem.signatureStoragePath = sigPath;

    try {
      const sigBlob = base64ToBlob(updatedItem.signatureBase64, 'image/png');
      const { error: uploadErr } = await supabase.storage
        .from('attendance-media')
        .upload(sigPath, sigBlob, { contentType: 'image/png', upsert: true });

      if (uploadErr) {
        telemetry.recordStorageUploadFailure(uploadErr.message);
        updatedItem.retryCount++;
        updatedItem.lastError = uploadErr.message;
        updatedItem.queueState = 'ERROR_RETRYABLE';
        return { updatedItem, isComplete: false };
      }

      telemetry.recordStorageUploadSuccess();

      const { error: attachErr } = await (supabase as any).rpc('attach_supervisor_signature', {
        p_punch_id: updatedItem.punchId,
        p_signature_url: sigPath,
        p_signature_blob: null
      });

      if (attachErr) {
        telemetry.recordMediaAttachmentFailure(attachErr.message);
        updatedItem.retryCount++;
        updatedItem.lastError = attachErr.message;
        updatedItem.queueState = 'ERROR_RETRYABLE';
        return { updatedItem, isComplete: false };
      }

      telemetry.recordMediaAttachmentSuccess();
      delete updatedItem.signatureBase64;
    } catch (sigErr: any) {
      telemetry.recordStorageUploadFailure(sigErr.message || String(sigErr));
      updatedItem.retryCount++;
      updatedItem.lastError = sigErr.message || String(sigErr);
      updatedItem.queueState = 'ERROR_RETRYABLE';
      return { updatedItem, isComplete: false };
    }
  }

  // If no remaining Base64 media and RPC succeeded, mark COMPLETE
  if (!updatedItem.selfieBase64 && !updatedItem.signatureBase64 && updatedItem.timesheetId) {
    updatedItem.queueState = 'COMPLETE';
    return { updatedItem, isComplete: true };
  }

  return { updatedItem, isComplete: false };
}

/**
 * Generate a short-lived signed URL for private Storage objects (valid for 60 minutes)
 */
export async function getSignedMediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:')) return path;

  try {
    const { data, error } = await supabase.storage
      .from('attendance-media')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      console.warn(`[getSignedMediaUrl] Failed to generate signed URL for path ${path}:`, error);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error(`[getSignedMediaUrl] Exception for path ${path}:`, e);
    return null;
  }
}
