// dash.js

// URL til metadata
const metadataUrl = 'http://192.168.0.11:8000/metadata'; // Sett denne til URL-en du bruker for metadata

// WebSocket til dashboard
let socket = new WebSocket("ws://192.168.0.11:8000"); // Endre PORT til riktig port for dashboard-tilkoblingen

// Lytt på play-knappen
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('play-button')) { // Endre 'play-button' til riktig klasse for knappen
        startStream();
    }
});

// Funksjon for å starte streamen og oppdatere dashboardet
function startStream() {
    // Hent metadata når streamen starter
    fetchMetadata()
        .then(metadata => {
            // Oppdater dashboardet med metadata og bilde
            sendToDashboard(metadata);
        })
        .catch(error => {
            console.error('Feil ved henting av metadata:', error);
        });
}

// Funksjon for å hente metadata
async function fetchMetadata() {
    try {
        let response = await fetch(metadataUrl);
        if (!response.ok) throw new Error('Feil ved henting av metadata');
        
        let data = await response.json();
        
        // Bruker bildet fra metadata, eller faller tilbake til logo på HDD
        let imageUrl = data.image || 'path/to/local/logo.png'; // Endre path til HDD-logoen
        
        return {
            title: data.title,
            artist: data.artist,
            image: imageUrl
        };
    } catch (error) {
        console.error('Feil ved henting av metadata:', error);
        throw error;
    }
}

// Funksjon for å sende data til dashboardet via WebSocket
function sendToDashboard(metadata) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(metadata));
    } else {
        console.warn('WebSocket ikke klar, prøver igjen...');
        socket = new WebSocket("ws://localhost:PORT"); // Prøv på nytt hvis WebSocket ikke var klar
    }
}

// Lukk WebSocket når vinduet lukkes
window.addEventListener('beforeunload', () => {
    socket.close();
});
