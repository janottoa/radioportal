const fs = require('fs');
function fixImage(streamTitle) {
    logFixImage(`Kaller fixImage med: ${streamTitle}`);
    // rest of the code
}
// Logging function for keeping track of metadata processing
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('titlefix.log', logMessage, 'utf8');
}
// Function to clean and split metadata based on common delimiters
function fixImage(rawMetadata) {
    if (rawMetadata === null || typeof rawMetadata !== 'string') {
        const warningMessage = `Invalid metadata provided: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage);
        return { title: null, artist: null };
    }

    if (rawMetadata.trim() === '') {
        // Handle empty string as valid metadata
        const infoMessage = `Empty metadata provided, returning empty title.`;
        console.info(infoMessage);
        logToFile(infoMessage);
        return { title: '', artist: null };
    }

    logToFile(`Received metadata: ${rawMetadata}`);

    // Identify delimiter, prioritize slash over hyphen if both present
    const delimiters = ['/', '-'];
    let splitChar = null;
    for (let delimiter of delimiters) {
        if (rawMetadata.includes(delimiter)) {
            splitChar = delimiter;
            break;
        }
    }

    // Split metadata based on identified delimiter
    if (splitChar) {
        const parts = rawMetadata.split(splitChar);
        const artist = parts.length > 1 ? parts[0].trim() : null;
        const title = parts.length > 1 ? parts[1].trim() : rawMetadata.trim();

        const processed = { title, artist };
        logToFile(`Processed metadata: ${JSON.stringify(processed)}`);
        return processed;
    } else {
        // No delimiter found, treat the whole string as the title
        const infoMessage = `No delimiter found in metadata: ${rawMetadata}`;
        logToFile(infoMessage);
        return { title: rawMetadata.trim(), artist: null };
    }
}

 
module.exports = { fixImage };

// Direct command line testing
if (require.main === module) {
    const sampleMetadata = 'Deeply Still In Love / ROLE MODEL';
    const processed = fixImage(sampleMetadata);
    console.log(`Processed metadata: ${JSON.stringify(processed)}`);
}
