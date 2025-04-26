import subprocess
import json
import time

def fetch_metadata(url):
    try:
        result = subprocess.run(
            ["ffmpeg", "-i", url, "-f", "ffmetadata", "-"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        metadata = {}
        
        for line in result.stderr.splitlines():
            line = line.lower()
            if "icy-title" in line:
                key, value = line.split(":", 1)
                metadata['title'] = value.strip()
            elif "icy-name" in line:
                key, value = line.split(":", 1)
                metadata['station_name'] = value.strip()
            elif "icy-description" in line:
                key, value = line.split(":", 1)
                metadata['description'] = value.strip()
        
        return metadata
    except Exception as e:
        print(f"Feil ved henting av metadata: {e}")
        return {}

def save_metadata_to_json(url, filename="metadata.json"):
    metadata = fetch_metadata(url)
    with open(filename, "w") as f:
        json.dump(metadata, f)

# Hovedløkken for å hente metadata med faste intervaller
url = "https://p4.p4groupaudio.com/P04_AH"  # Erstatt med din kanal-URL
while True:
    save_metadata_to_json(url)
    print("Metadata oppdatert.")
    time.sleep(10)  # Oppdater hvert 10. sekund
