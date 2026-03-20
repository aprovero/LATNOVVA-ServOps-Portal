import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, XCircle } from 'lucide-react';
import gsap from 'gsap';

interface OCRScannerProps {
    onScanComplete: (serial: string) => void;
    onCancel: () => void;
}

export default function OCRScanner({ onScanComplete, onCancel }: OCRScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanning, setScanning] = useState(false);
    const [permission, setPermission] = useState<boolean | null>(null);

    useEffect(() => {
        // Reveal animation
        gsap.fromTo('.scanner-modal', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' });

        // Mock camera stream logic
        let stream: MediaStream | null = null;

        // Check if camera is available (it might fail in non-HTTPS or without perms, so we use a mock simulation if it fails)
        navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => {
                stream = s;
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                    videoRef.current.play().catch(e => console.warn("Video play blocked:", e));
                }
                setPermission(true);
            })
            .catch(err => {
                console.error("Camera access denied or not available:", err);
                setPermission(false);
            });

        return () => {
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const triggerMockScan = () => {
        setScanning(true);
        // Simulate OCR processing time
        setTimeout(() => {
            setScanning(false);
            // Generate a realistic mock serial
            const mockSerial = `PE-INV-${Math.floor(Math.random() * 90000) + 10000}-XA`;
            onScanComplete(mockSerial);
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-accent-greyDark/80 backdrop-blur-sm">
            <div className="scanner-modal w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Camera size={20} className="text-brand-teal" />
                        OCR Nameplate Scanner
                    </h3>
                    <button onClick={onCancel} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="relative aspect-[4/3] bg-black flex flex-col items-center justify-center">
                    {permission === true ? (
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    ) : permission === false ? (
                        <div className="text-gray-400 text-center p-6">
                            <Camera size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Camera not accessible. Using simulation mode.</p>
                        </div>
                    ) : (
                        <div className="text-white">Initializing camera...</div>
                    )}

                    {/* Target Overlay */}
                    <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50">
                        <div className="w-full h-full border-2 border-brand-teal rounded-lg scale-95 relative">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-teal -translate-x-1 -translate-y-1"></div>
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-teal translate-x-1 -translate-y-1"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-teal -translate-x-1 translate-y-1"></div>
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-teal translate-x-1 translate-y-1"></div>
                        </div>
                    </div>

                    {scanning && (
                        <div className="absolute inset-0 bg-brand-teal/20 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                            <RefreshCw size={48} className="animate-spin text-brand-teal mb-4" />
                            <p className="font-bold tracking-widest uppercase bg-black/50 px-4 py-2 rounded-xl">Processing Nameplate...</p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-surface">
                    <p className="text-sm text-center text-gray-500 mb-6">Align the equipment rating plate inside the frame to auto-extract the serial number.</p>
                    <button
                        onClick={triggerMockScan}
                        disabled={scanning}
                        className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-4"
                    >
                        {scanning ? "Extracting..." : "Scan Serial Number"}
                        <Camera size={24} />
                    </button>
                </div>
            </div>
        </div>
    );
}
