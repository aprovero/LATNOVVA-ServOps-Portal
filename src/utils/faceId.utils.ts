import * as faceapi from '@vladmandic/face-api';
import {
  FACE_MATCH_THRESHOLD,
  MIN_DESCRIPTOR_DETECTION_SCORE,
  MIN_FACE_WIDTH_PX,
  FACE_BYPASS_STRIKE_LIMIT,
  getFaceDescriptorCacheKey,
  shouldShowBypassButton,
  resolveDetectorStrategy,
  normalizeDescriptor,
  matchDescriptors,
} from './faceIdCore.utils';

export {
  FACE_MATCH_THRESHOLD,
  MIN_DESCRIPTOR_DETECTION_SCORE,
  MIN_FACE_WIDTH_PX,
  FACE_BYPASS_STRIKE_LIMIT,
  getFaceDescriptorCacheKey,
  shouldShowBypassButton,
  resolveDetectorStrategy,
  normalizeDescriptor,
  matchDescriptors,
};

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

function coreModelsLoaded(): boolean {
  const hasDetector = faceapi.nets.ssdMobilenetv1.isLoaded || faceapi.nets.tinyFaceDetector.isLoaded;
  return (
    hasDetector &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  );
}

async function loadModelsFromSource(sourceUrl: string): Promise<boolean> {
  try {
    // Load TinyFaceDetector independently (fast live detector + fallback — failure must NOT block SSD)
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(sourceUrl);
      } catch (tinyErr) {
        console.warn(`[FaceID] TinyFaceDetector unavailable from ${sourceUrl}, continuing to SSD:`, tinyErr);
      }
    }
    // Load SSD MobileNet v1 independently (high-accuracy detector — failure must NOT block TinyFaceDetector)
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(sourceUrl);
      } catch (ssdErr) {
        console.warn(`[FaceID] SSD MobileNet v1 unavailable from ${sourceUrl}, falling back to TinyFaceDetector:`, ssdErr);
      }
    }
    if (!faceapi.nets.tinyFaceDetector.isLoaded && !faceapi.nets.ssdMobilenetv1.isLoaded) {
      return false;
    }
    if (!faceapi.nets.faceLandmark68Net.isLoaded) {
      await faceapi.nets.faceLandmark68Net.loadFromUri(sourceUrl);
    }
    if (!faceapi.nets.faceRecognitionNet.isLoaded) {
      await faceapi.nets.faceRecognitionNet.loadFromUri(sourceUrl);
    }
    return coreModelsLoaded();
  } catch (err) {
    console.warn(`[FaceID] Could not load core neural network models from ${sourceUrl}:`, err);
    return false;
  }
}

/**
 * Loads the face-api models with multi-tier fallback (origin -> relative -> jsDelivr CDN).
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded || coreModelsLoaded()) {
    modelsLoaded = true;
    return;
  }

  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const candidateSources = [
      origin ? `${origin}/models` : '/models',
      '/models',
      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
    ];

    for (const source of candidateSources) {
      const ok = await loadModelsFromSource(source);
      if (ok) {
        modelsLoaded = true;
        console.log('[FaceID] Models loaded successfully from', source);
        return;
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
    for (const source of candidateSources) {
      const ok = await loadModelsFromSource(source);
      if (ok) {
        modelsLoaded = true;
        console.log('[FaceID] Models loaded successfully on retry from', source);
        return;
      }
    }

    throw new Error('No se han podido cargar los modelos de reconocimiento facial.');
  })().finally(() => {
    modelLoadingPromise = null;
  });

  return modelLoadingPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image element'));
    img.src = src;
  });
}

export interface FaceValidationResult {
  success: boolean;
  descriptor?: number[];
  error?: string;
  confidence?: number;
}

export interface VideoFaceDetection {
  detected: boolean;
  isCentered: boolean;
  isFrontal: boolean;
  rollDegrees: number;
  asymmetry: number;
  box?: { x: number; y: number; width: number; height: number };
}

/**
 * Checks a live video stream for a centered, upright frontal face.
 */
