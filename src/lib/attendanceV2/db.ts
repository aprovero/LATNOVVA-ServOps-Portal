/**
 * Attendance V2 Dedicated IndexedDB Storage Subsystem
 * DB Name: latnovva_attendance_v2_db
 * Separately namespaced, completely independent of legacy localStorage or Zustand.
 */

import {
  QueuedAttendanceEvent,
  DurableActiveShift,
  CachedOfflineLease,
  CachedProjectGeofence,
  CachedMediaBlob
} from './types';

const DB_NAME = 'latnovva_attendance_v2_db';
const DB_VERSION = 1;

export const STORES = {
  QUEUED_EVENTS: 'queued_events',
  ACTIVE_SHIFTS: 'active_shifts',
  ACTIVE_LEASES: 'active_leases',
  CACHED_GEOFENCES: 'cached_geofences',
  MEDIA_BLOBS: 'media_blobs',
} as const;

export class AttendanceV2Database {
  private db: IDBDatabase | null = null;
  private isMemoryFallback = false;
  private memoryStores = {
    queued_events: new Map<string, QueuedAttendanceEvent>(),
    active_shifts: new Map<string, DurableActiveShift>(),
    active_leases: new Map<string, CachedOfflineLease>(),
    cached_geofences: new Map<string, CachedProjectGeofence>(),
    media_blobs: new Map<string, CachedMediaBlob>(),
  };

  constructor(forceMemory = false) {
    if (forceMemory || typeof window === 'undefined' || !window.indexedDB) {
      this.isMemoryFallback = true;
    }
  }

