import React, { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { requestInitialPermissions } from '../lib/permissions';

export const NotificationStatus: React.FC = () => {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const { t } = useTranslation();

    const updatePermissionState = () => {
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    };

    useEffect(() => {
        updatePermissionState();

        // Check again when window gains focus (in case they updated it in browser settings)
        window.addEventListener('focus', updatePermissionState);
        return () => window.removeEventListener('focus', updatePermissionState);
    }, []);

    const handleClick = async () => {
        if ('Notification' in window && Notification.permission === 'denied') {
            alert(t('notifications.blocked_alert', 'Las notificaciones están bloqueadas en tu navegador. Por favor, haz clic en el candado de la barra de direcciones y actívalas.'));
            return;
        }
        await requestInitialPermissions();
        updatePermissionState();
    };

    if (!('Notification' in window)) {
        return null; // Don't show if notifications are not supported
    }

    const isGranted = permission === 'granted';

    return (
        <button
            onClick={handleClick}
            title={isGranted ? "Push Notifications Active" : "Enable Push Notifications"}
            className={`flex items-center justify-center w-8 h-8 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                isGranted
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                    : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100 animate-pulse'
            }`}
        >
            {isGranted ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
    );
};
