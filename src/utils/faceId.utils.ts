import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

/**
 * Loads individual models sequentially from a candidate URL if not already loaded.
 */
async function loadModelsFromSource(sourceUrl: string): Promise<boolean> {
  try {
    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      await faceapi.nets.tinyFaceDetector.loadFromUri(sourceUrl);
    }
    if (!faceapi.nets.faceLandmark68Net.isLoaded) {
      await faceapi.nets.faceLandmark68Net.loadFromUri(sourceUrl);
    }
    if (!faceapi.nets.faceRecognitionNet.isLoaded) {
      await faceapi.nets.faceRecognitionNet.loadFromUri(sourceUrl);
    }
    return (
      faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded
    );
  } catch (err) {
    console.warn(`[FaceID] Could not load all neural network models from ${sourceUrl}:`, err);
    return false;
  }
}

/**
 * Loads the face-api models if they aren't already loaded with multi-tier fallback (origin -> relative -> jsDelivr CDN).
 */
export async function loadFaceModels(): Promise<void> {
  if (
    modelsLoaded ||
    (faceapi.nets.tinyFaceDetector.isLoaded &&
      faceapi.nets.faceLandmark68Net.isLoaded &&
      faceapi.nets.faceRecognitionNet.isLoaded)
  ) {
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

    // Secondary retry with 1s pause in case of temporary network glitch
    await new Promise((r) => setTimeout(r, 1000));
    for (const source of candidateSources) {
      const ok = await loadModelsFromSource(source);
      if (ok) {
        modelsLoaded = true;
        console.log('[FaceID] Models loaded successfully on retry from', source);
        return;
      }
    }

    throw new Error('No se han podido cargar los modelos de reconocimiento facial. Por favor verifica tu conexión o utiliza la opción de continuar sin Face ID.');
  })().finally(() => {
    modelLoadingPromise = null;
  });

  return modelLoadingPromise;
}

/**
 * Helper to convert base64 data URL to an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image element'));
    img.src = src;
  });
}

/**
 * Interface representing the face detection and validation outcome.
 */
export interface FaceValidationResult {
  success: boolean;
  descriptor?: number[];
  error?: string;
  confidence?: number;
}

/**
 * Checks a live video stream for a centered face (lightweight 224px check for auto-snap).
 */
export async function detectFaceInVideo(video: HTMLVideoElement): Promise<{
  detected: boolean;
  isCentered: boolean;
  box?: { x: number; y: number; width: number; height: number };
}> {
  if (!modelsLoaded || !video || video.readyState < 2 || video.paused || video.ended) {
    return { detected: false, isCentered: false };
  }

  try {
    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
    );

    if (!detection) {
      return { detected: false, isCentered: false };
    }

    const { box } = detection;
    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Check if face is centered within the middle 35% bounding zone
    const isCenteredX = centerX >= vWidth * 0.32 && centerX <= vWidth * 0.68;
    const isCenteredY = centerY >= vHeight * 0.25 && centerY <= vHeight * 0.75;
    // Check if face is sufficiently close / large in frame (>22% and <85% of width)
    const isGoodSize = box.width >= vWidth * 0.22 && box.width <= vWidth * 0.85;

    return {
      detected: true,
      isCentered: isCenteredX && isCenteredY && isGoodSize,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  } catch {
    return { detected: false, isCentered: false };
  }
}

/**
 * Analyzes a face image (base64 string) to extract the face descriptor with fast 2-tier detection.
 * Extracts 68-point landmarks and descriptor EXACTLY ONCE on the detected face box (< 400ms).
 */
export async function validateImageQualityAndGetDescriptor(
  imageSrc: string
): Promise<FaceValidationResult> {
  const processPromise = (async (): Promise<FaceValidationResult> => {
    try {
      await loadFaceModels();
      const img = await loadImage(imageSrc);

      // Fast Tier 1: optimal 320 resolution (~150ms)
      let detectedFace = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.22 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      // Fast Tier 2 Fallback: if Tier 1 misses due to glasses reflection/dim lighting, try 416 with softer threshold
      if (!detectedFace) {
        detectedFace = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.16 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (!detectedFace) {
        return { success: false, error: 'no_face_detected' };
      }

      // Convert Float32Array to standard number array for database storage
      const descriptorArray = Array.from(detectedFace.descriptor);

      return {
        success: true,
        descriptor: descriptorArray as number[],
        confidence: detectedFace.detection.score,
      };
    } catch (error: any) {
      console.error('[FaceID] Validation error:', error);
      return { success: false, error: error.message || 'unknown_error' };
    }
  })();

  // 15-second safety timeout so slower devices or first-time neural net downloads never time out prematurely
  const timeoutPromise = new Promise<FaceValidationResult>((resolve) =>
    setTimeout(() => resolve({ success: false, error: 'timeout' }), 15000)
  );

  return Promise.race([processPromise, timeoutPromise]);
}

/**
 * Matches two face descriptors using Euclidean distance.
 * Typically, a distance less than 0.65 is considered a match.
 */
export function matchDescriptors(
  descriptor1: number[],
  descriptor2: number[],
  threshold = 0.65
): { isMatch: boolean; distance: number } {
  if (!descriptor1 || !descriptor2 || descriptor1.length !== descriptor2.length || descriptor1.length === 0) {
    return { isMatch: false, distance: 1.0 };
  }

  const d1 = new Float32Array(descriptor1);
  const d2 = new Float32Array(descriptor2);

  const distance = faceapi.euclideanDistance(d1, d2);
  return {
    isMatch: distance < threshold,
    distance,
  };
}
