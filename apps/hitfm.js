const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// --- Konfigurasjon for Hit FM Spain (med Puppeteer) ---
const PLAYER_URL = 'https://www.hitfm.es/player/';
// Alternativt, hvis hovedsiden ikke fungerer, kan du prøve:
// const PLAYER_URL = 'https://www.hitfm.es/player/WebSocketClient2.html';
const CACHE_FILE = path.join(__dirname, 'hitfm_es_cache.json');
const REQUEST_TIMEOUT = 20000; // Økt timeout for nettleserstart og lasting
const BROWSER_TIMEOUT = 40000; // Generell timeout for nettleseroperasjoner
const INITIAL_WAIT_MS = 6000;  // Ventetid etter lasting for JS
const ADDITIONAL_WAIT_MS = 2000; // Ytterligere ventetid

// Enkel logging med tidsstempel
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] [HITFM-PUP] ${message}`);
}

// Sikker cache-lesing
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

// Sikker cache-skriving
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

// Hovedfunksjon for å hente metadata fra Hit FM Spain med Puppeteer
async function getBBCMetadata() {
    const cache = loadCache();
    let browser;

    try {
        log('Starter henting av nåværende sang fra Hit FM Spain med Puppeteer...');
        log(`Starter Chromium-nettleser...`);

        // Start en nettleserinstans
        // Legg til --no-sandbox hvis det kjører på en server uten GUI
        browser = await puppeteer.launch({
            headless: true,
            // args: ['--no-sandbox', '--disable-setuid-sandbox'] // Bruk dette på servere hvis nødvendig
        });
        const page = await browser.newPage();

        // Sett timeout for alle operasjoner på siden
        page.setDefaultTimeout(BROWSER_TIMEOUT);

        // Sett brukeragent for å ligne en vanlig nettleser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        log(`Navigerer til ${PLAYER_URL}...`);
        await page.goto(PLAYER_URL, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: REQUEST_TIMEOUT });

        // Vent litt ekstra for å sikre at JavaScript har lastet og oppdatert informasjonen
        // Bruker Nodes setTimeout for maksimal kompatibilitet
        log(`Venter ${INITIAL_WAIT_MS}ms på at siden skal laste ferdig og JavaScript skal kjøre...`);
        await new Promise(resolve => setTimeout(resolve, INITIAL_WAIT_MS));
        log(`Ventet ${INITIAL_WAIT_MS}ms. Fortsetter...`);
        
        // Ytterligere liten ventetid for å sikre lasting
        log(`Venter ${ADDITIONAL_WAIT_MS}ms ytterligere...`);
        await new Promise(resolve => setTimeout(resolve, ADDITIONAL_WAIT_MS));
        log(`Ytterligere ventetid fullført.`);

        // --- Hent data fra siden ---
        log(`Henter sanginformasjon fra nettleserens DOM...`);
        const trackData = await page.evaluate(() => {
            try {
                let title = '';
                let artist = '';
                let coverUrl = '';

                // --- Forsøk 1: Hent fra hovedspilleren (#ahora) ---
                const ahoraSection = document.querySelector('#ahora');
                if (ahoraSection) {
                    const canciónEl = ahoraSection.querySelector('#ahora-cancion');
                    const autorEl = ahoraSection.querySelector('#ahora-autor');
                    const coverImg = ahoraSection.querySelector('#onAirCover'); 
                    
                    title = canciónEl ? canciónEl.textContent.trim() : '';
                    artist = autorEl ? autorEl.textContent.trim() : '';
                    coverUrl = coverImg ? coverImg.src : '';
                    
                    if (title && artist) {
                        console.log("Hentet data fra #ahora");
                        return { title, artist, coverUrl };
                    }
                }

                // --- Forsøk 2: Hent fra WebSocketClient2.html struktur (#tablas) ---
                const tablaSection = document.querySelector('#tablas');
                if (tablaSection) {
                    const firstTable = tablaSection.querySelector('table'); // Finn første tabell
                    if (firstTable) {
                        const titleEl = firstTable.querySelector('#onAirTitle');
                        const artistEl = firstTable.querySelector('#onAirArtist');
                        const coverEl = firstTable.querySelector('#onAirCover'); // Cover fra første tabell
                        
                        title = titleEl ? titleEl.textContent.trim() : '';
                        artist = artistEl ? artistEl.textContent.trim() : '';
                        coverUrl = coverEl ? coverEl.src : '';
                        
                        if (title && artist) {
                            console.log("Hentet data fra #tablas (første tabell)");
                            return { title, artist, coverUrl };
                        }
                    }
                }

                // --- Forsøk 3: Hent fra #tablas med en mer generell tilnærming ---
                // Hvis dupliserte IDer forvirrer, søk etter første gyldige kombinasjon
                const tablasContainer = document.querySelector('#tablas');
                if (tablasContainer) {
                     const tables = tablasContainer.querySelectorAll('table');
                     for (let table of tables) {
                         const titleEl = table.querySelector('label#onAirTitle'); // Mer spesifikk selector
                         const artistEl = table.querySelector('label#onAirArtist');
                         
                         if (titleEl && artistEl && 
                             titleEl.textContent.trim() && 
                             artistEl.textContent.trim()) {
                             
                             title = titleEl.textContent.trim();
                             artist = artistEl.textContent.trim();
                             coverUrl = table.querySelector('img#onAirCover')?.src || '';
                             
                             console.log("Hentet data fra #tablas (generell metode)");
                             return { title, artist, coverUrl };
                         }
                     }
                }
                
                console.error("Fant ikke gyldig sangdata i noen av strukturene");
                return null;
                
            } catch (err) {
                console.error("Feil i page.evaluate:", err.message);
                return null;
            }
        });

        // Lukk nettleseren
        if (browser) {
             await browser.close();
        }

        if (!trackData || (!trackData.title && !trackData.artist)) {
            throw new Error("Kunne ikke hente sangdata fra siden etter JavaScript-kjøring og venting.");
        }

        const { title, artist, coverUrl } = trackData;
        log(`Funnet nåværende sang: "${title}" av "${artist}"`);

        const metadata = {
            artist: artist,
            title: title,
            streamTitle: `${artist} - ${title}`,
            coverUrl: coverUrl || null,
            retrievedAt: new Date().toISOString()
        };

        saveCache(metadata);
        return metadata;

    } catch (error) {
        log(`FEIL ved henting av metadata: ${error.message}`);
        // Forsikre oss om at nettleseren lukkes selv ved feil
        if (browser) {
            try {
                await browser.close();
            } catch (closeErr) {
                log(`FEIL ved lukking av nettleser: ${closeErr.message}`);
            }
        }

        // Returner cache ved feil hvis tilgjengelig
        if (cache.data) {
            log('Bruker cachet data fra tidligere vellykket forespørsel');
            return { ...cache.data, fromCache: true };
        }

        // Fallback hvis ingen cache
        return {
            artist: 'Hit FM Spain',
            title: 'Nå spilles',
            streamTitle: 'Hit FM Spain - Nå spilles',
            coverUrl: null,
            error: true,
            errorMessage: error.message
        };
    }
}

// Hjelpefunksjon - sjekk om URL er Hit FM Spain URL
// Denne må returnere TRUE for HitFM-url'er for at skriptet skal brukes
function isBBCRadio1Url(url) {
    return url && url.includes('hitfm.es');
}

// Eksporter funksjoner
// Viktig: Proxyen forventer sannsynligvis 'processBBCUrl', ikke 'processHitFMUrl'
module.exports = {
    getBBCMetadata,
    isBBCRadio1Url,
    
    // Endret navn til det proxyen forventer
    processBBCUrl: async function(url) {
        const metadata = await getBBCMetadata();
        return {
            success: !metadata.error,
            metadataUrl: `${url}?StreamTitle=${encodeURIComponent(metadata.streamTitle)}`,
            metadata: metadata
        };
    }
    // Fjernet processHitFMUrl da det ikke brukes av proxyen
};

// Hvis skriptet kjøres direkte (for testing)
if (require.main === module) {
    log('Hit FM Spain Metadata CLI (Puppeteer) starter...');
    getBBCMetadata().then(metadata => {
        console.log('\n========== HIT FM SPAIN NOW PLAYING (PUPPETEER) ==========');
        console.log(`Artist: ${metadata.artist}`);
        console.log(`Tittel: ${metadata.title}`);
        console.log(`Stream Title: ${metadata.streamTitle}`);
        if (metadata.coverUrl) {
            console.log(`Cover URL: ${metadata.coverUrl}`);
        }
        if (metadata.fromCache) {
            console.log('(Data fra cache)');
        }
        if (metadata.error) {
            console.log('(Feil oppsto ved henting)');
            console.log(`Feilmelding: ${metadata.errorMessage}`);
        }
        console.log('=========================================================\n');
        // Avslutt prosessen etter kjøring
        process.exit(0);
    }).catch(err => {
        console.error("Uventet feil:", err);
        process.exit(1);
    });
}