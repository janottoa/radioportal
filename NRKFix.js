/**
 * NRK Metadata Processor
 * Parserer metadata fra NRK-radiostrømmer
 */

function processNRKMetadata(rawMetadata) {
    if (!rawMetadata || typeof rawMetadata !== 'string') {
        return { program: null, title: null, artist: null };
    }

    let program = null;
    let title = null;
    let artist = null;

    // Split basert på første kolon for programnavn
    const parts = rawMetadata.split(':');
    if (parts.length > 1) {
        program = parts[0].trim();
        let remaining = parts.slice(1).join(':').trim();

        // Håndter "med X: " - format (f.eks. "med Vilde: Kiss Somebody, Artist")
        const medMatch = remaining.match(/^med\s+[^:]+:\s*/);
        if (medMatch) {
            // Fjern "med X: " fra remaining
            remaining = remaining.slice(medMatch[0].length);
        }

        // Del videre basert på ulike skilletegn
        // Prøv formatene i rekkefølge: mest spesifikk → minst spesifikk
        
        // 1. " by " (artist atskilt med " by ") - bruk regex for å håndtere ulike whitespace
        const byMatch = remaining.match(/\s+by\s+/);
        if (byMatch) {
            const byIndex = byMatch.index;
            title = remaining.slice(0, byIndex).trim() || null;
            artist = remaining.slice(byIndex + byMatch[0].length).trim() || null;
        }
        // 2. " -- " (dobbel dash med mellomrom)
        else if (remaining.includes(' -- ')) {
            const dashIndex = remaining.indexOf(' -- ');
            title = remaining.slice(0, dashIndex).trim() || null;
            artist = remaining.slice(dashIndex + 4).trim() || null;
        }
        // 4. "--" (dobbel dash uten mellomrom)
        else if (remaining.includes('--')) {
            const dashIndex = remaining.indexOf('--');
            title = remaining.slice(0, dashIndex).trim() || null;
            artist = remaining.slice(dashIndex + 2).trim() || null;
        }
        // 5. " - " (dash med mellomrom)
        else if (remaining.includes(' - ')) {
            const dashIndex = remaining.indexOf(' - ');
            title = remaining.slice(0, dashIndex).trim() || null;
            artist = remaining.slice(dashIndex + 3).trim() || null;
        }
        // 6. "," (komma)
        else if (remaining.includes(',')) {
            const [parsedTitle, parsedArtist] = remaining.split(',').map(str => str.trim());
            title = parsedTitle || null;
            artist = parsedArtist || null;
        }
        // 7. "-" (enkelt bindestrek uten mellomrom)
        else if (remaining.includes('-')) {
            const dashIndex = remaining.indexOf('-');
            title = remaining.slice(0, dashIndex).trim() || null;
            artist = remaining.slice(dashIndex + 1).trim() || null;
        }
        // 8. Kun tittel (ingen artist)
        else {
            title = remaining;
        }
    } else {
        program = rawMetadata.trim();
    }

    // Rens eventuelle unødvendige tegn
    if (title) title = title.replace(/["']/g, '').trim();
    if (artist) artist = artist.replace(/["']/g, '').trim();

    return { program, title, artist };
}

module.exports = { processNRKMetadata };