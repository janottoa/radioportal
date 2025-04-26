
// Main script to manage imports and initialization
import { setupWebSocket } from './modules/websocket.js';
import { initializeAudio } from './modules/audioControl.js';
import { loadMenu } from './modules/navigation.js';

document.addEventListener("DOMContentLoaded", () => {
    loadMenu('main');
    console.log("Radioportal initialized.");
});
