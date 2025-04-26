const fs = require('fs');

// Logging function for keeping track of metadata processing
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync('titlefix.log', logMessage, 'utf8');
}

// Function to clean and split metadata based on common delimiters
function fixTitle(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        const warningMessage = `Invalid metadata provided: ${rawMetadata}`;
        console.warn(warningMessage);
        logToFile(warningMessage);
        return { title: null, artist: null };
    }

    logToFile(`Received metadata: ${rawMetadata}`);

    // Identify delimiter, prioritize slash over hyphen if both present
    const delimiters = ['/', '-'];
    let splitChar = '-';
    for (let delimiter of delimiters) {
        if (rawMetadata.includes(delimiter)) {
            splitChar = delimiter;
            break;
        }
    }

    const parts = rawMetadata.split(splitChar);
    const artist = parts.length > 1 ? parts[0].trim() : null;
    const title = parts.length > 1 ? parts[1].trim() : rawMetadata.trim();

    const processed = { title, artist };
    logToFile(`Processed metadata: ${JSON.stringify(processed)}`);

    return processed;
}

module.exports = { fixTitle };

// Direct command line testing
if (require.main === module) {
    const sampleMetadata = 'Drip / Tamara Mneney';
    const processed = fixTitle(sampleMetadata);
    console.log(`Processed metadata: ${JSON.stringify(processed)}`);
}
