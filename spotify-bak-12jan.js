console.log("Spotify.js er lastet og kjører!");

// Spotify-konfigurasjon
const spotifyConfig = {
    clientId: "14aa4223881242a0950b6b988147b572",
    redirectUri: "http://anthonsen.net:2222/callback", // Uten skråstrek
    scopes: "playlist-modify-public playlist-modify-private",
    playlistId: "7nV8hxgQTSweEWo3TWWkON",
};

// Generer autorisasjons-URL
const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${spotifyConfig.clientId}&redirect_uri=${encodeURIComponent(spotifyConfig.redirectUri)}&scope=${encodeURIComponent(spotifyConfig.scopes)}`;

// Funksjoner for tokenhåndtering
function saveToken(accessToken, expiresIn) {
    const expiryTime = Date.now() + expiresIn * 1000; // Beregn utløpstid
    localStorage.setItem("spotifyAccessToken", accessToken);
    localStorage.setItem("spotifyTokenExpiry", expiryTime);
    console.log(`Token lagret. Utløpstid: ${new Date(expiryTime).toLocaleString()}`);
}

function getToken() {
    const accessToken = localStorage.getItem("spotifyAccessToken");
    const expiryTime = localStorage.getItem("spotifyTokenExpiry");

    if (!accessToken || !expiryTime) {
        console.warn("Ingen token funnet i localStorage.");
        return null;
    }

    if (Date.now() > expiryTime) {
        console.warn("Tokenet er utløpt.");
        localStorage.removeItem("spotifyAccessToken");
        localStorage.removeItem("spotifyTokenExpiry");
        return null;
    }

    console.log("Gyldig token funnet i localStorage.");
    return accessToken;
}

function handleAccessTokenFromUrl() {
    const hash = window.location.hash.substring(1); // Få alt etter `#`
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (accessToken && expiresIn) {
        // Lagre tokenet
        const expiryTime = Date.now() + parseInt(expiresIn, 10) * 1000;
        localStorage.setItem("spotifyAccessToken", accessToken);
        localStorage.setItem("spotifyTokenExpiry", expiryTime);

        console.log("Token lagret. Tilbake til hovedsiden.");

        // Fjern hash fra URL for å stoppe løkker
        window.history.replaceState({}, document.title, window.location.pathname);

        // Omdiriger til hovedsiden
        window.location.href = "http://anthonsen.net:2222"; // Bytt til hovedsiden din
    } else {
        console.error("Ingen token funnet i URL.");
        alert("Kunne ikke hente token. Vennligst prøv igjen.");
    }
}

// Utfør logikken
handleAccessTokenFromUrl();

// Start Spotify-integrasjon
function initializeSpotifyIntegration() {
    handleAccessTokenFromUrl();

    const userAccessToken = getToken();
    if (!userAccessToken) {
        console.log("Ingen gyldig token. Omdirigerer til Spotify for ny innlogging.");
        window.location.href = authUrl;
        return;
    }

    console.log("Token funnet og gyldig. Starter radioportal.");
    restorePlaybackState(); // Gjenopprett spillestatus
}

// Lagring av spillestatus
function savePlaybackState(stationUrl, stationDiv) {
    localStorage.setItem("currentStationUrl", stationUrl);
    localStorage.setItem("expandedStationId", stationDiv.id || stationDiv.getAttribute("data-url"));
    console.log("Spilletilstand lagret:", { stationUrl });
}

// Gjenoppretting av spillestatus
function restorePlaybackState() {
    const lastStationUrl = localStorage.getItem("currentStationUrl");
    const expandedStationId = localStorage.getItem("expandedStationId");

    if (lastStationUrl) {
        console.log("Gjenoppretter avspilling for stasjon:", lastStationUrl);

        const stationDiv = Array.from(document.querySelectorAll(".station")).find(
            div => div.getAttribute("data-url") === lastStationUrl
        );

        if (stationDiv) {
            initializeAudio(lastStationUrl, stationDiv); // Start avspilling igjen
        }
    }

    if (expandedStationId) {
        console.log("Gjenoppretter ekspandert knapp:", expandedStationId);

        const expandedElement = document.getElementById(expandedStationId);
        if (expandedElement) {
            expandedElement.classList.add("expanded"); // Marker som ekspandert
        }
    }
}

// Legg til sang i Spotify-spillelisten
async function addToPlaylist(trackSpotifyId) {
    const userAccessToken = getToken();
    if (!userAccessToken) {
        alert("Tokenet er utløpt. Logg inn på nytt via Spotify.");
        window.location.href = authUrl; // Omdiriger for ny innlogging
        return;
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${spotifyConfig.playlistId}/tracks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${userAccessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: [`spotify:track:${trackSpotifyId}`] }),
        });

        if (response.ok) {
            console.log(`Sangen med ID ${trackSpotifyId} ble lagt til i spillelisten.`);
            alert("Sangen ble lagt til i spillelisten!");
            // Hold avspilling og UI uendret
        } else {
            const errorData = await response.json();
            console.error("Feil ved tillegg til spilleliste:", errorData);
            alert(`Kunne ikke legge til sang. Feil: ${errorData.error.message}`);
        }
    } catch (error) {
        console.error("Feil under forespørsel til Spotify:", error);
        alert("Kunne ikke legge til sang på grunn av en feil.");
    }
}


// Start Spotify-integrasjonen
document.addEventListener("DOMContentLoaded", initializeSpotifyIntegration);
