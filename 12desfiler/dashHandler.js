const WebSocket = require('ws'); // Import WebSocket-modulen
const { spawn } = require('child_process');

// Konfigurasjon
const DASH_WEBSOCKET_PORT = 3084;
const wss = new WebSocket.Server({ port: DASH_WEBSOCKET_PORT });

console.log(`DASH WebSocket server running on port ${DASH_WEBSOCKET_PORT}`);



wss.on('connection', (ws) => {
    console.log('Ny tilkobling til DASH WebSocket.');

    ws.on('message', (dashUrl) => {
        console.log(`Starter DASH-stream for URL: ${dashUrl}`);
        handleDashStream(dashUrl, ws);
    });

    ws.on('close', () => {
        console.log('DASH WebSocket-tilkobling lukket.');
    });
});


function handleDashStream(dashUrl, ws) {
    const ffmpeg = spawn('ffmpeg', [
        '-i', dashUrl,
        '-af', 'loudnorm=i=-16:tp=-1.5:lra=11', // Normalisering
        '-vn', // Ingen video
        '-f', 'mp3', // Konverter til MP3
        'pipe:1'
    ]);

    ffmpeg.stdout.on('data', (chunk) => {
        ws.send(chunk); // Send lyddata til WebSocket-klienten
    });

    ffmpeg.stderr.on('data', (data) => {
        console.error(`FFmpeg feilmelding: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`FFmpeg prosess avsluttet med kode ${code}`);
    });

    ws.on('close', () => {
        console.log('Stopper FFmpeg-prosess for DASH-stream.');
        ffmpeg.kill('SIGKILL');
    });
}

module.exports = { wss };
