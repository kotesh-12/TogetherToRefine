import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize AI Access
// Secure Server-Side Key Only
const API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
    // Security: Restrict Access to Your Domains Only
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5000',
        'https://together-to-refine.vercel.app' // Replace with your actual Vercel domain
    ];

    const origin = req.headers.origin;

    // Allow requests from allowed origins or Server-to-Server (no origin)
    if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Default to safe fail - usually we don't set header, but for explictness/debugging:
        // res.setHeader('Access-Control-Allow-Origin', 'null'); 
    }

    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: "Server Configuration Error: API Key Missing" });
    }

    try {
        const { history, message, image, mimeType, systemInstruction } = req.body;
        const genAI = new GoogleGenerativeAI(API_KEY);

        // Helper to run chat
        const runChat = async (modelName) => {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction
            });

            const chat = model.startChat({ history: history || [] });

            let msgParts = [{ text: message || " " }];
            if (image) {
                msgParts.push({
                    inlineData: {
                        mimeType: mimeType || "image/jpeg",
                        data: image
                    }
                });
            }

            const result = await chat.sendMessage(msgParts);
            const response = await result.response;
            return response.text();
        };

        let text;
        try {
            console.log("Using primary model: gemini-2.0-flash");
            text = await runChat("gemini-2.0-flash");
        } catch (primaryError) {
            console.warn("Primary Model Failed, switching to fallback:", primaryError.message);
            text = await runChat("gemini-flash-latest");
        }

        res.status(200).json({ text });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}
