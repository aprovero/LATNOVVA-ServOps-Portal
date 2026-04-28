/**
 * Standard GPS accuracy threshold for "Good" signal (meters).
 */
export const GPS_ACCURACY_THRESHOLD = 100;

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
