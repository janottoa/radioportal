import requests
import hashlib
import urllib.parse
import time
import base64
from flask import Flask, request, jsonify

# Flask app setup
app = Flask(__name__)

# Spotify API Credentials
client_id = "14aa4223881242a0950b6b988147b572"
client_secret = "9cb6fb7ac80944f6a55cbf38aebb9833"
redirect_uri = "http://localhost:8888/callback"

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

# Step 2: Search for Track and Get Album Cover
def search_track_and_get_album_cover(access_token, artist_name, track_name):
    headers = {
        "Authorization": f"Bearer {access_token}"
    }

    search_url = "https://api.spotify.com/v1/search"
    params = {
        "q": f"artist:{artist_name} track:{track_name}",
        "type": "track",
        "limit": 1
    }

    response = requests.get(search_url, headers=headers, params=params)

    if response.status_code == 200:
        tracks = response.json().get("tracks").get("items")
        if tracks:
            album_cover_url = tracks[0].get("album").get("images")[0].get("url")
            print("Album Cover URL:", album_cover_url)
            # Download the album cover
            download_image(album_cover_url, "album_cover.jpg")
            return album_cover_url
        else:
            print("No track found with that name.")
            return None
    else:
        print("Failed to search track. Status code:", response.status_code)
        return None

# Download image to verify it works
def download_image(image_url, file_name):
    response = requests.get(image_url, stream=True)
    if response.status_code == 200:
        with open(file_name, 'wb') as file:
            for chunk in response.iter_content(1024):
                file.write(chunk)
        print(f"Image downloaded successfully: {file_name}")
    else:
        print(f"Failed to download image. Status code: {response.status_code}")

# Flask Endpoint to Get Album Cover from Spotify
@app.route('/get_album_cover', methods=['POST'])
def get_album_cover_endpoint():
    data = request.get_json()
    artist = data.get('artist')
    track = data.get('track')
    # Step 1: Get Access Token using Client Credentials Flow
    access_token = get_access_token()
    if access_token:
        # Step 2: Search for Track and Get Album Cover
        album_cover_url = search_track_and_get_album_cover(access_token, artist, track)
        if album_cover_url:
            return jsonify({'album_cover_url': album_cover_url})
        else:
            return jsonify({'error': 'No album cover found'}), 404
    else:
        return jsonify({'error': 'Failed to get access token'}), 401

if __name__ == "__main__":
    # Test with data for "Emma Steinbakken - Jeg Glemmer Deg Aldri"
    test_artist = "Emma Steinbakken"
    test_track = "Jeg Glemmer Deg Aldri"
    print(f"Testing with artist: {test_artist}, track: {test_track}")
    access_token = get_access_token()
    if access_token:
        search_track_and_get_album_cover(access_token, test_artist, test_track)

    # Run the Flask app
    app.run(host='0.0.0.0', port=5000)

    # Instructions to run the script:
    # 1. Make sure Python, Flask, and the 'requests' library are installed.
    # 2. Save this script to a file, e.g., 'album_cover_service.py'.
    # 3. Run the script from the terminal using: python album_cover_service.py
