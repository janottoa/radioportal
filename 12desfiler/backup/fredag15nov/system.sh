sudo systemctl stop script.service
sudo systemctl stop metadataFetcher.service
sudo systemctl start script.service
sudo systemctl start metadataFetcher.service

sudo systemctl status script.service
sudo systemctl status metadataFetcher.service
