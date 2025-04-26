const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { fetchSpotifyAlbumCover } = require('./spotifyFetcher.js');
const { processNRKMetadata } = require('./NRKFix.js');
const { processURLMetadata } = require('./URLFix.js');
const { fixTitle } = require('./fixTitle.js'); // Import the fixTitle function

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

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const metadataWss = new WebSocket.Server({ port: METADATA_PORT });

let metadataFetcherClient = null;
let currentFfmpegProcess = null;
let currentStreamUrl = null;

// Metadata WebSocket connection
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher connected.');

    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher disconnected.');
    });
});

// Frontend WebSocket connection
wss.on('connection', (ws) => {
    logError('New connection from frontend client.');

    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) {
            logError(`Stream URL already chosen: ${streamUrl}`);
            return;
        }

        logError(`Starting new process for: ${streamUrl}`);
        startFfmpegProcess(streamUrl, ws);
    });

    ws.on('close', () => {
        logError('Frontend WebSocket connection closed.');
        stopFfmpegProcess();
    });
});

function startFfmpegProcess(streamUrl, ws) {
    stopFfmpegProcess();

    currentStreamUrl = streamUrl;
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
        const imageMatch = output.match(/https?:\/\/[^\s]+/);

        if (titleMatch) {
            const streamTitle = titleMatch[1].trim();
            const imageUrl = imageMatch ? imageMatch[0].trim() : null;

            let processedMetadata = processNRKMetadata(streamTitle);

            if (!processedMetadata.title && !processedMetadata.artist) {
                logError('NRKFix returned empty values, trying URLFix.');
                processedMetadata = processURLMetadata(streamTitle);
                
                if (!processedMetadata.title && !processedMetadata.artist) {
                    logError('URLFix also failed, trying fixTitle.');
                    processedMetadata = fixTitle(streamTitle);
                }
            }

            const metadata = {
                StreamTitle: streamTitle,
                imageUrl: imageUrl || null,
                program: processedMetadata.program,
                title: processedMetadata.title,
                artist: processedMetadata.artist,
                album: processedMetadata.album,
            };

            if (!metadata.imageUrl && metadata.artist && metadata.title) {
                logError('No imageUrl found, trying to fetch from Spotify...');
                try {
                    const spotifyImageUrl = await fetchSpotifyAlbumCover(metadata.artist, metadata.title);
                    if (spotifyImageUrl) {
                        metadata.imageUrl = spotifyImageUrl;
                        logError(`Spotify album cover found: ${spotifyImageUrl}`);
                    }
                } catch (error) {
                    logError(`Error fetching from Spotify: ${error.message}`);
                }
            }

            ws.send(JSON.stringify(metadata));
            if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                metadataFetcherClient.send(JSON.stringify(metadata));
            }

            logError(`Metadata sent: ${JSON.stringify(metadata)}`);
        }

        handleStreamUrl(output, ws);
    });
}

function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        logError('Terminating ongoing ffmpeg process.');
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null;
        currentStreamUrl = null;
    }
}

function handleStreamUrl(output, ws) {
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1];
        logError(`Planetradio URL found: ${planetradioUrl}`);
        fetchPlanetradioMetadata(planetradioUrl, ws);
    }
}

async function fetchPlanetradioMetadata(url, ws) {
    logError(`Fetching metadata from Planetradio: ${url}`);
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const metadata = {
                StreamTitle: `${data.eventSongArtist || 'Unknown artist'} - ${data.eventSongTitle || 'Unknown title'}`,
                imageUrl: data.eventImageUrl,
                songTitle: data.eventSongTitle,
                artist: data.eventSongArtist,
                album: data.eventSongAlbum,
            };

            logError(`Planetradio metadata: ${JSON.stringify(metadata)}`);
            ws.send(JSON.stringify(metadata));
        } else {
            logError(`No valid metadata from Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Error fetching Planetradio metadata: ${error.message}`);
    }
}
