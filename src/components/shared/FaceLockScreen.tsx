import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, LogOut, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../lib/authStore';
import FaceCameraModal from './FaceCameraModal';

interface FaceLockScreenProps {
  onUnlock: () => void;
}

export default function FaceLockScreen({ onUnlock }: FaceLockScreenProps) {
  const { t } = useTranslation();
  const { signOut } = useAuthStore();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Retrieve cached user profile details
  const [cachedUser, setCachedUser] = useState<{ name: string; image: string; email: string } | null>(null);
  const [cachedDescriptor, setCachedDescriptor] = useState<number[] | null>(null);

  useEffect(() => {
    try {
      const profileRaw = localStorage.getItem('cached_user_profile');
      const descriptorRaw = localStorage.getItem('cached_user_descriptor');
      if (profileRaw) setCachedUser(JSON.parse(profileRaw));
      if (descriptorRaw) setCachedDescriptor(JSON.parse(descriptorRaw));
    } catch (e) {
      console.error('Failed to parse cached lock screen credentials:', e);
    }
  }, []);

  const handleUnlockSuccess = () => {
    setIsCameraOpen(false);
    setErrorMsg(null);
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-accent-greyDark/90 backdrop-blur-xl overflow-hidden font-sans select-none">
      {/* Decorative high-end glowing background circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-teal/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Lock Card Container */}
      <div className="relative w-full max-w-sm px-8 py-12 flex flex-col items-center text-center bg-white/5 border border-white/10 rounded-[32px] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
        
        {/* Lock indicator */}
        <div className="absolute -top-6 w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-teal to-blue-600 flex items-center justify-center text-white shadow-lg border border-white/20">
          <Key size={20} className="animate-bounce" />
        </div>

        {/* User profile image / avatar */}
        <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-white/20 shadow-md bg-white/10 flex items-center justify-center text-brand-teal text-3xl font-black mb-6">
          {cachedUser?.image ? (
            <img src={cachedUser.image} alt={cachedUser.name} className="w-full h-full object-cover" />
          ) : (
            cachedUser?.name?.charAt(0) || 'L'
          )}
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight leading-tight">
          {cachedUser?.name || 'Latnovva Staff'}
        </h2>
        <p className="text-xs text-white/40 mt-1.5 font-medium tracking-wide">
          {t('fast_login.locked_status', 'Device Session Locked')}
        </p>

        {errorMsg && (
          <div className="w-full mt-6 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-left animate-in fade-in duration-200">
            <ShieldAlert className="text-red-400 shrink-0" size={16} />
            <span className="text-[10px] text-red-200 font-semibold leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => setIsCameraOpen(true)}
          className="w-full mt-8 py-3.5 bg-gradient-to-r from-brand-teal to-blue-600 hover:opacity-95 transition-all text-white font-bold text-sm rounded-2xl shadow-lg hover:shadow-brand-teal/20"
        >
          {t('fast_login.unlock_btn', 'Unlock with Face ID')}
        </button>

        {/* Secondary options */}
        <button
          onClick={() => {
            signOut().catch(() => {});
            localStorage.removeItem('cached_user_profile');
            localStorage.removeItem('cached_user_descriptor');
            localStorage.removeItem('device_fast_login_enabled');
          }}
          className="w-full mt-4 py-3.5 bg-white/5 hover:bg-white/10 transition-all text-white/60 hover:text-white font-bold text-xs rounded-2xl border border-white/5 flex items-center justify-center gap-2"
        >
          <LogOut size={14} />
          {t('fast_login.sign_out', 'Sign out / Use another account')}
        </button>
      </div>

      {/* Verification Camera Modal */}
      {cachedDescriptor && (
        <FaceCameraModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          mode="verify"
          referenceDescriptor={cachedDescriptor}
          onSuccess={handleUnlockSuccess}
        />
      )}
    </div>
  );
}
