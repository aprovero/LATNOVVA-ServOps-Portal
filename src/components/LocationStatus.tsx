import React, { useEffect, useState } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const LocationStatus: React.FC = () => {
    const [status, setStatus] = useState<PermissionState>('prompt');
    const { t } = useTranslation();

    const updatePermissionState = async () => {
        if ('permissions' in navigator) {
            try {
                const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                setStatus(res.state);
                res.onchange = () => {
                    setStatus(res.state);
                };
            } catch (err) {
                console.warn('[LocationStatus] Permissions API geolocation query error:', err);
                // Fallback detection
                navigator.geolocation.getCurrentPosition(
                    () => setStatus('granted'),
                    (e) => {
                        if (e.code === e.PERMISSION_DENIED) {
                            setStatus('denied');
                        } else {
                            setStatus('prompt');
                        }
                    }
                );
            }
        }
    };

    useEffect(() => {
        updatePermissionState();

        window.addEventListener('focus', updatePermissionState);
        return () => window.removeEventListener('focus', updatePermissionState);
    }, []);

    const handleClick = async () => {
        if (status === 'denied') {
            alert(t('location.blocked_alert', 'El acceso a la ubicación está bloqueado. Por favor, haz clic en el candado de la barra de direcciones y actívalo para poder marcar tu asistencia.'));
            return;
        }

        // Trigger native browser geolocation permission prompt
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                () => {
                    setStatus('granted');
                },
                (err) => {
                    if (err.code === err.PERMISSION_DENIED) {
                        setStatus('denied');
                    }
                    console.warn('[LocationStatus] Click handler geolocation request failed:', err);
                },
                { timeout: 5000, maximumAge: 0 }
            );
        }
    };

    const isGranted = status === 'granted';
    const isDenied = status === 'denied';

    return (
        <button
            onClick={handleClick}
            title={
                isGranted 
                    ? t('location.status.active', 'Ubicación Activa') 
                    : isDenied 
                        ? t('location.status.blocked', 'Ubicación Bloqueada') 
                        : t('location.status.enable', 'Activar Ubicación')
            }
            className={`flex items-center justify-center w-8 h-8 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95 ${
                isGranted
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                    : isDenied
                        ? 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100 animate-pulse'
                        : 'bg-amber-50 border-amber-100 text-amber-500 hover:bg-amber-100'
            }`}
        >
            {isDenied ? <MapPinOff size={16} /> : <MapPin size={16} />}
        </button>
    );
};
