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
        const songInfo = JSON.parse(data);
        log(`Mottatt metadata fra proxy.js: ${JSON.stringify(songInfo)}`);

        // Start ffmpeg for volumjustering og metadata-håndtering
        const ffmpeg = spawn('ffmpeg', [
            '-i', songInfo.streamUrl, // stream URL fra metadata
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', // Normaliser volum
            '-vn', // ingen videoutgang
            '-loglevel', 'info', // loggnivå
            '-f', 'mp3', 'pipe:1' // sender ut til pipe
        ]);

        ffmpeg.stderr.on('data', (ffmpegData) => {
            const output = ffmpegData.toString();
            log(`ffmpeg output: ${output}`);

            const metadataMatch = output.match(/StreamTitle\s*:\s*(.*)/);
            if (metadataMatch) {
                const streamTitle = metadataMatch[1].trim();
                const enhancedSongInfo = { ...songInfo, streamTitle };
                
                // Send oppdatert metadata til frontend-klienter
                frontendServer.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(enhancedSongInfo));
                        log(`Sendt oppdatert metadata til frontend: ${JSON.stringify(enhancedSongInfo)}`);
                    }
                });
            }
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
