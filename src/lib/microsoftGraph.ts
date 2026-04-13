import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
const TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

export const msalConfig: Configuration = {
    auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false // Prevents the app from reloading itself inside the popup
    },
    cache: {
        cacheLocation: 'sessionStorage',
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                // Log all MSAL messages for debugging the popup issue
                console.log(`[MSAL] ${message}`);
            },
            logLevel: LogLevel.Verbose // High detail to find the redirect issue
        }
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
    scopes: ['User.Read', 'Files.ReadWrite']
};

export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
    graphSitesEndpoint: 'https://graph.microsoft.com/v1.0/sites',
    graphDrivesEndpoint: 'https://graph.microsoft.com/v1.0/drives'
};

let isInitialized = false;

export async function ensureInitialized() {
    if (!isInitialized) {
        await msalInstance.initialize();
        isInitialized = true;
    }
}

/**
 * Returns a Graph Access Token for the signed-in user.
 */
export async function getGraphToken() {
    await ensureInitialized();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
        throw new Error('No active account! Please sign in.');
    }

    try {
        const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0]
        });
        return response.accessToken;
    } catch (error) {
        console.warn('Silent token acquisition failed, acquiring token with popup', error);
        const response = await msalInstance.acquireTokenPopup(loginRequest);
        return response.accessToken;
    }
}

/**
 * Discovers a SharePoint Site ID by its URL.
 */
export async function discoverSiteId(siteUrl: string) {
    const token = await getGraphToken();
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash
    
    // Format: hostname:/sites/sitename
    const searchUrl = `${graphConfig.graphSitesEndpoint}/${hostname}:${path}`;
    
    const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to discover SharePoint Site ID');
    const data = await response.json();
    return data.id; // Usually in format 'hostname,site-uuid,web-uuid'
}

/**
 * Fetches the primary Drive ID for the currently signed-in user (Personal/Business OneDrive).
 */
export async function getMeDrive() {
    const token = await getGraphToken();
    const response = await fetch(`${graphConfig.graphMeEndpoint}/drive`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch OneDrive ID');
    const data = await response.json();
    return data.id;
}

/**
 * Fetches the default Drive (Document Library) for a Site.
 */
export async function getSiteDrive(siteId: string) {
    const token = await getGraphToken();
    const response = await fetch(`${graphConfig.graphSitesEndpoint}/${siteId}/drive`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to fetch SharePoint Drive ID');
    const data = await response.json();
    return data.id;
}

/**
 * Uploads a file to a Microsoft Graph Drive (SharePoint or OneDrive).
 */
export async function uploadToDrive(
    driveId: string, 
    folderPath: string, 
    filename: string, 
    file: File | Blob,
    siteId?: string
) {
    const token = await getGraphToken();
    const encodedPath = encodeURIComponent(folderPath ? `${folderPath}/${filename}` : filename);
    
    // Use site-specific or generic drive endpoint
    const baseUrl = siteId 
        ? `${graphConfig.graphSitesEndpoint}/${siteId}/drives/${driveId}`
        : `${graphConfig.graphDrivesEndpoint}/${driveId}`;
        
    const uploadUrl = `${baseUrl}/root:/${encodedPath}:/content`;
    
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(`Upload failed: ${err.error?.message || response.statusText}`);
    }
    
    return await response.json();
}

/**
 * Fetches a thumbnail URL for a DriveItem.
 */
export async function getFileThumbnail(driveId: string, itemId: string, siteId?: string) {
    const token = await getGraphToken();
    
    const baseUrl = siteId 
        ? `${graphConfig.graphSitesEndpoint}/${siteId}/drives/${driveId}`
        : `${graphConfig.graphDrivesEndpoint}/${driveId}`;
        
    const url = `${baseUrl}/items/${itemId}/thumbnails/0/large/url`;
    
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) return null;
    return await response.text();
}
