const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { fetchSpotifyAlbumCover } = require('./spotifyFetcher.js');
const { processNRKMetadata } = require('./NRKFix.js'); // Importer funksjonen for generell behandling
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

        logError(`Starter ny prosess for: ${streamUrl}`);
        startFfmpegProcess(streamUrl, ws);
    });

    ws.on('close', () => {
        logError('Frontend WebSocket-tilkobling lukket.');
        stopFfmpegProcess();
    });
});

function startFfmpegProcess(streamUrl, ws) {
    stopFfmpegProcess(); // Avslutt eventuelle kjørende prosesser

    currentStreamUrl = streamUrl;
    let ffmpeg;

    function spawnFfmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        currentFfmpegProcess = ffmpeg;

        ffmpeg.stderr.on('data', async (data) => {
            const output = data.toString();

            // Hent StreamTitle fra metadata
            const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
            const imageMatch = output.match(/https?:\/\/[^\s]+/);

            if (titleMatch) {
                const streamTitle = titleMatch[1].trim();
                const imageUrl = imageMatch ? imageMatch[0].trim() : null;

                let processedMetadata = processNRKMetadata(streamTitle); // Prøv NRKFix

                // Hvis NRKFix ikke gir resultater, prøv URLFix
                if (!processedMetadata.title && !processedMetadata.artist) {
                    logError('NRKFix returnerte tomme verdier, prøver URLFix.');
                    processedMetadata = processURLMetadata(streamTitle); // URLFix
                }

                // Nå håndterer vi spesifikt "/" formatet
                const trackInfoMatch = streamTitle.match(/(.*)\s*\/\s*(.*)/);
                let title, artist;

                if (trackInfoMatch) {
                    title = trackInfoMatch[1].trim();
                    artist = trackInfoMatch[2].trim();
                } else {
                    // Hvis både NRK og URL ikke gir resultater, bruk verdiene fra prosesseringen
                    title = processedMetadata.title || streamTitle; // Fallback til StreamTitle
                    artist = processedMetadata.artist || null; // Ingen fallback her
                }

                const metadata = {
                    StreamTitle: streamTitle,
                    imageUrl: imageUrl || null,
                    program: processedMetadata.program,
                    title: title, // Bruker tittel uansett format
                    artist: artist, // Bruker artist uansett format
                    album: processedMetadata.album || null,
                };

                // Hent albumcover fra Spotify hvis nødvendig
                if (!metadata.imageUrl && artist && title) {
                    logError('Ingen imageUrl funnet, prøver å hente fra Spotify...');
                    try {
                        const spotifyImageUrl = await fetchSpotifyAlbumCover(artist, title);
                        if (spotifyImageUrl) {
                            metadata.imageUrl = spotifyImageUrl;
                            logError(`Spotify albumcover funnet: ${spotifyImageUrl}`);
                        }
                    } catch (error) {
                        logError(`Feil ved Spotify-henting: ${error.message}`);
                    }
                }

                // Send metadata til klienter
                ws.send(JSON.stringify(metadata));
                if (metadataFetcherClient && metadataFetcherClient.readyState === WebSocket.OPEN) {
                    metadataFetcherClient.send(JSON.stringify(metadata));
                }

                logError(`Metadata sendt: ${JSON.stringify(metadata)}`);
            }

            // Sjekk og behandle StreamUrl for Planetradio
            handleStreamUrl(output, ws);
        });
    }

    spawnFfmpeg();

    ws.on('close', () => {
        stopFfmpegProcess();
    });
}

function stopFfmpegProcess() {
    if (currentFfmpegProcess) {
        logError('Avslutter pågående ffmpeg-prosess.');
        currentFfmpegProcess.kill('SIGKILL');
        currentFfmpegProcess = null;
        currentStreamUrl = null;
    }
}

function handleStreamUrl(output, ws) {
    // Filtrer og fang kun gyldige Planetradio URL-er
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1].trim(); // Fjern mellomrom
        logError(`Planetradio URL funnet: ${planetradioUrl}`);

        // Behold eksisterende metadata
        const currentMetadata = {
            imageUrl: currentMetadata?.imageUrl || stations.find(station => station.url === currentStreamUrl)?.logo || 'default-logo.png',
            title: currentMetadata?.title || 'Ukjent tittel',
            artist: currentMetadata?.artist || 'Ukjent artist',
            album: currentMetadata?.album || null,
        };

        // Hent metadata fra Planetradio
        fetchPlanetradioMetadata(planetradioUrl, ws, currentMetadata);
    } else {
        logError(`Ingen gyldig Planetradio URL funnet i output: ${output}`);
    }
}


async function fetchPlanetradioMetadata(url, ws) {
    logError(`Henter metadata fra Planetradio: ${url}`);
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data && data.eventSongTitle) {
            const metadata = {
                StreamTitle: `${data.eventSongArtist || 'Ukjent artist'} - ${data.eventSongTitle || 'Ukjent tittel'}`,
                imageUrl: data.eventImageUrl || null, // Behold dette feltet som det er
                title: data.eventSongTitle || 'Ukjent tittel', // Legg til felles feltnavn
                artist: data.eventSongArtist || 'Ukjent artist', // Legg til felles feltnavn
                album: data.eventSongAlbum || null, // Behold album hvis tilgjengelig
                // Nye felt kan legges til her:
                trackSpotifyId: null, // Planetradio gir ikke Spotify ID
                popularity: null, // Planetradio gir ikke popularitet
                releaseDate: null, // Planetradio gir ikke utgivelsesdato
                artists: [], // Tomt array for kompatibilitet
                duration: null, // Planetradio gir ikke varighet
                spotifyUri: null, // Planetradio gir ikke Spotify URI
                externalUrl: null, // Ingen ekstern URL fra Planetradio
            };

            logError(`Planetradio metadata: ${JSON.stringify(metadata)}`);
            ws.send(JSON.stringify(metadata)); // Send metadata til frontend
        } else {
            logError(`Ingen gyldige metadata fra Planetradio: ${JSON.stringify(data)}`);
        }
    } catch (error) {
        logError(`Feil ved henting av Planetradio metadata: ${error.message}`);
    }
}
