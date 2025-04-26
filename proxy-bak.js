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

// Function to start FFmpeg
function startFfmpeg(ws, streamUrl) {
    logError(`Starting FFmpeg process for URL: ${streamUrl}`);

    const ffmpeg = spawn('ffmpeg', [
        '-i', streamUrl,
        '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
        '-vn',
        '-loglevel', 'debug',
        '-f', 'null', '-'
    ]);

    currentFfmpegProcess = ffmpeg;

    ffmpeg.stderr.on('data', async (data) => {
        const output = data.toString();

        const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
        const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
        const imageMatch = output.match(/https?:\/\/[^\s]+/);

        if (titleMatch) {
            const streamTitle = titleMatch[1].trim();
            const imageUrl = imageMatch ? imageMatch[0].trim() : null;

            let processedMetadata = processNRKMetadata(streamTitle);

            if (!processedMetadata.title && !processedMetadata.artist) {
                processedMetadata = processURLMetadata(streamTitle);
            }

            const trackInfoMatch = streamTitle.match(/(.*)\s*\/\s*(.*)/);
            let title, artist;

            if (trackInfoMatch) {
                title = trackInfoMatch[1].trim();
                artist = trackInfoMatch[2].trim();
            } else {
                title = processedMetadata.title || streamTitle;
                artist = processedMetadata.artist || null;
            }

            const albumData = await fetchAlbumCover(artist, title);

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

            ws.send(JSON.stringify(metadata));
        }

        if (urlMatch) {
            const planetradioUrl = urlMatch[1];
            logError(`Planetradio URL found: ${planetradioUrl}`);
            fetchPlanetradioMetadata(planetradioUrl, ws);
        }
    });

    ffmpeg.on('error', (err) => {
        logError(`FFmpeg process error: ${err.message}`);
    });

    ffmpeg.on('close', (code) => {
        logError(`FFmpeg process closed with code: ${code}`);
        ws.send(JSON.stringify({ StreamTitle: "No metadata available" }));
        setTimeout(() => startFfmpeg(ws, currentStreamUrl), 5000);
    });
}

// Fetch Planetradio metadata
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

// Fetch album cover from Flask API
async function fetchAlbumCover(artist, track) {
    try {
        const response = await axios.post('http://localhost:5000/get_album_cover', { artist, track });
        return response.data;
    } catch (error) {
        logError(`Error fetching album cover: ${error.message}`);
        return null;
    }
}

// WebSocket connection for metadataFetcher
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher connected.');
    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher disconnected.');
    });
});

// WebSocket connection for frontend
wss.on('connection', (ws) => {
    logError('New frontend client connected.');

    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) return;

        stopFfmpegProcess();
        currentStreamUrl = streamUrl;
        startFfmpeg(ws, streamUrl);
    });

    ws.on('close', () => stopFfmpegProcess());
});

// Stop FFmpeg process
function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null;
    }
    currentStreamUrl = null;
}

logError('Proxy server is running.');
