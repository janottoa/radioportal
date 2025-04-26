const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Logging setup - kun feil-logging
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
    console.error(`[${timestamp}] ERROR: ${message}`);
}

// Konfigurasjon
const WEBSOCKET_PORT = 8080;
const METADATA_PORT = 8081;
const API_UPDATE_INTERVAL = 10000; // Henter metadata fra API hvert 10. sekund

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

            // Hvis Planetradio StreamUrl oppdages, start API-henting
            const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
            if (urlMatch) {
                const apiUrl = urlMatch[1].trim();

                // Stopp eksisterende API-henting hvis den finnes
                if (apiIntervalId) clearInterval(apiIntervalId);

                // Start ny periodisk API-henting for denne StreamUrl
                apiIntervalId = setInterval(() => {
                    fetchMetadataFromApi(apiUrl, ws);
                }, API_UPDATE_INTERVAL);
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
