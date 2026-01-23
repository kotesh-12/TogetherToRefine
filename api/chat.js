import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;
console.log("Runtime API Key Check:", API_KEY ? `Present (ends with ${API_KEY.slice(-4)})` : "Missing");

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        console.error("CRITICAL: GEMINI_API_KEY is missing in Vercel Environment Variables");
        return res.status(500).json({ error: "Server Configuration Error: API Key missing. Please set GEMINI_API_KEY in Vercel Settings." });
    }

    // Clean Key (remove potential quotes from copy-paste errors)
    const cleanKey = API_KEY.replace(/["']/g, "").trim();

    const { history, message, image, mimeType } = req.body;

    const tryGenerate = async (modelName) => {
        try {
            const genAI = new GoogleGenerativeAI(cleanKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            // Format history for API (ensure correct role sequences)
            // Note: This logic is partially in frontend, but good to ensure valid history here
            const chat = model.startChat({ history: history || [] });

            let parts = [{ text: message || " " }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
            }

            const result = await chat.sendMessage(parts);
            const response = await result.response;
            return response.text();
        } catch (error) {
            throw error;
        }
    };

    try {
        // Attempt with new model (gemini-2.0-flash)
        try {
            const text = await tryGenerate("gemini-2.0-flash");
            return res.json({ text });
        } catch (e) {
            console.warn(`Model 'gemini-2.0-flash' failed: ${e.message}`);

            // If Key is invalid/expired, DO NOT RETRY - Fail fast
            if (e.message.includes("API key expired") || e.message.includes("API_KEY_INVALID") || e.message.includes("403")) {
                throw new Error("Your API Key has expired or is invalid. Please update it in Vercel.");
            }

            // Otherwise, simple model 404/Overload -> Retry with stable model
            console.log("Switching to fallback model: 'gemini-1.5-flash'");
            const text = await tryGenerate("gemini-1.5-flash");
            return res.json({ text });
        }
    } catch (error) {
        console.error("AI Generation Fatal Error:", error.message);

        let errorMsg = error.message;
        // Ensure clearer message for frontend
        if (errorMsg.includes("expired") || errorMsg.includes("invalid")) {
            return res.status(401).json({ error: "Configuration Error: API Key Expired. Administrator must update Vercel Settings." });
        }

        return res.status(500).json({ error: `AI Service Error: ${errorMsg}` });
    }
}
