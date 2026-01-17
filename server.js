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
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- DYNAMIC MODEL FALLBACK SYSTEM ---
// Based on list-mode check: gemini-2.0-flash is available.
let currentModelName = "gemini-2.0-flash";
let model = genAI.getGenerativeModel({ model: currentModelName });

async function initAI() {
    console.log(`🤖 Testing AI Model: ${currentModelName}...`);
    try {
        await model.generateContent("Test");
        console.log(`✅ ${currentModelName} is working!`);
    } catch (e) {
        console.warn(`⚠️ ${currentModelName} Failed:`, e.message);
        if (e.message.includes("404") || e.message.includes("not found")) {
            console.log("🔄 404 Error. Switching to 'gemini-flash-latest'...");
            currentModelName = "gemini-flash-latest";
            model = genAI.getGenerativeModel({ model: currentModelName });
            try {
                await model.generateContent("Test");
                console.log("✅ Fallback to 'gemini-flash-latest' Successful!");
            } catch (ex) {
                console.error("❌ Fallback failed:", ex.message);
            }
        }
    }
}
initAI();

// --- ROUTES ---

app.post('/api/fetch-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL" });
        const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(r.data);
        $('script, style, nav, header, footer').remove();
        res.json({ content: $('body').text().trim().substring(0, 10000) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, image, mimeType } = req.body;
        const chat = model.startChat({ history: history || [] });

        let parts = [{ text: message || " " }];
        if (image) {
            // All "flash" models support images
            parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;
        res.json({ text: response.text() });
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend Server running on http://localhost:${PORT}`));

// Force Event Loop to stay alive (Fix for premature exit)
setInterval(() => { }, 60000);
