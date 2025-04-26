const WebSocket = require('ws');
const fs = require('fs');
const axios = require('axios');
const { spawn, exec } = require('child_process');
const logStream = fs.createWriteStream('fetcher.log', { flags: 'a' });

function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
}

// Laster inn stasjonsdata fra JSON-filen
const stationsData = JSON.parse(fs.readFileSync('/var/www/radioportal/stations.json', 'utf-8'));
log('stations.json lastet inn.');

const PROXY_URL = 'ws://192.168.0.11:8081';
const FRONTEND_PORT = 8082;

let proxySocket;
let currentFfmpegProcess = null;
let currentStationName = null;

const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });
log(`Frontend WebSocket-server kjører på ws://192.168.0.11:${FRONTEND_PORT}`);

frontendServer.on('connection', (client) => {
    log('Ny tilkobling fra frontend-klient');
    client.on('close', () => log('Frontend-klient tilkobling lukket'));
});

function connectToProxy() {
    proxySocket = new WebSocket(PROXY_URL);

    proxySocket.on('open', () => {
        log('Koblet til WebSocket-server i proxy.js');
    });

    proxySocket.on('message', (data) => {
        // Konverterer buffer til streng før parsing
        const messageString = data.toString();
        const { stationName } = JSON.parse(messageString);

        if (!stationName) {
            log(`Feil: Ingen stasjonsnavn mottatt i data: ${messageString}`);
            return;
        }

        if (stationName === currentStationName) {
            log(`Stasjonen er allerede valgt: ${stationName}. Ingen handling nødvendig.`);
            return;
        }

        currentStationName = stationName;
        let streamUrl = null;

        // Søker etter stream URL i stationsData
        for (const category in stationsData) {
            const station = stationsData[category].find(station => station.name === stationName);
            if (station) {
                streamUrl = station.url;
                break;
            }
        }

        if (!streamUrl) {
            log(`Ingen gyldig stream URL funnet for stasjonen '${stationName}'. Avbryter ffmpeg-prosess.`);
            return;
        }

        log(`Starter ffmpeg-prosess for URL: ${streamUrl}`);

        // Avslutt tidligere ffmpeg-prosess hvis den kjører
        if (currentFfmpegProcess) {
            log('Avslutter tidligere ffmpeg-prosess');
            currentFfmpegProcess.kill('SIGKILL');
            currentFfmpegProcess.on('close', () => {
                log('Tidligere ffmpeg-prosess avsluttet.');
                startFfmpeg(streamUrl);
            });
        } else {
            startFfmpeg(streamUrl);
        }
    });

    proxySocket.on('close', () => {
        log('WebSocket-tilkobling til proxy.js lukket. Forsøker på nytt om 5 sekunder...');
        setTimeout(connectToProxy, 5000);
    });

    proxySocket.on('error', (error) => {
        log(`WebSocket-feil: ${error.message}`);
    });
}

function startFfmpeg(streamUrl) {
    // Sjekk at ingen tidligere ffmpeg-prosesser fortsatt kjører
    exec('pkill -f ffmpeg', (err) => {
        if (err) {
            log('Ingen tidligere ffmpeg-prosesser å avslutte eller feil ved avslutning.');
        } else {
            log('Tidligere ffmpeg-prosesser avsluttet.');
        }

        // Start ffmpeg for volumjustering og metadata-håndtering
        currentFfmpegProcess = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-vn',
            '-loglevel', 'info',
            '-f', 'mp3', 'pipe:1'
        ]);

        currentFfmpegProcess.stderr.on('data', (ffmpegData) => {
            const metadataString = ffmpegData.toString();
            log(`ffmpeg output: ${metadataString}`);

            // Matcher icy-name og StreamTitle fra metadata
            const stationNameMatch = metadataString.match(/icy-name\s*:\s*(.*)/);
            const streamTitleMatch = metadataString.match(/StreamTitle\s*:\s*(.*)/);

            if (stationNameMatch) {
                currentStationName = stationNameMatch[1].trim();
            }

            if (streamTitleMatch) {
                const streamTitle = streamTitleMatch[1].trim();

                const message = JSON.stringify({
                    stationName: currentStationName,
                    StreamTitle: streamTitle,
                });

                // Send metadata videre til WebSocket
                frontendServer.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        });

        currentFfmpegProcess.on('close', (code) => {
            log(`ffmpeg avsluttet med kode ${code}`);
            currentFfmpegProcess = null;
        });
    });
}

connectToProxy();
