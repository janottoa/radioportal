const fs = require('fs');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('fixnrk.log', logMessage, 'utf8');
}

function processNRKMetadata(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage); // Logg til fil
        return { program: null, title: null, artist: null };
    }

    logToFile(`Mottatt metadata: ${rawMetadata}`); // Logg råmetadata

    // Del metadata opp ved bruk av kolon og komma
    const parts = rawMetadata.split(':');
    const program = parts.length > 1 ? parts[0].trim() : null;

    const songDetails = parts.length > 1 ? parts[1].split(',') : parts[0].split(',');
    const title = songDetails.length > 1 ? songDetails[0].trim() : null;
    const artist = songDetails.length > 1 ? songDetails[1].trim() : null;

    const processed = { program, title, artist };
    logToFile(`Prosesserte metadata: ${JSON.stringify(processed)}`); // Logg prosesserte metadata

    return processed;
}

module.exports = { processNRKMetadata };

// For testing direkte fra kommandolinjen
if (require.main === module) {
    const sampleMetadata = 'Søndagsåpent: Kaiser Chiefs - How 2 Dance';
    const processed = processNRKMetadata(sampleMetadata);
    console.log(`Prosesserte metadata: ${JSON.stringify(processed)}`);
}