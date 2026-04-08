import { PublicClientApplication, Configuration, LogLevel } from '@azure/msal-browser';

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
const TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';

export const msalConfig: Configuration = {
    auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: 'sessionStorage',
        storeAuthStateInCookie: false,
    },
    system: {
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                switch (level) {
                    case LogLevel.Error:
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                }
            }
        }
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
    scopes: ['User.Read', 'Files.ReadWrite.All', 'Sites.ReadWrite.All']
};

export const graphConfig = {
    graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
    graphSitesEndpoint: 'https://graph.microsoft.com/v1.0/sites'
};

/**
 * Returns a Graph Access Token for the signed-in user.
 */
export async function getGraphToken() {
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
 * Uploads a file to SharePoint.
 */
export async function uploadToSharePoint(
    siteId: string, 
    driveId: string, 
    folderPath: string, 
    filename: string, 
    file: File | Blob
) {
    const token = await getGraphToken();
    
    // SharePoint uses /document/path:/content for small file uploads (<4MB)
    // For larger files, an upload session should be created, but for photos <5MB, simple upload is usually fine.
    const encodedPath = encodeURIComponent(folderPath ? `${folderPath}/${filename}` : filename);
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;
    
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
        throw new Error(`SharePoint upload failed: ${err.error?.message || response.statusText}`);
    }
    
    return await response.json(); // Returns the DriveItem object with webUrl and id
}

/**
 * Fetches a thumbnail URL for a DriveItem.
 */
export async function getFileThumbnail(siteId: string, driveId: string, itemId: string) {
    const token = await getGraphToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${itemId}/thumbnails/0/large/url`;
    
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) return null;
    return await response.text(); // Returns the raw thumbnail URL
}
