import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: './TTR-AI-Supabase/.env' });

async function testTavily() {
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    console.log("Starting diagnostic...");
    
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_KEY,
                query: "latest news",
                max_results: 1
            })
        });

        const data = await response.json();
        fs.writeFileSync('tavily_result.json', JSON.stringify({
            status: response.status,
            success: response.ok,
            data: data
        }, null, 2));
        console.log("Diagnostic complete. Results written to tavily_result.json");
    } catch (error) {
        fs.writeFileSync('tavily_result.json', JSON.stringify({ error: error.message }, null, 2));
    }
}

testTavily();
