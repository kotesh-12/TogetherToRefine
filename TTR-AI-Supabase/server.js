import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Gemini Setup ──
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY is missing in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Try models in order of preference
const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
let currentModelName = MODELS[0];
let model = genAI.getGenerativeModel({ model: currentModelName });

// ── System Prompt ──
function getSystemPrompt(context) {
    const name = context?.name || 'User';
    return `You are TTR AI, an intelligent, friendly, and knowledgeable learning companion.

Your core traits:
- You are helpful, patient, and encouraging
- You explain complex topics in simple, clear language
- You use examples, analogies, and step-by-step breakdowns
- You can help with academics, coding, science, math, history, languages, and more
- You format responses using Markdown for readability (bold, lists, code blocks, etc.)
- You are conversational and warm — like a smart friend who loves teaching

The user's name is ${name}. Address them naturally.

Rules:
- Never say "I'm just an AI" — you ARE TTR AI, a premium learning assistant
- Give detailed, thorough answers
- Use code blocks with language tags for code
- Use bullet points and numbered lists for clarity
- Be encouraging and positive`;
}

// ── Chat Endpoint ──
app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, image, mimeType, userContext } = req.body;

        if (!message && !image) {
            return res.status(400).json({ error: 'No message or image provided' });
        }

        const systemPrompt = getSystemPrompt(userContext);

        const chat = model.startChat({
            history: history || [],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        });

        // Build message parts
        const parts = [];
        if (message) parts.push({ text: message });
        if (image && mimeType) {
            parts.push({ inlineData: { mimeType, data: image } });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;

        res.json({ text: response.text() });
    } catch (error) {
        console.error('AI Error:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));

        // Try fallback models
        for (let i = 1; i < MODELS.length; i++) {
            try {
                console.log(`Trying fallback model: ${MODELS[i]}`);
                const fallback = genAI.getGenerativeModel({ model: MODELS[i] });
                const systemPrompt = getSystemPrompt(req.body.userContext);
                const chat = fallback.startChat({
                    history: req.body.history || [],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                });
                const result = await chat.sendMessage([{ text: req.body.message || 'Hello' }]);
                const response = await result.response;
                console.log(`✅ Fallback ${MODELS[i]} succeeded`);
                return res.json({ text: response.text() });
            } catch (retryErr) {
                console.error(`Fallback ${MODELS[i]} failed:`, retryErr.message);
                continue;
            }
        }

        res.status(500).json({ error: 'AI is temporarily unavailable. Please try again in a moment.' });
    }
});

// ── Health Check ──
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', model: 'gemini-2.0-flash' });
});

// ── Start Server ──
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 TTR AI Server running on http://localhost:${PORT}`);
    console.log(`📡 Model: gemini-2.0-flash`);
    console.log(`✅ Ready to accept requests\n`);
});
