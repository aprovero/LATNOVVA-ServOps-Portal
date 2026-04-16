import { useState, useRef, useEffect } from 'react';
import { PenTool, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ReportSignature } from '../../store/useStore';

interface SignaturePadProps {
    onSave: (role: 'Supervisor' | 'Management' | 'Customer', blob: string) => void;
    readOnly: boolean;
    existingSignatures?: ReportSignature[];
    userRole: 'Engineer' | 'Manager' | 'Customer';
}

export default function MultisignaturePad({ onSave, readOnly, existingSignatures = [], userRole }: SignaturePadProps) {
    const { t } = useTranslation();
    const roles = ['Supervisor', 'Management', 'Customer'] as const;


    return (
        <div className="card-container">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <PenTool className="text-brand-teal" size={20} /> {t('reports.signature_section.title')}
            </h2>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {roles.map(role => {
                    const existing = existingSignatures.find(s => s.role === role);
                    // Determine if the current user can sign for this role
                    const canSign = !readOnly && !existing && (
                        (role === 'Supervisor' && userRole === 'Engineer') ||
                        (role === 'Management' && userRole === 'Manager') ||
                        (role === 'Customer' && userRole === 'Customer')
                    );

                    return (
                        <div key={role} className={`border rounded-2xl p-4 flex flex-col ${existing ? 'bg-gray-50 border-status-success/30' : 'bg-surface border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-accent-greyDark text-xs uppercase tracking-widest">{t(`reports.signature_section.${role.toLowerCase()}`)}</h3>
                                    {existing && role === 'Management' && (
                                        <span className="text-[9px] font-bold text-white bg-brand-teal px-1.5 py-0.5 rounded-sm animate-pulse">{t('reports.signature_section.approved')}</span>
                                    )}

                                </div>
                                {existing && <Lock size={14} className="text-status-success shrink-0" />}
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] bg-white border border-dashed border-gray-300 rounded-xl mb-4 relative overflow-hidden">
                                {existing ? (
                                    <div className="w-full h-full flex items-center justify-center relative p-2">
                                        <div className="absolute inset-x-0 bottom-4 border-b border-gray-200 w-3/4 mx-auto"></div>
                                        {existing.blob ? (
                                            <img src={existing.blob} alt={`${role} signature`} className="max-h-20 z-10" />
                                        ) : (
                                            <span className="font-yesteryear text-3xl text-gray-800 z-10">{existing.signedBy}</span>
                                        )}
                                        <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-mono text-right bg-white/80 p-1 rounded">
                                            {new Date(existing.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                ) : canSign ? (
                                    <SignatureCanvasBox onSign={(blob) => onSave(role, blob)} />
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <PenTool size={24} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs font-semibold">{t('reports.signature_section.waiting')}</p>
                                    </div>

                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


// Sub-component to handle canvas drawing logic per box
export function SignatureCanvasBox({ onSign }: { onSign: (blob: string) => void }) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState<'draw' | 'photo'>('draw');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        if (mode !== 'draw') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Handle High DPI displays
        const scale = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * scale;
        canvas.height = rect.height * scale;
        ctx.scale(scale, scale);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000';
    }, [mode]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.beginPath();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        }
    };

    const handleConfirmDraw = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            onSign(canvas.toDataURL());
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setPhotoPreview(result);
        };
        reader.readAsDataURL(file);
    };

    const handleConfirmPhoto = () => {
        if (photoPreview) onSign(photoPreview);
    };

    return (
        <div className="w-full h-full relative group flex flex-col">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100 mb-1 px-1">
                <button
                    onClick={() => setMode('draw')}
                    className={`flex-1 text-[10px] font-bold py-1 transition-colors ${mode === 'draw' ? 'text-brand-teal border-b-2 border-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    ✏️ {t('reports.signature_section.draw_tab')}
                </button>

                <button
                    onClick={() => setMode('photo')}
                    className={`flex-1 text-[10px] font-bold py-1 transition-colors ${mode === 'photo' ? 'text-brand-teal border-b-2 border-brand-teal' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    📷 {t('reports.signature_section.upload_tab')}
                </button>

            </div>

            {mode === 'draw' ? (
                <div className="flex-1 relative">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        onMouseMove={draw}
                        onTouchStart={startDrawing}
                        onTouchEnd={stopDrawing}
                        onTouchMove={draw}
                        className="w-full h-full cursor-crosshair touch-none"
                        style={{ width: '100%', height: '100%' }}
                    />
                    <div className="absolute inset-x-0 bottom-1 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={handleClear} className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold shadow-sm border border-red-100">{t('reports.signature_section.clear')}</button>
                        <button onClick={handleConfirmDraw} className="bg-brand-teal text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">{t('reports.signature_section.sign')}</button>
                    </div>

                    {/* Guide line */}
                    <div className="absolute bottom-6 left-4 right-4 border-b border-gray-200 pointer-events-none opacity-50"></div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-2">
                    {photoPreview ? (
                        <>
                            <img src={photoPreview} alt="Signature preview" className="max-h-16 object-contain rounded border border-gray-200" />
                            <div className="flex gap-2">
                                <button onClick={() => { setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                    className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold border border-red-100">{t('reports.signature_section.retake')}</button>
                                <button onClick={handleConfirmPhoto}
                                    className="bg-brand-teal text-white px-2 py-1 rounded text-[10px] font-bold">{t('reports.signature_section.use_this')}</button>
                            </div>

                        </>
                    ) : (
                        <>
                            <p className="text-[10px] text-gray-400 text-center">{t('reports.signature_section.upload_help')}</p>
                            <input

                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handlePhotoUpload}
                                className="hidden"
                                id="sig-photo-upload"
                            />
                            <label htmlFor="sig-photo-upload"
                                className="cursor-pointer bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-brand-teal/20">
                                📷 {t('reports.signature_section.camera_file')}
                            </label>

                        </>
                    )}
                </div>
            )}
        </div>
    );
}
