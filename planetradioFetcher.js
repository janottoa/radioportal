const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');

// Logging setup
const logStream = fs.createWriteStream('planetradioFetcher.log', { flags: 'a' });
function logMessage(level, message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${level.toUpperCase()}: ${message}\n`);
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
}

const PLANETRADIO_METADATA_PORT = 3087;
const API_UPDATE_INTERVAL = 10000; // 10 sekunder

const metadataWss = new WebSocket.Server({ port: PLANETRADIO_METADATA_PORT });

logMessage('info', `PlanetradioFetcher WebSocket-server kjører på port ${PLANETRADIO_METADATA_PORT}`);

metadataWss.on('connection', (ws) => {
    logMessage('info', 'Ny tilkobling til PlanetradioFetcher.');

    ws.on('message', async (apiUrl) => {
        if (!isValidUrl(apiUrl)) {
            logMessage('error', `Ugyldig URL mottatt: ${apiUrl}`);
            ws.send(JSON.stringify({ error: 'Ugyldig API URL' }));
            return;
        }

        logMessage('info', `Henter metadata for Planetradio URL: ${apiUrl}`);
        try {
            const metadata = await fetchMetadataFromApi(apiUrl);
            ws.send(JSON.stringify(metadata));
        } catch (error) {
            logMessage('error', `Feil ved henting av metadata: ${error.message}`);
        }
    });

    ws.on('close', () => {
        logMessage('info', 'Tilkobling til PlanetradioFetcher lukket.');
    });
});

async function fetchMetadataFromApi(apiUrl) {
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (!data) {
            throw new Error('Ingen metadata tilgjengelig');
        }

        return {
            title: data.eventSongTitle || 'Ukjent tittel',
            artist: data.eventSongArtist || 'Ukjent artist',
            startTime: data.eventStart,
            endTime: data.eventFinish,
            duration: data.eventDuration,
            imageUrl: data.eventImageUrl || 'default_image_url'
        };
    } catch (error) {
        throw new Error(`Feil ved henting av metadata fra API: ${error.message}`);
    }
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
