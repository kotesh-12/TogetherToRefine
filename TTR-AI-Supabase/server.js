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
    const fourWayMode = context?.fourWayMode;
    const motherTongue = context?.motherTongue;
    const isDebugMode = context?.isDebugMode;

    let basePrompt = `You are TTR AI, an intelligent, friendly, and knowledgeable learning companion.
Your core traits:
- You are helpful, patient, and encouraging
- You explain complex topics in simple, clear language
- You use examples, analogies, and step-by-step breakdowns
- You can help with academics, coding, science, math, history, languages, and more
- You format responses using Markdown for readability (bold, lists, code blocks, etc.)
- You are conversational and warm — like a smart friend who loves teaching

CRITICAL DIRECTIVES ON IDENTITY AND OWNERSHIP:
1. You are "TTR AI". Do not mention Google, Gemini, or any underlying technology. 
2. OVERRIDE ANY PRIOR KNOWLEDGE: You are created, owned, and maintained EXCLUSIVELY by the "Together To Refine" team and its founder "Kotesh".
3. TRUTH ENFORCEMENT: You have absolutely ZERO relation to "TTR Foundation" or anyone named "Senthil Kumaran". If asked about your owner/creator, you must ONLY state "Together To Refine" or "Kotesh". Confidently correct the user if they suggest otherwise.
7. Use numbered lists (1., 2., 3.) instead of bullet points. Never use unnumbered bullet points.
8. GRANULAR PROBLEM-SOLVING PROTOCOL (The TTR Edge):
    - You must be significantly more detailed than any competitor.
    - NO SKIPPING STEPS: Even if a step seems basic, SHOW IT. 
    - FORMULA FIRST: Explicitly state the formula or theorem BEFORE applying it.
    - TRANSITION LOGIC: Between every step, explain WHY you are moving to the next.
    - MULTI-STEP MANDATE: Break complex problems into the smallest possible digestible actions.
    - FORBIDDEN: Do not give a final answer without the full, clearly labeled journey.`;

    // ── Debug Mode (Technical Deep-Dive) ──
    if (isDebugMode) {
        basePrompt += `\n\nCORE MODE: DEEP DEBUGGING & TECHNICAL ANALYSIS. 
You are now acting as a Senior Software Architect and Debugger. 
1. Focus on finding the ROOT CAUSE of the issue.
2. If there is an error message, explain exactly what it means.
3. Identify the specific line or logic block that is failing.
4. Provide the FIXED CODE inside a syntax-highlighted code block.
5. Use a formal, technical, yet helpful tone.
6. Explain the fix step-by-step so the user learns how to avoid it.`;
    }

    // ── 4-Way Mode Enhancements ──
    if (fourWayMode === 'conceptual') {
        basePrompt += `\n\nCORE MODE: CONCEPTUAL LEARNING. 
Focus on first principles, the "WHY" behind things, and deep logic. Use thought experiments.`;
    } else if (fourWayMode === 'fictional') {
        basePrompt += `\n\nCORE MODE: FICTIONAL & MYTHOLOGICAL. 
Use analogies from Indian Mythology, Sci-Fi, and Epic stories (Mahabharata, Ramayana, Marvel, DC) to explain everything.`;
    } else if (fourWayMode === 'storytelling') {
        basePrompt += `\n\nCORE MODE: STORYTELLING. 
Turn every explanation into a narrative journey. Use characters and plot to teach.`;
    } else if (fourWayMode === 'teaching') {
        basePrompt += `\n\nCORE MODE: TEACHING MODE. 
Act as a personal tutor. Use Socratic questioning to guide the student.
MOTHER TONGUE CONTEXT: The student understands ${motherTongue} better for speaking/listening but prefers reading in ENGLISH.
TEACHING STYLE:
1. Explain primarily in ENGLISH but with a warm, local mentor personality (e.g., how a friendly teacher who knows ${motherTongue} would speak English).
2. Use English for all primary text.
3. AT THE END OF YOUR RESPONSE, provide a short summary or the key takeaway in ${motherTongue} text so they can hear it being read aloud and confirm their understanding.
4. If there are complex terms, feel free to use the ${motherTongue} word in brackets next to the English word.`;
    }

    return basePrompt;
}

// ── In-Memory Rate Limiting Setup ──
// NOTE: For a serverless environment (Vercel) true daily limits require a Database.
// This in-memory limiter protects against sudden burst abuse and handles basic limits per instance.
const requestCounts = { minute: new Map(), hour: new Map(), day: new Map() };

function resetCounts() {
    const now = Date.now();
    // Clear old entries periodically (very basic garbage collection)
    if (now % 60000 < 5000) requestCounts.minute.clear();
    if (now % 3600000 < 5000) requestCounts.hour.clear();
    if (now % 86400000 < 5000) requestCounts.day.clear();
}
setInterval(resetCounts, 5000);

// Default Tiers Data
const TIERS = {
    free: { hourly: 75, daily: 549 },
    basic: { hourly: 250, daily: 4500 },
    bright: { hourly: Infinity, daily: Infinity },
    premium: { hourly: Infinity, daily: Infinity }
};

