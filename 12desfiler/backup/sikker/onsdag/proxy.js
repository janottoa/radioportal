const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Logging setup
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
}

// Konfigurasjon
const WEBSOCKET_PORT = 8080;
const METADATA_PORT = 8081;
const API_UPDATE_INTERVAL = 10000; // Henter metadata fra API hvert 10. sekund

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
log(`WebSocket-server for frontend kjører på ws://192.168.0.11:${WEBSOCKET_PORT}`);

const metadataWss = new WebSocket.Server({ port: METADATA_PORT });
log(`Metadata WebSocket-server kjører på ws://192.168.0.11:${METADATA_PORT}`);

let metadataFetcherClient = null;

// Håndter tilkobling fra metadataFetcher.js
metadataWss.on('connection', (ws) => {
    log('Koblet til metadataFetcher.js');
    metadataFetcherClient = ws;

    ws.on('close', () => {
        log('WebSocket-tilkobling til metadataFetcher.js lukket.');
        metadataFetcherClient = null;
    });
});

// Håndter tilkobling fra frontend
wss.on('connection', (ws) => {
    ws.on('message', (streamUrl) => {
        log(`Koblet til ny strøm for URL: ${streamUrl}`);
        startFfmpegProcess(streamUrl, ws);
    });

    ws.on('close', () => {
        log('Frontend WebSocket-tilkobling lukket.');
    });
});

function startFfmpegProcess(streamUrl, ws) {
    let ffmpeg;
    let apiIntervalId = null; // Holder kontroll over API-intervallet

    function spawnFfmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            log(`ffmpeg output: ${output}`);

            const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
            if (titleMatch) {
                const streamTitle = titleMatch[1].trim();
                ws.send(JSON.stringify({ StreamTitle: streamTitle }));
                log(`StreamTitle funnet og sendt til frontend: ${streamTitle}`);

                if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                    metadataFetcherClient.send(JSON.stringify({ StreamTitle: streamTitle }));
                    log(`Sendt metadata til metadataFetcher.js: ${streamTitle}`);
                }
            }

            // Hvis Planetradio StreamUrl oppdages, start API-henting
            const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
            if (urlMatch) {
                const apiUrl = urlMatch[1].trim();
                log(`Planetradio StreamUrl funnet: ${apiUrl}`);
                
                // Stopp eksisterende API-henting hvis den finnes
                if (apiIntervalId) clearInterval(apiIntervalId);

                // Start ny periodisk API-henting for denne StreamUrl
                apiIntervalId = setInterval(() => {
                    fetchMetadataFromApi(apiUrl, ws);
                }, API_UPDATE_INTERVAL);
            }
        });

        ffmpeg.on('close', (code) => {
            log(`ffmpeg prosess avsluttet med kode ${code}`);
            if (code !== 0) {
                log('ffmpeg avsluttet med en feil. Sjekk URL-en eller ffmpeg-konfigurasjonen.');
            }
            ws.send(JSON.stringify({ StreamTitle: "Ingen metadata tilgjengelig" }));

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
        log('ffmpeg prosess og API-interval stoppet da WebSocket-tilkobling ble lukket.');
    });
}

// Hjelpefunksjon for å hente metadata fra Planetradio API
async function fetchMetadataFromApi(apiUrl, ws) {
    try {
        log(`Henter metadata fra Planetradio API: ${apiUrl}`);
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
        log(`Metadata fra API funnet og sendt: ${songInfo.artist} - ${songInfo.title}, bilde: ${songInfo.imageUrl}`);

        if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
            metadataFetcherClient.send(JSON.stringify(songInfo));
            log(`Sendt metadata til metadataFetcher.js: ${JSON.stringify(songInfo)}`);
        }
    } catch (error) {
        log(`Feil ved henting av metadata fra Planetradio API: ${error.message}`);
    }
}
