const WebSocket = require('ws');
const { spawn } = require('child_process');
const express = require('express');
const fs = require('fs');

// Konfigurasjon
const WEBSOCKET_PORT = 8080;
const HTTP_PORT = 3000;
const METADATA_PORT = 8081;
const IP_ADDRESS = '192.168.0.11';  // Bruk spesifikk IP-adresse for alle WebSocket-servere

// Logger til fil
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function writeToLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
}

// Start WebSocket-server for frontend
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT, host: IP_ADDRESS });
writeToLog(`WebSocket-server for frontend kjører på ws://${IP_ADDRESS}:${WEBSOCKET_PORT}`);

// Start en ny WebSocket-server for metadataFetcher.js
const metadataWss = new WebSocket.Server({ port: METADATA_PORT, host: IP_ADDRESS });
writeToLog(`Metadata WebSocket-server kjører på ws://${IP_ADDRESS}:${METADATA_PORT}`);

// Variabel for å holde metadataFetcher-klienten
let metadataFetcherClient = null;

// Håndter WebSocket-tilkobling fra metadataFetcher.js
metadataWss.on('connection', (ws) => {
    writeToLog('Koblet til metadataFetcher.js');
    metadataFetcherClient = ws;

    ws.on('close', () => {
        writeToLog('WebSocket-tilkobling til metadataFetcher.js lukket.');
        metadataFetcherClient = null;
    });
});

// Funksjon for å starte ffmpeg og hente metadata, inkludert StreamUrl
function startFfmpeg(ws, streamUrl) {
    writeToLog(`Starter ffmpeg-prosess for URL: ${streamUrl}`);
    
    const ffmpeg = spawn('ffmpeg', [
        '-i', streamUrl,
        '-vn',
        '-loglevel', 'debug',
        '-f', 'null', '-'
    ]);

    ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        writeToLog(`ffmpeg output: ${output}`);

        // Søk etter StreamUrl for dynamisk metadata-URL
        const urlMatch = output.match(/StreamUrl\s*:\s*(https:\/\/\S+)/);
        if (urlMatch) {
            const metadataUrl = urlMatch[1].trim();
            writeToLog(`Funnet StreamUrl: ${metadataUrl}`);

            // Send oppdatert metadata-URL til metadataFetcher.js, hvis tilkoblet
            if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                metadataFetcherClient.send(metadataUrl);
                writeToLog(`Sendt oppdatert StreamUrl til metadataFetcher.js: ${metadataUrl}`);
            } else {
                writeToLog('Ingen aktiv tilkobling til metadataFetcher.js for å sende StreamUrl.');
            }
        } else {
            writeToLog("Ingen StreamUrl funnet i ffmpeg-output.");
        }
    });

    ffmpeg.on('close', (code) => {
        writeToLog(`ffmpeg avsluttet med kode ${code}`);
        ws.send(JSON.stringify({ StreamTitle: "Ingen metadata tilgjengelig" }));
    });

    ws.on('close', () => {
        writeToLog('WebSocket-tilkobling til frontend lukket.');
        ffmpeg.kill();
    });
}

// Start Express-serveren
const app = express();
app.listen(HTTP_PORT, IP_ADDRESS, () => {
    writeToLog(`HTTP-server kjører på http://${IP_ADDRESS}:${HTTP_PORT}`);
});
