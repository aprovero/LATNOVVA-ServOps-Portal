import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, CheckCircle2, Loader2, AlertTriangle, ScanFace } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import {
  validateImageQualityAndGetDescriptor,
  matchDescriptors,
  loadFaceModels,
  detectFaceInVideo,
  detectGlassGlare,
  normalizeDescriptor,
  shouldShowBypassButton,
  FACE_BYPASS_STRIKE_LIMIT,
  getFaceDescriptorCacheKey,
} from '../../utils/faceId.utils';
import { playCaptureBeep } from '../../utils/sound.utils';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';

interface FaceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'enroll' | 'verify';
  referenceDescriptor?: number[];
  personnelId?: string;
  onSuccess: (data: { image: string; descriptor: number[] }) => void;
  onBypass?: (reason?: string) => void;
  allowBypass?: boolean;
}

const BYPASS_REASONS = [
  'Cámara dañada o no disponible',
  'Mala iluminación / contraluz',
  'Condiciones climáticas (lluvia / polvo)',
  'Otro motivo',
];

export default function FaceCameraModal({
  isOpen,
  onClose,
  mode,
  referenceDescriptor,
  personnelId,
  onSuccess,
  onBypass,
  allowBypass = true,
}: FaceCameraModalProps) {
  const { t } = useTranslation();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isOpenRef = useRef(isOpen);
  const isDetectingRef = useRef(false);

  // Always-fresh props ref prevents stale closures inside interval / async auto-capture
  const latestPropsRef = useRef({ mode, referenceDescriptor, personnelId, onSuccess });
  latestPropsRef.current = { mode, referenceDescriptor, personnelId, onSuccess };

  const [streamReady, setStreamReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScreenFlashing, setIsScreenFlashing] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // 3-strike contingency state ("Omitir" appears after 3 failures or immediate hardware/model error)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [showBypassView, setShowBypassView] = useState(false);
  const [bypassReason, setBypassReason] = useState(BYPASS_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // Real-time alignment state for hands-free auto-capture
  const [faceGuideState, setFaceGuideState] = useState<'searching' | 'aligning' | 'locked'>('searching');
  const [guideHint, setGuideHint] = useState<string>('Centra tu rostro frente a la cámara');
  const autoSnapTriggeredRef = useRef(false);
  const alignedFramesRef = useRef(0);
  const lastBoxRef = useRef<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const searchStartRef = useRef<number>(Date.now());

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamReady(false);
  };

  // Re-attach live MediaStream whenever <video> becomes visible again (fixes black screen on Retry / Volver)
  useEffect(() => {
    if (isOpen && streamReady && !capturedPhoto && !showBypassView && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen, streamReady, capturedPhoto, showBypassView]);

  useEffect(() => {
    if (isOpen) {
      setShowBypassView(false);
      setFailedAttempts(0);
      setHasCameraError(false);
      setVerifiedSuccess(false);
      setCapturedPhoto(null);
      setErrorMsg(null);
      autoSnapTriggeredRef.current = false;
      alignedFramesRef.current = 0;
      isDetectingRef.current = false;
      searchStartRef.current = Date.now();
      setFaceGuideState('searching');
      setGuideHint('Centra tu rostro frente a la cámara');
      startCamera();
      loadFaceModels().catch((err) => {
        console.warn('[FaceCameraModal] Model load error:', err);
        if (isOpenRef.current) {
          setHasCameraError(true);
          setErrorMsg('No se pudieron cargar los modelos de Face ID. Verifica tu conexión o usa Omitir.');
        }
      });
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  // Hands-free frontal alignment & auto-capture loop (with in-flight guard against overlapping TF.js inferences)
  useEffect(() => {
    if (!isOpen || !streamReady || capturedPhoto || isProcessing || showBypassView || verifiedSuccess || hasCameraError) {
      return;
    }

    searchStartRef.current = Date.now();

    const interval = setInterval(async () => {
      if (!videoRef.current || autoSnapTriggeredRef.current || isDetectingRef.current) return;

      if (Date.now() - searchStartRef.current > 15000) {
        searchStartRef.current = Date.now();
        alignedFramesRef.current = 0;
        setFailedAttempts((prev) => prev + 1);
        setErrorMsg('No se detectó un rostro claro a tiempo. Acércate un poco y mira de frente.');
        return;
      }

      isDetectingRef.current = true;
      try {
        const res = await detectFaceInVideo(videoRef.current);
        if (!isOpenRef.current || autoSnapTriggeredRef.current) return;
        lastBoxRef.current = res.box;

        if (!res.detected) {
          alignedFramesRef.current = 0;
          setFaceGuideState('searching');
          setGuideHint('Centra tu rostro dentro del óvalo');
          return;
        }

        if (!res.isCentered) {
          alignedFramesRef.current = 0;
          setFaceGuideState('aligning');
          setGuideHint('Acércate y centra tu rostro en el óvalo');
          return;
        }

        if (!res.isFrontal) {
          alignedFramesRef.current = 0;
          setFaceGuideState('aligning');
          setGuideHint('Mira de frente a la cámara con la cabeza recta');
          return;
        }

        alignedFramesRef.current += 1;
        setFaceGuideState('locked');
        setGuideHint('¡Mantén la posición! Capturando...');

        if (alignedFramesRef.current >= 3 && !autoSnapTriggeredRef.current) {
          autoSnapTriggeredRef.current = true;
          handleAutoCapture();
        }
      } catch {
        // non-fatal detection tick error
      } finally {
        isDetectingRef.current = false;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, streamReady, capturedPhoto, isProcessing, showBypassView, verifiedSuccess, hasCameraError]);

  async function startCamera() {
    setErrorMsg(null);
    setCapturedPhoto(null);
    setVerifiedSuccess(false);
    autoSnapTriggeredRef.current = false;
    alignedFramesRef.current = 0;
    setFaceGuideState('searching');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraError(true);
      setErrorMsg('Cámara no disponible en este dispositivo o navegador.');
      return;
    }

    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      // Prevent leaked camera light if modal closed while getUserMedia was pending
      if (!isOpenRef.current) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
      setStreamReady(true);
    } catch (err: any) {
      console.error('[FaceCameraModal] Camera access error:', err);
      if (isOpenRef.current) {
        setHasCameraError(true);
        setErrorMsg('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
      }
    }
  }

  async function resolveAuthoritativeReference(): Promise<number[] | null> {
    const { referenceDescriptor: latestRef, personnelId: latestPid } = latestPropsRef.current;
    const direct = normalizeDescriptor(latestRef);
    if (direct) return direct;

    const resolvedId = latestPid || useStore.getState().resolvePersonnelId();
    if (resolvedId) {
      try {
        const cachedRaw = localStorage.getItem(getFaceDescriptorCacheKey(resolvedId));
        const cached = normalizeDescriptor(cachedRaw);
        if (cached) return cached;
      } catch {}

      try {
        const { data: mxRow } = await (supabase.from('mx_personnel') as any)
          .select('faceDescriptor')
          .eq('id', resolvedId)
          .maybeSingle();
        const mxDesc = normalizeDescriptor(mxRow?.faceDescriptor);
        if (mxDesc) return mxDesc;
      } catch {}

      try {
        const { data: pRow } = await (supabase.from('personnel') as any)
          .select('faceDescriptor')
          .eq('id', resolvedId)
          .maybeSingle();
        const pDesc = normalizeDescriptor(pRow?.faceDescriptor);
        if (pDesc) return pDesc;
      } catch {}
    }

    return null;
  }

  async function handleAutoCapture() {
    if (!videoRef.current || !canvasRef.current) {
      autoSnapTriggeredRef.current = false;
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Abort cleanly if video has not produced a real frame yet (prevents black frame capture)
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      autoSnapTriggeredRef.current = false;
      alignedFramesRef.current = 0;
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      autoSnapTriggeredRef.current = false;
      return;
    }

    setIsScreenFlashing(true);
    playCaptureBeep();
    setTimeout(() => setIsScreenFlashing(false), 180);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const glare = detectGlassGlare(canvas, lastBoxRef.current);
    if (glare.isGlareDetected) {
      setFailedAttempts((prev) => prev + 1);
      setErrorMsg('Se detectó reflejo de pantalla o brillo excesivo. Evita reflejos directos e intenta nuevamente.');
      autoSnapTriggeredRef.current = false;
      alignedFramesRef.current = 0;
      searchStartRef.current = Date.now();
      return;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPhoto(dataUrl);
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const validation = await validateImageQualityAndGetDescriptor(dataUrl);
      if (!isOpenRef.current) return;

      if (!validation.success || !validation.descriptor) {
        setFailedAttempts((prev) => prev + 1);
        const errCode = validation.error;
        if (errCode === 'multiple_faces_detected') {
          setErrorMsg('Se detectaron múltiples rostros. Asegúrate de estar solo frente a la cámara.');
        } else if (errCode === 'face_too_small') {
          setErrorMsg('Tu rostro está muy lejos. Acércate un poco más a la cámara.');
        } else if (errCode === 'low_quality') {
          setErrorMsg('Imagen borrosa o con poca luz. Mejora la iluminación e intenta de nuevo.');
        } else if (errCode === 'timeout') {
          setErrorMsg('El análisis tardó demasiado. Intenta nuevamente.');
        } else {
          setErrorMsg('No se pudo detectar tu rostro con claridad. Intenta de nuevo.');
        }
        setIsProcessing(false);
        return;
      }

      const { mode: currentMode, onSuccess: currentOnSuccess } = latestPropsRef.current;

      if (currentMode === 'verify') {
        const refDesc = await resolveAuthoritativeReference();
        if (!isOpenRef.current) return;

        if (!refDesc) {
          setFailedAttempts((prev) => prev + 1);
          setErrorMsg('No se encontró tu perfil biométrico v6. Reintenta o actualiza tu registro.');
          setIsProcessing(false);
          return;
        }

        const match = matchDescriptors(validation.descriptor, refDesc);
        if (!match.isMatch) {
          const simPct = Math.max(0, Math.min(100, Math.round((1 - match.distance) * 100)));
          setFailedAttempts((prev) => prev + 1);
          setErrorMsg(`El rostro no coincide con el perfil registrado (${simPct}% coincidencia). Intenta con mejor luz.`);
          setIsProcessing(false);
          return;
        }
      }

      setVerifiedSuccess(true);
      setIsProcessing(false);
      stopCamera();
      setTimeout(() => {
        if (isOpenRef.current) {
          currentOnSuccess({ image: dataUrl, descriptor: validation.descriptor! });
        }
      }, 350);
    } catch (err: any) {
      if (!isOpenRef.current) return;
      setFailedAttempts((prev) => prev + 1);
      setErrorMsg(err?.message || 'Error inesperado al validar el rostro.');
      setIsProcessing(false);
    }
  }

  function handleRetry() {
    setCapturedPhoto(null);
    setErrorMsg(null);
    setHasCameraError(false);
    setVerifiedSuccess(false);
    autoSnapTriggeredRef.current = false;
    alignedFramesRef.current = 0;
    searchStartRef.current = Date.now();
    setFaceGuideState('searching');
    loadFaceModels().catch((err) => {
      console.warn('[FaceCameraModal] Model retry load error:', err);
      if (isOpenRef.current) {
        setHasCameraError(true);
        setErrorMsg('No se pudieron cargar los modelos de Face ID. Verifica tu conexión o usa Omitir.');
      }
    });
    if (!streamRef.current || !streamRef.current.active) {
      startCamera();
    }
  }

  function handleConfirmBypass() {
    const finalReason = bypassReason === 'Otro motivo' ? (customReason.trim() || 'Contingencia Face ID') : bypassReason;
    stopCamera();
    onBypass?.(finalReason);
  }

  const canShowBypass = shouldShowBypassButton(failedAttempts, hasCameraError, allowBypass && !!onBypass);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopCamera(); onClose(); } }}>
      <DialogContent
        overlayClassName="z-[10000]"
        className="z-[10001] sm:max-w-md bg-slate-950 text-white border-slate-800 p-0 overflow-hidden rounded-3xl"
      >
        <DialogHeader className="p-5 pb-3 border-b border-slate-800/80">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <ScanFace className="w-5 h-5 text-brand-teal" />
            {mode === 'enroll'
              ? t('face_id.enroll_title', 'Registro Biométrico Face ID')
              : t('face_id.verify_title', 'Verificación Face ID')}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {mode === 'enroll'
              ? 'Actualización v6.0: coloca tu rostro centrado para registrar tu nueva foto biométrica automáticamente.'
              : 'Coloca tu rostro frente a la cámara. La captura y validación son automáticas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {showBypassView ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>Selecciona el motivo para omitir la validación facial en este marcaje. Quedará registrado para revisión.</span>
              </div>

              <div className="space-y-2">
                {BYPASS_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBypassReason(r)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      bypassReason === r
                        ? 'bg-brand-teal/20 border-brand-teal text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {bypassReason === 'Otro motivo' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe brevemente el motivo..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                />
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBypassView(false)}
                  className="flex-1 bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  Volver
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmBypass}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${capturedPhoto ? 'hidden' : 'block'}`}
                />
                {capturedPhoto && (
                  <img
                    src={capturedPhoto}
                    alt="Captured face"
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                )}

                {isScreenFlashing && (
                  <div className="absolute inset-0 bg-white/85 pointer-events-none transition-opacity duration-150" />
                )}

                {!capturedPhoto && !hasCameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div
                      className={`w-44 h-56 rounded-[50%] border-[3px] transition-all duration-200 ${
                        faceGuideState === 'locked'
                          ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.45)] scale-[1.02]'
                          : faceGuideState === 'aligning'
                          ? 'border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.3)]'
                          : 'border-white/40 border-dashed'
                      }`}
                    />
                    <span
                      className={`mt-3 px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md ${
                        faceGuideState === 'locked'
                          ? 'bg-emerald-500/90 text-slate-950'
                          : 'bg-slate-950/75 text-white'
                      }`}
                    >
                      {guideHint}
                    </span>
                  </div>
                )}

                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
                    <span className="text-xs font-semibold text-slate-200">Validando biometría...</span>
                  </div>
                )}

                {verifiedSuccess && (
                  <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-200">
                      {mode === 'enroll' ? '¡Rostro registrado!' : '¡Identidad verificada!'}
                    </span>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="space-y-1">
                    <p>{errorMsg}</p>
                    {!hasCameraError && failedAttempts > 0 && failedAttempts < FACE_BYPASS_STRIKE_LIMIT && allowBypass && onBypass && (
                      <p className="text-[11px] text-slate-400">
                        Intento {failedAttempts} de {FACE_BYPASS_STRIKE_LIMIT}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                {(capturedPhoto || hasCameraError) && !isProcessing && !verifiedSuccess ? (
                  <Button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-white font-bold gap-2 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { stopCamera(); onClose(); }}
                    className="flex-1 bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl"
                  >
                    Cancelar
                  </Button>
                )}

                {canShowBypass && !isProcessing && !verifiedSuccess && (
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="face-omitir-btn"
                    onClick={() => setShowBypassView(true)}
                    className="bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 font-bold rounded-xl px-5"
                  >
                    Omitir
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
