import type { CachedOfflineLease } from './types';

/**
 * Fail-closed offline Attendance V2 bootstrap authority check (PASS 15B / Item 6).
 *
 * Allows V2 offline-capable attendance mode when the server is unreachable ONLY if:
 * 1. A server-issued CachedOfflineLease exists for the authenticated personnel_id
 * 2. The lease is NOT revoked and is unexpired (valid_until > nowMs)
 * 3. If the lease is device-bound (device_id present), it matches the local attendance_device_id
 *
 * Otherwise returns false (fail closed -> attendanceWriteMode: 'ERROR').
 */
export function canBootstrapOfflineV2WithLease(
  lease: CachedOfflineLease | null | undefined,
  personnelId: string | null | undefined,
  localDeviceId: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!lease || !personnelId) return false;
  if (lease.is_revoked) return false;
  if (lease.personnel_id !== personnelId) return false;

  const validUntilMs = new Date(lease.valid_until).getTime();
  if (!Number.isFinite(validUntilMs) || validUntilMs <= nowMs) return false;

  if (lease.device_id) {
    if (!localDeviceId || lease.device_id !== localDeviceId) return false;
  }

  return true;
}
