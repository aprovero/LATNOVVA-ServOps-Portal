/**
 * Semantic Versioning (SemVer) Utility for LATNOVVA Service Operations
 */

export function parseSemver(v: string | null | undefined): [number, number, number] | null {
    if (!v || typeof v !== 'string') return null;
    const clean = v.replace(/^v/, '').trim();
    const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

export function compareSemver(v1: string | null | undefined, v2: string | null | undefined): number | null {
    const p1 = parseSemver(v1);
    const p2 = parseSemver(v2);
    if (!p1 || !p2) return null;
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i]) return 1;
        if (p1[i] < p2[i]) return -1;
    }
    return 0;
}

export function isVersionAtLeast(clientVer: string | null | undefined, minVer: string): boolean {
    const cmp = compareSemver(clientVer, minVer);
    if (cmp === null) return false;
    return cmp >= 0;
}
