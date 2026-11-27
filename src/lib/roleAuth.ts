/**
 * Authoritative Fail-Closed Role Authorization Module (PASS 15B / P0-3, P1-3, P1-4)
 *
 * Separates authorization identity from display fallbacks.
 * Any null, undefined, empty, whitespace-only, or unknown role fails CLOSED (returns null / false).
 * NEVER defaults missing or malformed roles to 'Tech'.
 */

export const ALLOWED_ROLES = ['Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer'] as const;
export type AuthorizedRole = (typeof ALLOWED_ROLES)[number];

export const STAFF_ROLES: ReadonlySet<AuthorizedRole> = new Set([
  'Manager',
  'HR',
  'Supervisor',
  'Office',
  'Tech',
]);

export const ADMIN_ROLES: ReadonlySet<AuthorizedRole> = new Set(['Manager', 'HR']);
export const OPS_ROLES: ReadonlySet<AuthorizedRole> = new Set(['Manager', 'HR', 'Supervisor']);

/**
 * Normalizes a raw role value into an explicit AuthorizedRole or null.
 * Fails closed on null, undefined, non-strings, whitespace-only, or unknown values.
 */
export function normalizeRole(raw: unknown): AuthorizedRole | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if ((ALLOWED_ROLES as readonly string[]).includes(trimmed)) {
    return trimmed as AuthorizedRole;
  }
  return null;
}

/** Explicit staff check (Manager, HR, Supervisor, Office, Tech). Denies Customer, null, unknown. */
export function isStaffRole(raw: unknown): boolean {
  const role = normalizeRole(raw);
  return role !== null && STAFF_ROLES.has(role);
}

/** Settings & User Administration (aligned with hardened server RPCs: Manager & HR only). */
export function canAccessSettings(raw: unknown): boolean {
  const role = normalizeRole(raw);
  return role !== null && ADMIN_ROLES.has(role);
}

/** Personnel create / edit / delete (aligned with hardened server RPCs: Manager & HR only). */
export function canEditPersonnel(raw: unknown): boolean {
  const role = normalizeRole(raw);
  return role !== null && ADMIN_ROLES.has(role);
}

/** Attendance, Nomina, Survey Results (Manager & HR only). */
export function canAccessManagerHR(raw: unknown): boolean {
  const role = normalizeRole(raw);
  return role !== null && ADMIN_ROLES.has(role);
}

/** Live Map & Personnel directory view (Manager, HR, Supervisor). */
export function canAccessOps(raw: unknown): boolean {
  const role = normalizeRole(raw);
  return role !== null && OPS_ROLES.has(role);
}

/**
 * Tenant-scoped project access check (P1-4):
 * - Null/unknown role: DENY
 * - Customer: ALLOW only if both customerClientId and projectClientId are non-empty and match
 * - Internal staff: ALLOW
 */
export function canAccessProject(
  rawRole: unknown,
  customerClientId: string | null | undefined,
  projectClientId: string | null | undefined
): boolean {
  const role = normalizeRole(rawRole);
  if (!role) return false;
  if (role === 'Customer') {
    if (!customerClientId || !projectClientId) return false;
    return customerClientId === projectClientId;
  }
  return STAFF_ROLES.has(role);
}
