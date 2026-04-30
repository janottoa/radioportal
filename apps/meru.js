const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Configuration
const PLAYLIST_URL = 'https://onlineradiobox.com/es/los40/?cs=es.los40';
const CACHE_FILE = path.join(__dirname, 'los40-es-cache.json');
const REQUEST_TIMEOUT = 8000; // 8 seconds timeout

// Simple logging with timestamp
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] [NRJ] ${message}`);
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

// Main function to fetch metadata on demand
async function getBBCMetadata() {
    const cache = loadCache();
    
    try {
        log('Starter henting av metadata fra OnlineRadioBox...');
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
        const html = response.data;
        
        log('Søker etter nyeste sang i spillelisten...');
        const $ = cheerio.load(html);
        const firstTrackRow = $('tr').first();
        const trackData = firstTrackRow.find('.track_history_item').first().text().trim();
        const timestamp = firstTrackRow.find('.tablelist-schedule__time .time--schedule').text().trim();
        
        log(`Funnet øverste spillelisteelement: "${trackData}" spilt ${timestamp}`);
        
        // Default values
        let artist = 'BBC Radio One';
        let title = 'Current Track';
        
        // Parse artist and title
        if (trackData && trackData.includes(' - ')) {
            const parts = trackData.split(' - ');
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
            log(`Parsert artist: "${artist}", tittel: "${title}"`);
        }
        
        const metadata = {
            artist,
            title,
            streamTitle: `${artist} - ${title}`,
            timestamp,
            retrievedAt: new Date().toISOString()
        };
        
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
            artist: 'BBC Radio One',
            title: 'Current Track',
            streamTitle: 'BBC Radio One - Current Track',
            error: true
        };
    }
}

// Helper function - check if URL is a BBC Radio 1 URL
function isBBCRadio1Url(url) {
    return url && (
        url.includes('radiomruiloveyou')
        
    );
}

// Export functions
module.exports = {
    getBBCMetadata,
    isBBCRadio1Url,
    
    // Function for processing URL with metadata
    processBBCUrl: async function(url) {
        const metadata = await getBBCMetadata();
        return {
            success: true,
            metadataUrl: `${url}?StreamTitle=${encodeURIComponent(metadata.streamTitle)}`,
            metadata: metadata
        };
    }
};




// If run directly (for testing)
if (require.main === module) {
    log('BBC Metadata CLI starter...');
    getBBCMetadata().then(metadata => {
        console.log('\n========== BBC RADIO 1 NOW PLAYING ==========');
        console.log(`Tidspunkt: ${metadata.timestamp || 'ukjent'}`);
        console.log(`Artist: ${metadata.artist}`);
        console.log(`Tittel: ${metadata.title}`);
        console.log(`Stream Title: ${metadata.streamTitle}`);
        console.log('===========================================\n');
    });
}