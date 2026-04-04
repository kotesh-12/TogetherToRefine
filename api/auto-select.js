import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: 'Question is required' });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are the central router for TTR-AI, an intelligent learning platform.
Analyze the following user question and choose the absolute best "Hero/Path" and "Mode" to answer it.

Available Paths (Heroes):
- "default": The baseline helpful assistant. Works for general questions.
- "siddh": The elite 10x developer. Best for coding, debugging, programming, computer science.
- "chanyaka": The grand strategist. Best for business, statecraft, economics, strategy.
- "ramanujan": The pure mathematician. Best for rigorous math, theorems, complex derivations.
- "kalam": The visionary scientist. Best for physics, hard science, big ideas.

Available Modes (Learning Styles):
- "conceptual": Hardcore first-principles logic. Best for science, tight logic, direct rules.
- "fictional": Uses mythology, sci-fi, and narratives to explain. Best if they ask for a story, analogy, or it's a dry topic that needs excitement.
- "storytelling": Narrates a journey. Best for history or soft topics.
- "teaching": Acts as a warm Socratic tutor. Best for complete beginners saying "I don't understand".

User Question: "${question}"

Return exactly valid JSON and NO markdown formatting (no \`\`\`json).
Format:
{
    "path": "[selected hero]",
    "mode": "[selected mode]",
    "reason": "Brief 1 sentence reason why"
}
`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text().trim();
        if (rawText.startsWith('```json')) {
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        const parsed = JSON.parse(rawText);
        return res.status(200).json(parsed);

    } catch (err) {
        console.error('Auto-Select Error:', err);
        return res.status(500).json({ error: 'Failed to auto-select' });
    }
}
