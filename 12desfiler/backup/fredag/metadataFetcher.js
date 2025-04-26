const WebSocket = require('ws');
const fs = require('fs');
const axios = require('axios');

const logStream = fs.createWriteStream('fetcher.log', { flags: 'a' });
function log(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`);
    console.log(`[${timestamp}] ${message}`);
}

const PROXY_URL = 'ws://192.168.0.11:8081';
const FRONTEND_PORT = 8082;

let proxySocket;

const frontendServer = new WebSocket.Server({ port: FRONTEND_PORT });
log(`Frontend WebSocket-server kjører på ws://192.168.0.11:${FRONTEND_PORT}`);

frontendServer.on('connection', (client) => {
    log('Ny tilkobling fra frontend-klient');
    client.on('close', () => log('Frontend-klient tilkobling lukket'));
});

function connectToProxy() {
    proxySocket = new WebSocket(PROXY_URL);

    proxySocket.on('open', () => {
        log('Koblet til WebSocket-server i proxy.js');
    });

    proxySocket.on('message', (data) => {
        const songInfo = JSON.parse(data);
        log(`Mottatt metadata fra proxy.js: ${JSON.stringify(songInfo)}`);
        
        frontendServer.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(songInfo));
                log(`Sendt metadata til frontend: ${JSON.stringify(songInfo)}`);
            }
        });
    });

    proxySocket.on('close', () => {
        log('WebSocket-tilkobling til proxy.js lukket. Forsøker på nytt om 5 sekunder...');
        setTimeout(connectToProxy, 5000);
    });

    proxySocket.on('error', (error) => {
        log(`WebSocket-feil: ${error.message}`);
    });
}

connectToProxy();
