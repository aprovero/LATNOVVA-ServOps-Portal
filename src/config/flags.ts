/**
 * Feature Flags Configuration
 * 
 * USE_NORMALIZED_PUNCHES:
 * Gates the Global Stage 2 normalized punch architecture cutover.
 * Production default MUST remain false during Stage 1 canary experiment.
 */
export const USE_NORMALIZED_PUNCHES: boolean = 
  ((import.meta as any).env?.VITE_USE_NORMALIZED_PUNCHES === 'true') || false;
