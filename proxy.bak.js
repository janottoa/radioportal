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

// Konfigurasjon
const WEBSOCKET_PORT = 3080;
const METADATA_PORT = 3081;

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const metadataWss = new WebSocket.Server({ port: METADATA_PORT });

let metadataFetcherClient = null;
let currentFfmpegProcess = null;
let currentStreamUrl = null;

// Metadata WebSocket-tilkobling
metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logError('MetadataFetcher tilkoblet.');

    ws.on('close', () => {
        metadataFetcherClient = null;
        logError('MetadataFetcher frakoblet.');
    });
});

// Frontend WebSocket-tilkobling
wss.on('connection', (ws) => {
    logError('Ny tilkobling fra frontend-klient.');

    ws.on('message', (streamUrl) => {
        if (streamUrl === currentStreamUrl) {
            logError(`Stream URL allerede valgt: ${streamUrl}`);
            return;
        }

        // Avslutt eksisterende prosess og nullstill metadata
        logError(`Avslutter eksisterende prosess for: ${currentStreamUrl}`);
        stopFfmpegProcess();

        logError(`Starter ny prosess for: ${streamUrl}`);
        currentStreamUrl = streamUrl;

        // Start ny FFmpeg-prosess
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

                let processedMetadata = processNRKMetadata(streamTitle); // Prøv NRKFix

                // Hvis NRKFix ikke gir resultater, prøv URLFix
                if (!processedMetadata.title && !processedMetadata.artist) {
                    processedMetadata = processURLMetadata(streamTitle); // URLFix
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

                // Hent albumcover fra Flask API
                const albumData = await fetchAlbumCover(artist, title);

                if (albumData) {
                    const metadata = {
                        StreamTitle: streamTitle,
                        imageUrl: imageUrl || albumData.album_cover_url || null,
                        program: processedMetadata.program,
                        title: title || null,
                        artist: artist || null,
                        album: albumData.album_name || null,
                        trackSpotifyId: albumData.track_spotify_id || null,
                        popularity: albumData.popularity || null,
                        releaseDate: albumData.release_date || null,
                        duration: albumData.duration_ms || null,
                        spotifyUri: albumData.uri || null,
                        externalUrl: albumData.external_urls ? albumData.external_urls.spotify : null
                    };

                    ws.send(JSON.stringify(metadata)); // Send metadata til frontend
                } else {
                    logError('Ingen albumdata tilgjengelig.');
                }
            }
        });

        ffmpeg.on('close', () => {
            logError('FFmpeg-prosessen har avsluttet.');
        });
    });

    ws.on('close', () => {
        logError('Frontend WebSocket-tilkobling lukket.');
        stopFfmpegProcess();
    });
});

// Hent albumcover fra Flask API
async function fetchAlbumCover(artist, track) {
    try {
        const response = await axios.post('http://localhost:5000/get_album_cover', {
            artist: artist,
            track: track
        });
        return response.data;
    } catch (error) {
        logError(`Feil under henting av albumcover: ${error.message}`);
        return null;
    }
}

// Stop FFmpeg-prosess og nullstill metadata
function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        logError('Avslutter pågående ffmpeg-prosess.');

        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null;
    }

    // Nullstill metadata og informer frontend
    if (metadataFetcherClient) {
        metadataFetcherClient.send(JSON.stringify({
            action: 'reset',
            StreamTitle: null,
            imageUrl: null, // Fjern cover
            title: null,
            artist: null,
            album: null,
            releaseDate: null,
            duration: null,
            popularity: null
        }));
        logError('Metadata nullstilt og sendt til frontend.');

        // Frakoble klient etter nullstilling
        metadataFetcherClient = null;
        logError('MetadataFetcher-klient frakoblet etter nullstilling.');
    }

    currentStreamUrl = null;
}




// Håndterer StreamUrl for Planetradio
function handleStreamUrl(output, ws) {
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1];
        logError(`Planetradio URL funnet: ${planetradioUrl}`);
        fetchPlanetradioMetadata(planetradioUrl, ws);
    }
}

// Funksjonen for å hente Planetradio metadata
async function fetchPlanetradioMetadata(url, ws) {
    logError(`Henter metadata fra Planetradio: ${url}`);
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const artist = data.eventSongArtist || 'Ukjent artist';
            const title = data.eventSongTitle || 'Ukjent tittel';
            const planetradioImageUrl = data.eventImageUrl || null; // Bildet fra Planetradio

            // Logg og send Planetradio metadata først
            const metadata = {
                StreamTitle: `${artist} - ${title}`,
                imageUrl: planetradioImageUrl, // Bruk bilde-URL fra Planetradio hvis tilgjengelig
                songTitle: title,
                artist: artist,
                album: data.eventSongAlbum || null, // Album fra Planetradio
            };

            logError(`Planetradio metadata: ${JSON.stringify(metadata)}`);

            // Hent informasjon fra Spotify for å oppdatere metadata
            const albumData = await fetchAlbumCover(artist, title);

            if (albumData) {
                metadata.imageUrl = albumData.album_cover_url || metadata.imageUrl; // Oppdater med Spotify cover hvis tilgjengelig
                metadata.title = metadata.songTitle || metadata.title;
                metadata.album = albumData.album_name; // Oppdater album fra Spotify
                metadata.popularity = albumData.popularity; // Hent popularitet
                metadata.releaseDate = albumData.release_date; // Hent utgivelsesdato
                metadata.duration = albumData.duration_ms; // Hent varighet
                metadata.trackSpotifyId = albumData.track_spotify_id; // Hent Spotify ID
            }

            // Send den kombinerte metadata til frontend
            ws.send(JSON.stringify(metadata));
        } else {
            logError(`Ingen gyldige metadata fra Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Feil ved henting av Planetradio metadata: ${error.message}`);
    }
}