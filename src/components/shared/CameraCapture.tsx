import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, AlertCircle, Upload, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CameraCaptureProps {
    onCapture: (blob: string) => void;
    onClear: () => void;
}

export default function CameraCapture({ onCapture, onClear }: CameraCaptureProps) {
    const { t } = useTranslation();
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [usingFallback, setUsingFallback] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Initialize Camera Stream
    const startCamera = async () => {
        setError(null);
        setUsingFallback(false);
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            setStream(newStream);
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
        } catch (err: any) {
            console.warn('Camera initiation failed:', err);
            setError(t('attendance.gps.camera_error', 'Could not open camera. Please use manual upload or allow permissions.'));
            setUsingFallback(true);
        }
    };

    useEffect(() => {
        if (!capturedImage && !usingFallback) {
            startCamera();
        }
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [capturedImage, usingFallback]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw video frame to canvas
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        // Mirror the image for intuitive selfie view
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Export as base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
        onCapture(dataUrl);

        // Turn off camera stream to save resources
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setCapturedImage(dataUrl);
            onCapture(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const resetCamera = () => {
        setCapturedImage(null);
        onClear();
        setError(null);
        setUsingFallback(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Camera size={14} className="text-gray-400" />
                    {t('personnel.profile_photo', 'Identity Verification Selfie')}
                </span>
                {capturedImage && (
                    <button
                        onClick={resetCamera}
                        className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-600 transition-colors"
                    >
                        <RefreshCw size={12} /> {t('signature_section.retake', 'Retake')}
                    </button>
                )}
            </div>

            <div className="relative border-2 border-dashed border-gray-200 rounded-2xl bg-slate-900 overflow-hidden aspect-video shadow-inner flex items-center justify-center">
                {capturedImage ? (
                    // Captured Preview Mode
                    <div className="relative w-full h-full">
                        <img 
                            src={capturedImage} 
                            alt="Captured Selfie" 
                            className="w-full h-full object-cover" 
                        />
                        <div className="absolute bottom-3 right-3 bg-emerald-500 text-white p-1.5 rounded-full shadow-md animate-scale-in">
                            <Check size={18} />
                        </div>
                    </div>
                ) : usingFallback ? (
                    // Fallback File Upload Mode
                    <div className="p-6 text-center text-white space-y-4">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                            <Upload size={20} className="text-teal-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">{t('signature_section.camera_file', 'Camera / File Access')}</p>
                            <p className="text-xs text-gray-400 max-w-[240px] mx-auto">
                                {t('attendance.gps.camera_upload_desc', 'Use your device camera or upload an image file directly.')}
                            </p>
                        </div>
                        <label className="inline-flex items-center justify-center px-4 py-2.5 bg-teal-500 hover:bg-teal-600 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg cursor-pointer transition-all gap-1.5">
                            <Camera size={14} />
                            {t('signature_section.camera_file', 'Capture Photo / Browse')}
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="user" 
                                onChange={handleFileUpload} 
                                className="hidden" 
                            />
                        </label>
                    </div>
                ) : (
                    // Live Streaming Mode
                    <div className="relative w-full h-full flex items-center justify-center">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover -scale-x-100"
                        />
                        
                        {/* Shutter Overlay Button */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="w-14 h-14 bg-white/95 rounded-full flex items-center justify-center shadow-2xl border-4 border-teal-500/35 hover:scale-105 active:scale-95 transition-all focus:outline-none"
                                title={t('signature_section.sign', 'Capture')}
                            >
                                <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white hover:bg-teal-600 transition-colors">
                                    <Camera size={20} />
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading / Error States */}
                {!capturedImage && !stream && !usingFallback && (
                    <div className="text-white text-xs animate-pulse flex flex-col items-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-teal-400" />
                        <span>{t('attendance.gps.acquiring', 'Opening Camera...')}</span>
                    </div>
                )}
            </div>

            {error && !capturedImage && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs font-semibold">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Hidden canvas for taking snapshot */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
