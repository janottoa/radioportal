const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Logging setup - kun feil-logging
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
}

// Konfigurasjon
const WEBSOCKET_PORT = 8080;
const METADATA_PORT = 8081;
const API_UPDATE_INTERVAL = 10000; // Henter metadata fra API hvert 10. sekund

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
// Ikke logg vanlig oppstartsinfo, bare logError ved feil
// logError(`WebSocket-server for frontend kjører på ws://192.168.0.11:${WEBSOCKET_PORT}`);

const metadataWss = new WebSocket.Server({ port: METADATA_PORT });
// logError(`Metadata WebSocket-server kjører på ws://192.168.0.11:${METADATA_PORT}`);

let metadataFetcherClient = null;

// Håndter tilkobling fra metadataFetcher.js
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;

    ws.on('close', () => {
        metadataFetcherClient = null;
    });
});

// Håndter tilkobling fra frontend
wss.on('connection', (ws) => {
    ws.on('message', (streamUrl) => {
        startFfmpegProcess(streamUrl, ws);
    });

    ws.on('close', () => {
        // Bare log feil, ikke vanlig lukking
        // logError('Frontend WebSocket-tilkobling lukket.');
    });
});

function startFfmpegProcess(streamUrl, ws) {
    let ffmpeg;
    let apiIntervalId = null;

    function spawnFfmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();

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
            if (code !== 0) {
                logError('ffmpeg avsluttet med en feil. Starter prosessen på nytt.');
                setTimeout(spawnFfmpeg, 5000); // Start ffmpeg på nytt etter 5 sekunder
            }

            // Stopp API-henting når ffmpeg-prosessen avsluttes
            if (apiIntervalId) clearInterval(apiIntervalId);
        });
    }

    // Start første instans av ffmpeg-prosessen
    spawnFfmpeg();

    // Rydd opp når WebSocket lukkes
    ws.on('close', () => {
        if (apiIntervalId) clearInterval(apiIntervalId);
        ffmpeg.kill('SIGTERM');
  

    });
}

// Hjelpefunksjon for å hente metadata fra Planetradio API
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

        ws.send(JSON.stringify({ StreamTitle: `${songInfo.artist} - ${songInfo.title}`, imageUrl: songInfo.imageUrl, ...songInfo }));

        if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
            metadataFetcherClient.send(JSON.stringify(songInfo));
        }
    } catch (error) {
        logError(`Feil ved henting av metadata fra Planetradio API: ${error.message}`);
    }
}
