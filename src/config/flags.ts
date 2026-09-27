/**
 * Feature Flags Configuration
 * 
 * USE_NORMALIZED_PUNCHES:
 * Gates the Stage 2 normalized punch architecture (RPC record_clock_punch,
 * event-oriented pendingSync queue state machine, direct Storage media upload & attachment).
 * 
 * Production default MUST remain false.
 */
export const USE_NORMALIZED_PUNCHES: boolean = 
  import.meta.env.VITE_USE_NORMALIZED_PUNCHES === 'true' || false;
