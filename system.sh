

sudo systemctl stop script.service
sudo systemctl start script.service
sudo systemctl status script.service

sudo systemctl stop metadataFetcher.service
sudo systemctl start metadataFetcher.service
sudo systemctl status metadataFetcher.service

sudo systemctl stop flask_album_cover.service
sudo systemctl start flask_album_cover.service
sudo systemctl status flask_album_cover.service

sudo systemctl stop spotify_fetcher.service
sudo systemctl start spotify_fetcher.service
sudo systemctl status spotify_fetcher.service

sudo systemctl status script.service
sudo systemctl status metadataFetcher.service
sudo sysudo systemctl status spotify_fetcher.service
stemctl status flask_album_cover.service

sudo systemctl stop script.service
sudo systemctl stop metadataFetcher.service
sudo systemctl stop flask_album_cover.service
sudo systemctl stop spotify_fetcher.service

sudo systemctl start script.service
sudo systemctl start metadataFetcher.service
sudo systemctl start flask_album_cover.service
sudo systemctl start spotify_fetcher.service

Dette kan brukes på alle
sudo systemctl restart spotify_fetcher.service
sudo systemctl enable spotify_fetcher.service


sudo systemctl stop server.service
sudo systemctl start server.service
sudo systemctl status server.service
sudo systemctl status node.service
sudo systemctl status dash.service

Den under er stasjon.js
sudo systemctl stop nodejs-server.service
sudo systemctl start nodejs-server.service
sudo systemctl status nodejs-server.service

flask_album_cover.service
spotify_fetcher.service
nodejs-server.service
spotify_album_cover.service
systemctl list-units --type=service | grep -i "radioportal\|proxy\|spotify"
find /etc/systemd/system /lib/systemd/system -name "*.service"


ffprobe <input_file_or_stream_url>
// Dette vil vise detaljer om filen eller strømmen, inkludert:
// Format (for eksempel MP4, MKV, etc.)
// Video- og lydkodeker
// Bitrate
// Oppløsning (for video)
// FPS (bilder per sekund)
// Lydkanaler (for lyd)


ffmpeg -i <input_file_or_stream_url>
// Hvis du har en mediestrøm (f.eks. 
// en videofil eller en live stream) 
// og ønsker å hente ut detaljer om format, 
// codec, bitrate, oppløsning osv., 
// kan du bruke kommandoen:

ffmpeg -i rtmp://example.com/live/stream
// Streamanalyse

ffprobe -v error -show_entries format_tags -of default=noprint_wrappers=1 lyd.mp3
