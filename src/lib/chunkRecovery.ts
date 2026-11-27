/**
 * One-Shot Lazy ChunkLoadError Recovery (PASS 15B / P1-7)
 *
 * When a user has an open tab during a new deploy, dynamic import() for a lazy route
 * may fail with a ChunkLoadError / "Failed to fetch dynamically imported module".
 * This utility attempts at most ONE automatic SW update + page reload per session
 * (tracked via sessionStorage) to avoid infinite reload loops.
 */

export const CHUNK_RECOVERY_STORAGE_KEY = 'latnovva_chunk_reload_attempted';

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as any)?.message || err).toLowerCase();
  const name = String((err as any)?.name || '').toLowerCase();
  return (
    name === 'chunkloaderror' ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

export async function waitForInstallingServiceWorker(reg: ServiceWorkerRegistration, timeoutMs = 3000): Promise<void> {
  const installing = reg.installing;
  if (!installing) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const onStateChange = () => {
      if (installing.state === 'installed' || installing.state === 'activated' || installing.state === 'redundant') {
        clearTimeout(timer);
        installing.removeEventListener('statechange', onStateChange);
        resolve();
      }
    };
    installing.addEventListener('statechange', onStateChange);
  });
}

export async function attemptOneShotChunkRecovery(
  err: unknown,
  deps?: {
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    reload?: () => void;
    updateServiceWorker?: () => Promise<void>;
  }
): Promise<{ recovered: boolean; reason: 'not_chunk_error' | 'already_attempted' | 'reloading' }> {
  if (!isChunkLoadError(err)) {
    return { recovered: false, reason: 'not_chunk_error' };
  }

  const storage = deps?.storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const reload = deps?.reload ?? (() => { if (typeof window !== 'undefined') window.location.reload(); });
  const updateSW = deps?.updateServiceWorker ?? (async () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          await waitForInstallingServiceWorker(reg);
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch {}
    }
  });

  if (storage?.getItem(CHUNK_RECOVERY_STORAGE_KEY) === 'true') {
    return { recovered: false, reason: 'already_attempted' };
  }

  storage?.setItem(CHUNK_RECOVERY_STORAGE_KEY, 'true');
  await updateSW();
  reload();
  return { recovered: true, reason: 'reloading' };
}

export function clearChunkRecoveryMarker(
  storage: Pick<Storage, 'removeItem'> | undefined = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined
): void {
  try {
    storage?.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
  } catch {}
}
