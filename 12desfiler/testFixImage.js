const { fixImage } = require('./fixImage');

// Test cases
const testCases = [
    { input: 'Deeply Still In Love / ROLE MODEL', expected: { title: 'ROLE MODEL', artist: 'Deeply Still In Love' } },
    { input: 'Unknown Artist - Some Song', expected: { title: 'Some Song', artist: 'Unknown Artist' } },
    { input: 'No Delimiter', expected: { title: 'No Delimiter', artist: null } },
    { input: '', expected: { title: '', artist: null } },
    { input: null, expected: { title: null, artist: null } }
];

// Run tests
testCases.forEach(({ input, expected }, index) => {
    const result = fixImage(input);
    console.log(`Test Case #${index + 1}`);
    console.log(`Input: "${input}"`);
    console.log(`Expected: ${JSON.stringify(expected)}`);
    console.log(`Result:   ${JSON.stringify(result)}`);
    console.log(result.title === expected.title && result.artist === expected.artist ? '✅ Test Passed' : '❌ Test Failed');
    console.log('--------------------------------');
});
