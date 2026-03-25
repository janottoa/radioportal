const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { processNRKMetadata } = require('./NRKFix.js');
const { processURLMetadata } = require('./URLFix.js');
const express = require('express');
const app = express();
const cors = require('cors');
const stream = require('stream');
const path = require('path');

// Les programm.json
const programData = JSON.parse(fs.readFileSync('programm.json', 'utf-8'));
process.env.LANG = 'nb_NO.UTF-8';

// Middleware
app.use(express.json());

const API_PORT = 5055;
const WEBSOCKET_PORT = 13080;
const METADATA_PORT = 3081;
const constants = require('constants');
let sslOptions;

try {
    sslOptions = {
        key: fs.readFileSync('/var/www/certs/privkey.pem'),
        cert: fs.readFileSync('/var/www/certs/fullchain.pem'),
        ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:AES128-GCM-SHA256:AES256-GCM-SHA384',
        honorCipherOrder: true,
        secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
        secureProtocol: 'TLSv1_2_method'
    };
    console.log('Sertifikater lest inn uten feil');
} catch (error) {
    console.error('Feil ved lesing av sertifikater:', error);
    process.exit(1);
}

// Dagens dato formatert som DD-MM
const now = new Date();
const dateString = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

// Bruk dagens dato i filnavnet
const logStream = fs.createWriteStream(`log/proxy.${dateString}.log`, { flags: 'a' });

