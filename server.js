const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3030;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('stasjon'));

// Hent stasjoner
app.get('/stations', (req, res) => {
    fs.readFile('stations.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Feil ved lesing av stasjoner:', err);
            return res.status(500).send('Feil ved lesing av stasjoner.');
        }
        try {
            res.json(JSON.parse(data)); // Sender som JSON
        } catch (parseErr) {
            console.error('Feil ved parsing av stasjoner:', parseErr);
            return res.status(500).send('Feil ved parsing av stasjoner.');
        }
    });
});

// Oppdater stasjoner
app.post('/stations', (req, res) => {
    const newStations = JSON.stringify(req.body, null, 2);
    fs.writeFile('stations.json', newStations, 'utf8', (err) => {
        if (err) {
            console.error('Feil ved lagring av stasjoner:', err);
            return res.status(500).send('Feil ved lagring av stasjoner.');
        }
        res.send('Stasjoner lagret.');
    });
});

// Start serveren
app.listen(PORT, (err) => {
    if (err) {
        console.error('Feil ved oppstart av server:', err);
    } else {
        console.log(`Server kjører på port ${PORT}`);
    }
});