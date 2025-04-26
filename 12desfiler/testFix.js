const fs = require('fs');

// Logging-funksjon for å spore prosessering
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('fix.log', logMessage, 'utf8');
}

// Original prosessering av metadata (for eksempel med bindestrek)
function originalProcessMetadata(rawMetadata) {
    logToFile(`Råmetadata mottatt: [${rawMetadata}]`); // Logg før behandling
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage); // Logg til fil
        logToFile(`Metadata uten /: [${cleanedMetadata}]`); // Logg metadata uten separator
        return { title: null, artist: null };
    }

    console.log(`Råmetadata (original): ${rawMetadata}`);
    logToFile(`Mottatt metadata (original): ${rawMetadata}`);

    const parts = rawMetadata.split('-');
    const artist = parts.length > 1 ? parts[0].trim() : null;
    const title = parts.length > 1 ? parts[1].trim() : rawMetadata.trim();

    const processed = { title, artist };
    logToFile(`Prosesserte metadata (original): ${JSON.stringify(processed)}`);
    return processed;
}

// Utvidet prosessering for nye formater som "Tittel / Artist"
function extendedProcessMetadata(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Ugyldig metadata: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage); // Logg til fil
        return { title: null, artist: null };
    }

    console.log(`Råmetadata (utvidet): ${rawMetadata}`);
    logToFile(`Mottatt metadata (utvidet): ${rawMetadata}`);

    let title = null;
    let artist = null;

    if (rawMetadata.includes('/')) {
        const parts = rawMetadata.split('/').map(part => part.trim());
        if (parts.length === 2) {
            title = parts[0];
            artist = parts[1];
        } else {
            logToFile(`Ukjent format for "/": ${rawMetadata}`);
        }
    } else if (rawMetadata.includes('-')) {
        const parts = rawMetadata.split('-').map(part => part.trim());
        if (parts.length === 2) {
            artist = parts[0];
            title = parts[1];
        } else {
            logToFile(`Ukjent format for "-": ${rawMetadata}`);
        }
    } else {
        title = rawMetadata.trim();
    }

    const processed = { title, artist };
    logToFile(`Prosesserte metadata (utvidet): ${JSON.stringify(processed)}`);
    return processed;
}

// Kombinert funksjon for debugging og fallback
function processMetadata(rawMetadata) {
    logToFile(`Starter prosessering av metadata: ${rawMetadata}`);

    // Prøv original prosessering først
    const originalResult = originalProcessMetadata(rawMetadata);
    if (originalResult.artist && originalResult.title) {
        logToFile(`Original prosessering lyktes: ${JSON.stringify(originalResult)}`);
        return originalResult;
    }

    // Hvis original prosessering feiler, prøv utvidet prosessering
    const extendedResult = extendedProcessMetadata(rawMetadata);
    if (extendedResult.artist || extendedResult.title) {
        logToFile(`Utvidet prosessering lyktes: ${JSON.stringify(extendedResult)}`);
        return extendedResult;
    }

    // Hvis begge feiler, returner råmetadata
    logToFile(`Ingen prosessering lyktes, returnerer råmetadata: ${rawMetadata}`);
    return { title: rawMetadata, artist: null };
}

module.exports = { processMetadata };

// Testseksjon
if (require.main === module) {
    const testCases = [
        'Luk mig ind / Annika',
        'Die With A Smile / Lady Gaga, Bruno Mars',
        'Cryin\' - Aerosmith',
        'Stories / Kayak',
        'DR P3  dr.dk/p3',
        'Diet Pepsi / Addison Rae',
        'Ukjent format'
    ];

    testCases.forEach((test) => {
        const result = processMetadata(test);
        console.log(`Input: "${test}" -> Output: ${JSON.stringify(result)}`);
    });
}
