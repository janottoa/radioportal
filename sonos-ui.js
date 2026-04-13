/**
 * sonos-ui.js — Sonos integration for Radioportal
 *
 * Provides:
 *  - Output mode detection/switching (Local / Sonos)
 *  - Sending a stream URL to the Sonos HTTP-API at :3738
 *  - Correct Content-Type + request body so the /play endpoint
 *    no longer returns 500 Internal Server Error
 */

(function () {
    'use strict';

    /* ------------------------------------------------------------------ *
     *  Configuration                                                       *
     * ------------------------------------------------------------------ */
    // Allow override via <meta name="sonos-base-url" content="...">
    const metaEl = document.querySelector('meta[name="sonos-base-url"]');
    const SONOS_BASE_URL = (metaEl && metaEl.content)
        || `${window.location.protocol}//anthonsen.net:3738`;

    // Keep the current output mode: 'local' | 'sonos'
    let _outputMode = localStorage.getItem('outputMode') || 'local';

    // Currently active speaker/room name (empty = default / first Sonos room)
    let _activeSpeaker = localStorage.getItem('sonosSpeaker') || '';

    // Last URL sent to Sonos so we can detect no-op calls
    let _lastSonosUrl = null;

    /* ------------------------------------------------------------------ *
     *  Public API                                                          *
     * ------------------------------------------------------------------ */

    /**
     * Returns true when output should go to Sonos instead of browser audio.
     */
    window.shouldPlayToSonos = function () {
        return _outputMode === 'sonos';
    };

    /**
     * Returns the current output mode ('local' | 'sonos').
     */
    window.getOutputMode = function () {
        return _outputMode;
    };

    /**
     * Switch the output mode.
     * @param {'local'|'sonos'} mode
     */
    window.setOutputMode = function (mode) {
        _outputMode = mode;
        localStorage.setItem('outputMode', mode);
        _dispatchModeChange(mode);
    };

    /**
     * Toggle between local and Sonos output.
     * Returns the new mode.
     */
    window.toggleOutputMode = function () {
        const next = _outputMode === 'local' ? 'sonos' : 'local';
        window.setOutputMode(next);
        return next;
    };

    /**
     * Send a stream URL to the active Sonos speaker.
     *
     * Fixes the 500 error: sends proper JSON body with
     * Content-Type: application/json.
     *
     * @param {string} streamUrl  The radio stream URL to play.
     * @returns {Promise<boolean>} true on success, false on failure.
     */
    window.sonosSendToActive = async function (streamUrl) {
        if (!streamUrl) {
            console.warn('[sonos-ui] sonosSendToActive: no URL provided');
            return false;
        }

        // Build the endpoint: /[room]/play  or  /play if no room set
        const room = _activeSpeaker ? encodeURIComponent(_activeSpeaker) : null;
        const endpoint = room
            ? `${SONOS_BASE_URL}/${room}/play`
            : `${SONOS_BASE_URL}/play`;

        // Avoid re-sending the same URL unnecessarily
        if (_lastSonosUrl === streamUrl) {
            console.info('[sonos-ui] Already playing this URL on Sonos, skipping.');
            return true;
        }

        try {
            // Both 'uri' (node-sonos-http-api format) and 'url' (custom-server format)
            // are sent so the endpoint works regardless of which field it expects.
            const body = { uri: streamUrl, url: streamUrl };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                console.error(
                    `[sonos-ui] POST ${endpoint} → ${response.status}: ${text}`
                );
                return false;
            }

            _lastSonosUrl = streamUrl;
            console.info(`[sonos-ui] Now playing on Sonos: ${streamUrl}`);
            return true;
        } catch (err) {
            console.error('[sonos-ui] sonosSendToActive error:', err);
            return false;
        }
    };

    /**
     * Pause playback on the active Sonos speaker.
     * @returns {Promise<boolean>}
     */
    window.sonosPause = async function () {
        const room = _activeSpeaker ? encodeURIComponent(_activeSpeaker) : null;
        const endpoint = room
            ? `${SONOS_BASE_URL}/${room}/pause`
            : `${SONOS_BASE_URL}/pause`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) {
                console.error(`[sonos-ui] Pause failed: ${response.status}`);
                return false;
            }
            _lastSonosUrl = null;
            return true;
        } catch (err) {
            console.error('[sonos-ui] sonosPause error:', err);
            return false;
        }
    };

    /**
     * Fetch available Sonos rooms/zones from the server.
     * @returns {Promise<string[]>} Array of room names.
     */
    window.sonosFetchRooms = async function () {
        try {
            const response = await fetch(`${SONOS_BASE_URL}/zones`, {
                headers: { 'Accept': 'application/json' },
            });
            if (!response.ok) return [];
            const data = await response.json();
            // node-sonos-http-api returns an array of zone objects
            if (Array.isArray(data)) {
                return data.map(z => z.coordinator?.roomName || z.roomName || '').filter(Boolean);
            }
            return [];
        } catch {
            return [];
        }
    };

    /**
     * Set the active Sonos speaker/room by name.
     * @param {string} roomName
     */
    window.setSonosSpeaker = function (roomName) {
        _activeSpeaker = roomName;
        localStorage.setItem('sonosSpeaker', roomName);
        _lastSonosUrl = null; // reset so next play always sends
    };

    /**
     * Get the active Sonos speaker name.
     * @returns {string}
     */
    window.getSonosSpeaker = function () {
        return _activeSpeaker;
    };

    /* ------------------------------------------------------------------ *
     *  Internal helpers                                                    *
     * ------------------------------------------------------------------ */

    function _dispatchModeChange(mode) {
        const event = new CustomEvent('outputModeChanged', { detail: { mode } });
        document.dispatchEvent(event);
    }

    console.info('[sonos-ui] Loaded. Output mode:', _outputMode);
})();
