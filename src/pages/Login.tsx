import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, Component } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { signInWithEmail, signInWithOtp, loading, error } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [localSuccess, setLocalSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        setLocalSuccess(null);
        if (!email || !password) {
            setLocalError('Please enter both email and password.');
            return;
        }
        try {
            await signInWithEmail(email, password);
            // Imperative navigation — fires exactly once after explicit user action.
            // Cannot loop because it's not a reactive useEffect.
            navigate('/', { replace: true });
        } catch (err: any) {
            setLocalError(err.message || 'Failed to authenticate');
        }
    };

    const handleMagicLink = async () => {
        setLocalError(null);
        setLocalSuccess(null);
        if (!email) {
            setLocalError('Please enter your email to receive a magic link.');
            return;
        }
        try {
            await signInWithOtp(email);
            setLocalSuccess('Magic link sent! Check your inbox.');
        } catch (err: any) {
            setLocalError(err.message || 'Failed to send magic link');
        }
    };

    return (
        <div className="min-h-[100dvh] w-full flex bg-[#F8FAFC] relative font-jakarta">
            {/* Global Noise Overlay Texture (Subtle) */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-overlay"
                style={{ backgroundImage: 'radial-gradient(#424242 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

            {/* Left Side: Branding / Marketing Pattern */}
            <div className="hidden lg:flex flex-col flex-1 p-12 justify-between bg-gradient-to-br from-[#0097A7] to-[#00606B] relative overflow-hidden">
                {/* Abstract Glass shapes */}
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#000000]/10 rounded-[3rem] rotate-12 blur-2xl" />

                <div className="relative z-10 flex items-center gap-6 bg-white p-4 rounded-full w-max shadow-float border border-white/20">
                    <img src="/cor-logo.png" alt="COR Solutions" className="h-8 object-contain" />
                    <div className="w-px h-8 bg-slate-200" />
                    <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-6 object-contain" />
                </div>

                <div className="relative z-10 mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-6 border border-white/20">
                        <Component className="w-4 h-4" />
                        Digital Instrument PWA
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
                        Precision field <br /> management.
                    </h1>
                    <p className="text-xl text-teal-50 max-w-lg font-light leading-relaxed">
                        Offline-first data capability meets high-fidelity analytics. Streamline daily reports, asset commissioning, and multi-tenant operational visibility.
                    </p>
                </div>

                <div className="relative z-10 flex items-center gap-4 text-teal-100/60 font-mono text-sm">
                    <ShieldCheck className="w-5 h-5" />
                    <span>Cryptographically Locked Final Reports</span>
                </div>
            </div>

            {/* Right Side: Login Form */}
            <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 relative z-10 bg-white shadow-[-20px_0_40px_-5px_rgba(0,0,0,0.05)]">
                {/* Mobile Logos */}
                <div className="lg:hidden flex items-center gap-4 mb-12 border border-slate-100 p-4 rounded-3xl bg-slate-50 shadow-soft w-max">
                     <img src="/cor-logo.png" alt="COR Solutions" className="h-6 object-contain" />
                     <div className="w-px h-6 bg-slate-200" />
                     <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-5 object-contain" />
                </div>

                <div className="max-w-md w-full mx-auto">
                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-[#424242] tracking-tight mb-2">Welcome System Operator</h2>
                        <p className="text-slate-500 font-medium">Please authenticate to access mission data.</p>
                    </div>

                    {/* Status Alert */}
                    {(error || localError) && (
                        <div className="mb-6 animate-in slide-in-from-top-2 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 text-red-600">
                            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">{localError || error}</span>
                        </div>
                    )}
                    {localSuccess && (
                        <div className="mb-6 animate-in slide-in-from-top-2 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 text-emerald-600">
                            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">{localSuccess}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Secure Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0097A7] transition-colors">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-2xl text-slate-900 focus:ring-2 focus:ring-[#0097A7]/20 focus:border-[#0097A7] focus:bg-white transition-all shadow-sm outline-none font-mono text-sm placeholder:font-sans placeholder:text-slate-400"
                                    placeholder="operator@latnovva.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-sm font-semibold text-slate-700">Password</label>
                                <a href="#" className="text-sm font-medium text-[#0097A7] hover:text-[#007A88] transition-colors">Recover Access?</a>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#0097A7] transition-colors">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-4 border border-slate-200 bg-slate-50 rounded-2xl text-slate-900 focus:ring-2 focus:ring-[#0097A7]/20 focus:border-[#0097A7] focus:bg-white transition-all shadow-sm outline-none font-mono text-sm placeholder:font-sans placeholder:text-slate-400"
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full group relative flex items-center justify-center gap-2 py-4 px-4 border border-transparent rounded-2xl text-white font-semibold shadow-soft hover:shadow-float transition-all ${
                                    loading ? 'bg-[#424242] cursor-not-allowed opacity-70' : 'bg-[#0097A7] hover:bg-[#008695]'
                                }`}
                            >
                                {loading ? (
                                    <span className="font-mono text-sm">AUTHENTICATING...</span>
                                ) : (
                                    <>
                                        <span>Sign In Account</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                            
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleMagicLink}
                                className={`w-full group relative flex items-center justify-center gap-2 py-3.5 px-4 border-2 border-slate-200 rounded-2xl text-slate-600 font-semibold transition-all ${
                                    loading ? 'cursor-not-allowed opacity-70' : 'hover:border-[#0097A7] hover:text-[#0097A7] bg-white hover:bg-slate-50'
                                }`}
                            >
                                <span>Send Magic Link</span>
                            </button>
                        </div>
                    </form>
                    
                    <div className="mt-8 text-center text-sm font-mono text-slate-400 space-y-1">
                        <p>LATNOVVA SYSTEM OPS // v2.6.5</p>
                        <p>End-to-End Encryption Enabled</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
