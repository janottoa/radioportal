const WebSocket = require('ws');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const logStream = fs.createWriteStream('fetcher.log', { flags: 'a' });

function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
}

// Laster inn stasjonsdata fra JSON-filen
let stationsData;
try {
    stationsData = JSON.parse(fs.readFileSync('/var/www/radioportal/stations.json', 'utf-8'));
    log(`stations.json lastet inn.`);
} catch (error) {
    log(`Feil ved lasting av stations.json: ${error.message}`);
    process.exit(1); // Avslutter prosessen hvis filen ikke kan lastes
}

const PROXY_URL = 'ws://192.168.0.11:8081';
const FRONTEND_PORT = 8082;

let proxySocket;
let currentFfmpegProcess = null;

// Opprett WebSocket-server for frontend
const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });
log(`Frontend WebSocket-server kjører på ws://192.168.0.11:${FRONTEND_PORT}`);

// Håndter tilkoblinger fra frontend
frontendServer.on('connection', (client) => {
    log('Ny tilkobling fra frontend-klient');

    client.on('close', () => log('Frontend-klient tilkobling lukket'));
});

// Kobler til proxy.js via WebSocket
function connectToProxy() {
    proxySocket = new WebSocket(PROXY_URL);

    proxySocket.on('open', () => {
        log('Koblet til WebSocket-server i proxy.js');
    });

    proxySocket.on('message', (data) => {
        const messageString = data.toString();
        let parsedMessage;

        try {
            parsedMessage = JSON.parse(messageString);
            log(`Mottatt melding fra proxy: ${JSON.stringify(parsedMessage, null, 2)}`);
        } catch (error) {
            log(`Feil ved parsing av melding fra proxy: ${error.message}`);
            return;
        }

        if (parsedMessage.StreamTitle) {
            const messageToFrontend = {
                stationName: parsedMessage.stationName,
                StreamTitle: parsedMessage.StreamTitle,
                imageUrl: null,
                artist: null,
                title: null,
            };

            try {
                const streamMetadata = parsedMessage.StreamUrl ? JSON.parse(parsedMessage.StreamUrl) : {};
                log(`Parsed StreamUrl metadata: ${JSON.stringify(streamMetadata, null, 2)}`);

                messageToFrontend.imageUrl = streamMetadata.imageUrl || null;
                messageToFrontend.artist = streamMetadata.artist || null;
                messageToFrontend.title = streamMetadata.title || null;
            } catch (error) {
                log(`Feil ved parsing av StreamUrl: ${error.message}`);
                log(`Ugyldig StreamUrl: ${parsedMessage.StreamUrl}`);
            }

            sendToFrontend(messageToFrontend);
        } else {
            log(`Ingen StreamTitle i melding: ${messageString}`);
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

// Sender data til frontend via WebSocket
function sendToFrontend(data) {
    const message = JSON.stringify(data);

    frontendServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            log(`Sendte data til frontend: ${message}`);
        }
    });
}

// Starter ffmpeg-prosessen med angitt streamUrl
function startFfmpeg(streamUrl) {
    exec('pkill -f ffmpeg', (err) => {
        if (err) {
            log('Ingen tidligere ffmpeg-prosesser å avslutte eller feil ved avslutning.');
        } else {
            log('Tidligere ffmpeg-prosesser avsluttet.');
        }

        currentFfmpegProcess = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm',
            '-f', 'mp3',
            '-metadata', 'icy=true',
            '-',
        ]);

        currentFfmpegProcess.stdout.on('data', (data) => {
            log(`ffmpeg-utdata: ${data}`);
        });

        currentFfmpegProcess.stderr.on('data', (data) => {
            log(`ffmpeg-feilutdata: ${data}`);
        });

        currentFfmpegProcess.on('close', (code) => {
            log(`ffmpeg-prosess avsluttet med kode: ${code}`);
        });
    });
}

// Starter tilkoblingen til proxy.js ved oppstart
connectToProxy();
