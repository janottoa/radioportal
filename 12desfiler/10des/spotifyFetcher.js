// spotifyFetcher.js

// Funksjon for å hente albumcover fra Spotify
async function fetchSpotifyAlbumCover(artist, track) {
    try {
        const response = await fetch('http://192.168.0.11:5000/get_album_cover', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ artist, track }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.album_cover_url;
        } else {
            console.error('Failed to fetch album cover from Spotify:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error fetching album cover:', error);
        return null;
    }
}

// Eksporter funksjonen for bruk i andre skript
module.exports = { fetchSpotifyAlbumCover };

