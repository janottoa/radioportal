const WebSocket = require('ws');
const fs = require('fs');
const { fetchSpotifyAlbumCover } = require('./spotifyFetcher.js');
const { processNRKMetadata } = require('./NRKFix.js');

// Logger funksjon
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

const PROXY_URL = 'ws://192.168.0.11:3081';
const FRONTEND_PORT = 3082;

// Last stations.json
let stationsData;
try {
    stationsData = JSON.parse(fs.readFileSync('/var/www/radioportal/stations.json', 'utf-8'));
    log('stations.json lastet inn.');
} catch (error) {
    log(`Feil ved lasting av stations.json: ${error.message}`);
    process.exit(1);
}

// Opprett WebSocket-server for frontend
const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });
log(`Frontend WebSocket-server kjører på ws://192.168.0.11:${FRONTEND_PORT}`);

frontendServer.on('connection', (client) => {
    log('Ny tilkobling fra frontend-klient');
    client.on('close', () => log('Frontend-klient tilkobling lukket'));
});

// Prosessering av metadata
async function processMetadata(message) {
    const metadata = {
        stationName: message.stationName || 'Ukjent stasjon',
        StreamTitle: message.StreamTitle,
        imageUrl: null,
        artist: null,
        title: null,
        program: null,
    };

    console.log(`Behandler metadata for stasjon: ${metadata.stationName}`);

    // Behandle NRK-metadata
    if (metadata.StreamTitle) {
        const nrkProcessed = processNRKMetadata(metadata.StreamTitle);
        if (nrkProcessed) {
            metadata.program = nrkProcessed.program;
            metadata.title = nrkProcessed.title;
            metadata.artist = nrkProcessed.artist;
        }
    }

    // Hent albumcover fra Spotify hvis artist og tittel er tilgjengelig
    if (metadata.artist && metadata.title) {
        try {
            console.log(`Henter Spotify-data for: ${metadata.artist} - ${metadata.title}`);
            const spotifyImageUrl = await fetchSpotifyAlbumCover(metadata.artist, metadata.title);
            if (spotifyImageUrl) {
                metadata.imageUrl = spotifyImageUrl;
                console.log(`Spotify-albumcover funnet: ${spotifyImageUrl}`);
            }
        } catch (error) {
            console.log(`Spotify-feil: ${error.message}`);
        }
    }

    return metadata;
}


// Tilkobling til proxy.js
function connectToProxy() {
    const proxySocket = new WebSocket(PROXY_URL);

    proxySocket.on('open', () => log('Koblet til WebSocket-server i proxy.js'));

    proxySocket.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            log(`Mottatt melding fra proxy: ${JSON.stringify(message)}`);

            if (message.StreamTitle) {
                const updatedMetadata = await processMetadata(message);
                sendToFrontend(updatedMetadata);
            } else {
                log('Ingen StreamTitle i melding fra proxy.');
            }
        } catch (error) {
            log(`Feil ved parsing av melding fra proxy: ${error.message}`);
        }
    });

    proxySocket.on('close', () => {
        log('WebSocket-tilkobling til proxy.js lukket. Forsøker på nytt om 5 sekunder...');
        setTimeout(connectToProxy, 5000);
    });

    proxySocket.on('error', (error) => log(`WebSocket-feil: ${error.message}`));
}

// Send metadata til frontend
const sendLogStream = fs.createWriteStream('send.log', { flags: 'a' });


function sendToFrontend(metadata) {
    // Hvis Spotify har levert et albumcover, brukes disse dataene
    if (metadata.artist && metadata.title) {
        console.log(`Bruker data fra Spotify: Artist: ${metadata.artist}, Tittel: ${metadata.title}`);
    } else {
        console.log('Spotify-data mangler, sender standard metadata.');
    }

    // Sett standardverdier for manglende felter
    metadata.imageUrl = metadata.imageUrl || 'https://default-image-url.com/default.jpg';
    metadata.program = metadata.program || 'Ukjent program';
    metadata.artist = metadata.artist || 'Ukjent artist';
    metadata.title = metadata.title || 'Ukjent tittel';

    // Send metadata til frontend
    const message = JSON.stringify(metadata);
    frontendServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log(`Sendte data til frontend: ${message}`);
        }
    });
}

// Start tilkobling til proxy.js
connectToProxy();
