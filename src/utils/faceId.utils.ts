import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

/**
 * Loads the face-api models if they aren't already loaded.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  try {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('[FaceID] Models loaded successfully.');
  } catch (error) {
    console.error('[FaceID] Error loading models:', error);
    throw new Error('Failed to load face recognition models.');
  }
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
}

/**
 * Analyzes a face image (base64 string) to extract the face descriptor and ensure high quality.
 * Rules:
 * 1. Must detect exactly one face.
 * 2. The detection confidence must be high (> 0.70).
 */
export async function validateImageQualityAndGetDescriptor(
  imageSrc: string
): Promise<FaceValidationResult> {
  try {
    await loadFaceModels();
    const img = await loadImage(imageSrc);

    // Run face detection with landmarks and recognition descriptor
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      return { success: false, error: 'no_face_detected' };
    }

    if (detections.length > 1) {
      return { success: false, error: 'multiple_faces_detected' };
    }

    const face = detections[0];
    
    // Check detection score
    if (face.detection.score < 0.65) {
      return { success: false, error: 'low_detection_confidence' };
    }

    // Convert Float32Array to standard number array for database storage
    const descriptorArray = Array.from(face.descriptor);

    return {
      success: true,
      descriptor: descriptorArray,
    };
  } catch (error: any) {
    console.error('[FaceID] Validation error:', error);
    return { success: false, error: error.message || 'unknown_error' };
  }
}

/**
 * Matches two face descriptors using Euclidean distance.
 * Typically, a distance less than 0.6 is considered a match.
 */
export function matchDescriptors(
  descriptor1: number[],
  descriptor2: number[],
  threshold = 0.6
): { isMatch: boolean; distance: number } {
  if (descriptor1.length !== descriptor2.length) {
    return { isMatch: false, distance: 1.0 };
  }

  // Convert number arrays back to Float32Array for face-api utility
  const d1 = new Float32Array(descriptor1);
  const d2 = new Float32Array(descriptor2);

  const distance = faceapi.euclideanDistance(d1, d2);
  return {
    isMatch: distance < threshold,
    distance,
  };
}
