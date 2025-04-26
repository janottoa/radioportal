const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { processNRKMetadata } = require('./NRKFix.js');
const { processURLMetadata } = require('./URLFix.js');

// Logging setup
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;
    logStream.write(logMessage);
    console.error(logMessage);
}

// Configuration
const WEBSOCKET_PORT = 3080;
const METADATA_PORT = 3081;

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const metadataWss = new WebSocket.Server({ port: METADATA_PORT });

let metadataFetcherClient = null;
let currentFfmpegProcess = null;
let currentStreamUrl = null;
let isStreamActive = false; // For å spore strømmestatus

// Funksjon for å starte FFmpeg
function startFfmpeg(ws, ffmpegUrl) {
    if (!ffmpegUrl) {
        logError('Cannot start FFmpeg. No active FFmpeg URL available.');
        return;
    }

    logError(`Starting FFmpeg process for URL: ${ffmpegUrl}`);

    currentStreamUrl = ffmpegUrl; // Sett aktiv streaming URL
    currentFfmpegProcess = spawn('ffmpeg', [
        '-i', ffmpegUrl,
        '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
        '-vn',
        '-loglevel', 'debug',
        '-f', 'null', '-'
    ]);

    currentFfmpegProcess.stderr.on('data', async (data) => {
        const output = data.toString();
        const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
        const imageMatch = output.match(/https?:\/\/[^\s]+/);

        if (titleMatch) {
            isStreamActive = true; // Setter strømmen som aktiv
            const streamTitle = titleMatch[1].trim();
            const imageUrl = imageMatch ? imageMatch[0].trim() : null;

            let processedMetadata = processNRKMetadata(streamTitle);
            if (!processedMetadata.title || !processedMetadata.artist) {
                processedMetadata = processURLMetadata(streamTitle);
                logError(`Using fallback for metadata: ${JSON.stringify(processedMetadata)}`);
            }

            const metadata = {
                StreamTitle: `${processedMetadata.artist || 'Ukjent Artist'} - ${processedMetadata.title || 'Ukjent Tittel'}`,
                imageUrl: imageUrl || null,
                program: processedMetadata.program,
                title: processedMetadata.title || null,
                artist: processedMetadata.artist || null
            };

            // Sjekk for URL fra Planetradio
            handleStreamUrl(output, ws);

            // Send metadata til frontend hvis strømming er aktiv
            if (isStreamActive) {
                ws.send(JSON.stringify(metadata));
            }
        } else if (output.includes("No metadata available")) {
            isStreamActive = false; // Sett strømstatus til falsk
            logError('No metadata available, stopping stream.');
            ws.send(JSON.stringify({ StreamTitle: "No metadata available" }));
        }
    });

    currentFfmpegProcess.on('close', (code) => {
        logError(`FFmpeg process closed with code: ${code}`);
        isStreamActive = false; // Reset strømstatus
        currentFfmpegProcess = null; // Reset prosessreferanse
    });
}

// Håndterer StreamUrl for Planetradio
function handleStreamUrl(output, ws) {
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1];
        logError(`Planetradio URL funnet: ${planetradioUrl}`);
        fetchPlanetradioMetadata(planetradioUrl, ws);
    }
}

// Hent metadata for Planetradio
async function fetchPlanetradioMetadata(url, ws) {
    logError(`Henter metadata fra Planetradio: ${url}`);
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const artist = data.eventSongArtist || 'Ukjent artist';
            const title = data.eventSongTitle || 'Ukjent tittel';
            const planetradioImageUrl = data.eventImageUrl || null;

            const metadata = {
                StreamTitle: `${artist} - ${title}`,
                imageUrl: planetradioImageUrl,
                songTitle: title,
                artist: artist,
                album: data.eventSongAlbum || null,
            };

            logError(`Planetradio metadata: ${JSON.stringify(metadata)}`);
            ws.send(JSON.stringify(metadata));
        } else {
            logError(`Ingen gyldige metadata fra Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Feil ved henting av Planetradio metadata: ${error.message}`);
    }
}

// WebSocket-tilkoblinger for metadataFetcher
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher connected.');
    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher disconnected.');
    });
});

// WebSocket-tilkoblinger for frontend
wss.on('connection', (ws) => {
    logError('New frontend client connected.');

    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) {
            logError(`Stream URL allerede valgt: ${streamUrl}`);
            return; // Ingen oppdatering hvis strømmen er lik
        }

        logError(`Starter ny prosess for: ${streamUrl}`);
        stopFfmpegProcess(); // Stopp gjeldende FFmpeg-prosess
        startFfmpeg(ws, streamUrl); // Start opp ny prosess
    });

    ws.on('close', () => {
        logError('Frontend WebSocket-tilkobling lukket.');
        stopFfmpegProcess(); // Stopp FFmpeg-prosess når tilkoblingen lukkes
    });
});

// Stopp FFmpeg-prosess
function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        logError('Avslutter pågående ffmpeg-prosess.');
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null; // Nullstill prosessreferanse
        currentStreamUrl = null; // Nullstill URL-en ved stopp
    }
}

logError('Proxy server is running.');