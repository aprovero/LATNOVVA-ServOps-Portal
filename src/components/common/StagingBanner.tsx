import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AUTHORIZED_STAGING_PROJECT_REF,
  isStagingEnvironment,
} from '../../config/environment';
import { getAppVersion, getReleaseId } from '../../config/release';

/**
 * High-visibility amber staging banner rendered on Login and all authenticated views
 * when running in staging mode (`VITE_APP_ENV=staging` or `latnovva-v6-staging.onrender.com`).
 * Renders null in production.
 */
export const StagingBanner: React.FC = () => {
  if (!isStagingEnvironment()) {
    return null;
  }

  return (
    <div
      data-testid="staging-environment-banner"
      role="status"
      aria-live="polite"
      className="w-full bg-amber-600 text-white text-xs font-bold tracking-wide px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm z-[9999] select-none"
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        STAGING / UAT (v{getAppVersion()} r{getReleaseId()}) — ISOLATED BACKEND ({AUTHORIZED_STAGING_PROJECT_REF}) — NOT PRODUCTION
      </span>
    </div>
  );
};

export default StagingBanner;