function logInfo(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}`;
    logStream.write(logMessage + '\n');
    console.log(logMessage);
}
function logError(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;
    logStream.write(logMessage + '\n');
    console.error(logMessage);
}
// ✅ FIKS NASJONALE TEGN (ICE/ISO-8859-1 problem)
function fixEncoding(str) {
    try {
      if (typeof str !== 'string' || !str) return str;
  
      // Trigger kun når teksten ser "UTF-8 bytes tolket som latin1" ut:
      // Eksempler: BjÃ¶rk, RÃ¸yksopp, Guns Nâ€™ Roses, â€“
      const looksMojibake = /[ÃÂ]|â€/.test(str) || str.includes('\uFFFD');
      if (!looksMojibake) return str;
  
      // Reparasjon for mojibake: utf8 -> latin1
      const fixed = Buffer.from(str, 'utf8').toString('latin1');
  
      // Bruk kun hvis det ikke introduserer erstatningstegn
      if (fixed && fixed !== str && !fixed.includes('\uFFFD')) {
        logInfo(`Fixed encoding: "${str}" -> "${fixed}"`);
        return fixed;
      }
  
      return str;
    } catch (e) {
      logError(`Encoding fix error: ${e.message}`);
      return str;
    }
  }
// Global variabler for metadata-håndtering
let scriptCheckInterval = null;
const activeScriptStreams = new Map();
let currentStreamId = null;
let metadataFetcherClient = null;
let currentFffmpegProcess = null;
let currentStreamUrl = null;

function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
}

 
// Funksjon for å oppdatere metadata fra alle aktive script-strømmer
async function updateScriptMetadata() {
    if (activeScriptStreams.size === 0) {
        console.log('Ingen aktive script-strømmer å oppdatere metadata for');
        return;
    }
    
    console.log(`Oppdaterer metadata for ${activeScriptStreams.size} aktive script-strømmer...`);
    
    for (const [streamId, stream] of activeScriptStreams.entries()) {
        try {
            if (stream.wsClient.readyState !== WebSocket.OPEN) {
                console.log(`WebSocket for streamId=${streamId} er ikke lenger åpen, fjerner...`);
                activeScriptStreams.delete(streamId);
                continue;
            }
            
            console.log(`Henter oppdatert metadata for streamId=${streamId} (${stream.scriptName})...`);
            
            const newMetadata = await stream.scriptModule.getBBCMetadata();
            
            if (newMetadata && newMetadata.artist && newMetadata.title) {
                const lastMetadata = stream.lastMetadata;
                const hasChanged = !lastMetadata || 
                                  lastMetadata.artist !== newMetadata.artist || 
                                  lastMetadata.title !== newMetadata.title;
                
                if (hasChanged) {
                    console.log(`Ny metadata for streamId=${streamId}: ${newMetadata.artist} - ${newMetadata.title}`);
                    
                    stream.lastMetadata = newMetadata;
                    
                    if (currentFffmpegProcess) {
                        const streamTitle = `${newMetadata.artist} - ${newMetadata.title}`;
                        const simulatedOutput = `Metadata update for StreamTitle: ${streamTitle}`;
                        console.log(`Sender simulert metadata: ${simulatedOutput}`);
                        currentFffmpegProcess.stderr.emit('data', Buffer.from(simulatedOutput));
                    }
                } else {
                    console.log(`Ingen endring i metadata for streamId=${streamId}`);
                }
            } else {
                console.log(`Kunne ikke hente gyldig metadata for streamId=${streamId}`);
            }
        } catch (error) {
            console.error(`Feil ved oppdatering av metadata for streamId=${streamId}:`, error);
        }
    }
}

async function processUrl(streamUrl, wsClient, providedScriptName = null) {
    console.log(`Behandler streamUrl: ${streamUrl}`);
    let streamId = null;
    let channelUrl = null;
    
    // ✅ SJEKK OM STASJON HAR PLANETRADIO CHANNEL URL
    try {
        const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf8'));
        
        for (const category in stationsData) {
            if (Array.isArray(stationsData[category])) {
                const station = stationsData[category].find(s => s.url === streamUrl);
                
                if (station && station.channelUrl) {
                    logInfo(`✅ Fant channelUrl for ${station.name}: ${station.channelUrl}`);
                    channelUrl = station.channelUrl;
                    streamId = generateUniqueId();
                    
                    // Start Planetradio polling
                    await startPlanetradioPolling(streamUrl, channelUrl, wsClient);
                    
                    return {
                        url: streamUrl,
                        streamId: streamId,
                        isPlanetradio: true,
                        channelUrl: channelUrl
                    };
                }
            }
        }
    } catch (error) {
        logError(`Feil ved lesing av stations.json: ${error.message}`);
    }
    
    // let streamId = null;
    let scriptName = null;
    let scriptModule = null;
    let initialMetadata = null;
    
    if (providedScriptName && typeof providedScriptName === 'string') {
        scriptName = providedScriptName;
        console.log(`Bruker mottatt script-navn: ${scriptName}`);
    } else {
        console.log('Ingen script-navn mottatt, sjekker stations.json...');
        
        try {
            const stationsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'stations.json'), 'utf8'));
            
            console.log('Stations data type:', typeof stationsData);
            
            if (typeof stationsData === 'object' && stationsData !== null) {
                let foundStation = null;
                
                for (const category in stationsData) {
                    if (Array.isArray(stationsData[category])) {
                        console.log(`Sjekker kategori "${category}" med ${stationsData[category].length} stasjoner`);
                        
                        const station = stationsData[category].find(s => 
                            s.url === streamUrl || 
                            (streamUrl && streamUrl.includes(s.url))
                        );
                        
                        if (station) {
                            foundStation = station;
                            console.log(`Stasjon funnet i kategori "${category}":`);
                            console.log('- Navn:', station.name || 'Ukjent');
                            console.log('- URL:', station.url || 'Ingen URL');
                            
                            if (station.app) {
                                console.log('- station.app verdi:', station.app);
                                
                                if (typeof station.app === 'string') {
                                    scriptName = station.app;
                                    console.log(`App definert i stations.json: ${scriptName}`);
                                    break;
                                }
                            } else {
                                console.log('- Ingen app definert for denne stasjonen');
                            }
                        }
                    }
                }
                
                if (!foundStation) {
                    console.log('Ingen matching stasjon funnet for URL:', streamUrl);
                }
            } else {
                console.log('stations.json er ikke et objekt');
            }
        } catch (error) {
            console.error('Feil ved lesing eller parsing av stations.json:', error);
        }
    }
    
    if (scriptName && scriptName.endsWith('.js')) {
        try {
            const scriptPath = path.join(__dirname, 'apps', scriptName);
            console.log(`Sjekker om script finnes: ${scriptPath}`);
            
            if (fs.existsSync(scriptPath)) {
                console.log(`Script ${scriptName} funnet! Klar til å bruke for metadata.`);
                
                try {
                    scriptModule = require(scriptPath);
                    
                    if (typeof scriptModule.getBBCMetadata === 'function') {
                        console.log('Fant getBBCMetadata-funksjon i scriptet');
                        
                        console.log('Henter initial metadata fra scriptet...');
                        try {
                            initialMetadata = await scriptModule.getBBCMetadata();
                            
                            if (initialMetadata && initialMetadata.artist && initialMetadata.title) {
                                console.log(`Initial metadata hentet: ${initialMetadata.artist} - ${initialMetadata.title}`);
                                streamId = generateUniqueId();
                                
                                activeScriptStreams.set(streamId, {
                                    scriptName,
                                    scriptModule,
                                    wsClient,
                                    url: streamUrl,
                                    lastMetadata: initialMetadata
                                });
                                
                                if (!scriptCheckInterval) {
                                    console.log('Starter periodisk metadata-sjekk...');
                                    scriptCheckInterval = setInterval(updateScriptMetadata, 60000);
                                }
                            } else {
                                console.log('Ingen gyldig initial metadata mottatt fra script');
                            }
                        } catch (metadataError) {
                            console.error('Feil ved henting av initial metadata:', metadataError);
                        }
                    } else {
                        console.log(`Advarsel: ${scriptName} mangler getBBCMetadata-funksjon`);
                    }
                } catch (error) {
                    console.error(`Feil ved lasting av script ${scriptName}:`, error);
                    scriptName = null;
                }
            } else {
                console.log(`Script ${scriptName} finnes ikke i apps-mappen!`);
                scriptName = null;
            }
        } catch (error) {
            console.error('Feil ved sjekking av script:', error);
            scriptName = null;
        }
    }
    
    console.log(`App definert i stations.json: ${scriptName || 'ingen'}`);
    
    return {
        url: streamUrl,
        streamId: streamId,
        scriptName: scriptName,
        initialMetadata: initialMetadata
    };
}

function stopStream(streamId) {
    if (activeScriptStreams.has(streamId)) {
        activeScriptStreams.delete(streamId);
        console.log(`Script-strøm ${streamId} stoppet. Gjenværende strømmer: ${activeScriptStreams.size}`);

        if (activeScriptStreams.size === 0) {
            console.log('Stopper script metadata-polling - ingen aktive strømmer');
            clearInterval(scriptCheckInterval);
            scriptCheckInterval = null;
        }
    } else {
        console.log(`Fant ikke script-strøm med ID ${streamId} for å stoppe`);
    }
}

// WebSocket server med SSL
const wss = new WebSocket.Server({
    port: WEBSOCKET_PORT,
    sslOptions
});
console.log(`WebSocket server listening on port ${WEBSOCKET_PORT}`);

const metadataWss = new WebSocket.Server({ port: METADATA_PORT });
console.log(`Metadata WebSocket server listening on port ${METADATA_PORT}`);

metadataWss.on('connection', (ws) => {
    metadataFetcherClient = ws;
    logInfo('MetadataFetcher tilkoblet.');

    ws.on('close', () => {
        metadataFetcherClient = null;
        logInfo('MetadataFetcher frakoblet.');
    });
});

wss.on('connection', (ws, req) => {
    console.log('Headers:', req.headers);
    console.log('Upgrade:', req.headers.upgrade);
    console.log('Sec-WebSocket-Key:', req.headers['sec-websocket-key']);
    console.log('Ny tilkobling fra frontend-klient.');

    ws.on('message', async (message) => {
        const messageStr = message.toString().trim();
        let streamUrl;
        let stationScriptName = null;
        
        try {
            const data = JSON.parse(messageStr);
            if (data && data.url) {
                streamUrl = data.url;
                
                console.log('data.app type:', typeof data.app);
                console.log('data.app verdi:', data.app);
                
                if (data.app !== undefined) {
                    if (typeof data.app === 'string') {
                        stationScriptName = data.app;
                        console.log(`App-verdi (string): "${stationScriptName}"`);
                    } else if (typeof data.app === 'object') {
                        console.log('App-verdi er et objekt:', JSON.stringify(data.app));
                    }
                }
                
                console.log(`Mottatt URL fra JSON: ${streamUrl}`);
                console.log(`Script navn fra JSON: ${stationScriptName || 'ingen'}`);
            } else {
                streamUrl = messageStr;
                console.log(`Mottatt URL (legacy format): ${streamUrl}`);
            }
        } catch (e) {
            streamUrl = messageStr;
            console.log(`Mottatt URL (plain text): ${streamUrl}`);
        }

        if (!streamUrl || streamUrl.length === 0) {
            logError('❌ Mottatt tom eller ugyldig streamUrl!');
            return;
        }

        if (streamUrl === currentStreamUrl) {
            logError(`⚠️ Stream URL allerede valgt: ${streamUrl}`);
            return;
        }

        try {
            console.log('🔄 Kaller processUrl()...');
            const result = await processUrl(streamUrl, ws, stationScriptName);

            if (!result || !result.url) {
                logError('❌ Ugyldig resultat fra processUrl():', result);
                return;
            }

            logInfo(`🎵 Starter ny prosess for: ${result.url}`);
            await startFffmpegProcess(result, ws);
        } catch (error) {
            logError('🔥 Feil ved behandling av strøm:', error);
        }
    });

    ws.on('close', () => {
        logInfo('WebSocket forbindelse lukket. Stopper alle prosesser.');
        stopFffmpegProcess();
    });
});

async function fetchAlbumCover(artist, track) {
    try {
        logInfo(`Henter data fra Deezer: ${artist}, tittel: ${track}`);
        
        const response = await axios.get(
            `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}" track:"${encodeURIComponent(track)}"&limit=1`
        );

        if (response.data.data && response.data.data.length > 0) {
            const deezerTrack = response.data.data[0];
            
            const deezerData = {
                // === EKSISTERENDE ===
                album_cover: deezerTrack.album.cover_xl,
                track_deezer_id: deezerTrack.id,
                album_name: deezerTrack.album.title,
                album_id: deezerTrack.album.id,
                duration_ms: deezerTrack.duration * 1000,
                artists: [{ name: deezerTrack.artist.name }],
                release_date: deezerTrack.album.release_date || null,
                
                // === NYE FELTER ===
                artist_picture: deezerTrack.artist.picture_xl,
                artist_id: deezerTrack.artist.id,
                popularity: deezerTrack.rank || null,
                explicit_lyrics: deezerTrack.explicit_lyrics || false,
                preview: deezerTrack.preview || null
            };
            
            logInfo(`Deezer data hentet: ${JSON.stringify(deezerData)}`);
            return deezerData;
        } else {
            logInfo(`Ingen resultat fra Deezer for: ${artist} - ${track}`);
            return null;
        }
    } catch (error) {
        logError(`Feil ved henting fra Deezer: ${error.message}`);
        return null;
    }
}

