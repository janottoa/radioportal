y
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const express = require('express'); // Nytt
const axios = require('axios'); // Nytt

// Port for WebSocket-serveren
const PORT = 8080;
const LOG_FILE = 'ffmpeg_metadata.log';

// Start WebSocket-serveren
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket-server kjører på ws://192.168.0.11:${PORT}`);

// Start Express-serveren for å hente JSON-data
const app = express();
const HTTP_PORT = 3000; // Velg en port for HTTP-serveren

// Åpne loggfil for å skrive metadata
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Hente sanginformasjon fra en Radio Norge-lenke
app.get('/radio-norge-info', async (req, res) => {
    const streamUrl = 'https://listenapi.planetradio.co.uk/api9.2/eventdata/277667313';
    
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
        console.error('Error fetching song info:', error);
        res.status(500).json({ error: 'Failed to fetch song info' });
    }
});

// Start HTTP-serveren
app.listen(HTTP_PORT, () => {
    console.log(`HTTP-server kjører på http://localhost:${HTTP_PORT}`);
});

// WebSocket-tilkobling for å håndtere ffmpeg-strøm
wss.on('connection', (ws) => {
    console.log('Ny WebSocket-tilkobling opprettet.');

    ws.on('message', (message) => {
        const streamUrl = message;
        console.log(`Mottok forespørsel om strøm-URL: ${streamUrl}`);
        logStream.write(`Mottok strøm-URL: ${streamUrl}\n`);

        // Start ffmpeg-prosessen for å hente metadata fra strømmen
        const ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-vn',
            '-loglevel', 'debug', // Endrer til 'debug' for mer detaljert informasjon
            '-f', 'null', '-'
        ]);

        // Logg all output fra ffmpeg til feilsøking
        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('ffmpeg output:', output); // Logger til konsollen
            logStream.write(`ffmpeg output: ${output}\n`); // Logger til filen

            // Hent StreamTitle fra metadata hvis tilgjengelig
            const matches = output.match(/StreamTitle\s*:\s*(.*)/);
            if (matches) {
                const streamTitle = matches[1].trim();
                console.log(`Sender metadata til klient: ${streamTitle}`);
                ws.send(JSON.stringify({ StreamTitle: streamTitle }));
                logStream.write(`Sender metadata til klient: ${streamTitle}\n`);
            } else {
                // Logg hvis ingen StreamTitle finnes i output
                logStream.write(`Ingen StreamTitle funnet i denne outputen.\n`);
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
        });

        ws.on('close', () => {
            console.log('WebSocket-tilkobling avsluttet av klienten.');
            ffmpeg.kill(); // Avslutt ffmpeg-prosessen når WebSocket-tilkoblingen lukkes
            logStream.write('WebSocket-tilkobling avsluttet av klienten.\n');
        });
    });

    ws.on('error', (err) => {
        console.error("WebSocket-feil:", err);
        logStream.write(`WebSocket-feil: ${err}\n`);
    });
});