export async function detectFaceInVideo(video: HTMLVideoElement): Promise<VideoFaceDetection> {
  if (!modelsLoaded || !video || video.readyState < 2 || video.paused || video.ended) {
    return { detected: false, isCentered: false, isFrontal: false, rollDegrees: 0, asymmetry: 1.0 };
  }

  try {
    const strategy = resolveDetectorStrategy({
      ssdLoaded: faceapi.nets.ssdMobilenetv1.isLoaded,
      tinyLoaded: faceapi.nets.tinyFaceDetector.isLoaded,
    });
    if (strategy === 'unavailable') {
      return { detected: false, isCentered: false, isFrontal: false, rollDegrees: 0, asymmetry: 1.0 };
    }

    let detection: any = null;
    // Prefer TinyFaceDetector for low-latency live video; fall back to SSD if Tiny failed to load
    const detector = faceapi.nets.tinyFaceDetector.isLoaded
      ? new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
      : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 });

    if (faceapi.nets.faceLandmark68Net.isLoaded) {
      detection = await faceapi.detectSingleFace(video, detector).withFaceLandmarks();
    } else {
      detection = await faceapi.detectSingleFace(video, detector);
    }

    if (!detection) {
      return { detected: false, isCentered: false, isFrontal: false, rollDegrees: 0, asymmetry: 1.0 };
    }

    const box = detection.detection ? detection.detection.box : detection.box;
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const isCenteredX = centerX >= vWidth * 0.25 && centerX <= vWidth * 0.75;
    const isCenteredY = centerY >= vHeight * 0.18 && centerY <= vHeight * 0.82;
    const isGoodSize = box.width >= vWidth * 0.20 && box.width <= vWidth * 0.85;
    const isCentered = isCenteredX && isCenteredY && isGoodSize;

    let isFrontal = true;
    let rollDegrees = 0;
    let asymmetry = 1.0;

    if (detection.landmarks) {
      const jaw = detection.landmarks.getJawOutline();
      const nose = detection.landmarks.getNose();
      const leftEye = detection.landmarks.getLeftEye();
      const rightEye = detection.landmarks.getRightEye();

      if (leftEye && leftEye.length > 0 && rightEye && rightEye.length > 0) {
        const leftEyeCenterX = leftEye.reduce((s: number, p: any) => s + p.x, 0) / leftEye.length;
        const leftEyeCenterY = leftEye.reduce((s: number, p: any) => s + p.y, 0) / leftEye.length;
        const rightEyeCenterX = rightEye.reduce((s: number, p: any) => s + p.x, 0) / rightEye.length;
        const rightEyeCenterY = rightEye.reduce((s: number, p: any) => s + p.y, 0) / rightEye.length;

        const dX = rightEyeCenterX - leftEyeCenterX;
        const dY = rightEyeCenterY - leftEyeCenterY;
        rollDegrees = Math.abs(Math.atan2(dY, dX) * (180 / Math.PI));
      }

      if (jaw && jaw.length >= 17 && nose && nose.length >= 4) {
        const leftJawX = jaw[0].x;
        const rightJawX = jaw[16].x;
        const noseTipX = nose[3].x;
        const leftDist = Math.abs(noseTipX - leftJawX);
        const rightDist = Math.abs(rightJawX - noseTipX);

        if (leftDist > 0 && rightDist > 0) {
          asymmetry = Math.max(leftDist, rightDist) / Math.min(leftDist, rightDist);
          isFrontal = asymmetry <= 1.28 && rollDegrees <= 14;
        }
      }
    }

    return {
      detected: true,
      isCentered,
      isFrontal,
      rollDegrees,
      asymmetry,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  } catch {
    return { detected: false, isCentered: false, isFrontal: false, rollDegrees: 0, asymmetry: 1.0 };
  }
}

