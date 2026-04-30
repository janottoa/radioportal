const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Configuration
const PLAYLIST_URL = 'https://radio.nrk.no/direkte/p1_sorlandet';
const CACHE_FILE = '/var/www/radioportal/apps/nrk-metadata-cache.json';
const CONFIG_FILE = '/var/www/radioportal/apps/nrk-config.json';
const STATE_FILE = '/var/www/radioportal/apps/nrk-state.json';
const CONFIG_SCRIPT_FILE = '/var/www/radioportal/apps/nrk-config-script.txt';
const STATE_SCRIPT_FILE = '/var/www/radioportal/apps/nrk-state-script.txt';
const REQUEST_TIMEOUT = 8000; // 8 seconds timeout

// Ensure the directory exists
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    fs.mkdirSync(dirname, { recursive: true });
    return true;
}

// Simple logging with timestamp
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] [NRK] ${message}`);
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
        ensureDirectoryExistence(CACHE_FILE);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
        log(`Metadata lagret til cache-fil`);
    } catch (error) {
        log(`Advarsel: Kunne ikke skrive til cache: ${error.message}`);
    }
}

// Function to extract metadata from the HTML response
function extractMetadata(html) {
    const $ = cheerio.load(html);
    const scripts = $('script');

    let nrkRadioConfig = null;
    let preloadedState = null;

    scripts.each((i, script) => {
        const scriptContent = $(script).html();

        if (scriptContent.includes('window.__NRK_RADIO_CONFIG__')) {
            log('Fant __NRK_RADIO_CONFIG__ script');
            ensureDirectoryExistence(CONFIG_SCRIPT_FILE);
            fs.writeFileSync(CONFIG_SCRIPT_FILE, scriptContent, 'utf8');
            log(`Lagrer NRK Radio Config script til ${CONFIG_SCRIPT_FILE}`);
            const configMatch = scriptContent.match(/window\.__NRK_RADIO_CONFIG__\s*=\s*(\{[\s\S]*?\});/);
            if (configMatch) {
                try {
                    nrkRadioConfig = JSON.parse(configMatch[1].replace(/\u002F/g, '/'));
                } catch (e) {
                    log('Feil ved parsing av NRK Radio Config JSON');
                    log(e.message);
                }
                ensureDirectoryExistence(CONFIG_FILE);
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(nrkRadioConfig, null, 2), 'utf8');
                log(`Lagrer NRK Radio Config til ${CONFIG_FILE}`);
            }
        }

        if (scriptContent.includes('window.__PRELOADED_STATE__')) {
            log('Fant __PRELOADED_STATE__ script');
            ensureDirectoryExistence(STATE_SCRIPT_FILE);
            fs.writeFileSync(STATE_SCRIPT_FILE, scriptContent, 'utf8');
            log(`Lagrer Preloaded State script til ${STATE_SCRIPT_FILE}`);
            const stateMatch = scriptContent.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
            if (stateMatch) {
                try {
                    preloadedState = JSON.parse(stateMatch[1].replace(/\u002F/g, '/'));
                } catch (e) {
                    log('Feil ved parsing av Preloaded State JSON');
                    log(e.message);
                }
                ensureDirectoryExistence(STATE_FILE);
                fs.writeFileSync(STATE_FILE, JSON.stringify(preloadedState, null, 2), 'utf8');
                log(`Lagrer Preloaded State til ${STATE_FILE}`);
            }
        }
    });

    if (!nrkRadioConfig || !preloadedState) {
        log('Klarte ikke å finne __NRK_RADIO_CONFIG__ eller __PRELOADED_STATE__ i HTML-responsen');
        throw new Error('NRK configuration or state objects not found in HTML response');
    }

    const metadata = {
        browserLogLevel: nrkRadioConfig.BROWSER_LOG_LEVEL,
        environment: nrkRadioConfig.NODE_ENV,
        host: nrkRadioConfig.HOST,
        releaseNumber: nrkRadioConfig.RELEASE_NUMBER,
        applicationName: nrkRadioConfig.APPLICATION_NAME,
        channels: preloadedState ? preloadedState.liveBuffer.channels.map(channel => ({
            id: channel.id,
            title: channel.title,
            type: channel.type,
            entry: channel.entry ? {
                title: channel.entry.title,
                programId: channel.entry.programId,
                actualStart: channel.entry.actualStart,
                actualEnd: channel.entry.actualEnd,
                duration: channel.entry.duration
            } : null
        })) : []
    };

    return metadata;
}

// Main function to fetch metadata on demand
async function getNRKMetadata() {
    const cache = loadCache();

    try {
        log('Starter henting av metadata fra NRK...');
        log(`Sender forespørsel til ${PLAYLIST_URL}`);

        const response = await axios.get(PLAYLIST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache'
            },
            timeout: REQUEST_TIMEOUT
        });

        log(`Mottok HTTP ${response.status} respons`);
        
        const metadata = extractMetadata(response.data);

        log(`Funnet metadata: ${JSON.stringify(metadata, null, 2)}`);

        saveCache(metadata);
        return metadata;
    } catch (error) {
        log(`FEIL ved henting av metadata: ${error.message}`);

        // Return cache on error if available
        if (cache.data) {
            log('Bruker cachet data fra tidligere vellykket forespørsel');
            return { ...cache.data, fromCache: true };
        }

        // Fallback if no cache
        return {
            error: true,
            message: 'Kunne ikke hente metadata og ingen cache tilgjengelig'
        };
    }
}

// Export functions
module.exports = {
    getNRKMetadata,

    // Function for processing URL with metadata
    processNRKUrl: async function(url) {
        const metadata = await getNRKMetadata();
        return {
            success: true,
            metadataUrl: `${url}?StreamTitle=${encodeURIComponent(metadata.streamTitle)}`,
            metadata: metadata
        };
    }
};

// If run directly (for testing)
if (require.main === module) {
    log('NRK Metadata CLI starter...');
    getNRKMetadata().then(metadata => {
        console.log('\n========== NRK P1 Sørlandet NOW PLAYING ==========');
        console.log(`Metadata: ${JSON.stringify(metadata, null, 2)}`);
        console.log('===========================================\n');
    });
}