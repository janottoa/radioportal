const fs = require('fs');

// Funksjon for logging til fil
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

    console.log(`Råmetadata: ${rawMetadata}`);
    logToFile(`Mottatt metadata fixnrk: ${rawMetadata}`); // Logg råmetadata

    let program = null;
    let title = null;
    let artist = null;

    try {
        // Split basert på første kolon for programnavn
        const parts = rawMetadata.split(':');
        if (parts.length > 1) {
            program = parts[0].trim(); // Første del er programnavnet
            const remaining = parts.slice(1).join(':').trim(); // Resten etter første kolon

            // Del videre basert på bindestrek eller komma
            if (remaining.includes('-')) {
                const [parsedTitle, parsedArtist] = remaining.split('-').map(str => str.trim());
                title = parsedTitle || null;
                artist = parsedArtist || null;
            } else if (remaining.includes(',')) {
                const [parsedTitle, parsedArtist] = remaining.split(',').map(str => str.trim());
                title = parsedTitle || null;
                artist = parsedArtist || null;
            } else {
                title = remaining; // Hvis ingen separatorer, bruk hele som tittel
            }
        } else {
            // Hvis ingen kolon finnes, bruk hele som programnavnet
            program = rawMetadata.trim();
        }
    } catch (error) {
        console.error(`Feil under parsing av metadata: ${error.message}`);
        logToFile(`Feil under parsing: ${error.message}`);
    }

    // Rens eventuelle unødvendige tegn fra artist og tittel
    if (title) title = title.replace(/["']/g, '').trim();
    if (artist) artist = artist.replace(/["']/g, '').trim();

    const processed = { program, title, artist };
    console.log(`Prosesserte metadata NRKFix: ${JSON.stringify(processed)}`);
    logToFile(`Prosesserte metadata NRKFix: ${JSON.stringify(processed)}`);
    return processed;
}



module.exports = { processNRKMetadata };

// For testing direkte fra kommandolinjen
if (require.main === module) {
    const sampleMetadata = 'Søndagsåpent: Kaiser Chiefs - How 2 Dance';
    const processed = processNRKMetadata(sampleMetadata);
    console.log(`Prosesserte metadata: ${JSON.stringify(processed)}`);
}
