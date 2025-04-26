const express = require('express');
const fs = require('fs');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const config = require('./config.json');

// Funksjon for å lagre refresh token i config.json
async function saveTokenToConfig(refreshToken) {
    config.spotify.refresh_token = refreshToken;

    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    console.log('Refresh token lagret i config.json');
}

// Endepunkt for Spotify callback
app.get('/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        res.status(400).send('Ingen kode funnet. Kan ikke autentisere.');
        return;
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: config.spotify.redirect_uri,
            },
            headers: {
                Authorization: `Basic ${Buffer.from(`${config.spotify.client_id}:${config.spotify.client_secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token } = response.data;

        if (refresh_token) {
            await saveTokenToConfig(refresh_token);
        }

        res.send('Innlogging vellykket! Du kan nå gå tilbake til radioportalen.');
    } catch (error) {
        console.error('Feil ved innlogging:', error);
        res.status(500).send('Kunne ikke autentisere.');
    }
});

// Funksjon for å fornye access token
async function refreshToken() {
    const refreshToken = config.spotify.refresh_token;

    if (!refreshToken) {
        throw new Error('Ingen refresh token tilgjengelig.');
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
            headers: {
                Authorization: `Basic ${Buffer.from(`${config.spotify.client_id}:${config.spotify.client_secret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token } = response.data;
        console.log('Nytt access token generert:', access_token);
        return access_token;
    } catch (error) {
        console.error('Feil ved fornyelse av token:', error);
        throw new Error('Kunne ikke fornye token.');
    }
}

// Hent token fra server
app.get('/get-token', async (req, res) => {
    try {
        const token = await refreshToken();
        res.json({ accessToken: token });
    } catch (error) {
        console.error('Kunne ikke hente eller fornye token:', error);
        res.status(500).send('Kunne ikke hente token.');
    }
});

// Start serveren
app.listen(config.server.port, () => {
    console.log(`Spotify-token-server kjører på port ${config.server.port}`);
});
