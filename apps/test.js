const assert = require('assert');

// Mock data to simulate the behavior
const mockData = {
    title: "Morgenklubben med Loven & Co",
    program: "Morgenklubben med Loven & Co",
    artist: "Program"
};

// Function to test the new logic
function processMetadata(data) {
    if (data.artist === data.program) {
        data.program = data.title;
        data.artist = null;
        data.title = null;
    }
    return data;
}

// Test case
describe('Process Metadata', function () {
    it('should set program to title and nullify artist and title if artist equals program', function () {
        const result = processMetadata({...mockData});
        assert.strictEqual(result.program, mockData.title);
        assert.strictEqual(result.artist, null);
        assert.strictEqual(result.title, null);
    });
});
