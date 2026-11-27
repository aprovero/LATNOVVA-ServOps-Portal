import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, PenLine } from 'lucide-react';

interface UnifiedSignaturePadProps {
    onSign: (blob: string) => void;
    onClear: () => void;
    placeholder?: string;
    height?: number;
}

export default function UnifiedSignaturePad({ onSign, onClear, placeholder, height = 112 }: UnifiedSignaturePadProps) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasSig, setHasSig] = useState(false);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const start = (e: React.MouseEvent | React.TouchEvent) => {
        // e.preventDefault(); // Might interfere with scrolling if not handled carefully
        drawing.current = true;
        const ctx = canvasRef.current!.getContext('2d')!;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };

    const move = (e: React.MouseEvent | React.TouchEvent) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        setHasSig(true);
        const blob = canvasRef.current!.toDataURL('image/png');
        onSign(blob);
    };

    const clear = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSig(false);
        onClear();
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <PenLine size={12} /> {t('timesheets.modals.sign_here', 'Signature')}
                </span>
                {hasSig && (
                    <button onClick={clear} className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-600 transition-colors">
                        <Trash2 size={11} /> {t('common.delete', 'Clear')}
                    </button>
                )}
            </div>
            <div className="relative border-2 border-dashed border-gray-200 rounded-2xl bg-white overflow-hidden shadow-inner" style={{ touchAction: 'none' }}>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={height * 2}
                    className="w-full cursor-crosshair block"
                    style={{ height: `${height}px` }}
                    onMouseDown={start} 
                    onMouseMove={move} 
                    onMouseUp={end} 
                    onMouseLeave={end}
                    onTouchStart={start} 
                    onTouchMove={move} 
                    onTouchEnd={end}
                />
                {!hasSig && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-gray-300 text-sm font-medium italic">
                            {placeholder || t('reports.labor_section.click_to_sign', 'Draw signature here...')}
                        </p>
                    </div>
                )}
                <div className="absolute bottom-4 left-6 right-6 border-b border-gray-100" />
            </div>
        </div>
    );
}
