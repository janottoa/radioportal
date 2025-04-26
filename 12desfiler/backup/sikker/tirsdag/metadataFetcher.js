const WebSocket = require('ws');
const fs = require('fs');

// Logging setup
const logStream = fs.createWriteStream('fetcher.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
}

const PROXY_URL = 'ws://192.168.0.11:8081';
let currentMetadataUrl = null;

// Connect to proxy WebSocket server
function connectToProxy() {
    const ws = new WebSocket(PROXY_URL);

    ws.on('open', () => {
        log('Koblet til WebSocket-server i proxy.js');
    });

    ws.on('message', (data) => {
        try {
            const url = JSON.parse(data);
            if (url.test) {
                log(`Testmelding mottatt fra proxy.js: ${data}`);
            } else if (typeof url === 'string') {
                log(`Mottatt metadata-URL fra proxy.js: ${url}`);
                if (currentMetadataUrl !== url) {
                    currentMetadataUrl = url;
                    fetchMetadata();
                }
            }
        } catch (error) {
            log(`Feil ved mottak av data fra proxy.js: ${error.message}`);
        }
    });

    ws.on('close', () => {
        log('WebSocket-tilkobling til proxy.js lukket. Forsøker på nytt...');
        setTimeout(connectToProxy, 5000);
    });

    ws.on('error', (error) => {
        log(`WebSocket-feil: ${error.message}`);
    });
}

// Function to fetch metadata
function fetchMetadata() {
    log(`Henter metadata fra URL: ${currentMetadataUrl}`);
    // Your fetch metadata code here...
}

connectToProxy();
