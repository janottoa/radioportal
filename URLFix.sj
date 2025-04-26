const fs = require('fs');

// Logging-funksjon som skriver til fixurl.log og konsoll
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage); // Logger til konsoll
    fs.appendFileSync('fixurl.log', logMessage, 'utf8'); // Logger til fixurl.log
}

// Enkel funksjon for å prosessere metadata
function processMetadata(rawMetadata) {
    logToFile(`Startet prosessering av metadata: [${rawMetadata}]`);

    if (!rawMetadata || typeof rawMetadata !== 'string') {
        logToFile(`Ugyldig metadata: [${rawMetadata}]`);
        return { title: null, artist: null };
    }

    // Trim metadata
    const cleanedMetadata = rawMetadata.trim();
    logToFile(`Renset metadata: [${cleanedMetadata}]`);

    // Sjekk om metadata inneholder "/"
    if (cleanedMetadata.includes('/')) {
        logToFile(`Metadata inneholder Test URLFix "/": [${cleanedMetadata}]`);

        // Split på "/"
        const parts = cleanedMetadata.split('/').map(part => part.trim());
        logToFile(`Splittet deler: ${JSON.stringify(parts)}`);

        if (parts.length === 2) {
            const processed = { title: parts[0], artist: parts[1] };
            logToFile(`Prosesserte metadata URLFix: ${JSON.stringify(processed)}`);
            return processed;
        } else {
            logToFile(`Splittingen ga ikke to deler: ${JSON.stringify(parts)}`);
        }
    } else {
        logToFile(`Metadata inneholder ikke "/": [${cleanedMetadata}]`);
    }

    // Fallback
    logToFile(`Fallback: Returnerer råmetadata som tittel.`);
    return { title: cleanedMetadata, artist: null };
}

// Eksporter funksjonen
module.exports = { processMetadata };
