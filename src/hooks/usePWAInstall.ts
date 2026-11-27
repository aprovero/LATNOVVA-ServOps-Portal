import { useState, useEffect } from 'react';

// Extend the BeforeInstallPromptEvent for TypeScript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface UsePWAInstallReturn {
  /** True when the browser has fired the install prompt and the app can be installed */
  canInstall: boolean;
  /** True when the app is already running in standalone/installed mode */
  isInstalled: boolean;
  /** Call this to trigger the native install dialog */
  triggerInstall: () => Promise<'accepted' | 'dismissed' | null>;
}

/**
 * Captures the browser's beforeinstallprompt event so we can show a custom
 * install button. The event is held until the user explicitly triggers it.
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed)
    const checkInstalled = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsInstalled(checkInstalled());

    // Listen for display-mode changes (user installs or uninstalls)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mediaQuery.addEventListener('change', handleMediaChange);

    // Capture the install prompt before the browser auto-dismisses it
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Prevent the mini-infobar from appearing on mobile
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Clear our stored prompt once the app is actually installed
    const handleAppInstalled = () => {
      setPromptEvent(null);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!promptEvent) return null;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null); // The prompt can only be used once
    return outcome;
  };

  return {
    canInstall: promptEvent !== null && !isInstalled,
    isInstalled,
    triggerInstall,
  };
}
