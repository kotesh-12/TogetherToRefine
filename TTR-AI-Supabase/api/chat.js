import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

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

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

    const { history, message, image, mimeType, userContext } = req.body;

    if (!message && !image) {
        return res.status(400).json({ error: 'No message or image provided' });
    }

    const systemPrompt = getSystemPrompt(userContext);

    // Try each model until one succeeds
    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const chat = model.startChat({
                history: history || [],
                systemInstruction: { parts: [{ text: systemPrompt }] },
            });

            const parts = [];
            if (message) parts.push({ text: message });
            if (image && mimeType) {
                parts.push({ inlineData: { mimeType, data: image } });
            }

            const result = await chat.sendMessage(parts);
            const response = await result.response;

            return res.status(200).json({ text: response.text() });
        } catch (error) {
            console.error(`Model ${modelName} failed:`, error.message);
            continue;
        }
    }

    return res.status(500).json({ error: 'AI is temporarily unavailable. Please try again.' });
}
