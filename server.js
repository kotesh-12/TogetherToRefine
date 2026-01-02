import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = 5000;

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY or VITE_GEMINI_API_KEY is missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
// Using gemini-2.0-flash as tested
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Endpoint to fetch and parse URL content (Smart Notes)
app.post('/api/fetch-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });

        console.log(`Fetching URL: ${url}`);
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        // Limit text length to avoid token limits
        const truncatedText = text.substring(0, 10000);

        res.json({ content: truncatedText });
    } catch (error) {
        console.error("URL Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch URL content", details: error.message });
    }
});

// Endpoint for AI Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, image, mimeType } = req.body;

        const chat = model.startChat({
            history: history
        });

        let msgParts = message;
        if (image) {
            msgParts = [
                { text: message },
                {
                    inlineData: {
                        mimeType: mimeType || "image/jpeg",
                        data: image
                    }
                }
            ];
        }

        const result = await chat.sendMessage(msgParts);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error("Server AI Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server running on http://localhost:${PORT}`);
});
