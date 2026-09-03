import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, Component, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../lib/authStore';
import { requestInitialPermissions } from '../lib/permissions';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import FaceCameraModal from '../components/shared/FaceCameraModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { signInWithEmail, signInWithOtp, loading, error } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [localSuccess, setLocalSuccess] = useState<string | null>(null);

    const session = useAuthStore(s => s.session);

    // Face ID enrollment states for POC
    const [showFaceIdPrompt, setShowFaceIdPrompt] = useState(false);
    const [showEnroller, setShowEnroller] = useState(false);
    const [enrollerMode, setEnrollerMode] = useState<'enroll' | 'verify'>('enroll');
    const [tempDescriptor, setTempDescriptor] = useState<number[] | null>(null);
    const [tempImage, setTempImage] = useState<string | null>(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
    const isConfirmed = React.useRef(false);
    const { personnel } = useStore();

    React.useEffect(() => {
        if (session && !loading) {
            const email = (session.user?.email || '').toLowerCase();
            const pilotEmails = ['tech@latnovva.com', 'jacqueline.martinez@latnovva.com'];
            if (pilotEmails.includes(email)) {
                const checkEnrollmentStatus = async () => {
                    const localEnrolled = localStorage.getItem(`face_id_enrolled_${email}`) === 'true';
                    const localRejected = localStorage.getItem(`face_id_rejected_${email}`) === 'true';
                    if (localEnrolled || localRejected) {
                        navigate('/', { replace: true });
                        return;
                    }

                    // Check Supabase database across mx_personnel, personnel, and profiles
                    try {
                        let enrolledDescriptor: number[] | null = null;

                        // 1. Check mx_personnel table
                        try {
                            const { data: mxData } = await (supabase.from('mx_personnel') as any)
                                .select('id, email, faceDescriptor, image')
                                .or(`id.eq.${session.user.id},email.ilike.${email}`)
                                .limit(1);
                            if (mxData && mxData.length > 0) {
                                const d = mxData[0].faceDescriptor || (mxData[0] as any).face_descriptor;
                                if (Array.isArray(d) && d.length > 0) enrolledDescriptor = d;
                            }
                        } catch (e) {
                            console.warn('[Login] mx_personnel check:', e);
                        }

                        // 2. Fallback to personnel table
                        if (!enrolledDescriptor) {
                            try {
                                const { data: pData } = await (supabase.from('personnel') as any)
                                    .select('id, email, faceDescriptor, image')
                                    .or(`id.eq.${session.user.id},email.ilike.${email}`)
                                    .limit(1);
                                if (pData && pData.length > 0) {
                                    const d = pData[0].faceDescriptor || (pData[0] as any).face_descriptor;
                                    if (Array.isArray(d) && d.length > 0) enrolledDescriptor = d;
                                }
                            } catch (e) {
                                console.warn('[Login] personnel check:', e);
                            }
                        }

                        // 3. Fallback to profiles table
                        if (!enrolledDescriptor) {
                            try {
                                const { data: profData } = await (supabase.from('profiles') as any)
                                    .select('id, faceDescriptor, face_descriptor')
                                    .eq('id', session.user.id)
                                    .limit(1);
                                if (profData && profData.length > 0) {
                                    const d = profData[0].faceDescriptor || (profData[0] as any).face_descriptor;
                                    if (Array.isArray(d) && d.length > 0) enrolledDescriptor = d;
                                }
                            } catch (e) {
                                // non-fatal
                            }
                        }

                        if (enrolledDescriptor && enrolledDescriptor.length > 0) {
                            localStorage.setItem(`face_id_enrolled_${email}`, 'true');
                            localStorage.setItem('cached_user_descriptor', JSON.stringify(enrolledDescriptor));
                            navigate('/', { replace: true });
                            return;
                        }
                    } catch (e) {
                        console.warn('[Login] Error checking face enrollment in DB:', e);
                    }

                    setShowFaceIdPrompt(true);
                };

                checkEnrollmentStatus();
                return;
            }
            navigate('/', { replace: true });
        }
    }, [session, loading, navigate]);

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
            // Trigger permissions request on successful login
            requestInitialPermissions();
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
            // Trigger permissions request when link is sent to pre-approve the device
            requestInitialPermissions();
            setLocalSuccess('Magic link sent! Check your inbox.');
        } catch (err: any) {
            setLocalError(err.message || 'Failed to send magic link');
        }
    };

    const handlePromptNo = () => {
        const email = session?.user?.email;
        if (email) {
            localStorage.setItem(`face_id_rejected_${email}`, 'true');
        }
        setShowFaceIdPrompt(false);
        navigate('/', { replace: true });
    };

    const handlePromptYes = () => {
        setShowFaceIdPrompt(false);
        setEnrollerMode('enroll');
        setShowEnroller(true);
    };

    const handleFaceSuccess = async (data: { image: string; descriptor: number[] }) => {
        isConfirmed.current = true;
        if (enrollerMode === 'enroll') {
            setTempDescriptor(data.descriptor);
            setTempImage(data.image);
            setEnrollerMode('verify');
            setShowVerifyPrompt(true);
        } else {
            setShowEnroller(false);
            const email = (session?.user?.email || '').toLowerCase();
            const userId = session?.user?.id;
            const finalImage = tempImage || data.image;
            const finalDescriptor = tempDescriptor || data.descriptor;

            if (email) {
                localStorage.setItem(`face_id_enrolled_${email}`, 'true');
                localStorage.setItem('cached_user_descriptor', JSON.stringify(finalDescriptor));
                localStorage.setItem('cached_user_profile', JSON.stringify({
                    name: session?.user?.user_metadata?.full_name || email.split('@')[0],
                    email,
                    image: finalImage
                }));
            }

            // Direct DB upsert to guarantee cross-device persistence
            if (userId) {
                const payload = {
                    id: userId,
                    email: email,
                    name: session?.user?.user_metadata?.full_name || email.split('@')[0],
                    image: finalImage,
                    faceDescriptor: finalDescriptor,
                    status: 'Active',
                    app_role: 'Technician',
                    subsidiary: 'MX'
                };

                // Upsert to mx_personnel (primary Mexico table)
                try {
                    await (supabase.from('mx_personnel') as any).upsert(payload);
                } catch (err) {
                    console.warn('[Login] mx_personnel upsert face warning:', err);
                }

                // Upsert to personnel (universal table)
                try {
                    await (supabase.from('personnel') as any).upsert(payload);
                } catch (err) {
                    console.warn('[Login] personnel upsert face warning:', err);
                }

                // Update profiles if supported
                try {
                    await (supabase.from('profiles') as any).update({
                        faceDescriptor: finalDescriptor
                    }).eq('id', userId);
                } catch (err) {
                    // non-fatal
                }
            }

            // Also update Zustand store
            const targetPerson = personnel.find(p => p.email?.toLowerCase() === email || p.id === userId);
            if (targetPerson) {
                await useStore.getState().updatePersonnel(targetPerson.id, {
                    image: finalImage,
                    faceDescriptor: finalDescriptor
                });
            }

            setShowSuccessDialog(true);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessDialog(false);
        navigate('/', { replace: true });
    };

    return (
        <div className="min-h-[100dvh] w-full flex bg-[#F8FAFC] relative font-jakarta">
            {/* Global Noise Overlay Texture (Subtle) */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-overlay"
                style={{ backgroundImage: 'radial-gradient(#424242 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

            {/* Left Side: Branding / Marketing Pattern */}
            <div className="hidden lg:flex flex-col flex-1 p-12 justify-between relative overflow-hidden bg-[#00606B]">
                {/* Video Background */}
                <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover z-0"
                >
                    <source src="/HOME-LATNOVVA.mp4" type="video/mp4" />
                </video>
                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-black/40 z-0" />

                <div className="relative z-10 flex items-center gap-6 bg-white p-4 rounded-full w-max shadow-float border border-white/20">
                    <img src="/cor-logo.png" alt="COR Solutions" className="h-9 object-contain" />
                    <div className="w-px h-8 bg-slate-200" />
                    <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-5 object-contain" />
                    <div className="w-px h-8 bg-slate-200" />
                    <img src="/S&S-logo.png" alt="SyS" className="h-6 object-contain" />
                </div>

                <div className="relative z-10 mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-6 border border-white/20">
                        <Component className="w-4 h-4" />
                        Sustainable Engineering Portal
                    </div>
                    <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
                        Green, efficient & safe <br /> industrial solutions.
                    </h1>
                    <p className="text-xl text-teal-50 max-w-lg font-light leading-relaxed">
                        Your partner for sustainable and innovative development in renewable energy, mechanical and electrical installations, maintenance, and construction.
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
                     <img src="/cor-logo.png" alt="COR Solutions" className="h-7 object-contain" />
                     <div className="w-px h-6 bg-slate-200" />
                     <img src="/latnovva-logo.png" alt="LATNOVVA" className="h-4 object-contain" />
                     <div className="w-px h-6 bg-slate-200" />
                     <img src="/S&S-logo.png" alt="SyS" className="h-5 object-contain" />
                </div>

                <div className="max-w-md w-full mx-auto">
                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-[#424242] tracking-tight mb-2">Welcome to LATNOVVA</h2>
                        <p className="text-slate-500 font-medium">Please authenticate to access operational data.</p>
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
                        <p>LATNOVVA SYSTEM OPS // v{__APP_VERSION__}</p>
                        <p>End-to-End Encryption Enabled</p>
                    </div>
                </div>
            </div>

            {/* Face ID Prompt Dialog */}
            <Dialog open={showFaceIdPrompt} onOpenChange={(open) => { if (!open) handlePromptNo(); }}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-xl border border-gray-150">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="text-brand-teal w-6 h-6" />
                            Registro de Face ID
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            Tu cuenta es elegible para el registro de asistencia mediante Face ID.
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 leading-normal">
                            <strong className="text-slate-700 block mb-1">Aviso sobre Datos Biométricos:</strong>
                            Para habilitar Face ID, capturaremos tus rasgos faciales. Estos datos se almacenan de forma segura y solo se utilizan para verificar tu identidad al registrar tus entradas y salidas.
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={handlePromptNo} className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-4 py-2 text-sm">
                            No, preguntar más tarde
                        </Button>
                        <Button onClick={handlePromptYes} className="rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold px-4 py-2 text-sm">
                            Sí, habilitar Face ID
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Face camera modal */}
            {showEnroller && (
                <FaceCameraModal
                    isOpen={showEnroller}
                    onClose={() => {
                        setShowEnroller(false);
                        if (!isConfirmed.current) {
                            navigate('/', { replace: true });
                        }
                        isConfirmed.current = false;
                    }}
                    mode={enrollerMode}
                    referenceDescriptor={tempDescriptor || undefined}
                    onSuccess={handleFaceSuccess}
                    onBypass={() => {
                        setShowEnroller(false);
                        navigate('/', { replace: true });
                    }}
                    allowBypass={true}
                />
            )}

            {/* Intermediate Verify Prompt Dialog */}
            <Dialog open={showVerifyPrompt} onOpenChange={(open) => { if (!open) { setShowVerifyPrompt(false); navigate('/', { replace: true }); } }}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-xl border border-gray-150 text-center">
                    <div className="mx-auto w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-brand-teal mb-4 animate-bounce">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 text-center">
                            Verificar tu Selfie
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-sm text-slate-600 leading-relaxed">
                            ¡Selfie capturada con éxito! Hagamos una prueba rápida de verificación para asegurar que la coincidencia de Face ID funcione correctamente.
                        </p>
                    </div>
                    <DialogFooter className="sm:justify-center mt-4">
                        <Button onClick={() => {
                            setShowVerifyPrompt(false);
                            setShowEnroller(true);
                        }} className="w-full sm:w-auto rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold px-6 py-2 text-sm">
                            Escanear Rostro de Nuevo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Success Modal */}
            <Dialog open={showSuccessDialog} onOpenChange={(open) => { if (!open) handleSuccessClose(); }}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-xl border border-gray-150 text-center">
                    <div className="mx-auto w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-brand-teal mb-4">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 text-center">
                            Registro Exitoso
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Face ID ha sido registrado y verificado exitosamente. Tu cuenta ahora está configurada para checar asistencia con Face ID.
                        </p>
                    </div>
                    <DialogFooter className="sm:justify-center mt-4">
                        <Button onClick={handleSuccessClose} className="w-full sm:w-auto rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold px-6 py-2 text-sm">
                            Listo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
