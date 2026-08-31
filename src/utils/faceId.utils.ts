import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let modelLoadingPromise: Promise<void> | null = null;

/**
 * Loads the face-api models if they aren't already loaded.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const MODEL_URL = `${baseUrl}/models`;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log('[FaceID] Models loaded successfully from', MODEL_URL);
    } catch (error: any) {
      console.warn('[FaceID] Failed loading from origin, trying /models relative path...', error);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        modelsLoaded = true;
        console.log('[FaceID] Models loaded successfully from /models');
      } catch (err2: any) {
        console.error('[FaceID] Error loading face recognition models:', err2);
        throw new Error('Failed to load facial recognition models.');
      }
    } finally {
      modelLoadingPromise = null;
    }
  })();

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
 * Analyzes a face image (base64 string) to extract the face descriptor with adaptive multi-scale detection.
 */
export async function validateImageQualityAndGetDescriptor(
  imageSrc: string
): Promise<FaceValidationResult> {
  try {
    await loadFaceModels();
    const img = await loadImage(imageSrc);

    // Multi-scale adaptive detection across various input sizes
    // TinyFaceDetector inputSize must be multiple of 32: 320, 416, 512, 224, 160
    const candidateSizes = [320, 416, 512, 224, 160];
    let detections: any[] = [];

    for (const inputSize of candidateSizes) {
      try {
        const result = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.25 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (result && result.length > 0) {
          detections = result;
          break;
        }
      } catch (err) {
        console.warn(`[FaceID] TinyFaceDetector failed at size ${inputSize}:`, err);
      }
    }

    // Fallback pass with lower threshold if no detection on primary pass
    if (detections.length === 0) {
      for (const inputSize of [320, 416, 224]) {
        try {
          const result = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.15 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (result && result.length > 0) {
            detections = result;
            break;
          }
        } catch {}
      }
    }

    if (detections.length === 0) {
      return { success: false, error: 'no_face_detected' };
    }

    // Sort detections by bounding box area (largest face in foreground)
    detections.sort((a, b) => {
      const areaA = (a.detection?.box?.width || 0) * (a.detection?.box?.height || 0);
      const areaB = (b.detection?.box?.width || 0) * (b.detection?.box?.height || 0);
      return areaB - areaA;
    });

    const primaryFace = detections[0];

    // Check if there is genuinely a second person in frame (>45% size of primary and high score)
    if (detections.length > 1) {
      const areaPrimary = primaryFace.detection.box.width * primaryFace.detection.box.height;
      const areaSecondary = detections[1].detection.box.width * detections[1].detection.box.height;
      if (areaSecondary > areaPrimary * 0.45 && detections[1].detection.score > 0.45) {
        return { success: false, error: 'multiple_faces_detected' };
      }
    }

    // Convert Float32Array to standard number array for database storage
    const descriptorArray = Array.from(primaryFace.descriptor);

    return {
      success: true,
      descriptor: descriptorArray as number[],
      confidence: primaryFace.detection.score,
    };
  } catch (error: any) {
    console.error('[FaceID] Validation error:', error);
    return { success: false, error: error.message || 'unknown_error' };
  }
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
