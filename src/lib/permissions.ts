/**
 * Utility to request initial device permissions (Location, Notifications)
 * Should be called in response to a direct user action (like clicking the Login button)
 * to comply with browser anti-abuse policies.
 */

export const requestInitialPermissions = async (): Promise<void> => {
    console.log('[Permissions] Requesting initial device permissions...');

    // 1. Request Notification Permission
    if ('Notification' in window) {
        try {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                console.log(`[Permissions] Notification permission: ${permission}`);
            }
        } catch (err) {
            console.warn('[Permissions] Failed to request Notification permission:', err);
        }
    }

    // 2. Request Geolocation Permission
    if ('geolocation' in navigator) {
        try {
            // We only want to trigger the prompt, we don't necessarily need the location data immediately.
            // Using a short timeout so it doesn't block if GPS is slow.
            navigator.geolocation.getCurrentPosition(
                () => {
                    console.log('[Permissions] Geolocation permission granted.');
                },
                (err) => {
                    console.warn(`[Permissions] Geolocation error (${err.code}): ${err.message}`);
                },
                { timeout: 5000, maximumAge: 60000 }
            );
        } catch (err) {
            console.warn('[Permissions] Failed to request Geolocation permission:', err);
        }
    }
};
