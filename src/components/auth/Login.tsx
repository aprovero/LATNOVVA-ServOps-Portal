import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { gsap } from 'gsap';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(containerRef.current, 
                { opacity: 0, y: 30 }, 
                { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
            );
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Check your email for the login link!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Error sending magic link' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
            {/* Ambient Background Lights */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div ref={containerRef} className="w-full max-w-md">
                <div className="bg-zinc-900 border border-zinc-800/50 p-8 rounded-2xl shadow-2xl backdrop-blur-sm relative z-10 relative overflow-hidden">
                    {/* Top glass reflection */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    
                    <div className="text-center mb-10">
                        {/* Logo placeholder - replace src with your actual logo */}
                        <div className="bg-zinc-800/50 p-3 rounded-xl inline-flex items-center justify-center border border-zinc-700/50 shadow-inner mb-6">
                            <Mail className="h-8 w-8 text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                            LATNOVVA ServiceTool
                        </h1>
                        <p className="text-zinc-400 mt-2 text-sm">
                            Sign in via Magic Link
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="johndoe@latnovva.com"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-zinc-600"
                                />
                            </div>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-lg flex items-start space-x-3 text-sm ${
                                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                                {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                                <span>{message.text}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || message?.type === 'success'}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-blue-900/20 border border-blue-500/50"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending Link...</span>
                                </div>
                            ) : (
                                "Send Login Link"
                            )}
                        </button>
                    </form>
                </div>
                
                <p className="text-center text-zinc-600 text-xs mt-6">
                    Protected by Supabase Auth
                </p>
            </div>
        </div>
    );
};
