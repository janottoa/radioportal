const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const express = require('express');
const axios = require('axios');

// Konfigurasjon
const WEBSOCKET_PORT = 8081;  // Endre til tilgjengelig port
const HTTP_PORT = 3001;       // Endre til tilgjengelig port
const LOG_FILE = 'ffmpeg_metadata.log';

// Start WebSocket-serveren for ffmpeg metadata
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
console.log(`WebSocket-server kjører på ws://192.168.0.11:${WEBSOCKET_PORT}`);

// Start Express-serveren for å hente metadata fra Radio Norge-lenker
const app = express();

// Åpne loggfil for å skrive metadata
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Funksjon for å starte ffmpeg og håndtere metadata
function startFfmpeg(ws, streamUrl) {
    console.log(`Starter ffmpeg-prosess for URL: ${streamUrl}`);
    
    const ffmpeg = spawn('ffmpeg', [
        '-i', streamUrl,
        '-vn',
        '-loglevel', 'debug', // Endrer til 'debug' for mer detaljert informasjon
        '-f', 'null', '-'
    ]);

    ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        logStream.write(`ffmpeg output: ${output}\n`);

        // Søk etter StreamTitle og StreamUrl
        const titleMatch = output.match(/StreamTitle\s*:\s*(.*)/);
        const urlMatch = output.match(/StreamUrl\s*:\s*(https:\/\/\S+)/);

        if (titleMatch) {
            const streamTitle = titleMatch[1].trim();
            ws.send(JSON.stringify({ StreamTitle: streamTitle }));
            logStream.write(`Sendt StreamTitle til klient: ${streamTitle}\n`);
        }

        if (urlMatch) {
            const metadataUrl = urlMatch[1].trim();
            fetchMetadataFromUrl(metadataUrl, ws);
        }
    });

    ffmpeg.on('error', (err) => {
        console.error("ffmpeg-prosess feilet:", err);
        logStream.write(`ffmpeg-prosess feilet: ${err}\n`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`ffmpeg avsluttet med kode ${code}`);
        ws.send(JSON.stringify({ StreamTitle: "Ingen metadata tilgjengelig" }));
        logStream.write(`ffmpeg avsluttet med kode ${code}\n`);

        // Prøv å starte på nytt etter en kort pause
        setTimeout(() => startFfmpeg(ws, streamUrl), 5000);
    });

    ws.on('close', () => {
        console.log('WebSocket-tilkobling avsluttet av klienten.');
        ffmpeg.kill();
        logStream.write('WebSocket-tilkobling avsluttet av klienten.\n');
    });
}

// Håndter WebSocket-tilkoblinger
wss.on('connection', (ws) => {
    console.log('Ny WebSocket-tilkobling opprettet.');
    ws.on('message', (message) => {
        logStream.write(`Mottok strøm-URL fra klient: ${message}\n`);
        startFfmpeg(ws, message);
    });
});

// Håndter HTTP-forespørsler for å hente metadata fra en gitt URL (for Radio Norge)
app.get('/radio-norge-info', async (req, res) => {
    const streamUrl = req.query.url; // Forvent en URL som parameter i forespørselen
    if (!streamUrl) {
        return res.status(400).json({ error: 'Ingen URL spesifisert' });
    }

    try {
        const response = await axios.get(streamUrl);
        const data = response.data;

        const songInfo = {
            title: data.eventSongTitle,
            artist: data.eventSongArtist,
            start_time: data.eventStart,
            finish_time: data.eventFinish,
            duration: data.eventDuration,
            image_url: data.eventImageUrl,
            apple_music_url: data.eventAppleMusicUrl
        };

        res.json(songInfo);
    } catch (error) {
        console.error('Feil ved henting av sanginfo fra URL:', error);
        res.status(500).json({ error: 'Klarte ikke å hente sanginformasjon' });
    }
});

// Funksjon for å hente metadata fra en URL og sende til WebSocket-klienten
async function fetchMetadataFromUrl(url, ws) {
    try {
        const response = await axios.get(url);
        const data = response.data;

        const songInfo = {
            title: data.eventSongTitle,
            artist: data.eventSongArtist,
            start_time: data.eventStart,
            finish_time: data.eventFinish,
            duration: data.eventDuration,
            image_url: data.eventImageUrl,
            apple_music_url: data.eventAppleMusicUrl
        };

        ws.send(JSON.stringify(songInfo));
        logStream.write(`Sendt metadata fra URL til klienten: ${JSON.stringify(songInfo)}\n`);
    } catch (error) {
        console.error('Feil ved henting av metadata fra URL:', error);
        ws.send(JSON.stringify({ error: 'Klarte ikke å hente metadata fra URL' }));
    }
}

// Start Express-serveren
app.listen(HTTP_PORT, () => {
    console.log(`HTTP-server kjører på http://localhost:${HTTP_PORT}`);
});
