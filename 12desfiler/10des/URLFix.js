const fs = require('fs');

// Logging-funksjon for URLFix
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('urlfix.log', logMessage, 'utf8');
}

// Funksjon for å dele og rydde opp i metadata
function processURLMetadata(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage); // Logg til fil
        return { title: null, artist: null };
    }

    logToFile(`Mottatt metadata: ${rawMetadata}`); // Logg råmetadata

    // Del metadata opp ved bruk av bindestrek ("-")
    const parts = rawMetadata.split('-');

    const artist = parts.length > 1 ? parts[0].trim() : null;
    const title = parts.length > 1 ? parts[1].trim() : rawMetadata.trim();

    const processed = { title, artist };
    logToFile(`Prosesserte metadata: ${JSON.stringify(processed)}`); // Logg prosesserte metadata

    return processed;
}

module.exports = { processURLMetadata };

// For testing direkte fra kommandolinjen
if (require.main === module) {
    const sampleMetadata = 'The Doors - Hello, I Love You';
    const processed = processURLMetadata(sampleMetadata);
    console.log(`Prosesserte metadata: ${JSON.stringify(processed)}`);
}
