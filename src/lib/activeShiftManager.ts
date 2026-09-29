export interface NormalizedActiveShift {
  personnelId: string;
  timesheetId: string;
  date: string;
  projectId?: string;
  workMode: 'On Site' | 'Home Office';
  startedAt: string;
  clockInPunchId?: string;
}

const STORAGE_KEY_PREFIX = 'latnovva-active-shift-';

export function getActiveShiftKey(personnelId: string): string {
  return `${STORAGE_KEY_PREFIX}${personnelId}`;
}

function getLocalDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getActiveShift(personnelId: string): NormalizedActiveShift | null {
  if (!personnelId) return null;
  try {
    const raw = localStorage.getItem(getActiveShiftKey(personnelId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.timesheetId && parsed.personnelId === personnelId) {
      if (parsed.date && parsed.date < getLocalDateStr()) {
        console.warn(`[activeShiftManager] Clearing stale active shift from previous date (${parsed.date}) for personnel ${personnelId}`);
        clearActiveShift(personnelId);
        return null;
      }
      return parsed as NormalizedActiveShift;
    }
  } catch (e) {
    console.error('[activeShiftManager] Error reading active shift from localStorage:', e);
  }
  return null;
}

export function setActiveShift(shift: NormalizedActiveShift): void {
  if (!shift || !shift.personnelId || !shift.timesheetId) return;
  try {
    localStorage.setItem(getActiveShiftKey(shift.personnelId), JSON.stringify(shift));
  } catch (e) {
    console.error('[activeShiftManager] Error saving active shift to localStorage:', e);
  }
}

export function clearActiveShift(personnelId: string): void {
  if (!personnelId) return;
  try {
    localStorage.removeItem(getActiveShiftKey(personnelId));
  } catch (e) {
    console.error('[activeShiftManager] Error clearing active shift from localStorage:', e);
  }
}

/**
 * Deterministic recovery of active shift when local storage is unavailable.
 * Rules:
 * - 0 open candidates: return null
 * - 1 unambiguous candidate: recover exact timesheetId
 * - >1 candidates: FAIL CLOSED (return null, log explicit warning, do NOT choose by array order or ORDER BY created_at LIMIT 1)
 */
export function recoverActiveShift(
  personnelId: string,
  timesheets: any[]
): NormalizedActiveShift | null {
  if (!personnelId || !Array.isArray(timesheets)) return null;

  const openCandidates = timesheets.filter(
    (t: any) => t.personnelId === personnelId && t.timeIn && !t.timeOut
  );

  if (openCandidates.length === 0) {
    return null;
  }

  if (openCandidates.length === 1) {
    const cand = openCandidates[0];
    const shift: NormalizedActiveShift = {
      personnelId,
      timesheetId: cand.id,
      date: cand.date,
      projectId: cand.projectId,
      workMode: cand.type === 'Home Office' ? 'Home Office' : 'On Site',
      startedAt: cand.createdAt || new Date().toISOString()
    };
    // Re-persist recovered unambiguous shift
    setActiveShift(shift);
    return shift;
  }

  console.warn(
    `[activeShiftManager] Ambiguous active shifts detected (${openCandidates.length} open shifts for personnel ${personnelId}). Failing closed. Do not infer by array order.`
  );
  return null;
}
