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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Ambient Background Lights */}
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-teal/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-brand-yellow/10 rounded-full blur-[120px] pointer-events-none" />

            <div ref={containerRef} className="w-full max-w-md z-10">
                <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    
                    <div className="text-center mb-10">
                        {/* Official Joint Logos */}
                        <div className="flex items-center justify-center gap-5 mb-8">
                            <img src="/cor-logo.png" alt="COR Solutions Logo" className="h-14 object-contain drop-shadow-sm" />
                            <div className="h-10 w-px bg-gray-200"></div>
                            <img src="/latnovva-logo.png" alt="LATNOVVA Logo" className="h-8 object-contain drop-shadow-sm" />
                        </div>
                        <h1 className="text-xl font-black text-accent-greyDark tracking-tight">
                            LATNOVVA Service Operations Portal
                        </h1>
                        <p className="text-gray-500 font-medium mt-2 text-sm">
                            Sign in to your secure account
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Employee Email"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-4 text-accent-greyDark font-bold focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal transition-all placeholder:text-gray-400 placeholder:font-medium"
                                />
                            </div>
                        </div>

                        {message && (
                            <div className={`p-4 rounded-xl flex items-start space-x-3 text-sm font-bold ${
                                message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                                {message.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                                <span>{message.text}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || message?.type === 'success'}
                            className="w-full flex items-center justify-center bg-brand-teal hover:bg-teal-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-brand-teal/20"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending Link...</span>
                                </div>
                            ) : (
                                "Send Magic Link"
                            )}
                        </button>
                    </form>
                </div>
                
                <div className="flex flex-col items-center justify-center mt-8 gap-1 text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                        &copy; {new Date().getFullYear()} LATNOVVA & COR Solutions.<br/>
                        All Rights Reserved.<br/>
                        <span className="italic text-gray-400 normal-case tracking-normal">Powered by aprovero</span>
                    </p>
                    <img src="/APROVERO_LOGO.png" alt="Aprovero Logo" className="h-[24px] object-contain opacity-60 mix-blend-multiply transition-opacity mt-1" />
                </div>
            </div>
        </div>
    );
};
