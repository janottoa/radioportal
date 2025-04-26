const WebSocket = require('ws');
const { spawn } = require('child_process');

const PORT = 8000;
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket-server kjører på ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
    console.log('Ny WebSocket-tilkobling opprettet.');

    ws.on('message', (message) => {
        const streamUrl = message;
        console.log(`Mottok forespørsel om URL: ${streamUrl}`);

        // Start en ffmpeg-prosess for å hente metadata fra strømmen
        const ffmpeg = spawn('ffmpeg', [
            '-i', streamUrl,
            '-vn', 
            '-loglevel', 'info',
            '-f', 'null', '-'
        ]);

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString();
            console.log('ffmpeg output:', output); // Skriv ut output for feilsøking
            const matches = output.match(/StreamTitle\s*:\s*(.*)/);
            if (matches) {
                const streamTitle = matches[1].trim();
                console.log(`Sender metadata: ${streamTitle}`);
                ws.send(JSON.stringify({ StreamTitle: streamTitle }));
            }
        });

        ffmpeg.on('close', (code) => {
            console.log(`ffmpeg avsluttet med kode ${code}`);
            ws.send(JSON.stringify({ StreamTitle: "Ingen metadata tilgjengelig" }));
        });

        ws.on('close', () => {
            console.log('WebSocket-tilkobling avsluttet.');
            ffmpeg.kill();
        });
    });
});
