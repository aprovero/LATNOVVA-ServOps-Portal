import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

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
                if (permission === 'granted') {
                    // Subscribe user to push notifications automatically after permission is granted
                    subscribeUserToPush();
                }
            } else if (Notification.permission === 'granted') {
                // If already granted, verify push subscription
                subscribeUserToPush();
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

/**
 * Registers the device browser with the web push service and saves the subscription to Supabase.
 */
export const subscribeUserToPush = async (): Promise<void> => {
    if (!VAPID_PUBLIC_KEY) {
        console.warn('[Push] Missing VITE_VAPID_PUBLIC_KEY in environment, skipping subscription registration');
        return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[Push] Service worker or Push notifications not supported by browser');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Get existing subscription or create a new one
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            console.log('[Push] Creating new push subscription...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        console.log('[Push] Subscription obtained:', subscription);

        // Get current auth user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.warn('[Push] No authenticated user found, skipping subscription registration in database.');
            return;
        }

        // Upsert subscription to database using raw endpoint as conflict target or using the unique index
        const subscriptionJson = subscription.toJSON();
        const { error } = await (supabase as any)
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                subscription: subscriptionJson,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'subscription' // Handled by unique constraint index
            });

        if (error) {
            console.error('[Push] Failed to save subscription to database:', error);
        } else {
            console.log('[Push] Subscription successfully registered in Supabase');
        }
    } catch (err) {
        console.error('[Push] Error subscribing user to push notifications:', err);
    }
};
