export function getRegionName(locationStr: string | undefined): string {
    if (!locationStr) return 'Unknown Location';
    
    // Check if it's already a text address
    if (!locationStr.includes(',')) return locationStr;
    if (/[a-zA-Z]/.test(locationStr)) return locationStr;

    const [latStr, lngStr] = locationStr.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) return '';

    // 1. Specific US States (Prioritize these to avoid broad box overlap)
    if (lat > 25 && lat < 49 && lng > -125 && lng < -66) {
        if (lng < -114 && lat > 32) return 'California, USA';
        if (lng > -107 && lng < -93 && lat < 37) return 'Texas, USA'; // Texas core
        if (lng > -115 && lng < -108) return 'Arizona / Nevada, USA';
        if (lng > -93 && lat > 38) return 'Midwest / NE, USA';
        if (lng > -93 && lat < 38) return 'Southeast, USA';
        return 'United States';
    }

    // 2. Mexico (Specific check after US states)
    if (lat > 14 && lat < 32.5 && lng > -118 && lng < -86) return 'Mexico';

    // 3. Other Countries
    if (lat > 17 && lat < 19 && lng > -68 && lng < -65) return 'Puerto Rico';
    if (lat > -5 && lat < 13 && lng > -79 && lng < -66) return 'Colombia';
    if (lat > -56 && lat < -17 && lng > -75 && lng < -66) return 'Chile';

    // If no reasonable region found, return empty (per user request to leave blank if unsure/offline context)
    return '';
}