  public async init(): Promise<void> {
    if (this.isMemoryFallback) {
      return;
    }

    if (this.db) {
      return;
    }

    // Request persistent storage if supported
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (err) {
        console.warn('[AttendanceV2DB] Persistent storage request error:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('[AttendanceV2DB] IndexedDB open error, falling back to in-memory store');
        this.isMemoryFallback = true;
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. queued_events
        if (!db.objectStoreNames.contains(STORES.QUEUED_EVENTS)) {
          const store = db.createObjectStore(STORES.QUEUED_EVENTS, { keyPath: 'event_id' });
          store.createIndex('by_shift_id', 'shift_id', { unique: false });
          store.createIndex('by_sync_status', 'sync_status', { unique: false });
          store.createIndex('by_causal_sequence', 'causal_sequence', { unique: false });
        }

        // 2. active_shifts
        if (!db.objectStoreNames.contains(STORES.ACTIVE_SHIFTS)) {
          const store = db.createObjectStore(STORES.ACTIVE_SHIFTS, { keyPath: 'shift_id' });
          store.createIndex('by_personnel_id', 'personnel_id', { unique: false });
          store.createIndex('by_state', 'state', { unique: false });
        }

        // 3. active_leases
        if (!db.objectStoreNames.contains(STORES.ACTIVE_LEASES)) {
          const store = db.createObjectStore(STORES.ACTIVE_LEASES, { keyPath: 'lease_id' });
          store.createIndex('by_personnel_id', 'personnel_id', { unique: false });
        }

        // 4. cached_geofences
        if (!db.objectStoreNames.contains(STORES.CACHED_GEOFENCES)) {
          db.createObjectStore(STORES.CACHED_GEOFENCES, { keyPath: 'project_id' });
        }

        // 5. media_blobs
        if (!db.objectStoreNames.contains(STORES.MEDIA_BLOBS)) {
          const store = db.createObjectStore(STORES.MEDIA_BLOBS, { keyPath: 'media_id' });
          store.createIndex('by_event_id', 'event_id', { unique: false });
          store.createIndex('by_sync_status', 'sync_status', { unique: false });
        }
      };
    });
  }

  // --- QUEUED EVENTS ---
  public async saveQueuedEvent(event: QueuedAttendanceEvent): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.queued_events.set(event.event_id, { ...event });
      return;
    }
    return this.tx(STORES.QUEUED_EVENTS, 'readwrite', (store) => store.put(event));
  }

  public async getQueuedEvent(eventId: string): Promise<QueuedAttendanceEvent | null> {
    await this.init();
    if (this.isMemoryFallback) {
      return this.memoryStores.queued_events.get(eventId) || null;
    }
    return this.tx(STORES.QUEUED_EVENTS, 'readonly', (store) => store.get(eventId));
  }

  public async getQueuedEventsByShift(shiftId: string): Promise<QueuedAttendanceEvent[]> {
    await this.init();
    if (this.isMemoryFallback) {
      return Array.from(this.memoryStores.queued_events.values())
        .filter((e) => e.shift_id === shiftId)
        .sort((a, b) => a.causal_sequence - b.causal_sequence);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.QUEUED_EVENTS, 'readonly');
      const store = tx.objectStore(STORES.QUEUED_EVENTS);
      const index = store.index('by_shift_id');
      const req = index.getAll(shiftId);
      req.onsuccess = () => {
        const events = (req.result as QueuedAttendanceEvent[]).sort(
          (a, b) => a.causal_sequence - b.causal_sequence
        );
        resolve(events);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllQueuedEvents(): Promise<QueuedAttendanceEvent[]> {
    await this.init();
    if (this.isMemoryFallback) {
      return Array.from(this.memoryStores.queued_events.values()).sort(
        (a, b) => a.causal_sequence - b.causal_sequence
      );
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.QUEUED_EVENTS, 'readonly');
      const store = tx.objectStore(STORES.QUEUED_EVENTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const events = (req.result as QueuedAttendanceEvent[]).sort(
          (a, b) => a.causal_sequence - b.causal_sequence
        );
        resolve(events);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteQueuedEvent(eventId: string): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.queued_events.delete(eventId);
      return;
    }
    return this.tx(STORES.QUEUED_EVENTS, 'readwrite', (store) => store.delete(eventId));
  }

  // --- ACTIVE SHIFTS ---
  public async saveActiveShift(shift: DurableActiveShift): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.active_shifts.set(shift.shift_id, { ...shift, updated_at: new Date().toISOString() });
      return;
    }
    return this.tx(STORES.ACTIVE_SHIFTS, 'readwrite', (store) =>
      store.put({ ...shift, updated_at: new Date().toISOString() })
    );
  }

  public async getActiveShift(shiftId: string): Promise<DurableActiveShift | null> {
    await this.init();
    if (this.isMemoryFallback) {
      return this.memoryStores.active_shifts.get(shiftId) || null;
    }
    return this.tx(STORES.ACTIVE_SHIFTS, 'readonly', (store) => store.get(shiftId));
  }

  public async getCurrentActiveShiftForPersonnel(personnelId: string): Promise<DurableActiveShift | null> {
    await this.init();
    if (this.isMemoryFallback) {
      const shifts = Array.from(this.memoryStores.active_shifts.values());
      return shifts.find((s) => s.personnel_id === personnelId && s.state === 'ACTIVE') || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.ACTIVE_SHIFTS, 'readonly');
      const store = tx.objectStore(STORES.ACTIVE_SHIFTS);
      const index = store.index('by_personnel_id');
      const req = index.getAll(personnelId);
      req.onsuccess = () => {
        const shifts = req.result as DurableActiveShift[];
        const active = shifts.find((s) => s.state === 'ACTIVE');
        resolve(active || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllActiveShifts(): Promise<DurableActiveShift[]> {
    await this.init();
    if (this.isMemoryFallback) {
      return Array.from(this.memoryStores.active_shifts.values());
    }
    return this.tx(STORES.ACTIVE_SHIFTS, 'readonly', (store) => store.getAll());
  }

  public async deleteActiveShift(shiftId: string): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.active_shifts.delete(shiftId);
      return;
    }
    return this.tx(STORES.ACTIVE_SHIFTS, 'readwrite', (store) => store.delete(shiftId));
  }

  // --- ACTIVE LEASES ---
  public async saveOfflineLease(lease: CachedOfflineLease): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.active_leases.set(lease.lease_id, { ...lease });
      return;
    }
    return this.tx(STORES.ACTIVE_LEASES, 'readwrite', (store) => store.put(lease));
  }

  public async getOfflineLease(leaseId: string): Promise<CachedOfflineLease | null> {
    await this.init();
    if (this.isMemoryFallback) {
      return this.memoryStores.active_leases.get(leaseId) || null;
    }
    return this.tx(STORES.ACTIVE_LEASES, 'readonly', (store) => store.get(leaseId));
  }

  public async getLatestOfflineLeaseForPersonnel(personnelId: string): Promise<CachedOfflineLease | null> {
    await this.init();
    if (this.isMemoryFallback) {
      const leases = Array.from(this.memoryStores.active_leases.values())
        .filter((l) => l.personnel_id === personnelId && !l.is_revoked)
        .sort((a, b) => new Date(b.valid_until).getTime() - new Date(a.valid_until).getTime());
      return leases[0] || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.ACTIVE_LEASES, 'readonly');
      const store = tx.objectStore(STORES.ACTIVE_LEASES);
      const index = store.index('by_personnel_id');
      const req = index.getAll(personnelId);
      req.onsuccess = () => {
        const leases = (req.result as CachedOfflineLease[])
          .filter((l) => !l.is_revoked)
          .sort((a, b) => new Date(b.valid_until).getTime() - new Date(a.valid_until).getTime());
        resolve(leases[0] || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- CACHED GEOFENCES ---
  public async saveCachedGeofence(geofence: CachedProjectGeofence): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.cached_geofences.set(geofence.project_id, { ...geofence });
      return;
    }
    return this.tx(STORES.CACHED_GEOFENCES, 'readwrite', (store) => store.put(geofence));
  }

  public async getCachedGeofence(projectId: string): Promise<CachedProjectGeofence | null> {
    await this.init();
    if (this.isMemoryFallback) {
      return this.memoryStores.cached_geofences.get(projectId) || null;
    }
    return this.tx(STORES.CACHED_GEOFENCES, 'readonly', (store) => store.get(projectId));
  }

  // --- MEDIA BLOBS ---
  public async saveMediaBlob(media: CachedMediaBlob): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.media_blobs.set(media.media_id, { ...media, updated_at: new Date().toISOString() });
      return;
    }
    return this.tx(STORES.MEDIA_BLOBS, 'readwrite', (store) =>
      store.put({ ...media, updated_at: new Date().toISOString() })
    );
  }

  public async getMediaBlob(mediaId: string): Promise<CachedMediaBlob | null> {
    await this.init();
    if (this.isMemoryFallback) {
      return this.memoryStores.media_blobs.get(mediaId) || null;
    }
    return this.tx(STORES.MEDIA_BLOBS, 'readonly', (store) => store.get(mediaId));
  }

  public async getMediaBlobByEvent(eventId: string): Promise<CachedMediaBlob | null> {
    await this.init();
    if (this.isMemoryFallback) {
      const items = Array.from(this.memoryStores.media_blobs.values());
      return items.find((m) => m.event_id === eventId) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.MEDIA_BLOBS, 'readonly');
      const store = tx.objectStore(STORES.MEDIA_BLOBS);
      const index = store.index('by_event_id');
      const req = index.get(eventId);
      req.onsuccess = () => resolve((req.result as CachedMediaBlob) || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getPendingMediaBlobs(): Promise<CachedMediaBlob[]> {
    await this.init();
    if (this.isMemoryFallback) {
      return Array.from(this.memoryStores.media_blobs.values()).filter(
        (m) => m.sync_status === 'PENDING' || m.sync_status === 'FAILED_RETRYABLE'
      );
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORES.MEDIA_BLOBS, 'readonly');
      const store = tx.objectStore(STORES.MEDIA_BLOBS);
      const index = store.index('by_sync_status');
      const req = index.getAll('PENDING');
      req.onsuccess = () => resolve((req.result as CachedMediaBlob[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteMediaBlob(mediaId: string): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.media_blobs.delete(mediaId);
      return;
    }
    return this.tx(STORES.MEDIA_BLOBS, 'readwrite', (store) => store.delete(mediaId));
  }

  // --- PURGE / RESET ---
  public async clearAll(): Promise<void> {
    await this.init();
    if (this.isMemoryFallback) {
      this.memoryStores.queued_events.clear();
      this.memoryStores.active_shifts.clear();
      this.memoryStores.active_leases.clear();
      this.memoryStores.cached_geofences.clear();
      this.memoryStores.media_blobs.clear();
      return;
    }
    for (const storeName of Object.values(STORES)) {
      await this.tx(storeName, 'readwrite', (store) => store.clear());
    }
  }

  private tx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }
      const transaction = this.db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Global singleton instance
export const attendanceV2Db = new AttendanceV2Database();
