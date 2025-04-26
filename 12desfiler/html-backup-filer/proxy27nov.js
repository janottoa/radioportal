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
const WEBSOCKET_PORT = 8080;
const METADATA_PORT = 8081;
const API_UPDATE_INTERVAL = 10000; // 10 sekunder

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
    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) {
            logError(`Stream URL allerede valgt: ${streamUrl}`);
            return;
        }
        logError(`Starter ny ffmpeg-prosess for: ${streamUrl}`);
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
    let apiIntervalId = null;

    function spawnFfmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm=i=-16:tp=-1.5:lra=11', // Normaliseringsfilter
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        currentFfmpegProcess = ffmpeg;

        // Oppdatert ffmpeg metadatahåndtering
        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();

            // Hent StreamTitle
            const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
            if (titleMatch) {
                const streamTitle = titleMatch[1].trim();
                ws.send(JSON.stringify({ StreamTitle: streamTitle }));

                if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                    metadataFetcherClient.send(JSON.stringify({ StreamTitle: streamTitle }));
                }
            }

            // Hent StreamUrl
            const urlMatch = output.match(/Metadata update for StreamUrl:\s*(\{.*\})/); // Hent JSON direkte
            if (urlMatch) {
                let streamUrlData = null;

                try {
                    streamUrlData = JSON.parse(urlMatch[1].trim());
                    console.log("Parsed StreamUrl metadata:", streamUrlData);
                } catch (error) {
                    logError(`Feil ved parsing av StreamUrl: ${error.message}`);
                }

                if (streamUrlData && streamUrlData.imageUrl) {
                    // Send hele metadataen til frontend og metadataFetcher
                    const metadata = {
                        StreamTitle: streamUrlData.title || 'Ukjent tittel',
                        StreamUrl: urlMatch[1].trim(),
                        imageUrl: streamUrlData.imageUrl,
                        artist: streamUrlData.artist || 'Ukjent artist'
                    };

                    ws.send(JSON.stringify(metadata));

                    if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                        metadataFetcherClient.send(JSON.stringify(metadata));
                    }
                } else {
                    logError("StreamUrl mangler imageUrl eller nødvendig informasjon.");
                }
            }
        });

        ffmpeg.on('error', (error) => {
            logError(`ffmpeg-feil: ${error.message}`);
        });

        ffmpeg.on('close', (code) => {
            logError(`ffmpeg prosess avsluttet med kode ${code}`);
            currentFfmpegProcess = null;
            currentStreamUrl = null;

            if (apiIntervalId) clearInterval(apiIntervalId); // Stopp API-henting
        });
    }

    spawnFfmpeg();

    ws.on('close', () => {
        if (apiIntervalId) clearInterval(apiIntervalId);
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

async function fetchMetadataFromApi(apiUrl, ws) {
    try {
        const response = await axios.get(apiUrl);
        const data = response.data;

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

        if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
            metadataFetcherClient.send(JSON.stringify(songInfo));
        }
    } catch (error) {
        logError(`Feil ved henting av metadata fra Planetradio API: ${error.message}`);
    }
}
