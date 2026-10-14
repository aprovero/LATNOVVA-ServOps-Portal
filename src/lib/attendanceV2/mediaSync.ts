/**
 * Attendance V2 Event-Bound Media Synchronizer
 * Implements two-phase event/media synchronization.
 * Event ACK and Media ACK are completely decoupled.
 */

import { CachedMediaBlob, MediaSyncStatus } from './types';
import { AttendanceV2Database, attendanceV2Db } from './db';

export interface StorageUploader {
  uploadSelfie(params: {
    bucket: string;
    path: string;
    dataBase64: string;
    mimeType: string;
  }): Promise<{ success: boolean; error?: string }>;
}

export interface MediaRpcClient {
  requestAttendanceSelfieUpload(eventId: string): Promise<{
    success: boolean;
    bucket?: string;
    storage_path?: string;
    error?: string;
  }>;
  confirmAttendanceSelfieUpload(params: {
    eventId: string;
    storagePath: string;
    byteSize: number;
    sha256Hash: string;
  }): Promise<{
    success: boolean;
    media_id?: string;
    status?: string;
    error?: string;
  }>;
}

export class AttendanceV2MediaSync {
  private db: AttendanceV2Database;
  private rpcClient?: MediaRpcClient;
  private uploader?: StorageUploader;

  constructor(
    db: AttendanceV2Database = attendanceV2Db,
    rpcClient?: MediaRpcClient,
    uploader?: StorageUploader
  ) {
    this.db = db;
    this.rpcClient = rpcClient;
    this.uploader = uploader;
  }

  public setRpcClient(client: MediaRpcClient) {
    this.rpcClient = client;
  }

  public setUploader(uploader: StorageUploader) {
    this.uploader = uploader;
  }

  /**
   * Enqueues a captured selfie locally before network upload.
   */
  public async queueSelfie(params: {
    eventId: string;
    shiftId: string;
    personnelId: string;
    subsidiary: string;
    dataBase64: string;
    mimeType: string;
    sha256Hash: string;
    byteSize: number;
  }): Promise<CachedMediaBlob> {
    const mediaId = crypto.randomUUID();
    const now = new Date().toISOString();

    const mediaBlob: CachedMediaBlob = {
      media_id: mediaId,
      event_id: params.eventId,
      shift_id: params.shiftId,
      personnel_id: params.personnelId,
      subsidiary: params.subsidiary,
      media_type: 'SELFIE',
      data_base64: params.dataBase64,
      mime_type: params.mimeType,
      byte_size: params.byteSize,
      sha256_hash: params.sha256Hash,
      sync_status: 'PENDING',
      retry_count: 0,
      created_at: now,
      updated_at: now
    };

    await this.db.saveMediaBlob(mediaBlob);
    return mediaBlob;
  }

  /**
   * Synchronizes a single media blob with two-phase verification.
   */
  public async syncMediaBlob(mediaId: string): Promise<{
    success: boolean;
    status: MediaSyncStatus;
    error?: string;
  }> {
    if (!this.rpcClient || !this.uploader) {
      throw new Error('MediaRpcClient or StorageUploader not configured on AttendanceV2MediaSync');
    }

    const media = await this.db.getMediaBlob(mediaId);
    if (!media) {
      return { success: false, status: 'REJECTED', error: 'Media blob not found in IndexedDB' };
    }

    if (media.sync_status === 'UPLOADED') {
      return { success: true, status: 'UPLOADED' };
    }

    media.sync_status = 'UPLOADING';
    await this.db.saveMediaBlob(media);

    try {
      // Phase 1: Request upload path & verify event binding
      const reqRes = await this.rpcClient.requestAttendanceSelfieUpload(media.event_id);
      if (!reqRes.success || !reqRes.bucket || !reqRes.storage_path) {
        media.sync_status = 'FAILED_RETRYABLE';
        media.error_message = reqRes.error || 'Server rejected upload request';
        media.retry_count++;
        await this.db.saveMediaBlob(media);
        return { success: false, status: 'FAILED_RETRYABLE', error: media.error_message };
      }

      // Phase 2: Binary upload to private storage
      const uploadRes = await this.uploader.uploadSelfie({
        bucket: reqRes.bucket,
        path: reqRes.storage_path,
        dataBase64: media.data_base64,
        mimeType: media.mime_type
      });

      if (!uploadRes.success) {
        media.sync_status = 'FAILED_RETRYABLE';
        media.error_message = uploadRes.error || 'Storage upload network failure';
        media.retry_count++;
        await this.db.saveMediaBlob(media);
        return { success: false, status: 'FAILED_RETRYABLE', error: media.error_message };
      }

      // Phase 3: Server Confirmation of stored object
      const confRes = await this.rpcClient.confirmAttendanceSelfieUpload({
        eventId: media.event_id,
        storagePath: reqRes.storage_path,
        byteSize: media.byte_size,
        sha256Hash: media.sha256_hash
      });

      if (confRes.success) {
        media.sync_status = 'UPLOADED';
        media.remote_storage_path = reqRes.storage_path;
        media.error_message = undefined;
        await this.db.saveMediaBlob(media);
        return { success: true, status: 'UPLOADED' };
      } else {
        media.sync_status = 'FAILED_RETRYABLE';
        media.error_message = confRes.error || 'Server confirmation failure';
        media.retry_count++;
        await this.db.saveMediaBlob(media);
        return { success: false, status: 'FAILED_RETRYABLE', error: media.error_message };
      }
    } catch (err: any) {
      media.sync_status = 'FAILED_RETRYABLE';
      media.error_message = String(err.message || err);
      media.retry_count++;
      await this.db.saveMediaBlob(media);
      return { success: false, status: 'FAILED_RETRYABLE', error: media.error_message };
    }
  }

  /**
   * Synchronizes all pending media blobs in IndexedDB.
   */
  public async syncAllPendingMedia(): Promise<{
    total_processed: number;
    uploaded_count: number;
    failed_count: number;
  }> {
    const pending = await this.db.getPendingMediaBlobs();
    let uploaded = 0;
    let failed = 0;

    for (const item of pending) {
      const res = await this.syncMediaBlob(item.media_id);
      if (res.success) {
        uploaded++;
      } else {
        failed++;
      }
    }

    return {
      total_processed: pending.length,
      uploaded_count: uploaded,
      failed_count: failed
    };
  }
}
