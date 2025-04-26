import requests
import base64
from flask import Flask, request, jsonify
import time
import logging

logging.basicConfig(
    filename='/var/www/radioportal/spotify.log',  # Sett riktig absolutt bane
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

client_id = "14aa4223881242a0950b6b988147b572"
client_secret = "9cb6fb7ac80944f6a55cbf38aebb9833"

# Hent tilgangstoken
def get_access_token():
    auth_string = f"{client_id}:{client_secret}"
    b64_auth_string = base64.b64encode(auth_string.encode()).decode()

    headers = {
        "Authorization": f"Basic {b64_auth_string}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {"grant_type": "client_credentials"}

    response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data)
    if response.status_code == 200:
        logging.info("Access token hentet vellykket.")
        return response.json().get("access_token")
    else:
        logging.error(f"Feil ved henting av access token: {response.status_code} - {response.text}")
        return None

# Søk etter sang
def search_track(access_token, artist_name, track_name):
    headers = {"Authorization": f"Bearer {access_token}"}
    search_url = "https://api.spotify.com/v1/search"
    params = {
        "q": f"artist:{artist_name} track:{track_name}",
        "type": "track",
        "limit": 1
    }

    logging.info(f"Søker etter sang: Artist: {artist_name}, Tittel: {track_name}")

    response = requests.get(search_url, headers=headers, params=params)
    if response.status_code == 200:
        logging.info("Spotify-søk vellykket.")
        tracks = response.json().get("tracks", {}).get("items", [])
        if tracks:
            logging.info(f"Funnet sang: {tracks[0].get('name')} av {tracks[0].get('artists', [{}])[0].get('name')}")
            return tracks[0]
        else:
            logging.warning("Ingen treff i Spotify-søket.")
    else:
        logging.error(f"Spotify-søk feilet: {response.status_code} - {response.text}")
    return None

@app.route('/get_album_cover', methods=['POST'])
def get_album_cover_endpoint():
    data = request.get_json()
    if not data or 'artist' not in data or 'track' not in data:
        logging.warning("Ingen artist eller sangtittel oppgitt i forespørselen.")
        return jsonify({'error': 'No artist or track provided'}), 400

    artist = data.get('artist', '').strip()
    track = data.get('track', '').strip()

    logging.info(f"Forespørsel mottatt for artist: {artist}, tittel: {track}")

    access_token = get_access_token()
    if not access_token:
        logging.error("Kunne ikke hente access token.")
        return jsonify({'error': 'Failed to get access token'}), 401

    track_data = search_track(access_token, artist, track)
    if not track_data:
        # Prøv fallback uten artist for bedre treff
        logging.info("Prøver fallback-søk uten artist.")
        track_data = search_track(access_token, "", track)
        if not track_data:
            logging.warning("Sang ikke funnet.")
            return jsonify({'error': 'Track not found'}), 404

    album = track_data.get("album", {})
    album_cover_url = album.get("images", [{}])[0].get("url", "default-logo.png")

    logging.info(f"Returnerer albumdata: Album: {album.get('name')}, Cover: {album_cover_url}")

    return jsonify({
        'album_cover_url': album_cover_url,
        'album_name': album.get('name', 'Unknown Album'),
        'track_spotify_id': track_data.get('id'),
        'popularity': track_data.get('popularity', 0),
        'artists': [{'name': a.get('name'), 'spotify_id': a.get('id')} for a in track_data.get('artists', [])],
        'spotify_uri': track_data.get('uri'),
        'external_url': track_data.get('external_urls', {}).get('spotify'),
    })

if __name__ == "__main__":
    logging.info("Starter Flask-applikasjon.")
    app.run(host='0.0.0.0', port=5000)
