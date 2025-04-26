console.log("Spotify.js er lastet og kjører!");

const apiUrl = "http://anthonsen.net:3085"; // Backend URL

// Hent token fra backend
async function getToken() {
    try {
        const response = await fetch(`${apiUrl}/get-token`);
        if (!response.ok) {
            throw new Error("Kunne ikke hente token fra server.");
        }
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Feil ved henting av token:", error);
        return null;
    }
}

// Legg til sang i Spotify-spilleliste
async function addToPlaylist(trackId) {
    const token = await getToken();
    if (!token) {
        alert("Kan ikke legge til sang. Ingen gyldig token.");
        return;
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${config.spotify.playlist_id}/tracks`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        });

        if (response.ok) {
            alert("Sangen ble lagt til i spillelisten!");
        } else {
            const errorData = await response.json();
            console.error("Feil ved tillegg til spilleliste:", errorData);
            alert(`Kunne ikke legge til sang: ${errorData.error.message}`);
        }
    } catch (error) {
        console.error("Feil under forespørsel:", error);
        alert("Kunne ikke legge til sang på grunn av en feil.");
    }
}
