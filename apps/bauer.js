const { exec } = require('child_process');
const path = require('path');

// Konfigurasjon
const FALLBACK_URL = 'https://radioplay.no/radio-norge/play/';

// Logging med tidsstempel
function log(message) {
    const now = new Date();
    const timestamp = now.toISOString();
    console.log(`[${timestamp}] ${message}`);
}

// Funksjon for å hente HTML fra fallback-URL
async function fetchFallbackData() {
    log(`Henter programnavn fra: ${FALLBACK_URL}`);
    return new Promise((resolve, reject) => {
        exec(`curl -s "${FALLBACK_URL}"`, (error, stdout) => {
            if (error) {
                log(`Feil ved henting: ${error.message}`);
                reject(error);
            } else {
                resolve(stdout); // HTML-innhold fra nettsiden
            }
        });
    });
}




// Funksjon for å analysere HTML og trekke ut programnavn
function parseProgramTitle(html) {
    try {
        log("Parser programnavn fra HTML...");

        // Match hele innholdet i <span data-test="on-air-now-component">
        const programMatch = html.match(/<span data-test="on-air-now-component".*?>(.*?)<\/span>/);
        let title = programMatch ? programMatch[1].trim() : 'Ukjent program';

        // Fjerne alt før og inkludert ">" fra linjen
        const indexOfArrow = title.indexOf('>'); 
        if (indexOfArrow !== -1) {
            title = title.slice(indexOfArrow + 1).trim();
        }

        log(`Renset programnavn: "${title}"`);
        return title;
    } catch (error) {
        log(`Feil under parsing: ${error.message}`);
        return 'Ukjent program';
    }
}


function parseFallbackData(html) {
    try {
        log("Parser HTML fra fallback...");

        // Hent det direktesendte programmet fra data-test-attributtet
        const programMatch = html.match(/<span data-test="on-air-now-component".*?>(.*?)<\/span>/);
        let title = programMatch ? programMatch[1].trim() : 'Ukjent program';

        // Fjern "Direkte nå:" og eventuelle HTML-kommentarer
        title = title.replace(/Direkte nå:[\s\S]*?>\s*/, '').replace(/<!--.*?-->/g, '').trim();

        log(`Renset programnavn: "${title}"`);
        return title;
    } catch (error) {
        log(`Feil under parsing: ${error.message}`);
        return 'Ukjent program';
    }
}
// Hovedfunksjon for URLFix
async function handleURLFix(streamUrl) {
    if (streamUrl === "https://listenapi.planetradio.co.uk/api9.2/eventdata/-1") {
        log("Ugyldig URL. Henter fallback...");
        try {
            const html = await fetchFallbackData(); // Hent HTML
            const programTitle = parseProgramTitle(html); // Hent programnavn
            return { success: true, program: programTitle };
        } catch (error) {
            log(`Fallback-feil: ${error.message}`);
            return { success: false, program: 'Ukjent program' };
        }
    }

    return { success: true, program: null }; // Ingen fallback nødvendig
}

// Eksporter funksjoner
module.exports = {
    handleURLFix
};

// Testmodus
if (require.main === module) {
    log("Starter URLFix test...");
    handleURLFix("https://listenapi.planetradio.co.uk/api9.2/eventdata/-1").then(result => {
        console.log("\n========== RESULTAT ==========");
        console.log(`Programnavn: ${result.program}`);
        console.log("==============================\n");
    });
}
