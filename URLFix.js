const fs = require('fs');

/**
 * URL Metadata Processor
 * Parserer metadata fra stream-URLer og ICY-metadata
 */

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
        logToFile(warningMessage);
        return { title: null, artist: null };
    }

    logToFile(`Mottatt metadata: ${rawMetadata}`);

    let title = null;
    let artist = null;

    // Prøv ulike skilletegn i rekkefølge: mest spesifikk → minst spesifikk

    // 1. " by " (artist atskilt med " by ") - bruker regex med capture groups
    const byRegex = /^(.+?)\s+by\s+(.+)$/i;
    const byMatch = rawMetadata.match(byRegex);
    if (byMatch) {
        title = byMatch[1].trim() || null;
        artist = byMatch[2].trim() || null;
    }
    // 2. " -- " (dobbel dash med mellomrom)
    else if (rawMetadata.includes(' -- ')) {
        const dashIndex = rawMetadata.indexOf(' -- ');
        title = rawMetadata.slice(0, dashIndex).trim() || null;
        artist = rawMetadata.slice(dashIndex + 4).trim() || null;
    }
    // 3. "--" (dobbel dash uten mellomrom)
    else if (rawMetadata.includes('--')) {
        const dashIndex = rawMetadata.indexOf('--');
        title = rawMetadata.slice(0, dashIndex).trim() || null;
        artist = rawMetadata.slice(dashIndex + 2).trim() || null;
    }
    // 4. " - " (dash med mellomrom)
    else if (rawMetadata.includes(' - ')) {
        const dashIndex = rawMetadata.indexOf(' - ');
        title = rawMetadata.slice(0, dashIndex).trim() || null;
        artist = rawMetadata.slice(dashIndex + 3).trim() || null;
    }
    // 5. "," (komma)
    else if (rawMetadata.includes(',')) {
        const [parsedTitle, parsedArtist] = rawMetadata.split(',').map(str => str.trim());
        title = parsedTitle || null;
        artist = parsedArtist || null;
    }
    // 6. "-" (enkelt bindestrek uten mellomrom)
    else if (rawMetadata.includes('-')) {
        const dashIndex = rawMetadata.indexOf('-');
        title = rawMetadata.slice(0, dashIndex).trim() || null;
        artist = rawMetadata.slice(dashIndex + 1).trim() || null;
    }
    // 7. Kun tittel (ingen artist)
    else {
        title = rawMetadata.trim();
    }

    // Rens eventuelle unødvendige tegn
    if (title) title = title.replace(/["']/g, '').trim();
    if (artist) artist = artist.replace(/["']/g, '').trim();

    const processed = { title, artist };
    logToFile(`Prosesserte metadata: ${JSON.stringify(processed)}`);

    return processed;
}

module.exports = { processURLMetadata };

// For testing direkte fra kommandolinjen
if (require.main === module) {
    const testCases = [
        'Weather With You by Crowded House',
        'The Riddle by Nik Kershaw',
        'Bad Romance by Lady Gaga',
        'Artist - Title',
        'Title'
    ];

    testCases.forEach(test => {
        const processed = processURLMetadata(test);
        console.log(`Input: "${test}" → ${JSON.stringify(processed)}`);
    });
}