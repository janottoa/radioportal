const axios = require('axios');
require('dotenv').config();

// Sett opp API URL og autentisering
const API_BASE_URL = 'https://psapi.nrk.no';
const CHANNEL_ID = 'NRK_CHANNEL_ID'; // Her må du bruke en faktisk kanal-ID, for eksempel "P1" eller en annen NRK-kanal.
const BEARER_TOKEN = process.env.NRK_API_TOKEN; // Token lagret i .env

async function fetchNRKMetadata(channelId) {
    try {
        console.log(`Henter metadata for kanal: ${channelId}...`);
        const response = await axios.get(`${API_BASE_URL}/playback/metadata/channel/${channelId}`, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });
        const metadata = response.data;
        console.log('Metadata hentet:', metadata); // Logging av metadataen som ble hentet
        return metadata;
    } catch (error) {
        console.error(`Feil ved henting av metadata for kanal: ${channelId}`, error);
        return null;
    }
}

// Eksempel på kall
fetchNRKMetadata(CHANNEL_ID);
