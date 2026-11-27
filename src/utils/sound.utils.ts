/**
 * Sound & Audio Telemetry Utilities for LATNOVVA ServiceTool v6.0.0
 * Uses Web Audio API for instantaneous, cross-platform audio feedback (iOS Safari, Android Chrome, Desktop)
 * with zero external asset downloads and 100% offline support.
 */

export function playCaptureBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.08);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now);
    osc2.frequency.exponentialRampToValueAtTime(1760.0, now + 0.08);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.22);
    osc2.start(now);
    osc2.stop(now + 0.22);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([45, 30, 45]);
      } catch {}
    }
  } catch {
    // Graceful fallback if audio is restricted by browser policy
  }
}
