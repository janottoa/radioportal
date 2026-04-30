const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const STREAM_URL = 'https://mdstrm.com/audio/632cccdf9234f869e9a51995/live.m3u8';
const OUTPUT_FILE = path.join(__dirname, 'output.txt');
const CACHE_FILE = path.join(__dirname, 'lafm-metadata-cache.json');

// Simple logging with timestamp
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Safe cache reading
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            const cache = JSON.parse(data);
            const timestamp = new Date(cache.timestamp).toLocaleTimeString();
            log(`Lastet cachet metadata fra fil (sist oppdatert: ${timestamp})`);
            return cache;
        }
    } catch (error) {
        log(`Advarsel: Kunne ikke lese cache: ${error.message}`);
    }
    return { data: null, timestamp: 0 };
}

// Safe cache writing
function saveCache(metadata) {
    try {
        const cache = {
            data: metadata,
            timestamp: Date.now()
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
        log(`Metadata lagret til cache-fil`);
    } catch (error) {
        log(`Advarsel: Kunne ikke skrive til cache: ${error.message}`);
    }
}

// Function to fetch metadata using FFmpeg
async function fetchMetadata() {
    return new Promise((resolve, reject) => {
        log('Starter FFmpeg for å hente metadata...');
        exec(`ffmpeg -i "${STREAM_URL}" > ${OUTPUT_FILE} 2>&1`, (error, stdout, stderr) => {
            if (error) {
                log(`Feil under henting av metadata: ${error.message}`);
                log(`FFmpeg stderr: ${stderr}`);
                reject(error);
            } else {
                log(`Metadata hentet og lagret til ${OUTPUT_FILE}`);
                const metadata = parseMetadata();
                resolve(metadata);
            }
        });
    });
}

// Function to parse metadata from file
function parseMetadata() {
    try {
        log('Parsing metadata fra fil...');
        const data = fs.readFileSync(OUTPUT_FILE, 'utf8');
        log(`Innholdet i output.txt: ${data}`);
        const lines = data.split('\n');
        let title = 'Ukjent tittel';
        let streamTitle = 'Ukjent tittel';

        // Søk etter X-STREAM-TITLE i HLS-metadata
        lines.forEach(line => {
            const streamTitleMatch = line.match(/X-STREAM-TITLE="([^"]+)"/);
            if (streamTitleMatch) {
                streamTitle = streamTitleMatch[1].trim();
                title = streamTitle; // Bruk samme verdi for begge felt
            }
        });

        log(`Funnet tittel: "${streamTitle}"`);

        return {
            artist: 'Ukjent artist', // Artist ikke tilgjengelig i denne strømmen
            title: title,
            streamTitle: streamTitle,
            retrievedAt: new Date().toISOString()
        };
    } catch (error) {
        log(`Feil under parsing av metadata: ${error.message}`);
        return {
            artist: 'Ukjent artist',
            title: 'Ukjent tittel',
            streamTitle: 'Ukjent tittel - Ukjent artist',
            error: true
        };
    }
}

// Main function to fetch metadata on demand
async function getLAFMMetadata() {
    const cache = loadCache();

    try {
        const metadata = await fetchMetadata();
        saveCache(metadata);
        return metadata;
    } catch (error) {
        log(`Feil ved henting av metadata: ${error.message}`);

        // Return cache on error if available
        if (cache.data) {
            log('Bruker cachet data fra tidligere vellykket forespørsel');
            return { ...cache.data, fromCache: true };
        }

        // Fallback if no cache
        return {
            artist: 'Ukjent artist',
            title: 'Ukjent tittel',
            streamTitle: 'Ukjent tittel - Ukjent artist',
            error: true
        };
    }
}

// Export functions
module.exports = {
    getLAFMMetadata,

    // Function for processing URL with metadata
    processLAFMUrl: async function(url) {
        const metadata = await getLAFMMetadata();
        return {
            success: true,
            metadataUrl: `${url}?StreamTitle=${encodeURIComponent(metadata.streamTitle)}`,
            metadata: metadata
        };
    }
};

// If run directly (for testing)
if (require.main === module) {
    log('LAFM Metadata CLI starter...');
    getLAFMMetadata().then(metadata => {
        console.log('\n========== NOW PLAYING ==========');
        console.log(`Tidspunkt: ${new Date(metadata.retrievedAt).toLocaleString()}`);
        console.log(`Tittel: ${metadata.title}`);
        console.log(`Stream Title: ${metadata.streamTitle}`);
        console.log('===========================================\n');
    });
}