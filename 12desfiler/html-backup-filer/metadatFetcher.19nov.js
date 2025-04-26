const WebSocket = require('ws');
const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');
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
        const { stationName } = JSON.parse(data);

        if (!stationName) {
            log(`Feil: Ingen stasjonsnavn mottatt i data: ${JSON.stringify(data)}`);
            return;
        }

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
        
        // Start ffmpeg for volumjustering og metadata-håndtering
        const ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-vn',
            '-loglevel', 'info',
            '-f', 'mp3', 'pipe:1'
        ]);

        ffmpeg.stderr.on('data', (ffmpegData) => {
            log(`ffmpeg output: ${ffmpegData}`);
        });

        ffmpeg.on('close', (code) => {
            log(`ffmpeg avsluttet med kode ${code}`);
        });
    });

    proxySocket.on('close', () => {
        log('WebSocket-tilkobling til proxy.js lukket. Forsøker på nytt om 5 sekunder...');
        setTimeout(connectToProxy, 5000);
    });

    proxySocket.on('error', (error) => {
        log(`WebSocket-feil: ${error.message}`);
    });
}

connectToProxy();
