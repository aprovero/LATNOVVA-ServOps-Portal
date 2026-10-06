// PASS 12N Authoritative Release Metadata
export const APP_VERSION = '5.0.3';
export const RELEASE_ID = 43;

export const getAppVersion = (): string => {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : APP_VERSION;
};

export const getReleaseId = (): number => {
    return typeof __RELEASE_ID__ !== 'undefined' ? __RELEASE_ID__ : RELEASE_ID;
};

export const getBuildId = (): string => {
    return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown';
};
