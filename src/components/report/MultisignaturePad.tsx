import { useState, useRef, useEffect } from 'react';
import { PenTool, Lock } from 'lucide-react';
import { ReportSignature } from '../../store/useStore';

interface SignaturePadProps {
    onSave: (role: 'Supervisor' | 'Management' | 'Customer', blob: string) => void;
    readOnly: boolean;
    existingSignatures?: ReportSignature[];
    userRole: 'Engineer' | 'Manager' | 'Customer';
}

export default function MultisignaturePad({ onSave, readOnly, existingSignatures = [], userRole }: SignaturePadProps) {
    const roles = ['Supervisor', 'Management', 'Customer'] as const;

    return (
        <div className="card-container">
            <h2 className="text-xl font-bold text-accent-greyDark flex items-center gap-2 mb-6">
                <PenTool className="text-brand-teal" size={20} /> Signatures & Verification
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
                                <h3 className="font-bold text-accent-greyDark text-sm uppercase tracking-wide">{role}</h3>
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
                                        <p className="text-xs font-semibold">Waiting for signature</p>
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
function SignatureCanvasBox({ onSign }: { onSign: (blob: string) => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
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
    }, []);

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
            // Support retina clearing
            ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        }
    };

    const handleConfirm = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            onSign(canvas.toDataURL());
        }
    };

    return (
        <div className="w-full h-full relative group">
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
                <button onClick={handleClear} className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold shadow-sm border border-red-100">Clear</button>
                <button onClick={handleConfirm} className="bg-brand-teal text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm">Sign</button>
            </div>
            {/* Guide line */}
            <div className="absolute bottom-6 left-4 right-4 border-b border-gray-200 pointer-events-none opacity-50"></div>
        </div>
    );
}
