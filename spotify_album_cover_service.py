import requests
import base64
from flask import Flask, request, jsonify
import logging

# Setup logging
logging.basicConfig(
    filename='/var/www/radioportal/spotify.log',  # Sett riktig absolutt bane
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

# Spotify API credentials
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


if __name__ == "__main__":
    logging.info("Starter Flask-applikasjon.")
    app.run(host='0.0.0.0', port=5000)