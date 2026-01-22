import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

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
        return res.status(500).json({ error: "Server Configuration Error: API Key missing" });
    }

    const { history, message, image, mimeType } = req.body;

    // Fallback logic for model selection
    const tryGenerate = async (modelName) => {
        try {
            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({ model: modelName });

            const chat = model.startChat({ history: history || [] });

            let parts = [{ text: message || " " }];
            if (image) {
                parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
            }

            const result = await chat.sendMessage(parts);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.warn(`Model ${modelName} failed:`, error.message);
            throw error;
        }
    };

    try {
        // Try preferred model first
        try {
            const text = await tryGenerate("gemini-2.0-flash");
            return res.json({ text });
        } catch (e) {
            // Fallback to stable model
            const text = await tryGenerate("gemini-1.5-flash");
            return res.json({ text });
        }
    } catch (error) {
        console.error("AI Generation Error:", error);
        return res.status(500).json({ error: error.message || "AI Service Unavailable" });
    }
}
