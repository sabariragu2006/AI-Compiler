// test-gemini.js
const axios = require('axios');

const GEMINI_API_KEY = 'AIzaSyDzkTmdVplrF9budh2X8S7sWrMXNRs_CQg'; // Your key

async function testApiKey() {
  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`
    );

    console.log('✅ Gemini API Key is VALID!');
    console.log(`📌 Found ${response.data.models.length} models.`);
    console.log('SupportedContent:');
    response.data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .forEach(m => console.log(`  - ${m.name}`));
  } catch (err) {
    if (err.response) {
      console.error('❌ API Key Invalid or Quota Issue');
      console.error('Status:', err.response.status);
      console.error('Error:', err.response.data);
    } else {
      console.error('❌ Network or other error:', err.message);
    }
  }
}

testApiKey();