#!/bin/bash

# Gå til katalogen hvor Flask-skriptet ditt er plassert
cd /var/www/radioportal

# Aktiver virtual environment
source myenv/bin/activate

# Kjør bare koden som trengs for Spotify Fetcher, IKKE Flask-tjenesten
# (Fjern linjen som kjører spotify_album_cover_service.py hvis den allerede blir kjørt av flask_album_cover.service)

#!/bin/bash