/**
 * Detects harsh planar specular glare or glass screen reflections on the face region.
 * > 10% pure saturated white pixels indicates a phone/tablet screen reflection spoof.
 */
export function detectGlassGlare(
  canvas: HTMLCanvasElement,
  box?: { x: number; y: number; width: number; height: number }
): { isGlareDetected: boolean; glareRatio: number } {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { isGlareDetected: false, glareRatio: 0 };

    const bx = box ? Math.max(0, Math.floor(box.x)) : 0;
    const by = box ? Math.max(0, Math.floor(box.y)) : 0;
    const bw = box ? Math.min(canvas.width - bx, Math.floor(box.width)) : canvas.width;
    const bh = box ? Math.min(canvas.height - by, Math.floor(box.height)) : canvas.height;

    if (bw < 30 || bh < 30) return { isGlareDetected: false, glareRatio: 0 };

    const imgData = ctx.getImageData(bx, by, bw, bh);
    const data = imgData.data;
    const totalPixels = bw * bh;

    let saturatedCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= 252 && data[i + 1] >= 252 && data[i + 2] >= 252) {
        saturatedCount++;
      }
    }

    const glareRatio = (saturatedCount / totalPixels) * 100;
    return { isGlareDetected: glareRatio > 10.0, glareRatio };
  } catch {
    return { isGlareDetected: false, glareRatio: 0 };
  }
}

/**
 * Analyzes a face image (base64 data URL) using SSD MobileNet v1 (with TinyFaceDetector fallback)
 * and extracts a 128-D face descriptor. Rejects multi-face, low-confidence, and too-small captures.
 */
export async function validateImageQualityAndGetDescriptor(
  imageSrc: string
): Promise<FaceValidationResult> {
  const processPromise = (async (): Promise<FaceValidationResult> => {
    try {
      await loadFaceModels();
      const img = await loadImage(imageSrc);

      let detections: any[] = [];
      const initialStrategy = resolveDetectorStrategy({
        ssdLoaded: faceapi.nets.ssdMobilenetv1.isLoaded,
        tinyLoaded: faceapi.nets.tinyFaceDetector.isLoaded,
      });

      if (initialStrategy === 'unavailable') {
        return { success: false, error: 'no_detector_loaded' };
      }

      if (initialStrategy === 'ssd') {
        try {
          detections = await faceapi
            .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();
        } catch (ssdRunErr) {
          console.warn('[FaceID] SSD inference failed, falling back to TinyFaceDetector:', ssdRunErr);
          detections = [];
        }
      }

      const fallbackStrategy = resolveDetectorStrategy({
        ssdLoaded: faceapi.nets.ssdMobilenetv1.isLoaded,
        tinyLoaded: faceapi.nets.tinyFaceDetector.isLoaded,
        ssdDetectionsCount: detections?.length ?? 0,
      });

      if (fallbackStrategy === 'tiny_fallback') {
        detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      }

      if (!detections || detections.length === 0) {
        return { success: false, error: 'no_face_detected' };
      }

      if (detections.length > 1) {
        return { success: false, error: 'multiple_faces_detected' };
      }

      const detectedFace = detections[0];
      const score = detectedFace.detection.score;
      const box = detectedFace.detection.box;

      if (score < MIN_DESCRIPTOR_DETECTION_SCORE) {
        return { success: false, error: 'low_quality', confidence: score };
      }

      if (box.width < MIN_FACE_WIDTH_PX) {
        return { success: false, error: 'face_too_small', confidence: score };
      }

      return {
        success: true,
        descriptor: Array.from(detectedFace.descriptor) as number[],
        confidence: score,
      };
    } catch (error: any) {
      console.error('[FaceID] Validation error:', error);
      return { success: false, error: error.message || 'unknown_error' };
    }
  })();

  const timeoutPromise = new Promise<FaceValidationResult>((resolve) =>
    setTimeout(() => resolve({ success: false, error: 'timeout' }), 15000)
  );

  return Promise.race([processPromise, timeoutPromise]);
}
