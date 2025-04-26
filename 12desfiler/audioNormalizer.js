const { spawn } = require('child_process');

function startAudioProcess(streamUrl, ws, logError) {
    if (!streamUrl) {
        logError('Ingen URL oppgitt for lydprosessering.');
        return;
    }

    console.log(`Starter lydprosess for URL: ${streamUrl}`);

    const audioProcess = spawn('ffmpeg', [
        '-i', streamUrl,
        '-af', 'loudnorm=i=-20:tp=-1.5:lra=7', // Lydnormalisering
        '-c:a', 'mp3',
        '-b:a', '128k',
        '-f', 'mp3',
        '-loglevel', 'error', // Kun feil logges
        'pipe:1'
    ]);

    // Håndter lyddata fra stdout
    audioProcess.stdout.on('data', (chunk) => {
        try {
            if (ws && ws.readyState === 1) { // Sørg for at WebSocket-tilkoblingen er åpen
                ws.send(chunk);
            } else {
                logError('WebSocket er ikke åpen eller tilgjengelig.');
            }
        } catch (err) {
            logError(`Feil ved sending av lyddata: ${err.message}`);
        }
    });

    // Håndter feilmeldinger fra stderr
    audioProcess.stderr.on('data', (data) => {
        logError(`FFmpeg feilmelding: ${data.toString()}`);
    });

    // Når prosessen avsluttes
    audioProcess.on('close', (code) => {
        if (code === 0) {
            console.log('FFmpeg avsluttet normalt.');
        } else {
            logError(`FFmpeg avsluttet med kode ${code}`);
        }
    });

    audioProcess.on('error', (err) => {
        logError(`Feil i FFmpeg-prosess: ${err.message}`);
    });

    return audioProcess;
}

module.exports = { startAudioProcess };
