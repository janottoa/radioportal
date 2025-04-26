const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const wss = new WebSocket.Server({ port: 3088, host: '0.0.0.0' });
console.log("WebSocket server running on ws://anthonsen.net:8088");

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Send logo to the client
    const logoPath = path.join(__dirname, 'logo', 'nrklogo', 'sor.png');
    fs.readFile(logoPath, (err, data) => {
        if (err) {
            console.error('Error reading logo file:', err);
            ws.send(JSON.stringify({ error: 'Failed to load logo' }));
        } else {
            // Send the image as Base64
            const base64Logo = data.toString('base64');
            ws.send(JSON.stringify({ type: 'logo', data: base64Logo }));
            console.log('Logo sent to client');
        }
    });

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
