const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Konfigurasjon
const FALLBACK_URL = 'https://radioplay.no/radio-norge/play/';
const CACHE_FILE = path.join(__dirname, 'radionorge-metadata-cache.json');
const REQUEST_TIMEOUT = 8000; // 8 sekunders timeout

// Logging
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] [Radio Norge] ${message}`);
}

// Lagre cache til fil
function saveCache(data) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
        log('Metadata cache lagret.');
    } catch (error) {
        log(`Feil ved lagring av cache: ${error.message}`);
    }
}

// Last cache fra fil
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const cacheData = fs.readFileSync(CACHE_FILE, 'utf8');
            log('Metadata cache lastet.');
            return JSON.parse(cacheData);
        }
    } catch (error) {
        log(`Feil ved lasting av cache: ${error.message}`);
    }
    return null;
}

// Funksjon for å fjerne "Direkte nå:" fra tekst
function removePrefixFromText(text) {
    // Sjekk om teksten inneholder "Direkte nå:" og fjern det
    return text.replace(/^Direkte nå:\s*/i, '');
}

// Hent og prosesser metadata
async function getRadioNorgeMetadata() {
    // Prøv å laste cache først
    const cachedData = loadCache();

    try {
        log(`Henter metadata fra ${FALLBACK_URL}`);
        const response = await axios.get(FALLBACK_URL, { timeout: REQUEST_TIMEOUT });
        const html = response.data;
        const $ = cheerio.load(html);

        // Ekstrakter metadata
        const streamTitle = $('span[data-test="on-air-now-component"]').text().trim();
        log(`Rå streamTitle: ${streamTitle}`);

        // Fjern "Direkte nå:" og del opp i program og tittel
        const cleanedStreamTitle = removePrefixFromText(streamTitle);
        log(`Renset streamTitle: ${cleanedStreamTitle}`);

        // Del opp i program og tittel/artist
        const [program, titleAndArtist] = cleanedStreamTitle.includes(':') 
            ? cleanedStreamTitle.split(':').map(part => part.trim()) 
            : [cleanedStreamTitle, null];

        log(`Program: ${program}, Tittel/Artist: ${titleAndArtist}`);

        // Forsøk å dele tittel/artist
        let title = null;
        let artist = null;

        if (titleAndArtist) {
            if (titleAndArtist.includes('-')) {
                const parts = titleAndArtist.split('-').map(part => part.trim());
                title = parts[0];
                artist = parts[1] || null;
                log(`Tittel: ${title}, Artist: ${artist}`);
            } else {
                // Hvis det ikke er "-", bruk hele strengen som tittel
                title = titleAndArtist;
                artist = null;
                log(`Tittel (uten artist): ${title}`);
            }
        } else {
            // Ingen tittel/artist tilgjengelig, sett til programnavn
            artist = 'Program';
           title = program;
            log(`Ingen tittel/artist, standardverdier brukes - Program: ${program}`);
        }

        // Sett opp metadata
        const metadata = {
            program: program || 'Ukjent program',
            title: title || 'Ukjent tittel',
            artist: artist || 'Ukjent artist',
            imageUrl: null
        };

        saveCache(metadata);
        return metadata;

    } catch (error) {
        log(`Feil ved henting av metadata: ${error.message}`);

        // Returner cache hvis tilgjengelig
        if (cachedData) {
            log('Bruker cachet metadata på grunn av feil');
            return cachedData;
        }

        // Fallback verdier
        return {
            program: 'Radio Norge',
            title: 'Ukjent tittel',
            artist: 'Ukjent artist',
            imageUrl: null
        };
    }
}


// Eksporter funksjonen med begge navn for bakoverkompatibilitet
module.exports = { 
    getRadioNorgeMetadata,      // Korrekt navn
    getBBCMetadata: getRadioNorgeMetadata  // For bakoverkompatibilitet
};

// Testmodus
if (require.main === module) {
    log('Starter metadatahenting...');
    getRadioNorgeMetadata().then(metadata => {
        console.log('\n========== RADIO NORGE METADATA ==========');
        console.log(`Program: ${metadata.program}`);
        console.log(`Title: ${metadata.title}`);
        console.log(`Artist: ${metadata.artist}`);
        console.log(`Image URL: ${metadata.imageUrl}`);
        console.log('==========================================\n');
    });
}
