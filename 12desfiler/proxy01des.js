const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Logging setup
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
    console.error(`[${timestamp}] ERROR: ${message}`);
}

// Konfigurasjon
const WEBSOCKET_PORT = 3080;
const METADATA_PORT = 3081;

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const metadataWss = new WebSocket.Server({ port: METADATA_PORT });

let metadataFetcherClient = null;
let currentFfmpegProcess = null;
let currentStreamUrl = null;

// Metadata WebSocket-tilkobling
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher tilkoblet.');

    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher frakoblet.');
    });
});

// Frontend WebSocket-tilkobling
wss.on('connection', (ws) => {
    logError('Ny tilkobling fra frontend-klient.');

    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) {
            logError(`Stream URL allerede valgt: ${streamUrl}`);
            return;
        }

        logError(`Starter ny prosess for: ${streamUrl}`);
        startFfmpegProcess(streamUrl, ws);
    });

    ws.on('close', () => {
        logError('Frontend WebSocket-tilkobling lukket.');
        stopFfmpegProcess();
    });
});

function startFfmpegProcess(streamUrl, ws) {
    stopFfmpegProcess(); // Avslutt eventuelle kjørende prosesser

    currentStreamUrl = streamUrl;
    let ffmpeg;

    function spawnFfmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        currentFfmpegProcess = ffmpeg;

       ffmpeg.stderr.on('data', (data) => {
    const output = data.toString();

    // Hent StreamTitle fra vanlig metadata
    const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
    const imageMatch = output.match(/https?:\/\/[^\s]+/); // Forenklet regex for å hente bilde-URL

    if (titleMatch) {
        const streamTitle = titleMatch[1].trim();
        const imageUrl = imageMatch ? imageMatch[0].trim() : null; // Bruk første URL funnet som bilde

        const metadata = {
            StreamTitle: streamTitle,
            imageUrl: imageUrl // Send bilde hvis det finnes, ellers null
        };

        ws.send(JSON.stringify(metadata));
        if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
            metadataFetcherClient.send(JSON.stringify(metadata));
        }
        logError(`Oppdatert StreamTitle: ${streamTitle}, imageUrl: ${imageUrl || 'Ingen bilde tilgjengelig'}`);
    }

    // Sjekk og behandle StreamUrl for Planetradio
    handleStreamUrl(output, ws);
});

    }

    spawnFfmpeg();

    ws.on('close', () => {
        stopFfmpegProcess();
    });
}

function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        logError('Avslutter pågående ffmpeg-prosess.');
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null;
        currentStreamUrl = null;
    }
}

function handleStreamUrl(output, ws) {
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1];
        logError(`Planetradio URL funnet: ${planetradioUrl}`);
        fetchPlanetradioMetadata(planetradioUrl, ws);
    }
}

async function fetchPlanetradioMetadata(url, ws) {
    logError(`Henter metadata fra Planetradio: ${url}`);
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const metadata = {
                StreamTitle: `${data.eventSongArtist || 'Ukjent artist'} - ${data.eventSongTitle || 'Ukjent tittel'}`,
                imageUrl: data.eventImageUrl, // Bruk bilde fra Planetradio direkte
                songTitle: data.eventSongTitle,
                artist: data.eventSongArtist,
            };

            logError(`Planetradio metadata: ${JSON.stringify(metadata)}`);
            ws.send(JSON.stringify(metadata)); // Send metadata til frontend
        } else {
            logError(`Ingen gyldige metadata fra Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Feil ved henting av Planetradio metadata: ${error.message}`);
    }
}
