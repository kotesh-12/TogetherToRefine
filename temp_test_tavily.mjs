import dotenv from 'dotenv';
dotenv.config({ path: './TTR-AI-Supabase/.env' });

async function testTavily() {
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    console.log("Checking Tavily API Connection...");
    
    if (!TAVILY_KEY) {
        console.error("❌ Error: TAVILY_API_KEY is missing from .env");
        return;
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: TAVILY_KEY,
                query: "What is the latest news about TTR AI?",
                search_depth: "basic",
                max_results: 1
            })
        });

        const data = await response.json();
        
        if (response.ok && data.results) {
            console.log("✅ Tavily API Connection: SUCCESS");
            console.log("📡 Search result sample:", data.results[0]?.title || "No results found but API reached.");
        } else {
            console.error("❌ Tavily API Connection: FAILED");
            console.error("Response Status:", response.status);
            console.error("Error Detail:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ Connection Error:", error.message);
    }
}

testTavily();
