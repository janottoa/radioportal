const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');

// Logging setup
const logStream = fs.createWriteStream('planetradioFetcher.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
    console.error(`[${timestamp}] ERROR: ${message}`);
}

const PLANETRADIO_METADATA_PORT = 8083;
const API_UPDATE_INTERVAL = 10000; // 10 sekunder

const metadataWss = new WebSocket.Server({ port: PLANETRADIO_METADATA_PORT });
let currentApiUrl = null;
let apiIntervalId = null;

metadataWss.on('connection', (ws) => {
    logError('Ny tilkobling til Planetradio metadata-fetcher.');
    
    ws.on('message', (apiUrl) => {
        if (apiUrl === currentApiUrl) {
            logError(`API URL allerede valgt: ${apiUrl}`);
            return;
        }

        logError(`Starter API-henting for: ${apiUrl}`);
        currentApiUrl = apiUrl;

        // Stopper eksisterende API-henting hvis den finnes
        if (apiIntervalId) clearInterval(apiIntervalId);

        // Start periodisk API-henting for den nye URL-en
        apiIntervalId = setInterval(() => {
            fetchMetadataFromApi(apiUrl, ws);
        }, API_UPDATE_INTERVAL);
    });

    ws.on('close', () => {
        logError('Tilkobling til Planetradio metadata-fetcher lukket.');
        if (apiIntervalId) clearInterval(apiIntervalId);
        currentApiUrl = null;
    });
});

async function fetchMetadataFromApi(apiUrl, ws) {
    try {
        logError(`Henter metadata fra API: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data) {
            logError(`Mangler nødvendig metadata fra API: ${JSON.stringify(data)}`);
            return;
        }

        const songInfo = {
            title: data.eventSongTitle || 'Ukjent tittel',
            artist: data.eventSongArtist || 'Ukjent artist',
            startTime: data.eventStart,
            endTime: data.eventFinish,
            duration: data.eventDuration,
            imageUrl: data.eventImageUrl || 'default_image_url'
        };

        ws.send(JSON.stringify({ 
            StreamTitle: `${songInfo.artist} - ${songInfo.title}`, 
            imageUrl: songInfo.imageUrl, 
            ...songInfo 
        }));

    } catch (error) {
        logError(`Feil ved henting av metadata fra Planetradio API: ${error.message}`);
    }
}
