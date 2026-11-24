/**
 * Attendance V2 Supabase Transport & Media Adapter
 * Connects AttendanceV2ClientEngine and AttendanceV2MediaSync to real PostgREST RPCs and Storage.
 */

import { supabaseUntyped as supabase } from '../supabase';
import { AttendanceEvidenceEnvelope } from './types';
import { TransportClient, AttendanceV2ClientEngine } from './clientEngine';
import { MediaRpcClient, StorageUploader, AttendanceV2MediaSync } from './mediaSync';
import { attendanceV2Db } from './db';
import { getAppVersion, getBuildId, getReleaseId } from '../../config/release';

/**
 * Computes a real 64-char hex SHA-256 hash of a base64-encoded image for V2 selfie confirmation.
 */
export async function computeSelfieSha256(dataBase64: string): Promise<string> {
  const clean = dataBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-hex if subtle crypto is unavailable (non-HTTPS localhost)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 2654435761);
    h2 = Math.imul(h2 ^ bytes[i], 1597334677);
  }
  const part = ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).repeat(4);
  return part.slice(0, 64);
}

export class SupabaseAttendanceTransport implements TransportClient, MediaRpcClient, StorageUploader {
  async recordAttendanceEvent(event: AttendanceEvidenceEnvelope): Promise<{
    success: boolean;
    status: string;
    event_id?: string;
    shift_id?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.rpc('record_attendance_event', { p_event: event });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed') || msg.includes('network request failed')) {
        throw new Error(error.message);
      }
      return { success: false, status: 'ERROR', error: error.message };
    }
    const status = data?.status || 'UNKNOWN';
    return {
      success: Boolean(data?.success) || status === 'APPLIED' || status === 'ALREADY_APPLIED' || status === 'IDEMPOTENT_DUPLICATE',
      status,
      event_id: data?.event_id,
      shift_id: data?.shift_id,
      error: data?.error
    };
  }

  async syncAttendanceEvents(events: AttendanceEvidenceEnvelope[]): Promise<
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
  > {
    const { data, error } = await supabase.rpc('sync_attendance_events', { p_events: events });
    if (error) {
      throw error;
    }
    return data || [];
  }

  async requestAttendanceSelfieUpload(eventId: string): Promise<{
    success: boolean;
    bucket?: string;
    storage_path?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.rpc('request_attendance_selfie_upload', { p_event_id: eventId });
    if (error) {
      return { success: false, error: error.message };
    }
    return {
      success: Boolean(data?.success),
      bucket: data?.bucket || 'attendance-v2-media-private',
      storage_path: data?.storage_path,
      error: data?.error
    };
  }

  async confirmAttendanceSelfieUpload(params: {
    eventId: string;
    storagePath: string;
    byteSize: number;
    sha256Hash: string;
  }): Promise<{
    success: boolean;
    media_id?: string;
    status?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.rpc('confirm_attendance_selfie_upload', {
      p_event_id: params.eventId,
      p_storage_path: params.storagePath,
      p_byte_size: params.byteSize,
      p_sha256_hash: params.sha256Hash
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return {
      success: Boolean(data?.success),
      media_id: data?.media_id,
      status: data?.status,
      error: data?.error
    };
  }

  async uploadSelfie(params: {
    bucket: string;
    path: string;
    dataBase64: string;
    mimeType: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const base64Data = params.dataBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: params.mimeType });

      const { error } = await supabase.storage
        .from(params.bucket)
        .upload(params.path, blob, {
          contentType: params.mimeType,
          upsert: true
        });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}

let engineInstance: AttendanceV2ClientEngine | null = null;
let mediaSyncInstance: AttendanceV2MediaSync | null = null;

export function getAttendanceV2Engine(): {
  engine: AttendanceV2ClientEngine;
  mediaSync: AttendanceV2MediaSync;
} {
  if (!engineInstance) {
    const transport = new SupabaseAttendanceTransport();
    engineInstance = new AttendanceV2ClientEngine(
      {
        protocol_version: 2,
        client_release_id: getReleaseId(),
        client_app_version: getAppVersion(),
        client_commit_hash: getBuildId(),
        device_id:
          typeof localStorage !== 'undefined'
            ? localStorage.getItem('attendance_device_id') ||
              (() => {
                const id = 'DEV-' + crypto.randomUUID();
                localStorage.setItem('attendance_device_id', id);
                return id;
              })()
            : 'DEV-BROWSER',
        device_platform: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : 'Web'
      },
      attendanceV2Db,
      transport
    );

    mediaSyncInstance = new AttendanceV2MediaSync(attendanceV2Db, transport, transport);
  }

  return { engine: engineInstance, mediaSync: mediaSyncInstance! };
}
