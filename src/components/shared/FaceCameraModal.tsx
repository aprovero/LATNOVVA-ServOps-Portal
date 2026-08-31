import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { validateImageQualityAndGetDescriptor, matchDescriptors, loadFaceModels } from '../../utils/faceId.utils';

interface FaceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enroll' | 'verify';
  referenceDescriptor?: number[];
  onSuccess: (data: { image: string; descriptor: number[] }) => void;
}

export default function FaceCameraModal({
  isOpen,
  onClose,
  mode,
  referenceDescriptor,
  onSuccess,
}: FaceCameraModalProps) {
  const { t } = useTranslation();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempDescriptor, setTempDescriptor] = useState<number[] | null>(null);

  // Initialize camera and preload models when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
      loadFaceModels().catch((err) => console.warn('[FaceCameraModal] Preload error:', err));
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  async function startCamera() {
    setErrorMsg(null);
    setCapturedPhoto(null);
    setTempDescriptor(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setErrorMsg(t('attendance.face_camera.access_denied', 'Camera access denied. Please grant camera permissions to complete Facial ID verification.'));
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas at full resolution
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);

    const base64Image = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPhoto(base64Image);
    stopCamera();

    // Process photo for Face ID
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await validateImageQualityAndGetDescriptor(base64Image);
      if (!res.success || !res.descriptor) {
        let msg = t('attendance.face_camera.quality_failed', 'Face detection failed. Ensure good lighting.');
        if (res.error === 'no_face_detected') {
          msg = t('attendance.face_camera.no_face', 'No face detected. Please position your face clearly in the frame.');
        } else if (res.error === 'multiple_faces_detected') {
          msg = t('attendance.face_camera.multiple_faces', 'Multiple faces detected. Only one face should be visible.');
        } else if (res.error === 'low_detection_confidence') {
          msg = t('attendance.face_camera.blurry_face', 'Face detection confidence was low. Please stay still and avoid dark environments.');
        } else if (res.error) {
          msg = `Face detection failed: ${res.error}`;
        }
        throw new Error(msg);
      }

      if (mode === 'verify' && referenceDescriptor) {
        const matchResult = matchDescriptors(res.descriptor, referenceDescriptor);
        if (!matchResult.isMatch) {
          throw new Error(t('attendance.face_camera.match_failed', 'Face ID Verification mismatch. Please try again.'));
        }
      }

      // Success! Store descriptor for approval step
      setTempDescriptor(res.descriptor);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto && tempDescriptor) {
      onSuccess({ image: capturedPhoto, descriptor: tempDescriptor });
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setTempDescriptor(null);
    setErrorMsg(null);
    startCamera();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95%] p-6 rounded-3xl gap-4 border border-gray-100 shadow-xl overflow-hidden bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-accent-greyDark flex items-center gap-2">
            <Camera className="text-brand-teal" size={20} />
            {mode === 'enroll' 
              ? t('attendance.face_camera.title_enroll', 'Enroll Face ID') 
              : t('attendance.face_camera.title_verify', 'Verify Face ID')
            }
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-4 py-2">
          {/* Main camera viewport box */}
          <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-brand-teal/20 shadow-inner bg-black flex items-center justify-center">
            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover transform scale-x-[-1]" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            {/* Circular face target guidelines */}
            {!capturedPhoto && (
              <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/50 pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-48 h-56 rounded-[50%/60%_60%_40%_40%] border border-white/20" />
              </div>
            )}

            {/* Real-time scanner sweep animation */}
            {!capturedPhoto && stream && (
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-teal to-transparent shadow-[0_0_8px_rgba(0,180,166,0.8)] animate-[scan_2s_infinite_ease-in-out] pointer-events-none" />
            )}

            {/* Scanning styles insert */}
            <style>{`
              @keyframes scan {
                0% { top: 10%; }
                50% { top: 90%; }
                100% { top: 10%; }
              }
            `}</style>
          </div>

          {/* Canvas helper */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Feedback messages */}
          <div className="w-full min-h-[40px] text-center px-4">
            {isProcessing && (
              <p className="text-xs text-brand-teal font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                <Loader2 size={14} className="animate-spin" />
                {t('attendance.face_camera.processing', 'Analyzing facial structures...')}
              </p>
            )}

            {errorMsg && (
              <div className="text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-start gap-2 text-left">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {tempDescriptor && !isProcessing && (
              <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                <CheckCircle2 size={14} />
                {mode === 'enroll'
                  ? t('attendance.face_camera.enroll_ready', 'Reference captured! Click continue to register.')
                  : t('attendance.face_camera.verify_ready', 'Identity verified!')
                }
              </p>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 mt-2">
          {!capturedPhoto ? (
            <>
              <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-500" onClick={onClose}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button 
                disabled={!stream} 
                className="flex-1 h-11 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl text-xs font-bold" 
                onClick={handleCapture}
              >
                {t('attendance.face_camera.capture', 'Snap Photo')}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                disabled={isProcessing}
                className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-500 gap-1.5" 
                onClick={handleRetake}
              >
                <RefreshCw size={12} /> {t('attendance.face_camera.retake', 'Retake')}
              </Button>
              <Button 
                disabled={isProcessing || !tempDescriptor}
                className="flex-1 h-11 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl text-xs font-bold" 
                onClick={handleConfirm}
              >
                {t('common.continue', 'Continue')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
