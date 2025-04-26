console.log("Spotify.js er lastet og kjører!");

const spotifyConfig = {
    clientId: "14aa4223881242a0950b6b988147b572", // Din Spotify Client ID
    redirectUri: "http://anthonsen.net:2222/callback/", // Din faktiske server-URI
    scopes: "playlist-modify-public playlist-modify-private", // Tillatelser
    playlistId: "7nV8hxgQTSweEWo3TWWkON", // Din BilHits-spilleliste
};
const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=14aa4223881242a0950b6b988147b572&redirect_uri=${encodeURIComponent("http://anthonsen.net:2222/callback")}&scope=${encodeURIComponent("playlist-modify-public playlist-modify-private")}`;
console.log("Logg inn med denne URL-en for å gi tilgang:", authUrl);

 
// Funksjon for å hente access_token fra URL eller localStorage
//function getAccessToken() {
  //  console.log("Prøver å hente token fra URL eller localStorage...");
  //  const hash = window.location.hash.substring(1);
  //  const params = new URLSearchParams(hash);
  //  const tokenFromUrl = params.get("access_token");

  //  if (tokenFromUrl) {
  //      console.log("Token funnet i URL:", tokenFromUrl);
   //     localStorage.setItem("spotifyAccessToken", tokenFromUrl);
    //    return tokenFromUrl;
   // }

   // const tokenFromStorage = localStorage.getItem("spotifyAccessToken");
   // if (tokenFromStorage) {
   //     console.log("Token funnet i localStorage:", tokenFromStorage);
   //     return tokenFromStorage;
   // } else {
   //     console.error("Ingen token funnet.");
   //     return null;
   // }
// }

function getAccessToken() {
    console.log("Sjekker etter token...");
    
    // Sjekk først localStorage
    const tokenFromStorage = localStorage.getItem("spotifyAccessToken");
    if (tokenFromStorage) {
        console.log("Token funnet i localStorage:", tokenFromStorage);
        return tokenFromStorage;
    }

    // Sjekk URL for token
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const tokenFromUrl = params.get("access_token");

    if (tokenFromUrl) {
        console.log("Token funnet i URL:", tokenFromUrl);
        // Lagre token i localStorage for senere bruk
        localStorage.setItem("spotifyAccessToken", tokenFromUrl);

        // Fjern token fra URL for å stoppe løkken
        window.history.replaceState({}, document.title, window.location.pathname);

        return tokenFromUrl;
    }

    // Hvis ingen token funnet
    console.error("Ingen token funnet. Brukeren må logge inn.");
    return null;
}

// Håndter aut




const userAccessToken = getAccessToken();

if (!userAccessToken) {
    console.log("Ingen Access Token tilgjengelig. Krever ny innlogging.");
    alert("Du må logge inn via Spotify.");
    window.location.href = authUrl;
} else {
    console.log("Access Token klart til bruk:", userAccessToken);
}

// Funksjon for å legge til en sang i spillelisten
async function addToPlaylist(trackSpotifyId) {
    if (!userAccessToken) {
        console.error("Access Token mangler. Kan ikke legge til sang.");
        alert("Du må logge inn først!");
        return;
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${spotifyConfig.playlistId}/tracks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${userAccessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                uris: [`spotify:track:${trackSpotifyId}`],
            }),
        });

        if (response.ok) {
            console.log(`Sang med ID ${trackSpotifyId} er lagt til i spillelisten.`);
            alert("Sangen ble lagt til i BilHits!");
        } else {
            const errorData = await response.json();
            console.error("Feil ved tillegg til spilleliste:", errorData);
            alert(`Kunne ikke legge til sang. Feil: ${errorData.error.message}`);
        }
    } catch (error) {
        console.error("Feil under tillegg til spillelisten:", error);
        alert("Kunne ikke legge til sang.");
    }
}
