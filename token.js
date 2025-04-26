const fetch = require('node-fetch');

const exchangeCodeForTokens = async (authCode) => {
    const url = "https://accounts.spotify.com/api/token";
    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: 'http://anthonsen.net:2222/callback', // Redirect URI må være den samme
            client_id: '14aa4223881242a0950b6b988147b572', // Din Client ID
            client_secret: '9cb6fb7ac80944f6a55cbf38aebb9833' // Din Client Secret
        }),
    };

    try {
        const response = await fetch(url, payload);
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Logger tokenene
        console.log('Access Token:', data.access_token);
        console.log('Refresh Token:', data.refresh_token); // Sjekk for refresh token
        
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token, // Lagre denne for senere bruk
        };
    } catch (error) {
        console.error('Failed to get tokens:', error);
    }
};

// Bruk autorisasjonskoden din
const authCode = 'AQCVmehZAYmuXMfizPr-PIbTvWUaOVeI7QthI3W3ZYIMwNInJldQhSm_h3DgxE7rNEZsH6aqjpTH5cSW7gIJu3MdWYzBYj6mWEj9r2NVl2F1RYubjMs97QxQQjbXd27PYSKySfZathfDE7lWOEl4LFz7BJipUDGgNoqRpDHj-e5ToL98Hzp-tjuU3asOLS5QMlo3DwwosOHYPk6MwaUc9o0ow9L19NumAvEuGFe2Ca-bewJrSNgl'; // Sett inn koden her
exchangeCodeForTokens(authCode);
