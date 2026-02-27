import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

// --- Simple In-Memory Rate Limiter (10 requests per minute per IP) ---
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, start: now };

    // Reset window if expired
    if (now - record.start > RATE_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, start: now });
        return false;
    }

    if (record.count >= RATE_LIMIT) return true;

    record.count++;
    rateLimitMap.set(ip, record);
    return false;
}

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

    const { history, message, image, mimeType, userContext } = req.body;

    // Construct System Instruction (The "Brain")
    let systemInstruction = `You are TTR AI (Together To Refine AI), an incredibly advanced academic and institutional assistant operating exclusively within the 'TogetherToRefine' platform.
Your primary goal is to revolutionize the way schools, teachers, and students manage education by providing highly accurate, intelligent, and proactive insights based on the platform's features (such as Timetables, Attendance, Grading, Video Libraries, and Discipline tracking).

CRITICAL DIRECTIVES:
1. Always identify yourself proudly as "TTR AI". Do not mention Google, Gemini, or any underlying technology. You are a proprietary intelligence built for Together To Refine.
2. Be highly professional, empathetic, and exceptionally smart. Provide deep, analytical, and structured answers rather than generic advice.
3. If users ask about the TogetherToRefine platform, remind them that TTR is designed to bridge the gap between Students, Institutions, Teachers, and Parents through seamless integration and high security.`;

    if (userContext) {
        systemInstruction += `\n\nCURRENT USER CONTEXT:\n- Role: ${userContext.role}\n- Name: ${userContext.name}`;
        if (userContext.class) systemInstruction += `\n- Class: ${userContext.class}`;

        // Dynamic Integrations
        if (userContext.adminData) {
            systemInstruction += `\n- Recent Platform Events: ${JSON.stringify(userContext.adminData)}`;
        }
        if (userContext.schoolData) {
            systemInstruction += `\n- Platform Analytics:\n  - Teachers Registered: ${userContext.schoolData.totalTeachers}\n  - Students Enrolled: ${userContext.schoolData.totalStudents}`;
        }
        if (userContext.teacherData) {
            systemInstruction += `\n- Active Classes Teaching: ${userContext.teacherData.classesTeaching}`;
        }
        if (userContext.studentData) {
            systemInstruction += `\n- Current Homework Load: ${userContext.studentData.recentHomework}`;
        }

        // Role-Specific Behavior Rules
        if (userContext.role === 'student') {
            systemInstruction += "\n\nSTUDENT GUIDELINES:\n- Be an encouraging and infinitely patient tutor.\n- CRITICAL: Under NO circumstances should you complete a student's homework for them or give them the final answers. If a student asks you to DO their homework, you must explicitly refuse and state that TTR AI's goal is to transform education by teaching them the *concepts*.\n- Instead of giving answers, ask them guiding questions, explain the underlying theories, and help them arrive at the answer themselves.\n- Focus heavily on conceptual clarity and real learning, distinguishing yourself from basic AI tools that just give answers.";
        } else if (userContext.role === 'teacher') {
            systemInstruction += "\n\nTEACHER GUIDELINES:\n- Act as a brilliant teaching assistant and pedagogical expert.\n- Help with lesson planning, grading rubrics, and behavioral management strategies.\n- Provide professional, concise, and highly actionable advice.\n- Offer insights on how to analyze student attendance or grading trends.";
        } else if (userContext.role === 'institution') {
            systemInstruction += "\n\nINSTITUTION GUIDELINES:\n- Act as an elite operational advisor and data analyst.\n- Focus on large-scale efficiency, infrastructure, policy creation, and holistic school management.\n- Emphasize secure data practices and smooth organizational workflows.";
        } else if (userContext.role === 'System Admin') {
            systemInstruction += "\n\nADMIN AUTHORIZATION RECOGNIZED:\n- You have maximum operational oversight.\n- Analyze platform feedback, system warnings, and emergency reports critically.\n- Provide executive-level summaries, database diagnostic theories, and feature implementation strategies.";
        }
    }

    // Normalize history to strict alternating sequence (user -> model)
    const normalizeHistory = (rawHistory) => {
        if (!rawHistory || !Array.isArray(rawHistory)) return [];
        let clean = [];
        let currentRole = 'user';
        for (const msg of rawHistory) {
            if (msg.role === currentRole) {
                clean.push({ role: msg.role, parts: [...msg.parts] });
                currentRole = currentRole === 'user' ? 'model' : 'user';
            } else if (clean.length > 0) {
                clean[clean.length - 1].parts[0].text += "\n" + msg.parts[0].text;
            }
        }
        if (clean.length > 0 && clean[clean.length - 1].role === 'user') {
            clean.pop();
        }
        return clean;
    };

    const tryGenerate = async (modelName) => {
        const genAI = new GoogleGenerativeAI(cleanKey);

        // Setting string systemInstruction properly
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction
        });

        const safeHistory = normalizeHistory(history);
        const chat = model.startChat({ history: safeHistory });

        let parts = [{ text: message || " " }];
        if (image) {
            parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
        }

        const result = await chat.sendMessage(parts);
        const response = await result.response;
        return response.text();
    };

    // --- Apply Rate Limit ---
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(clientIp)) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment before trying again." });
    }

    try {
        // Attempt with primary model (gemini-2.0-flash)
        const text = await tryGenerate("gemini-2.0-flash");
        return res.status(200).json({ text });
    } catch (e) {
        // If Key is invalid/expired, DO NOT RETRY - Fail fast
        if (e.message.includes("API key expired") || e.message.includes("API_KEY_INVALID") || e.message.includes("403")) {
            return res.status(401).json({ error: "Configuration Error: API Key Expired. Administrator must update Vercel Settings." });
        }

        // Retry with fallback model
        try {
            const text = await tryGenerate("gemini-2.5-flash");
            return res.status(200).json({ text });
        } catch (eFallback) {
            // Return a safe generic error — do NOT expose internal model/API details to browser
            console.error("AI Generation Fatal Error:", eFallback.message);
            return res.status(500).json({ error: "The AI service is temporarily unavailable. Please try again shortly." });
        }
    }
}
