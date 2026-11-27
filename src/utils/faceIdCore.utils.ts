/**
 * Pure, zero-dependency biometric math, policy, detector fallback, and empirical validation helpers.
 * Re-exported by faceId.utils.ts so unit tests can import production logic directly in Node.
 */

/**
 * Single authoritative match threshold (PASS 15B / P1-1).
 * Adjustable via VITE_FACE_MATCH_THRESHOLD env var without divergent constants.
 * NOTE: 0.53 is a candidate threshold — EMPIRICAL VALIDATION REQUIRED on real devices/lighting.
 */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.53;
export const FACE_MATCH_THRESHOLD = DEFAULT_FACE_MATCH_THRESHOLD;

export function getFaceMatchThreshold(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0 && override < 1) {
    return override;
  }
  try {
    const envVal = (import.meta as any)?.env?.VITE_FACE_MATCH_THRESHOLD;
    if (envVal !== undefined && envVal !== '') {
      const parsed = Number(envVal);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 1) return parsed;
    }
  } catch {}
  return DEFAULT_FACE_MATCH_THRESHOLD;
}

export const MIN_DESCRIPTOR_DETECTION_SCORE = 0.6;
export const MIN_FACE_WIDTH_PX = 90;
export const FACE_BYPASS_STRIKE_LIMIT = 3;

export function getFaceDescriptorCacheKey(userId: string): string {
  return `v6_face_descriptor_${userId}`;
}

export function shouldShowBypassButton(
  failedAttempts: number,
  hasCameraError: boolean,
  allowBypass: boolean
): boolean {
  if (!allowBypass) return false;
  if (hasCameraError) return true;
  return failedAttempts >= FACE_BYPASS_STRIKE_LIMIT;
}

/**
 * Detector fallback decision helper (PASS 15B / P1-2):
 * - SSD loaded & found detections -> 'ssd'
 * - SSD unavailable OR SSD found 0 detections, and Tiny loaded -> 'tiny_fallback'
 * - Both unavailable -> 'unavailable'
 */
export function resolveDetectorStrategy(params: {
  ssdLoaded: boolean;
  tinyLoaded: boolean;
  ssdDetectionsCount?: number;
}): 'ssd' | 'tiny_fallback' | 'unavailable' {
  if (!params.ssdLoaded && !params.tinyLoaded) {
    return 'unavailable';
  }
  if (params.ssdLoaded) {
    if (params.ssdDetectionsCount === undefined || params.ssdDetectionsCount > 0) {
      return 'ssd';
    }
    return params.tinyLoaded ? 'tiny_fallback' : 'unavailable';
  }
  return params.tinyLoaded ? 'tiny_fallback' : 'unavailable';
}

export interface EmpiricalFaceValidationSample {
  timestamp: string;
  candidateThreshold: number;
  genuineDistance: number | null;
  impostorDistance: number | null;
  acceptedGenuine: boolean | null;
  rejectedImpostor: boolean | null;
  device: string;
  lighting: string;
  glassesOrPpe: string;
}

/**
 * Empirical validation harness helper (P1-1) for field calibration before finalizing threshold.
 */
export function createEmpiricalValidationRecord(params: {
  candidateThreshold?: number;
  genuineDistance?: number | null;
  impostorDistance?: number | null;
  device: string;
  lighting: string;
  glassesOrPpe?: string;
}): EmpiricalFaceValidationSample {
  const threshold = getFaceMatchThreshold(params.candidateThreshold);
  const gDist = params.genuineDistance ?? null;
  const iDist = params.impostorDistance ?? null;
  return {
    timestamp: new Date().toISOString(),
    candidateThreshold: threshold,
    genuineDistance: gDist,
    impostorDistance: iDist,
    acceptedGenuine: gDist !== null ? gDist < threshold : null,
    rejectedImpostor: iDist !== null ? iDist >= threshold : null,
    device: params.device,
    lighting: params.lighting,
    glassesOrPpe: params.glassesOrPpe ?? 'none',
  };
}

export function normalizeDescriptor(raw: unknown): number[] | null {
  if (!raw) return null;
  let value: any = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  let arr: number[] | null = null;
  if (Array.isArray(value)) {
    arr = value.map(Number);
  } else if (value instanceof Float32Array) {
    arr = Array.from(value);
  } else if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
      arr = keys.sort((a, b) => Number(a) - Number(b)).map((k) => Number(value[k]));
    }
  }
  if (!arr || arr.length !== 128 || arr.some((n) => !Number.isFinite(n))) return null;
  return arr;
}

export function matchDescriptors(
  descriptor1: unknown,
  descriptor2: unknown,
  threshold = getFaceMatchThreshold()
): { isMatch: boolean; distance: number } {
  const a = normalizeDescriptor(descriptor1);
  const b = normalizeDescriptor(descriptor2);
  if (!a || !b) {
    return { isMatch: false, distance: 1.0 };
  }

  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  const distance = Math.sqrt(sumSq);
  return {
    isMatch: distance < threshold,
    distance,
  };
}
