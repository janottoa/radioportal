const fs = require('fs');

// Logging-funksjon for URLFix
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('urlfix.log', logMessage, 'utf8');
}

// Funksjon for å prosessere generelle metadata og StreamTitle
function processURLMetadata(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage); // Logg til fil
        return { title: null, artist: null };
    }

    logToFile(`Mottatt metadata: ${rawMetadata}`); // Logg råmetadata

    let title = null;
    let artist = null;

    // Håndterer format: "Tittel / Artist"
    function processURLMetadata(rawMetadata) {
        if (!rawMetadata || typeof rawMetadata !== 'string') {
            const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
            console.warn(warningMessage);
            logToFile(warningMessage); // Logg til fil
            return { title: null, artist: null };
        }

        logToFile(`Mottatt metadata: ${rawMetadata}`); // Logg råmetadata

        let title = null;
        let artist = null;

        // Håndterer format: "Tittel / Artist(er)"
        if (rawMetadata.includes('/')) {
            const parts = rawMetadata.split('/').map(part => part.trim());
            if (parts.length === 2) {
                title = parts[0]; // Første del er tittelen
                artist = parts[1]; // Andre del er artisten(e)
            } else {
                logToFile(`Ukjent format for "/": ${rawMetadata}`);
            }
        }
        // Håndterer format: "Artist - Tittel"
        else if (rawMetadata.includes('-')) {
            const parts = rawMetadata.split('-').map(part => part.trim());
            if (parts.length === 2) {
                artist = parts[0];
                title = parts[1];
            } else {
                logToFile(`Ukjent format for "-": ${rawMetadata}`);
            }
        }
        // Hvis ingen separator finnes
        else {
            title = rawMetadata.trim();
        }

        // Logg og returner resultatet
        const processed = { title, artist };
        logToFile(`Prosesserte metadata: ${JSON.stringify(processed)}`);
        return processed;
    }


    module.exports = { processURLMetadata };

// For testing direkte fra kommandolinjen
if (require.main === module) {
    // Testeksempler
    const sampleMetadata1 = 'StreamTitle: Die With A Smile / Lady Gaga, Bruno Mars';
    const sampleMetadata2 = 'The Doors - Hello, I Love You';
    const processed1 = processURLMetadata(sampleMetadata1);
    const processed2 = processURLMetadata(sampleMetadata2);

    console.log(`Prosesserte metadata 1: ${JSON.stringify(processed1)}`);
    console.log(`Prosesserte metadata 2: ${JSON.stringify(processed2)}`);
}
