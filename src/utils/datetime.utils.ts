/**
 * Standard GPS accuracy threshold for "Good" signal (meters).
 */
export const GPS_ACCURACY_THRESHOLD = 100;

/**
 * Detects if the current device is a mobile browser.
 */
export const isMobileDevice = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Gets the standard GPS accuracy threshold (meters) based on device type.
 */
export const getGPSAccuracyThreshold = (): number => {
    return isMobileDevice() ? 50 : 150;
};

/**
 * Calculates distance in meters between two coordinates using Haversine formula.
 */
export const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
};

/**
 * Parses coordinates string like "19.4293, -99.1724" into lat/lng numeric object.
 */
export const parseCoordinates = (locationStr?: string): { lat: number; lng: number } | null => {
    if (!locationStr) return null;
    const parts = locationStr.split(',');
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
};

/**
 * Calculates decimal hours between two HH:mm strings.
 * Handles overnight shifts by adding 24 hours if out < in.
 */
export const calculateHours = (inTime?: string, outTime?: string): number => {
    if (!inTime || !outTime) return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    
    let diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff < 0) diff += 24 * 60; // Handle overnight shifts
    
    return Number((diff / 60).toFixed(2));
};

/**
 * Returns true if the provided ISO date string is within the current calendar month.
 */
export const isThisMonth = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/**
 * Returns true if the certification is expired based on current date.
 */
export const isCertExpired = (expirationDate?: string): boolean => {
    if (!expirationDate) return false;
    const exp = new Date(expirationDate);
    const now = new Date();
    // Normalize to start of day for comparison
    now.setHours(0, 0, 0, 0);
    return exp < now;
};
