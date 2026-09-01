import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../lib/authStore';

interface FaceIdStatusProps {
    onClick?: () => void;
}

export const FaceIdStatus: React.FC<FaceIdStatusProps> = ({ onClick }) => {
    const { t } = useTranslation();
    const { personnel, platformSettings } = useStore();
    const { user } = useAuthStore();

    // Check if Face ID is active / enrolled for current user or enabled for organization
    const isFaceIdActive = useMemo(() => {
        const userEmail = (user?.email || '').toLowerCase();
        const resId = useStore.getState().resolvePersonnelId();
        const person = personnel.find(p => p.id === resId || (p.email && p.email.toLowerCase() === userEmail));
        const localEnrolled = localStorage.getItem(`face_id_enrolled_${userEmail}`) === 'true' || localStorage.getItem('face_id_enrolled') === 'true';
        let cachedDescriptor = false;
        try {
            const raw = localStorage.getItem('cached_user_descriptor');
            if (raw && JSON.parse(raw).length > 0) cachedDescriptor = true;
        } catch {}

        const userHasFace = Boolean(
            (person?.faceDescriptor && person.faceDescriptor.length > 0) ||
            ((person as any)?.face_descriptor && (person as any).face_descriptor.length > 0) ||
            localEnrolled ||
            cachedDescriptor
        );

        // Face ID is active if user has enrolled face OR if platform settings has facial ID enabled (default on in Mexico portal)
        return userHasFace || platformSettings?.enableFacialId !== false;
    }, [user, personnel, platformSettings]);

    const label = isFaceIdActive
        ? t('attendance.face_id_enabled', 'Face ID Enabled')
        : t('attendance.face_id_disabled', 'Face ID Inactive');

    return (
        <button
            type="button"
            onClick={onClick}
            title={t('attendance.face_id_active_tooltip', 'Face ID biométrico configurado y activo')}
            className={`group relative flex items-center h-8 rounded-full border shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 active:scale-95 cursor-pointer select-none shrink-0 ${
                isFaceIdActive
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-200'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:border-gray-300'
            }`}
        >
            <ShieldCheck size={16} className={`shrink-0 ${isFaceIdActive ? 'text-emerald-600' : 'text-gray-400'}`} />
            <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[180px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold flex items-center gap-1.5 leading-none select-none">
                {isFaceIdActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
                <span>{label}</span>
            </span>
        </button>
    );
};
