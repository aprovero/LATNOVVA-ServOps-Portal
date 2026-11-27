import React, { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../lib/authStore';
import { getFaceDescriptorCacheKey, normalizeDescriptor } from '../utils/faceId.utils';

interface FaceIdStatusProps {
    onClick?: () => void;
}

export const FaceIdStatus: React.FC<FaceIdStatusProps> = ({ onClick }) => {
    const { t } = useTranslation();
    const personnel = useStore(s => s.personnel);
    const { user } = useAuthStore();

    const isFaceIdEnrolled = useMemo(() => {
        const userEmail = (user?.email || '').toLowerCase();
        const resId = useStore.getState().resolvePersonnelId();
        const person = personnel.find(p => p.id === resId || (p.email && p.email.toLowerCase() === userEmail));

        const fromStore = normalizeDescriptor(person?.faceDescriptor || (person as any)?.face_descriptor);
        if (fromStore) return true;

        if (resId) {
            try {
                const raw = localStorage.getItem(getFaceDescriptorCacheKey(resId));
                if (normalizeDescriptor(raw)) return true;
            } catch {}
        }

        return false;
    }, [user, personnel]);

    const label = isFaceIdEnrolled
        ? t('attendance.face_id_enabled', 'Face ID Activo')
        : t('attendance.face_id_pending', 'Face ID Pendiente');

    return (
        <button
            type="button"
            onClick={onClick}
            title={isFaceIdEnrolled
                ? t('attendance.face_id_active_tooltip', 'Face ID biométrico v6 configurado y activo')
                : t('attendance.face_id_pending_tooltip', 'Se registrará tu rostro en tu próximo Clock-In')}
            className={`group relative flex items-center h-8 rounded-full border shadow-xs transition-all duration-300 ease-in-out px-2 hover:px-3 active:scale-95 cursor-pointer select-none shrink-0 ${
                isFaceIdEnrolled
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-200'
                    : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300'
            }`}
        >
            <ShieldCheck size={16} className={`shrink-0 ${isFaceIdEnrolled ? 'text-emerald-600' : 'text-amber-500'}`} />
            <span className="min-w-0 max-w-0 opacity-0 group-hover:max-w-[180px] group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs font-bold flex items-center gap-1.5 leading-none select-none">
                {isFaceIdEnrolled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
                <span>{label}</span>
            </span>
        </button>
    );
};
