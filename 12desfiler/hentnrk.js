const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Sett opp API URL og autentisering
const API_BASE_URL = 'https://psapi.nrk.no';
const BEARER_TOKEN = process.env.NRK_API_TOKEN; // Token lagret i .env

async function fetchAllChannels() {
    try {
        console.log(`Henter alle tilgjengelige radiokanaler...`);
        const response = await axios.get(`${API_BASE_URL}/radio/linear/channels`, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        const channels = response.data;

        // Lagre resultatene i en fil i rotkatalogen
        fs.writeFileSync('/var/www/radioportal/channels.json', JSON.stringify(channels, null, 2));
        
        console.log('Kanallisten er lagret i channels.json');
    } catch (error) {
        console.error('Feil ved henting av radiokanaler', error);
    }
}

// Kjør funksjonen for å hente alle kanaler
fetchAllChannels();
