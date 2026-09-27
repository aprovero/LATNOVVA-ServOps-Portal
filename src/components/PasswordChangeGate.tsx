import React, { useState } from 'react';
import { Lock, Key, LogOut, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import { useStore } from '../store/useStore';

export const PasswordChangeGate: React.FC = () => {
    const identity = useAuthStore(s => s.identity);
    const completePasswordRotation = useAuthStore(s => s.completePasswordRotation);
    const signOut = useAuthStore(s => s.signOut);
    const platformSettings = useStore(s => s.platformSettings);

    const isEnabled = platformSettings.passwordRotationEnabled;
    const reqVersion = platformSettings.requiredPasswordPolicyVersion || 1;

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const session = useAuthStore(s => s.session);

    // Evaluate password rotation requirement from trusted Auth app_metadata (falling back to identity)
    const appMetaPolicyVer = (session?.user?.app_metadata as any)?.password_policy_version;
    const userPolicyVer = appMetaPolicyVer !== undefined ? Number(appMetaPolicyVer) : (identity?.password_policy_version ?? 0);
    const isServiceAccount = (session?.user?.app_metadata as any)?.is_service_account || identity?.is_service_account || false;

    const isRotationRequired = isEnabled && !isServiceAccount && userPolicyVer < reqVersion;

    if (!isRotationRequired) {
        return null; // Compliant
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 12) {
            setError('New password must be at least 12 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match. Please verify.');
            return;
        }

        if (newPassword === 'Latnovva2026!') {
            setError('New password cannot be the shared default password.');
            return;
        }

        setIsSubmitting(true);
        try {
            await completePasswordRotation(newPassword);
        } catch (err: any) {
            setError(err.message || 'Failed to update password. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 text-white">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
                <div className="flex items-center space-x-3 text-emerald-400">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <Lock className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Mandatory Password Rotation</h2>
                        <p className="text-xs text-slate-400">Security Policy v{reqVersion}</p>
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2 text-sm">
                    <p className="text-slate-300">
                        To protect your account and field data, you must establish a unique personal password before continuing.
                    </p>
                    <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside pt-2 border-t border-slate-700/50">
                        <li>Minimum 12 characters</li>
                        <li>Cannot be the shared default password (Latnovva2026!)</li>
                    </ul>
                </div>

                {error && (
                    <div className="flex items-start space-x-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                        <div className="relative">
                            <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="At least 12 characters"
                                required
                                minLength={12}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                        <div className="relative">
                            <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                required
                                minLength={12}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => signOut()}
                            className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>{isSubmitting ? 'Updating...' : 'Set Password'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeGate;
