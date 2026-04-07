export function getRegionName(locationStr: string | undefined): string {
    if (!locationStr) return 'Unknown Location';
    
    // Check if it's already a text address
    if (!locationStr.includes(',')) return locationStr;
    if (/[a-zA-Z]/.test(locationStr)) return locationStr;

    const [latStr, lngStr] = locationStr.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) return locationStr;

    // Puerto Rico
    if (lat > 17 && lat < 19 && lng > -68 && lng < -65) return 'Puerto Rico';
    
    // Colombia
    if (lat > -5 && lat < 13 && lng > -79 && lng < -66) return 'Colombia';
    
    // Chile
    if (lat > -56 && lat < -17 && lng > -75 && lng < -66) return 'Chile';
    
    // Mexico (Broad bounding box roughly separating from US border)
    if (lat > 14 && lat < 33 && lng > -118 && lng < -86) return 'Mexico';
    
    // USA Broad Areas
    if (lat > 25 && lat < 49 && lng > -125 && lng < -66) {
        if (lng < -114 && lat > 32) return 'California, USA';
        if (lng > -106 && lng < -93 && lat < 36.5) return 'Texas, USA';
        if (lng > -115 && lng < -109) return 'Arizona / Nevada, USA';
        if (lng > -93 && lat > 38) return 'Midwest / NE, USA';
        if (lng > -93 && lat < 38) return 'Southeast, USA';
        return 'United States';
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
