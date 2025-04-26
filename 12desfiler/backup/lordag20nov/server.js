const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('stasjon')); // Serverer HTML-filer

// Hent stasjoner
app.get('/stations', (req, res) => {
    fs.readFile('stations.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Feil ved lesing av stasjoner.');
        } else {
            res.send(JSON.parse(data));
        }
    });
});

// Oppdater stasjoner
app.post('/stations', (req, res) => {
    const newStations = JSON.stringify(req.body, null, 2);
    fs.writeFile('stations.json', newStations, 'utf8', (err) => {
        if (err) {
            res.status(500).send('Feil ved lagring av stasjoner.');
        } else {
            res.send('Stasjoner lagret.');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server kjører på http://192.168.0.11:${PORT}`);
});