// ✅ NY FUNKSJON - Hent lyrics fra Musixmatch
// ✅ NY FUNKSJON - Hent lyrics fra lyrics-api.ovh (GRATIS)
// ✅ NY FUNKSJON - Hent lyrics fra lyrics-api.ovh (GRATIS)
async function fetchLyrics(artist, title) {
    try {
        // Rens artist-navn - fjern featuring, &, etc
        let cleanArtist = artist
            .split(/\s+(?:feat\.|featuring|&|ft\.)/i)[0]
            .trim();
        
        logInfo(`Henter lyrics: ${cleanArtist} - ${title}`);
        
        // Lyrics-API - GRATIS, ingen nøkkel trengs!
        const response = await axios.get(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(title)}`
        );

        if (response.data && response.data.lyrics) {
            const lyricsText = response.data.lyrics;
            const lyricsLines = lyricsText
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            logInfo(`✅ Lyrics hentet: ${lyricsLines.length} linjer`);
            
            return {
                hasLyrics: true,
                lyricsText: lyricsText,
                lyricsLines: lyricsLines
            };
        } else {
            logInfo(`⚠️ Ingen lyrics funnet for: ${cleanArtist} - ${title}`);
            return {
                hasLyrics: false,
                lyricsLines: []
            };
        }
    } catch (error) {
        logError(`Feil ved henting av lyrics: ${error.message}`);
        return {
            hasLyrics: false,
            lyricsLines: []
        };
    }
}
async function startFffmpegProcess(result, ws) {
    stopFffmpegProcess();

    currentStreamId = result.streamId || null;
    let streamUrl = result.url.trim();
    currentStreamUrl = streamUrl;
    let ffmpeg;

    if (result.initialMetadata && currentStreamId) {
        console.log(`Planlegger sending av initial metadata: ${result.initialMetadata.artist} - ${result.initialMetadata.title}`);
    }

    function spawnFffmpeg() {
        ffmpeg = spawn('ffmpeg', [
            '-headers', 'Authorization: Basic bW9mZmE6bWluYmls',
            '-i', streamUrl,
            '-af', 'loudnorm=i=-16:tp=-1.5:lra=11',
            '-vn',
            '-loglevel', 'debug',
            '-f', 'null', '-'
        ]);

        currentFffmpegProcess = ffmpeg;

        if (result.initialMetadata && currentStreamId) {
            setTimeout(() => {
                if (currentFffmpegProcess) {
                    const streamTitle = `${result.initialMetadata.artist} - ${result.initialMetadata.title}`;
                    const simulatedOutput = `Metadata update for StreamTitle: ${streamTitle}`;
                    console.log(`Sender initial metadata: ${streamTitle}`);
                    currentFffmpegProcess.stderr.emit('data', Buffer.from(simulatedOutput));
                }
            }, 1000);
        }

        ffmpeg.stderr.on('data', async (data) => {
            const output = data.toString();
            const titleMatch = output.match(/Metadata update for StreamTitle:\s*(.*)/);
            const imageMatch = output.match(/https?:\/\/[^\s]+/);
         // ✅ HVIS PLANETRADIO - IGNORER ALT
    if (result.isPlanetradio) {
        return;
    }
            if (titleMatch) {
                let streamTitle = titleMatch[1].trim();
                
                // ✅ LEGG TIL DENNE LINJEN
                streamTitle = fixEncoding(streamTitle);
                
                streamTitle = streamTitle.split('||')[0].trim();
                
                const originalImageUrl = imageMatch ? imageMatch[0].trim() : null;
            
                let processedMetadata = processURLMetadata(streamTitle);
                logInfo(`Prosesserte metadata (URLFix): ${JSON.stringify(processedMetadata)}`);
            
                const nrkMetadata = processNRKMetadata(streamTitle);
                logInfo(`Prosessert metadata (NRKFix): ${JSON.stringify(nrkMetadata)}`);
            
                if (nrkMetadata.title || nrkMetadata.artist) {
                    processedMetadata = nrkMetadata;
                }
            
                const trackInfoMatch = streamTitle.match(/(.*)\s*\/\s*(.*)/);
                let title, artist;
            
                if (trackInfoMatch) {
                    title = fixEncoding(trackInfoMatch[1].trim());  // ✅ LEGG TIL
                    artist = fixEncoding(trackInfoMatch[2].trim()); // ✅ LEGG TIL
                } else {
                    title = fixEncoding(processedMetadata.title || streamTitle);  // ✅ LEGG TIL
                    artist = fixEncoding(processedMetadata.artist || null);       // ✅ LEGG TIL
                }
            
                let deezerData = null;
                if (artist && title && !title.includes('Metadata update for StreamUrl')) {
                    deezerData = await fetchAlbumCover(artist, title);
                }
            
                // ✅ NY - Hent lyrics
                let lyricsData = null;
                if (artist && title) {
                    lyricsData = await fetchLyrics(artist, title);
                } else {
                    lyricsData = { hasLyrics: false, lyricsLines: [] };
                }
                
                // Resten av koden...

                const metadata = {
                    original: {
                        StreamTitle: streamTitle,
                        imageUrl: originalImageUrl,
                        program: processedMetadata.program,
                        title: processedMetadata.title || title,
                        artist: processedMetadata.artist || artist
                    },
                    deezer: deezerData ? {
                        albumCover: deezerData.album_cover,
                        trackDeezerId: deezerData.track_deezer_id,
                        albumName: deezerData.album_name,
                        albumId: deezerData.album_id,
                        artists: deezerData.artists,
                        artistPicture: deezerData.artist_picture,
                        artistId: deezerData.artist_id,
                        releaseDate: deezerData.release_date,
                        duration: deezerData.duration_ms,
                        popularity: deezerData.popularity,
                        explicit: deezerData.explicit_lyrics,
                        preview: deezerData.preview
                    } : null,
                    // ✅ NY - Lyrics data
                    lyrics: {
                        hasLyrics: lyricsData.hasLyrics,
                        lyricsLines: lyricsData.lyricsLines || []
                    },
                    StreamTitle: streamTitle,
                    imageUrl: originalImageUrl || (deezerData ? deezerData.album_cover : null),
                    program: processedMetadata.program,
                    title: processedMetadata.title || title,
                    artist: processedMetadata.artist || artist,
                    album: deezerData ? deezerData.album_name : null,
                    albumId: deezerData ? deezerData.album_id : null,
                    trackDeezerId: deezerData ? deezerData.track_deezer_id : null,
                    artistPicture: deezerData ? deezerData.artist_picture : null,
                    artistId: deezerData ? deezerData.artist_id : null,
                    duration: deezerData ? deezerData.duration_ms : null,
                    releaseDate: deezerData ? deezerData.release_date : null,
                    popularity: deezerData ? deezerData.popularity : null,
                    explicit: deezerData ? deezerData.explicit_lyrics : false,
                    preview: deezerData ? deezerData.preview : null
                };

                if (!deezerData && processedMetadata.program) {
                    const matchedProgram = programData.find(
                        (p) => p.program && p.program.toLowerCase() === processedMetadata.program.toLowerCase()
                    );
                    if (matchedProgram && matchedProgram.logo) {
                        metadata.imageUrl = matchedProgram.logo;
                    }
                }

                logInfo("Metadata klart til sending:");
                for (const [key, value] of Object.entries(metadata)) {
                    logInfo(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
                }

                ws.send(JSON.stringify(metadata));
            }

            handleStreamUrl(output, ws);
        });

        ffmpeg.on('error', (error) => {
            logError(`FFmpeg error: ${error.message}`);
        });

        ffmpeg.on('close', (code) => {
            logInfo(`FFmpeg process avsluttet med kode: ${code}`);
        });
    }

    spawnFffmpeg();

    ws.on('close', () => {
        stopFffmpegProcess();
    });
}

function stopFffmpegProcess() {
    if (currentFffmpegProcess) {
        logInfo('Avslutter pågående ffmpeg-prosess.');
        currentFffmpegProcess.kill('SIGKILL');
        currentFffmpegProcess = null;
        currentStreamUrl = null;
        
        if (currentStreamId) {
            stopStream(currentStreamId);
            currentStreamId = null;
        }

        if (scriptCheckInterval) {
            console.log('Tvinger stopp av metadata-polling.');
            clearInterval(scriptCheckInterval);
            scriptCheckInterval = null;
        }
    }
}

function handleStreamUrl(output, ws) {
    const urlMatch = output.match(/Metadata update for StreamUrl:\s*(https:\/\/listenapi\.planetradio\.co\.uk\/api9\.2\/eventdata\/\d+)/);
    if (urlMatch) {
        const planetradioUrl = urlMatch[1];
        logInfo(`Planetradio URL funnet: ${planetradioUrl}`);
        fetchPlanetradioMetadata(planetradioUrl, ws);
    }
}

// ✅ PLANETRADIO API POLLING
let planetradioPollers = new Map();

async function startPlanetradioPolling(streamUrl, channelUrl, ws) {
    logInfo(`🎙️ Starter Planetradio polling: ${channelUrl}`);
    logInfo(`📡 WebSocket mottatt: ${ws ? 'JA' : 'NULL'}`);
    logInfo(`📡 WebSocket readyState: ${ws ? ws.readyState : 'N/A'}`);
    
    let lastTrackId = null;
    
    const pollInterval = setInterval(async () => {
        try {
            const response = await axios.get(channelUrl);
            const data = response.data;
            
            if (data && data.TrackId) {
                if (data.TrackId !== lastTrackId) {
                    lastTrackId = data.TrackId;
                    logInfo(`🎵 SANG ENDRET: ${data.ArtistName} - ${data.TrackTitle}`);
                    
                    const artist = fixEncoding(data.ArtistName || 'Ukjent artist');
                    const title = fixEncoding(data.TrackTitle || 'Ukjent tittel');
                    
                    let deezerData = await fetchAlbumCover(artist, title);
                    
                    if (!deezerData) {
                        logInfo(`⚠️ Bruker Planetradio bildekilde i stedet for Deezer`);
                        deezerData = {
                            album_cover: data.ImageUrl || data.ArtistImageUrl,
                            album_name: null,
                            album_id: null,
                            track_deezer_id: null,
                            release_date: null,
                            duration_ms: data.TrackDuration * 1000,
                            artists: [{ name: artist }],
                            artist_picture: data.ArtistImageUrl,
                            artist_id: data.ArtistId,
                            popularity: null,
                            explicit_lyrics: false,
                            preview: null
                        };
                    }
                    
                    const lyricsData = await fetchLyrics(artist, title);
                    
                    const currentTrack = `${artist} - ${title}`;
                    
                    const metadata = {
                        StreamTitle: currentTrack,
                        title: title,
                        artist: artist,
                        album: deezerData ? deezerData.album_name : null,
                        albumId: deezerData ? deezerData.album_id : null,
                        trackDeezerId: deezerData ? deezerData.track_deezer_id : null,
                        artistPicture: deezerData ? deezerData.artist_picture : null,
                        artistId: deezerData ? deezerData.artist_id : null,
                        duration: deezerData ? deezerData.duration_ms : null,
                        releaseDate: deezerData ? deezerData.release_date : null,
                        popularity: deezerData ? deezerData.popularity : null,
                        explicit: deezerData ? deezerData.explicit_lyrics : false,
                        preview: deezerData ? deezerData.preview : null,
                        imageUrl: deezerData ? deezerData.album_cover : null,
                        deezer: deezerData,
                        lyrics: {
                            hasLyrics: lyricsData.hasLyrics,
                            lyricsLines: lyricsData.lyricsLines || []
                        },
                        planetradio: {
                            trackId: data.TrackId,
                            duration: data.TrackDuration,
                            appleMusicUrl: data.TrackAppleMusicUrl,
                            eventStart: data.EventStart,
                            eventFinish: data.EventFinish
                        }
                    };
                    
                    logInfo(`📤 Vil sende metadata. WebSocket readyState: ${ws ? ws.readyState : 'NULL'}`);
                    logInfo(`📤 WebSocket.OPEN verdi: ${WebSocket.OPEN}`);
                    
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(metadata));
                        logInfo(`✅ Metadata sendt via WebSocket`);
                    } else {
                        logInfo(`❌ FEIL: WebSocket ikke åpen! readyState=${ws ? ws.readyState : 'NULL'}`);
                    }
                }
            }
        } catch (error) {
            logError(`Planetradio API poll feil: ${error.message}`);
        }
    }, 20000);
    
    planetradioPollers.set(streamUrl, pollInterval);
    
    return pollInterval;
}

function stopPlanetradioPolling(streamUrl) {
    if (planetradioPollers.has(streamUrl)) {
        clearInterval(planetradioPollers.get(streamUrl));
        planetradioPollers.delete(streamUrl);
        logInfo(`🛑 Planetradio polling stoppet for: ${streamUrl}`);
    }
}
// === LAGRE SANG TIL FIL ===
app.post('/save-song', async (req, res) => {
    const { artist, title } = req.body;

    if (!artist || !title) {
        logError('Mangler artist eller title');
        return res.status(400).json({ error: 'Mangler artist eller title' });
    }

    try {
        // Opprett katalogen hvis den ikke finnes
        const savedSongsDir = path.join(__dirname, 'saved_songs');
        if (!fs.existsSync(savedSongsDir)) {
            fs.mkdirSync(savedSongsDir, { recursive: true });
            logInfo(`Opprettet katalog: ${savedSongsDir}`);
        }

        // Lag filsti
        const fileName = 'saved_songs.txt';
        const filePath = path.join(savedSongsDir, fileName);

        // Dato og tidspunkt
        const now = new Date();
        const dateTime = now.toISOString().replace('T', ' ').split('.')[0];

        // Format: Artist | Song | Dato og tidspunkt
        const entry = `${artist} | ${title} | ${dateTime}\n`;

        // Legg til i fil
        fs.appendFileSync(filePath, entry, 'utf-8');

        logInfo(`Sang lagret: ${artist} - ${title}`);
        res.json({ 
            success: true, 
            message: `Lagret: ${artist} - ${title}`,
            savedAt: dateTime
        });
    } catch (error) {
        logError(`Feil ved lagring av sang: ${error.message}`);
        res.status(500).json({ error: 'Feil ved lagring av sang' });
    }
});

// === HENT ALLE LAGREDE SANGER ===
app.get('/get-saved-songs', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'saved_songs', 'saved_songs.txt');

        if (!fs.existsSync(filePath)) {
            return res.json({ songs: [] });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        const songs = lines.map(line => {
            const parts = line.split(' | ');
            return {
                artist: parts[0] || '',
                title: parts[1] || '',
                savedAt: parts[2] || ''
            };
        });

        logInfo(`Hentet ${songs.length} lagrede sanger`);
        res.json({ songs });
    } catch (error) {
        logError(`Feil ved lesing av lagrede sanger: ${error.message}`);
        res.status(500).json({ error: 'Feil ved lesing av lagrede sanger' });
    }
});

// === SLETT LAGRET SANG ===
app.post('/delete-saved-song', async (req, res) => {
    const { artist, title } = req.body;

    if (!artist || !title) {
        logError('Mangler artist eller title for sletting');
        return res.status(400).json({ error: 'Mangler artist eller title' });
    }

    try {
        const filePath = path.join(__dirname, 'saved_songs', 'saved_songs.txt');

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Ingen lagrede sanger' });
        }

        let content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        // Filtrer bort linjen som skal slettes
        const filteredLines = lines.filter(line => {
            if (!line.trim()) return true;
            const parts = line.split(' | ');
            return !(parts[0] === artist && parts[1] === title);
        });

        fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf-8');

        logInfo(`Slettet: ${artist} - ${title}`);
        res.json({ success: true, message: `Slettet: ${artist} - ${title}` });
    } catch (error) {
        logError(`Feil ved sletting av sang: ${error.message}`);
        res.status(500).json({ error: 'Feil ved sletting av sang' });
    }
});

app.get('/metadata', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        logError("Ingen URL spesifisert i forespørselen.");
        return res.status(400).json({ error: 'Ingen URL spesifisert' });
    }

    logInfo(`Forespørsel mottatt for metadata-url: ${url}`);

    try {
        const metadata = await fetchPlanetradioMetadata(url);
        logInfo(`Metadata hentet for ${url}: ${JSON.stringify(metadata)}`);
        res.json(metadata);
    } catch (error) {
        logError(`Feil ved henting av metadata for ${url}: ${error.message}`);
        res.status(500).json({ error: 'Feil ved henting av metadata' });
    }
});

// === STATUS ENDPOINT ===
app.get('/status', (req, res) => {
    const status = {
        timestamp: new Date().toISOString(),
        currentStreamUrl: currentStreamUrl || 'Ingen aktiv strøm',
        currentStreamId: currentStreamId || 'Ingen',
        activeScriptStreams: activeScriptStreams.size,
        ffmpegRunning: currentFffmpegProcess ? 'Ja' : 'Nei',
        websocketConnections: wss.clients ? wss.clients.size : 0,
        uptime: Math.floor(process.uptime()),
        message: '✅ Proxy kjører normalt'
    };
    
    logInfo(`Status forespørsel: ${JSON.stringify(status)}`);
    res.json(status);
});
app.listen(API_PORT, () => {
    logInfo(`Metadata API kjører på http://localhost:${API_PORT}`);
});