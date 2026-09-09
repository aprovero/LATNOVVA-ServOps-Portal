import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw, ShieldAlert, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { validateImageQualityAndGetDescriptor, matchDescriptors, loadFaceModels } from '../../utils/faceId.utils';

interface FaceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enroll' | 'verify';
  referenceDescriptor?: number[];
  onSuccess: (data: { image: string; descriptor: number[] }) => void;
  onBypass?: (reason?: string) => void;
  allowBypass?: boolean;
}

export default function FaceCameraModal({
  isOpen,
  onClose,
  mode,
  referenceDescriptor,
  onSuccess,
  onBypass,
  allowBypass = true,
}: FaceCameraModalProps) {
  const { t } = useTranslation();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempDescriptor, setTempDescriptor] = useState<number[] | null>(null);

  // Bypass / Fallback states
  const [showBypassView, setShowBypassView] = useState(false);
  const [bypassReason, setBypassReason] = useState('Cámara dañada o no disponible');
  const [customReason, setCustomReason] = useState('');

  // Real-time centering states for hands-free auto-snap
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const autoSnapTriggeredRef = useRef(false);
  const centeredCountRef = useRef(0);

  // Initialize camera and preload models when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowBypassView(false);
      autoSnapTriggeredRef.current = false;
      centeredCountRef.current = 0;
      setIsFaceCentered(false);
      startCamera();
      loadFaceModels().catch((err) => console.warn('[FaceCameraModal] Preload error:', err));
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  // Hands-free video stream centering detection
  useEffect(() => {
    if (!isOpen || !stream || capturedPhoto || isProcessing || showBypassView) {
      return;
    }

    const interval = setInterval(async () => {
      if (!videoRef.current || autoSnapTriggeredRef.current) return;
      try {
        const { detectFaceInVideo } = await import('../../utils/faceId.utils');
        const res = await detectFaceInVideo(videoRef.current);
        if (res.isCentered) {
          setIsFaceCentered(true);
          centeredCountRef.current += 1;
          // 4 consecutive centered frames (~1.2s steady) triggers auto-snap!
          if (centeredCountRef.current >= 4 && !autoSnapTriggeredRef.current) {
            autoSnapTriggeredRef.current = true;
            handleCapture();
          }
        } else {
          setIsFaceCentered(false);
          centeredCountRef.current = 0;
        }
      } catch {
        // non-fatal
      }
    }, 300);

    return () => clearInterval(interval);
  }, [isOpen, stream, capturedPhoto, isProcessing, showBypassView]);

  async function startCamera() {
    setErrorMsg(null);
    setCapturedPhoto(null);
    setTempDescriptor(null);
    autoSnapTriggeredRef.current = false;
    centeredCountRef.current = 0;
    setIsFaceCentered(false);
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
      setErrorMsg(t('attendance.face_camera.access_denied', 'Acceso a la cámara denegado. Por favor otorga permisos de cámara para continuar con la verificación biométrica.'));
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

    const base64Image = canvas.toDataURL('image/jpeg', 0.90);
    setCapturedPhoto(base64Image);
    stopCamera();

    // Process photo for Face ID
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await validateImageQualityAndGetDescriptor(base64Image);
      if (!res.success || !res.descriptor) {
        let msg = t('attendance.face_camera.quality_failed', 'No se pudo detectar el rostro. Asegúrate de tener buena iluminación.');
        if (res.error === 'no_face_detected') {
          msg = t('attendance.face_camera.no_face', 'No se detectó ningún rostro. Por favor, posiciona tu rostro claramente en el círculo.');
        } else if (res.error === 'multiple_faces_detected') {
          msg = t('attendance.face_camera.multiple_faces', 'Se detectaron múltiples rostros. Solo una persona debe estar visible.');
        } else if (res.error === 'timeout') {
          msg = 'Tiempo de espera de detección agotado. Puedes reintentar o registrar con contingencia.';
        } else if (res.error) {
          msg = `Error de detección: ${res.error}`;
        }
        throw new Error(msg);
      }

      if (mode === 'verify' && referenceDescriptor) {
        const matchResult = matchDescriptors(res.descriptor, referenceDescriptor);
        if (!matchResult.isMatch) {
          throw new Error(t('attendance.face_camera.match_failed', 'Los rasgos faciales no coinciden con la selfie registrada. Por favor intenta de nuevo.'));
        }
      }

      // Success! Store descriptor and auto-advance immediately (hands-free!)
      setTempDescriptor(res.descriptor);
      setTimeout(() => {
        onSuccess({ image: base64Image, descriptor: res.descriptor! });
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error en la verificación.');
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
    autoSnapTriggeredRef.current = false;
    centeredCountRef.current = 0;
    setIsFaceCentered(false);
    startCamera();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[95%] p-5 sm:p-6 rounded-3xl gap-3.5 border border-gray-100 shadow-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {showBypassView ? (
              <>
                <AlertTriangle className="text-amber-500" size={18} />
                <span>{t('attendance.face_camera.bypass_title', 'Continuar sin Face ID')}</span>
              </>
            ) : (
              <>
                <Camera className="text-brand-teal" size={18} />
                <span>
                  {mode === 'enroll' 
                    ? t('attendance.face_camera.title_enroll', 'Registrar Face ID') 
                    : t('attendance.face_camera.title_verify', 'Verificar Face ID')
                  }
                </span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {showBypassView ? (
          /* ─── BYPASS / FALLBACK VIEW ─── */
          <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-200">
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950 mb-0.5">
                  {t('attendance.face_camera.bypass_banner_title', 'Registro con contingencia')}
                </p>
                <p className="text-amber-800 leading-relaxed">
                  {t('attendance.face_camera.bypass_banner_desc', 'Si tu cámara no funciona o tienes dificultades, tu asistencia se registrará de inmediato indicando el motivo:')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                {t('attendance.face_camera.bypass_reason_label', 'Motivo:')}
              </label>
              {[
                { key: 'cam_broken', text: 'Cámara dañada o sin permisos' },
                { key: 'lighting', text: 'Iluminación deficiente o reflejos' },
                { key: 'tech_issue', text: 'Error de reconocimiento facial' },
                { key: 'other', text: 'Otro motivo' },
              ].map(opt => (
                <label
                  key={opt.key}
                  onClick={() => setBypassReason(opt.text)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                    bypassReason === opt.text 
                      ? 'border-brand-teal bg-brand-teal/5 text-slate-900 font-bold shadow-xs' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="bypassReason"
                    value={opt.text}
                    checked={bypassReason === opt.text}
                    onChange={() => setBypassReason(opt.text)}
                    className="accent-brand-teal w-4 h-4"
                  />
                  <span>{opt.text}</span>
                </label>
              ))}

              {bypassReason === 'Otro motivo' && (
                <input
                  type="text"
                  placeholder={t('attendance.face_camera.bypass_custom_placeholder', 'Escribe el motivo brevemente...')}
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-teal outline-none mt-1"
                  autoFocus
                />
              )}
            </div>

            <div className="flex items-center gap-3 mt-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-500"
                onClick={() => setShowBypassView(false)}
              >
                {t('attendance.face_camera.back_to_camera', 'Volver a la cámara')}
              </Button>
              <Button
                className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm"
                onClick={() => {
                  const finalReason = bypassReason === 'Otro motivo' && customReason.trim()
                    ? customReason.trim()
                    : bypassReason;
                  stopCamera();
                  if (onBypass) {
                    onBypass(finalReason);
                  } else {
                    onClose();
                  }
                }}
              >
                {t('attendance.face_camera.confirm_bypass', 'Continuar y Registrar')}
              </Button>
            </div>
          </div>
        ) : (
          /* ─── CAMERA VIEW ─── */
          <>
            <div className="flex flex-col items-center justify-center gap-3 py-1">
              {/* Main camera viewport box with responsive circle clipping */}
              <div 
                className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 transition-all duration-300 shadow-inner bg-black flex items-center justify-center isolate ${
                  isFaceCentered 
                    ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.45)]' 
                    : 'border-brand-teal/30'
                }`}
                style={{ 
                  borderRadius: '50%',
                  clipPath: 'circle(50% at 50% 50%)', 
                  WebkitClipPath: 'circle(50% at 50% 50%)' 
                }}
              >
                {capturedPhoto ? (
                  <img 
                    src={capturedPhoto} 
                    alt="Captured" 
                    className="w-full h-full object-cover transform scale-x-[-1]" 
                    style={{ 
                      borderRadius: '50%', 
                      clipPath: 'circle(50% at 50% 50%)', 
                      WebkitClipPath: 'circle(50% at 50% 50%)',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }} 
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                    style={{ 
                      borderRadius: '50%', 
                      clipPath: 'circle(50% at 50% 50%)', 
                      WebkitClipPath: 'circle(50% at 50% 50%)',
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }} 
                  />
                )}

                {/* Circular face target guidelines */}
                {!capturedPhoto && (
                  <div className={`absolute inset-4 rounded-full border-2 border-dashed pointer-events-none transition-colors duration-300 flex items-center justify-center ${
                    isFaceCentered ? 'border-emerald-400 animate-pulse' : 'border-white/50'
                  }`}>
                    <div className={`w-40 h-48 sm:w-44 sm:h-52 rounded-[50%/60%_60%_40%_40%] border transition-colors ${
                      isFaceCentered ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/20'
                    }`} />
                  </div>
                )}

                {/* Real-time scanner sweep animation */}
                {!capturedPhoto && stream && !isFaceCentered && (
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

              {/* Feedback messages / Auto-snap indicator */}
              <div className="w-full min-h-[36px] text-center px-2">
                {!capturedPhoto && !isProcessing && (
                  <p className={`text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    isFaceCentered ? 'text-emerald-600' : 'text-gray-500'
                  }`}>
                    {isFaceCentered ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span>¡Rostro alineado! Mantente quieto...</span>
                      </>
                    ) : (
                      <span>Centra tu rostro dentro del círculo</span>
                    )}
                  </p>
                )}

                {isProcessing && (
                  <p className="text-xs text-brand-teal font-semibold flex items-center justify-center gap-1.5 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    {t('attendance.face_camera.processing', 'Analizando estructura facial...')}
                  </p>
                )}

                {errorMsg && (
                  <div className="space-y-2 mt-1">
                    <div className="text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-start gap-2 text-left">
                      <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  </div>
                )}

                {tempDescriptor && (
                  <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1 bg-emerald-50 p-2 rounded-xl border border-emerald-100 animate-in zoom-in-95">
                    <CheckCircle2 size={14} />
                    {mode === 'enroll'
                      ? t('attendance.face_camera.enroll_ready', '¡Rostro capturado! Registrando asistencia...')
                      : t('attendance.face_camera.verify_ready', '¡Identidad verificada! Registrando...')
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-1">
              {!capturedPhoto ? (
                <>
                  <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-500" onClick={onClose}>
                    {t('common.cancel', 'Cancelar')}
                  </Button>
                  <Button 
                    disabled={!stream} 
                    className="flex-1 h-11 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl text-xs font-bold shadow-xs" 
                    onClick={handleCapture}
                  >
                    {t('attendance.face_camera.capture', 'Tomar Foto')}
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
                    <RefreshCw size={12} /> {t('attendance.face_camera.retake', 'Repetir')}
                  </Button>
                  <Button 
                    disabled={isProcessing || !tempDescriptor}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold" 
                    onClick={handleConfirm}
                  >
                    {tempDescriptor ? '✓ Registrando...' : t('common.continue', 'Continuar')}
                  </Button>
                </>
              )}
            </div>

            {/* Permanent Way Out Link (Always visible, even during streaming or errors) */}
            {allowBypass && onBypass && (
              <div className="pt-2 border-t border-gray-100 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowBypassView(true)}
                  className="text-xs font-semibold text-gray-500 hover:text-amber-700 hover:underline flex items-center gap-1.5 py-1 px-2 transition-colors"
                >
                  <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                  <span>{t('attendance.face_camera.bypass_link', '¿Problemas con la cámara? Continuar sin Face ID')}</span>
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
