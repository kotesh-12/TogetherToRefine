import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

console.log(`Checking API Key: ${API_KEY ? (API_KEY.substring(0, 8) + "...") : "MISSING"}`);

async function check() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(url);
        console.log("✅ API Connection Successful!");
        console.log("--- AVAILABLE MODELS ---");
        response.data.models.forEach(m => console.log(m.name));
        console.log("-----------------------");
    } catch (error) {
        console.error("❌ Failed to list models.");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

check();