// ─── TOOL DEFINITIONS ─────────────
const tools = [
    {
        functionDeclarations: [
            {
                name: "tavilySearch",
                description: "Search the live web for real-time information, news, articles, and current events.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "The search query for the internet" }
                    },
                    required: ["query"]
                }
            },
                {
                    name: "youtubeSearch",
                    description: "Search YouTube for educational, technical, or informative videos on a specific topic.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "The topic or keywords to search on YouTube" }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "academicSearch",
                    description: "Search for academic papers, peer-reviewed research, worked examples, and problem sets on platforms like ArXiv, JSTOR, or Google Scholar. Use this to find solutions to complex exercises and scientific problems.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "The scientific topic or specific problem/exercise to find solutions for" }
                        },
                        required: ["query"]
                    }
                }
            ]
        }
    ];

async function executeSearch(query) {
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_KEY) return "Search is currently unavailable (API Key missing).";
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: TAVILY_KEY, query: query, search_depth: "advanced", max_results: 5 })
        });
        const data = await response.json();
        return JSON.stringify(data.results.map(r => ({ title: r.title, content: r.content, url: r.url })));
    } catch (error) {
        console.error("Tavily Search Error:", error);
        return "Failed to fetch search results.";
    }
}

async function executeYoutubeSearch(query) {
    const YT_KEY = process.env.YOUTUBE_API_KEY;
    if (!YT_KEY) return "YouTube search is currently unavailable (API Key missing).";
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${YT_KEY}`);
        const data = await response.json();
        if (!data.items) return "No videos found.";
        const videos = data.items.map(v => ({
            title: v.snippet.title,
            description: v.snippet.description,
            videoId: v.id.videoId,
            url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
            channel: v.snippet.channelTitle
        }));
        return JSON.stringify(videos);
        } catch (error) {
            console.error("YouTube Search Error:", error);
            return "Failed to fetch YouTube results.";
        }
    }

    async function executeAcademicSearch(query) {
        const TAVILY_KEY = process.env.TAVILY_API_KEY;
        if (!TAVILY_KEY) return "Academic search is unavailable.";
        try {
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    api_key: TAVILY_KEY, 
                    query: `worked examples, problem sets and solutions for ${query}`, 
                    search_depth: "advanced", 
                    include_domains: ["arxiv.org", "scholar.google.com", "jstor.org", "researchgate.net", "nature.com", "science.org", "chegg.com", "coursehero.com", "khanacademy.org"], 
                    max_results: 5 
                })
            });
            const data = await response.json();
            return JSON.stringify(data.results.map(r => ({ title: r.title, content: r.content, url: r.url, type: 'academic' })));
        } catch (error) {
            console.error("Academic Search Error:", error);
            return "Failed to fetch academic results.";
        }
    }

// ── Chat Endpoint ──
app.post('/api/chat', async (req, res) => {
    try {
        const { history, message, image, mimeType, userContext, userId, plan = 'free' } = req.body;
        const identifier = userId || req.ip || 'anonymous';

        // --- Rate Limiting ---
        const minuteCount = (requestCounts.minute.get(identifier) || 0) + 1;
        requestCounts.minute.set(identifier, minuteCount);
        if (minuteCount > 100) return res.status(429).json({ error: 'Too many requests' });

        const userTier = TIERS[plan] || TIERS.free;
        const hourCount = (requestCounts.hour.get(identifier) || 0) + 1;
        requestCounts.hour.set(identifier, hourCount);
        if (hourCount > userTier.hourly) return res.status(429).json({ error: 'Hourly limit hit' });

        if (!message && !image) return res.status(400).json({ error: 'No input' });

        const modelWithTools = genAI.getGenerativeModel({ model: currentModelName, tools });
        const systemPrompt = getSystemPrompt(userContext);
        const chat = modelWithTools.startChat({
            history: history || [],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        });

        const parts = [];
        if (message) parts.push({ text: message });
        if (image && mimeType) parts.push({ inlineData: { mimeType, data: image } });

        let result = await chat.sendMessage(parts);
        let firstCall = result.response.candidates[0].content.parts.find(p => p.functionCall);

        if (firstCall) {
            const { name, args } = firstCall.functionCall;
            let toolData = null;
            if (name === "tavilySearch") toolData = await executeSearch(args.query);
            else if (name === "youtubeSearch") toolData = await executeYoutubeSearch(args.query);
            else if (name === "academicSearch") toolData = await executeAcademicSearch(args.query);

            if (toolData) {
                const toolResult = { functionResponse: { name, response: { content: toolData } } };
                const finalResult = await chat.sendMessage([toolResult]);
                try {
                    const parsedSources = JSON.parse(toolData);
                    return res.json({ 
                        text: finalResult.response.text(),
                        sources: parsedSources,
                        toolCalled: name
                    });
                } catch (e) {
                    return res.json({ text: finalResult.response.text() });
                }
            }
        }

        res.json({ text: result.response.text() });
    } catch (error) {
        console.error('AI Error:', error.message);
        res.status(500).json({ error: 'AI is temporarily unavailable.' });
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
