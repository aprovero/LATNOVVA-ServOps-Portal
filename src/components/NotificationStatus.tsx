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
    const label = isGranted 
        ? t('notifications.status.active', 'Notificaciones Activas') 
        : t('notifications.status.enable', 'Activar Notificaciones');

    return (
        <button
            onClick={handleClick}
            title={label}
            className={`group relative flex items-center h-8 rounded-full border shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 active:scale-95 cursor-pointer select-none shrink-0 ${
                isGranted
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-200'
                    : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:border-red-200 animate-pulse'
            }`}
        >
            {isGranted ? <Bell size={16} className="shrink-0" /> : <BellOff size={16} className="shrink-0" />}
            <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[180px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold leading-none select-none">
                {label}
            </span>
        </button>
    );
};
