/**
 * Pure helpers for safe localStorage cleanup during app version upgrades (P0-4, P1-7)
 * and targeted session logout cleanup (P2-3).
 *
 * CRITICAL (P0-4): Never delete offline attendance device identity (`attendance_device_id`),
 * active shift evidence (`latnovva-active-shift-*`), or GPS cache (`latnovva_last_gps_fix`)
 * on version upgrades or routine session logouts.
 */
export function shouldPreserveStorageKeyOnUpgrade(key: string): boolean {
    if (
        key === 'attendance_device_id' ||
        key === 'latnovva-storage' ||
        key === 'latnovva_app_version' ||
        key === 'latnovva_last_gps_fix' ||
        key === 'cached_user_profile' ||
        key === 'device_fast_login_enabled' ||
        key === 'registered_push_endpoint' ||
        key === 'i18nextLng' ||
        key === 'survey_status'
    ) {
        return true;
    }

    if (
        key.startsWith('app_version_logged_') ||
        key.startsWith('sb-') ||
        key.includes('supabase.auth') ||
        key.startsWith('latnovva-active-shift-') ||
        key.startsWith('v6_face_descriptor_')
    ) {
        return true;
    }

    return false;
}

export function runVersionUpgradeStorageCleanup(
    storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { keys?: () => string[] },
    currentVersion: string,
    allKeys?: string[]
): { upgraded: boolean; removedKeys: string[] } {
    const storedVersion = storage.getItem('latnovva_app_version');
    if (storedVersion === currentVersion) {
        return { upgraded: false, removedKeys: [] };
    }

    const preservedStore = storage.getItem('latnovva-storage');
    const keys = allKeys ?? Object.keys(storage);
    const hasV6Descriptor = keys.some((k) => k.startsWith('v6_face_descriptor_'));
    const removedKeys: string[] = [];

    for (const k of keys) {
        // Prevent Dec 1 FaceLockScreen lockout: if upgrading without a v6 Face ID descriptor, disable fast-login lock
        if (k === 'device_fast_login_enabled' && !hasV6Descriptor) {
            storage.removeItem(k);
            removedKeys.push(k);
            continue;
        }
        if (!shouldPreserveStorageKeyOnUpgrade(k)) {
            storage.removeItem(k);
            removedKeys.push(k);
        }
    }

    storage.setItem('latnovva_app_version', currentVersion);
    if (preservedStore) {
        storage.setItem('latnovva-storage', preservedStore);
    }

    return { upgraded: true, removedKeys };
}

/**
 * Targeted logout cleanup (P2-3): removes auth/session tokens and user-specific Face/profile cache
 * while PRESERVING attendance_device_id, latnovva-active-shift-*, latnovva_last_gps_fix,
 * latnovva_app_version, and safe app preferences.
 */
export function clearAuthSessionStorage(
    storage: Pick<Storage, 'removeItem'> & Record<string, any>,
    _userId?: string | null,
    allKeys?: string[]
): string[] {
    const keys = allKeys ?? Object.keys(storage);
    const removed: string[] = [];

    for (const k of keys) {
        const shouldRemove =
            k.startsWith('sb-') ||
            k.includes('supabase.auth') ||
            k === 'cached_user_profile' ||
            k === 'cached_user_descriptor' ||
            k === 'device_fast_login_enabled' ||
            k === 'lnv_search_recent' ||
            k.startsWith('face_id_enrolled_') ||
            k.startsWith('face_id_rejected_') ||
            k.startsWith('v6_face_descriptor_');

        if (shouldRemove) {
            storage.removeItem(k);
            removed.push(k);
        }
    }

    return removed;
}
