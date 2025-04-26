<!DOCTYPE html>
<html lang="no">
<head>
    <meta charset="UTF-8">
    <title>Radioportal</title>
</head>
<body>
    <h1>Radio Metadata</h1>
    <div id="metadata">
        <p>Stasjon: <span id="station_name">Laster...</span></p>
        <p>Sang: <span id="title">Laster...</span></p>
        <p>Beskrivelse: <span id="description">Laster...</span></p>
    </div>

    <script>
        async function fetchMetadata() {
            const response = await fetch("metadata.json");
            const data = await response.json();

            document.getElementById("station_name").textContent = data.station_name || "Ikke tilgjengelig";
            document.getElementById("title").textContent = data.title || "Ikke tilgjengelig";
            document.getElementById("description").textContent = data.description || "Ikke tilgjengelig";
        }

        setInterval(fetchMetadata, 30000); // Hent metadata hvert 30. sekund
        fetchMetadata(); // Hent ved første innlasting
    </script>
</body>
</html>
