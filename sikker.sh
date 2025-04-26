#!/bin/bash

# Katalog for backup
BACKUP_DIR="/var/www/sikker/$(date +'%Y%m%d_%H%M%S')"

# Opprett backup-katalog
mkdir -p "$BACKUP_DIR"

# Base-katalog for radioportalen
RADIOPORTAL_DIR="/var/www/radioportal"

# Liste over tjenester som skal sikkerhetskopieres
SERVICES=(
    "script.service"
    "metadataFetcher.service"
    "spotify_fetcher.service"
    "spotify_album_cover.service"
    "nodejs-server.service"
    "flask_album_cover.service"
    "server.service"
    "node.service"
    "dash.service"
)

echo "Starter sikkerhetskopiering..."

# Sikkerhetskopierer tjenestefiler
echo "Sikkerhetskopierer tjenestefiler..."
for SERVICE in "${SERVICES[@]}"; do
    SERVICE_PATH="/etc/systemd/system/$SERVICE"
    if [ -f "$SERVICE_PATH" ]; then
        cp "$SERVICE_PATH" "$BACKUP_DIR/"
        echo "Kopierte $SERVICE_PATH til $BACKUP_DIR/"
    else
        echo "Tjenestefil $SERVICE_PATH ikke funnet!"
    fi
done

# Sikkerhetskopierer alle .html-filer i rotkatalogen og stasjon-undermappen
echo "Sikkerhetskopierer .html-filer..."
find "$RADIOPORTAL_DIR" -maxdepth 1 -name "*.html" -exec cp --parents {} "$BACKUP_DIR/" \;
find "$RADIOPORTAL_DIR/stasjon" -name "*.html" -exec cp --parents {} "$BACKUP_DIR/" \;

# Sikkerhetskopierer alle .js og .py-filer i radioportalen
echo "Sikkerhetskopierer alle .js og .py-filer i $RADIOPORTAL_DIR..."
find "$RADIOPORTAL_DIR" -type f \( -name "*.js" -o -name "*.py" \) -exec cp --parents {} "$BACKUP_DIR" \;

# Ferdig
echo "Sikkerhetskopiering fullført. Filer lagret i $BACKUP_DIR"
