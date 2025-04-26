import requests
import hashlib
import urllib.parse

def get_album_cover(artist_name, track_name, api_key, shared_secret):
    base_url = "http://ws.audioscrobbler.com/2.0/"
    params = {
        "method": "track.getInfo",
        "artist": artist_name,
        "track": track_name,
        "api_key": api_key,
        "format": "json"
    }

    # Generating API signature with updated method
    api_sig = generate_api_signature(params, shared_secret)
    params["api_sig"] = api_sig

    # Logging parameters for debugging
    print("Parameters being sent:")
    for key, value in params.items():
        print(f"{key}: {value}")

    response = requests.get(base_url, params=params)

    if response.status_code == 200:
        data = response.json()
        try:
            album_image = data['track']['album']['image'][-1]['#text']
            if album_image:
                return album_image
            else:
                return "No image found"
        except KeyError:
            return "No album information available"
    elif response.status_code == 400:
        return "Bad Request: Please check the parameters (artist name, track name, API key, shared secret)"
    else:
        return f"Error: {response.status_code}"

def generate_api_signature(params, shared_secret):
    # Sorting parameters and concatenating for signature
    concatenated_string = ""
    for key in sorted(params):
        if key != "format":  # Exclude 'format' from the signature
            concatenated_string += key + params[key]
    concatenated_string += shared_secret

    # Creating MD5 hash
    return hashlib.md5(concatenated_string.encode('utf-8')).hexdigest()

def download_image(image_url, file_name):
    response = requests.get(image_url, stream=True)
    if response.status_code == 200:
        with open(file_name, 'wb') as file:
            for chunk in response.iter_content(1024):
                file.write(chunk)
        print(f"Image downloaded successfully: {file_name}")
    else:
        print(f"Failed to download image. Status code: {response.status_code}")

if __name__ == "__main__":
    # Replace these with your own credentials
    api_key = "0403989337ed74aca5c3ce08005c9926"
    shared_secret = "76effcbaaeade38eeec2ad4d411edbad"
    artist = "Rakkere"
    track = "24/7"

    # Run the function and print the result
    album_cover_url = get_album_cover(artist, track, api_key, shared_secret)
    print("Album Cover URL:", album_cover_url)

    # Download the album cover to a file
    if "http" in album_cover_url:
        download_image(album_cover_url, "album_cover.jpg")

    # Instructions to run the script:
    # 1. Make sure Python and the 'requests' library are installed.
    # 2. Save this script to a file, e.g., 'get_album_cover.py'.
    # 3. Run the script from the terminal using: python get_album_cover.py
