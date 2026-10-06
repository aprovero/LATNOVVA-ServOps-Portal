import { supabase } from './supabase';
import { compareSemver } from './semver';
import { getAppVersion, getReleaseId, getBuildId } from '../config/release';

export type ReleaseCheckStatus = 'CURRENT' | 'UPDATE_REQUIRED' | 'CHECK_ERROR';

export interface ReleaseCheckResult {
    status: ReleaseCheckStatus;
    clientVersion: string;
    clientRelease: number;
    requiredVersion?: string;
    requiredRelease?: number;
    error?: string;
}

/**
 * Record non-sensitive release gate & security telemetry events
 */
export async function recordReleaseTelemetry(
    event: 'CLIENT_UPDATE_REQUIRED' | 'CLIENT_UPDATE_STARTED' | 'CLIENT_UPDATE_SUCCESS' | 'CLIENT_UPDATE_FAILED' | 'CANARY_LEGACY_WRITE_BLOCKED',
    details?: {
        personnelId?: string;
        operation?: string;
        reason?: string;
        error?: string;
        [key: string]: any;
    }
) {
    try {
        const payload = {
            event,
            app_version: getAppVersion(),
            build_id: getBuildId(),
            release_id: getReleaseId(),
            timestamp: new Date().toISOString(),
            personnel_id: details?.personnelId || null,
            operation: details?.operation || null,
            reason: details?.reason || null,
            error: details?.error || null,
            client_platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        };

        // Try inserting into app_version_logs for audit visibility if table exists
        await (supabase.from('app_version_logs') as any).insert({
            version: getAppVersion(),
            email: details?.personnelId ? `personnel:${details.personnelId}` : 'system',
            user_agent: JSON.stringify(payload)
        }).catch(() => {});

        console.info(`[Telemetry] ${event}:`, payload);
    } catch (e) {
        console.warn('[Telemetry] Error recording telemetry:', e);
    }
}

/**
 * Authoritative central release check
 * Evaluates current client version & release ID against authoritative server configuration.
 */
export async function checkRequiredClientRelease(): Promise<ReleaseCheckResult> {
    const clientVer = getAppVersion();
    const clientRel = getReleaseId();

    try {
        // Attempt 1: Authoritative Bootstrap RPC
        let serverMinVer: string | undefined;
        let serverReqRel: number | undefined;
        let isGateEnabled: boolean = true;

        const { data: bootstrapData, error: rpcErr } = await (supabase.rpc as any)('get_client_bootstrap_config');
        const bootstrap = bootstrapData as any;

        if (!rpcErr && bootstrap) {
            serverMinVer = bootstrap.minimum_client_version;
            serverReqRel = bootstrap.required_client_release !== undefined ? Number(bootstrap.required_client_release) : 43;
            isGateEnabled = bootstrap.minimum_client_version_enabled ?? true;
        } else {
            // Attempt 2: Fallback query to platform_settings directly
            const { data: settings, error: tableErr } = await (supabase.from('platform_settings') as any)
                .select('minimum_client_version, minimum_client_version_enabled, required_client_release')
                .eq('id', 'global')
                .maybeSingle();

            if (tableErr || !settings) {
                console.error('[checkRequiredClientRelease] Failed to query release config from server:', rpcErr || tableErr);
                return {
                    status: 'CHECK_ERROR',
                    clientVersion: clientVer,
                    clientRelease: clientRel,
                    error: (rpcErr || tableErr)?.message || 'Unable to connect to configuration server'
                };
            }

            serverMinVer = settings.minimum_client_version;
            serverReqRel = settings.required_client_release !== undefined ? Number(settings.required_client_release) : 43;
            isGateEnabled = settings.minimum_client_version_enabled ?? true;
        }

        // If version enforcement gate is disabled on server, allow
        if (!isGateEnabled) {
            return {
                status: 'CURRENT',
                clientVersion: clientVer,
                clientRelease: clientRel,
                requiredVersion: serverMinVer,
                requiredRelease: serverReqRel
            };
        }

        const effectiveMinVer = serverMinVer || '5.0.3';
        const effectiveReqRel = serverReqRel !== undefined ? serverReqRel : 43;

        // Monotonic release ID check: client release < server required release -> UPDATE_REQUIRED
        if (clientRel < effectiveReqRel) {
            recordReleaseTelemetry('CLIENT_UPDATE_REQUIRED', {
                reason: `Release ID ${clientRel} is below required ${effectiveReqRel}`
            });
            return {
                status: 'UPDATE_REQUIRED',
                clientVersion: clientVer,
                clientRelease: clientRel,
                requiredVersion: effectiveMinVer,
                requiredRelease: effectiveReqRel
            };
        }

        // Semantic version check: client version < server minimum version -> UPDATE_REQUIRED
        const cmp = compareSemver(clientVer, effectiveMinVer);
        if (cmp !== null && cmp < 0) {
            recordReleaseTelemetry('CLIENT_UPDATE_REQUIRED', {
                reason: `Version ${clientVer} is below minimum ${effectiveMinVer}`
            });
            return {
                status: 'UPDATE_REQUIRED',
                clientVersion: clientVer,
                clientRelease: clientRel,
                requiredVersion: effectiveMinVer,
                requiredRelease: effectiveReqRel
            };
        }

        return {
            status: 'CURRENT',
            clientVersion: clientVer,
            clientRelease: clientRel,
            requiredVersion: effectiveMinVer,
            requiredRelease: effectiveReqRel
        };
    } catch (err: any) {
        console.error('[checkRequiredClientRelease] Exception during release check:', err);
        return {
            status: 'CHECK_ERROR',
            clientVersion: clientVer,
            clientRelease: clientRel,
            error: err.message || 'Unknown network error'
        };
    }
}
