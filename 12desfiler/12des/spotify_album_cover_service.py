import requests
import base64
from flask import Flask, request, jsonify
import time

# Flask app setup
app = Flask(__name__)

# Spotify API Credentials
client_id = "14aa4223881242a0950b6b988147b572"
client_secret = "9cb6fb7ac80944f6a55cbf38aebb9833"

# Step 1: Exchange Authorization Code for Access Token
def get_access_token():
    auth_string = f"{client_id}:{client_secret}"
    b64_auth_string = base64.b64encode(auth_string.encode()).decode()

    headers = {
        "Authorization": f"Basic {b64_auth_string}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "client_credentials"
    }

    response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data)

    if response.status_code == 200:
        access_token = response.json().get("access_token")
        return access_token
    else:
        print("Failed to get access token. Status code:", response.status_code)
        return None

# Step 2: Search for Track and Get Track Data
def search_track(access_token, artist_name, track_name):
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    search_url = "https://api.spotify.com/v1/search"
    params = {
        "q": f"artist:{artist_name} track:{track_name}",
        "type": "track",
        "limit": 1
    }

    retry_count = 0
    max_retries = 3
    retry_delay = 2

    while retry_count < max_retries:
        response = requests.get(search_url, headers=headers, params=params)

        if response.status_code == 200:
            tracks = response.json().get("tracks").get("items")
            if tracks:
                return tracks[0]  # Return first track's data
            else:
                print("No track found with that name.")
                return None
        elif response.status_code == 500:
            print(f"Spotify server error (500). Retrying in {retry_delay} seconds...")
            retry_count += 1
            time.sleep(retry_delay)
        else:
            print("Failed to search track. Status code:", response.status_code)
            print("Response content:", response.content)
            return None

    print("Failed to fetch track data from Spotify after multiple attempts.")
    return None

# Flask Endpoint to Get Album Cover from Spotify
@app.route('/get_album_cover', methods=['POST'])
def get_album_cover_endpoint():
    data = request.get_json()
    if not data or 'artist' not in data or 'track' not in data:
        print("Feil: Ingen metadata mottatt eller feil format i forespørselen:", data)
        return jsonify({'error': 'No artist or track provided or incorrect format'}), 400

    artist = data.get('artist')
    track = data.get('track')

    # Step 1: Get Access Token using Client Credentials Flow
    access_token = get_access_token()
    if not access_token:
        return jsonify({'error': 'Failed to get access token after multiple attempts'}), 401

    # Step 2: Search for Track and Get Track Data
    track_data = search_track(access_token, artist, track)
    if not track_data:
        return jsonify({'error': 'Track data not found'}), 404

    # Step 3: Get Album Cover URL
    album_cover_url = track_data.get("album", {}).get("images", [{}])[0].get("url")
    if album_cover_url:
        album = track_data.get('album', {})
        return jsonify({
            'album_cover_url': album_cover_url,
            'artist': artist,
            'track': track,
            'album_name': album.get('name', 'Unknown Album'),  # Album name
            'track_spotify_id': track_data['id'],  # Spotify track ID
            'popularity': track_data['popularity'],  # Popularity
            'artists': [{'name': artist['name'], 'spotify_id': artist['id']} for artist in track_data['artists']],  # Artists
            'spotify_uri': track_data['uri'],  # Spotify URI
            'external_url': track_data['external_urls']['spotify']  # Spotify link
        })
    else:
        return jsonify({'error': 'No album cover found'}), 404

if __name__ == "__main__":
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000)
