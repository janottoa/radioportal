const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { processNRKMetadata } = require('./NRKFix.js');
const { processURLMetadata } = require('./URLFix.js');

// Logging setup
const logStream = fs.createWriteStream('proxy.log', { flags: 'a' });
function logError(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;
    logStream.write(logMessage);
    console.error(logMessage);
}

// Configuration
const WEBSOCKET_PORT = 3080;
const METADATA_PORT = 3081;

// WebSocket servers
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const metadataWss = new WebSocket.Server({ port: METADATA_PORT });

let metadataFetcherClient = null;
let currentFfmpegProcess = null;
let currentStreamUrl = null;
let isStreamActive = false; // For å spore strømmestatus

// Funksjon for å starte FFmpeg
function startFfmpeg(ws, ffmpegUrl) {
    if (!ffmpegUrl) {
        logError('Cannot start FFmpeg. No active FFmpeg URL available.');
        return;
    }

    logError(`Starting FFmpeg process for URL: ${ffmpegUrl}`);

    currentStreamUrl = ffmpegUrl; // Sett aktiv streaming URL
    currentFfmpegProcess = spawn('ffmpeg', [
        '-i', ffmpegUrl,
        '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
        '-vn',
        '-loglevel', 'debug',
        '-f', 'null', '-'
    ]);

    currentFfmpegProcess.stderr.on('data', async (data) => {
        const output = data.toString();

        const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
        const imageMatch = output.match(/https?:\/\/[^\s]+/);

        if (titleMatch) {
            isStreamActive = true; // Setter strømmen som aktiv
            const streamTitle = titleMatch[1].trim();
            const imageUrl = imageMatch ? imageMatch[0].trim() : null;

            // Prosesser råmetadata fra NRK
            let processedMetadata = processNRKMetadata(streamTitle);

            // Kontrollere for manglende tittel og artist
            if (!processedMetadata.title || !processedMetadata.artist) {
                processedMetadata = processURLMetadata(streamTitle);
                logError(`Using fallback for metadata: ${JSON.stringify(processedMetadata)}`);
            }

            let title = processedMetadata.title || streamTitle; // Sett tittel
            let artist = processedMetadata.artist; // Sett artist

            let albumData = null; // Bestem albumdata
            if (artist && title) {
                // Hente albumcover
                try {
                    albumData = await fetchAlbumCover(artist, title);
                } catch (error) {
                    logError(`Error fetching album cover for ${artist} - ${title}: ${error.message}`);
                }
            }

            const metadata = {
                StreamTitle: streamTitle,
                imageUrl: imageUrl || (albumData ? albumData.album_cover_url : null),
                program: processedMetadata.program,
                title: title || null,
                artist: artist || null,
                album: albumData?.album_name || null,
                trackSpotifyId: albumData?.track_spotify_id || null,
                popularity: albumData?.popularity || null,
                releaseDate: albumData?.release_date || null,
                duration: albumData?.duration_ms || null,
                spotifyUri: albumData?.uri || null,
                externalUrl: albumData?.external_urls?.spotify || null
            };

            // Send metadata til frontend hvis strømming er aktiv
            if (isStreamActive) {
                ws.send(JSON.stringify(metadata));
            }
        } else if (output.includes("No metadata available")) {
            isStreamActive = false; // Sett strømstatus til falsk
            logError('No metadata available, stopping stream.');

            // Send en melding til frontend for å indikere at strømmingen er stoppet
            ws.send(JSON.stringify({ StreamTitle: "No metadata available" }));
        }
    });

    currentFfmpegProcess.on('error', (err) => {
        logError(`FFmpeg process error: ${err.message}`);
    });

    currentFfmpegProcess.on('close', (code) => {
        logError(`FFmpeg process closed with code: ${code}`);
        isStreamActive = false; // Reset strømstatus
        currentFfmpegProcess = null; // Reset prosessreferanse

        // Bare start opp igjen hvis strømming er aktiv
        if (currentStreamUrl && isStreamActive) {
            setTimeout(() => startFfmpeg(ws, currentStreamUrl), 5000);
        }
    });
}

// Hent metadata for Planetradio
async function fetchPlanetradioMetadata(url, ws) {
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const metadata = {
                StreamTitle: `${data.eventSongArtist || 'Unknown Artist'} - ${data.eventSongTitle || 'Unknown Title'}`,
                imageUrl: data.eventImageUrl || null,
                artist: data.eventSongArtist || 'Unknown Artist',
                title: data.eventSongTitle || 'Unknown Title',
                album: data.eventSongAlbum || null
            };

            const albumData = await fetchAlbumCover(metadata.artist, metadata.title);
            if (albumData) {
                metadata.imageUrl = albumData.album_cover_url || metadata.imageUrl;
                metadata.popularity = albumData.popularity || null;
                metadata.releaseDate = albumData.release_date || null;
            }

            ws.send(JSON.stringify(metadata));
        } else {
            logError(`Invalid metadata from Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Error fetching Planetradio metadata: ${error.message}`);
    }
}

// Hent albumcover fra Flask API
async function fetchAlbumCover(artist, track) {
    if (!artist || !track) {
        logError("Fetching album cover failed: Missing artist or track");
        return null;
    }

    try {
        const response = await axios.post('http://localhost:5000/get_album_cover', { artist, track });
        return response.data;
    } catch (error) {
        logError(`Error fetching album cover: ${error.message}`);
        return null;
    }
}

// WebSocket-tilkoblinger for metadataFetcher
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher connected.');
    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher disconnected.');
    });
});

// WebSocket-tilkoblinger for frontend
wss.on('connection', (ws) => {
    logError('New frontend client connected.');

    ws.on('message', (message) => {
        let streamUrl;

        try {
            const parsedMessage = JSON.parse(message);
            streamUrl = parsedMessage.streamUrl; // Forventet melding med streamUrl
        } catch (err) {
            streamUrl = message; // Ren tekstmelding
        }

        if (streamUrl === currentStreamUrl) return; // Ingen oppdatering hvis strømming er lik

        stopFfmpegProcess();
        currentStreamUrl = streamUrl; // Oppdater aktiv strømming
        startFfmpeg(ws, streamUrl);
    });

    ws.on('close', () => {
        stopFfmpegProcess();
        logError('Frontend client disconnected');
    });
});

// Stopp FFmpeg-prosess
function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null; // Reset prosessreferanse
    }
    currentStreamUrl = null; // Nullstill URL-en ved stopp
}

logError('Proxy server is running.');