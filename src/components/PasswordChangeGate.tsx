import React, { useState } from 'react';
import { Lock, Key, LogOut, CheckCircle, AlertCircle, Check, X, ShieldCheck } from 'lucide-react';
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

    // MUST require an active session, otherwise logged out users get trapped on the modal
    const isRotationRequired = !!session && isEnabled && !isServiceAccount && userPolicyVer < reqVersion;

    if (!isRotationRequired) {
        return null; // Compliant or unauthenticated
    }

    const handleSignOut = async () => {
        setIsSubmitting(true);
        try {
            await signOut();
        } catch (e) {
            console.error('[Auth] Error during sign out:', e);
        } finally {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch (e) {}
            window.location.href = '/login';
        }
    };

    // Live validation checks & 2026 NIST/OWASP security recommendations
    const hasMinLength = newPassword.length >= 12;
    const hasMaxLength = newPassword.length <= 128;
    const isNotDefault = newPassword !== 'Latnovva2026!';
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!hasMinLength || !hasMaxLength) {
            setError('La nueva contraseña debe tener entre 12 y 128 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden. Por favor verifique ambas casillas.');
            return;
        }

        if (!isNotDefault) {
            setError('La nueva contraseña no puede ser la contraseña compartida predeterminada (Latnovva2026!).');
            return;
        }

        setIsSubmitting(true);
        try {
            await completePasswordRotation(newPassword);
        } catch (err: any) {
            setError(err.message || 'Error al actualizar la contraseña. Por favor intente de nuevo.');
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
                        <h2 className="text-xl font-bold text-slate-100">Rotación Obligatoria de Contraseña</h2>
                        <p className="text-xs text-slate-400">Política de Seguridad v{reqVersion}</p>
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3 text-sm">
                    <p className="text-slate-300">
                        Para proteger su cuenta y los datos operativos de campo, debe establecer una contraseña personal única antes de continuar.
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-700/50 text-xs">
                        <span className="font-semibold text-slate-200 block mb-1">Requisitos y Recomendaciones (2026):</span>

                        <div className="grid grid-cols-1 gap-1">
                            <div className={`flex items-center space-x-1.5 ${hasMinLength && hasMaxLength ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {hasMinLength && hasMaxLength ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-500 ml-1 mr-1 flex-shrink-0" />}
                                <span>Mínimo 12 caracteres (máximo 128)</span>
                            </div>

                            <div className={`flex items-center space-x-1.5 ${newPassword.length > 0 && isNotDefault ? 'text-emerald-400' : newPassword === 'Latnovva2026!' ? 'text-red-400' : 'text-slate-400'}`}>
                                {newPassword.length > 0 && isNotDefault ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : newPassword === 'Latnovva2026!' ? <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-500 ml-1 mr-1 flex-shrink-0" />}
                                <span>Diferente a la contraseña predeterminada (Latnovva2026!)</span>
                            </div>

                            <div className="pt-2 text-slate-400 text-[11px] space-y-1 border-t border-slate-700/30 mt-1">
                                <div className="flex items-center space-x-1 text-slate-300 font-medium">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                    <span>Recomendado incluir:</span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 pl-4 text-slate-400">
                                    <span className={hasUpper ? 'text-emerald-400 font-medium' : ''}>• Mayúsculas (A-Z)</span>
                                    <span className={hasLower ? 'text-emerald-400 font-medium' : ''}>• Minúsculas (a-z)</span>
                                    <span className={hasNumber ? 'text-emerald-400 font-medium' : ''}>• Números (0-9)</span>
                                    <span className={hasSymbol ? 'text-emerald-400 font-medium' : ''}>• Símbolos (@#$!%*)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="flex items-start space-x-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Nueva Contraseña</label>
                        <div className="relative">
                            <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="Mínimo 12 caracteres"
                                required
                                minLength={12}
                                maxLength={128}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                        <div className="relative">
                            <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Reingrese la nueva contraseña"
                                required
                                minLength={12}
                                maxLength={128}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        {confirmPassword.length > 0 && (
                            <p className={`text-[11px] mt-1 flex items-center space-x-1 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                                {passwordsMatch ? (
                                    <>
                                        <Check className="w-3 h-3" />
                                        <span>Las contraseñas coinciden</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-3 h-3" />
                                        <span>Las contraseñas no coinciden</span>
                                    </>
                                )}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Cerrar Sesión</span>
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting || !hasMinLength || !isNotDefault || !passwordsMatch}
                            className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50"
                        >
                            <CheckCircle className="w-4 h-4" />
                            <span>{isSubmitting ? 'Actualizando...' : 'Establecer Contraseña'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeGate;

