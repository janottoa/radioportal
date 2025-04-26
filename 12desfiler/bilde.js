import subprocess

def download_image_with_wget(image_url, save_path):
    try:
        # Bruker wget til å laste ned bildet og lagre det i angitt sti
        result = subprocess.run(['wget', '-O', save_path, image_url], check=True)
        if result.returncode == 0:
            print(f"Bilde lagret til {save_path}")
        else:
            print("wget returnerte en feil.")
    except subprocess.CalledProcessError as e:
        print(f"Kunne ikke laste ned bildet med wget: {e}")

def main():
    image_url = "https://lastfm.freetls.fastly.net/i/u/300x300/e6ee04f22c8c96f5de8b4045a34a07da.png"
    save_path = "/var/www/radioportal/album_cover.jpg"

    # Last ned bildet ved bruk av wget
    download_image_with_wget(image_url, save_path)

if __name__ == "__main__":
    main()
