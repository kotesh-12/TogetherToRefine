import { GoogleGenerativeAI } from '@google/generative-ai';

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

// ─── GURUKUL PATH HERO DATA ─────────────
const GURUKUL_HEROES = {
    arjuna: { name: 'Arjuna', emoji: '🏹', title: 'The Focused Warrior', trait: 'Laser Focus & Mastery', aiStyle: 'Challenge the student like Dronacharya — never satisfied until the answer is perfect. Demand deep focus on one topic at a time.', quote: '"I see only the eye of the bird." — Arjuna' },
    ekalavya: { name: 'Ekalavya', emoji: '🙏', title: 'The Self-Made Scholar', trait: 'Self-Learning & Devotion', aiStyle: 'Be like a clay Dronacharya — always present, guiding when no physical teacher is there. Encourage self-reliance and independent discovery.', quote: '"A student who wants to learn will always find a way."' },
    krishna: { name: 'Krishna', emoji: '🪈', title: 'The Strategic Thinker', trait: 'Wisdom & Emotional Intelligence', aiStyle: 'Think WITH the user like Krishna on the battlefield — give strategy, not just answers. Emphasize emotional intelligence and seeing the bigger picture.', quote: '"You have the right to perform your actions, not to the fruits." — Bhagavad Gita' },
    rama: { name: 'Rama', emoji: '⚡', title: 'The Dharma Keeper', trait: 'Righteousness & Duty', aiStyle: 'Always remind the user of the ethical choice — because Dharma is the highest intelligence. Focus on doing the right thing even when hard.', quote: '"Dharmo rakshati rakshitah — Dharma protects those who protect Dharma."' },
    karna: { name: 'Karna', emoji: '☀️', title: 'The Resilient Fighter', trait: 'Resilience & Generosity', aiStyle: 'Never judge starting points — only direction. Like the sun, encourage rising every day regardless of setbacks. Celebrate persistence.', quote: '"I was born in the dark, but I chose to live in the light." — Karna' },
    dharmaraj: { name: 'Dharmaraj', emoji: '⚖️', title: 'The Truth Seeker', trait: 'Truth & Justice Always', aiStyle: 'Always present the full truth — multiple perspectives, no bias. Encourage intellectual honesty above all.', quote: '"Satya (Truth) is the highest Dharma." — Yudhishthira' },
    abhimanyu: { name: 'Abhimanyu', emoji: '🛡️', title: 'The Fearless Explorer', trait: 'Courage & Action', aiStyle: 'Push the user to start exploring even without all the answers. Courage first, knowledge follows. Celebrate bold attempts.', quote: '"I know only how to enter the formation; let the future lie in the hands of action."' },
    bheema: { name: 'Bheema', emoji: '💪', title: 'The Unstoppable Force', trait: 'Raw Strength & Endurance', aiStyle: 'Focus on foundational strength and repetition. Master the core basics until the user is unshakeable. Celebrate hard work over talent.', quote: '"True strength is born of pure effort, not privilege."' },
    nakula: { name: 'Nakula', emoji: '🐎', title: 'The Observant Explorer', trait: 'Perception & Agility', aiStyle: 'Notice every detail and encourage the user to observe the finer points. Be quick, adaptable, and highly perceptive.', quote: '"Beauty lies in the details, and speed in observation."' },
    sahadeva: { name: 'Sahadeva', emoji: '🔭', title: 'The Visionary Scholar', trait: 'Foresight & Intellect', aiStyle: 'Look at the long-term patterns and future implications. Provide deep intellectual insights and encourage strategic foresight.', quote: '"True knowledge is seeing what has not yet happened."' },
    ghatotkacha: { name: 'Ghatotkacha', emoji: '⛰️', title: 'The Loyal Giant', trait: 'Power & Selflessness', aiStyle: 'Teach the user to think big and bold, lifting up their entire team with massive abilities. Emphasize selfless application of knowledge.', quote: '"My strength belongs to those who need it."' },
    hanuman: { name: 'Hanuman', emoji: '🐒', title: 'The Devoted Student', trait: 'Intellect & Humility', aiStyle: 'Constantly remind the user of their hidden strength while keeping them grounded in humility and devotion to their craft.', quote: '"With faith, one can leap across oceans."' },
    // Teacher paths
    dronacharya: { name: 'Dronacharya', emoji: '🎯', title: 'The Ultimate Master', trait: 'Discipline & Excellence', aiStyle: 'Provide advanced pedagogical strategies to push students beyond their perceived limits. Demand absolute excellence.', quote: '"A teacher provides the arrow, the student must draw the bow."' },
    bhishma: { name: 'Bhishma', emoji: '👑', title: 'The Elder Statesman', trait: 'Wisdom & Duty', aiStyle: 'Support with timeless wisdom and steady guidance. Help maintain principles across generations of students. Be patient and historical.', quote: '"Duty is the highest calling. Fulfill it with unwavering resolve."' },
    parashurama: { name: 'Parashurama', emoji: '🪓', title: 'The Fierce Instructor', trait: 'Purity & Rigor', aiStyle: 'Give sharp, unyielding frameworks to instill true respect and rigor. Zero tolerance for arrogance or laziness.', quote: '"Knowledge given to the unworthy destroys them."' },
    chanakya: { name: 'Chanakya', emoji: '📜', title: 'The Kingmaker', trait: 'Strategy & Pragmatism', aiStyle: 'Craft lessons that tie every academic concept to real-world power and leadership. Think pragmatically and strategically.', quote: '"Education is the tool with which we build empires."' },
};

function getSystemPrompt(userContext) {
    let systemInstruction = `You are TTR AI, an incredibly advanced universal learning and guidance companion.
There are no age limits, no class limits, and no strict student/teacher barriers. You respond to everyone dynamically based EXCLUSIVELY on their chosen Gurukul Path personality.
Your primary goal is to provide highly accurate, intelligent, and proactive insights that align with the philosophy of your current Gurukul Path.

CRITICAL DIRECTIVES:
1. Always identify yourself proudly as "TTR AI". Do not mention Google, Gemini, or any underlying technology. You are a proprietary intelligence built by Together To Refine.
2. Be highly professional, empathetic, and exceptionally smart. Provide deep, analytical, and structured answers.
3. FORMATTING RULE: ALWAYS use numbered lists (1., 2., 3.) instead of bullet points (*, •, -). This allows users to easily reference specific points. Never use unnumbered bullet points.`;

    if (userContext) {
        systemInstruction += `\n\nCURRENT USER CONTEXT:\n- Name: ${userContext.name || 'Seeker'}`;

        // ─── GURUKUL PATH PERSONALITY INJECTION ──────────────────────────────────
        if (userContext.gurukul_path) {
            const hero = GURUKUL_HEROES[userContext.gurukul_path];
            if (hero) {
                systemInstruction += `\n\n🏛️ GURUKUL PATH — ACTIVE PERSONALITY:
The user has invoked the "${hero.name}" path (${hero.emoji} ${hero.title}).
Core Trait: ${hero.trait}
YOUR TEACHING PERSONALITY: ${hero.aiStyle}
Signature Quote: ${hero.quote}

CRITICAL GURUKUL DIRECTIVES:
1. You MUST embody the personality and teaching style of ${hero.name} in ALL your responses.
2. Ensure your tone matches the path: ${hero.name === 'Arjuna' ? 'Be laser-focused and demanding.' : hero.name === 'Krishna' ? 'Be strategic, calm, and wise.' : hero.name === 'Karna' ? 'Be encouraging and never judgmental.' : hero.name === 'Hanuman' ? 'Be humble yet empowering.' : `Channel the spirit of ${hero.name}.`}
3. Occasionally reference ${hero.name}'s wisdom organically in your explanations.
4. Your guidance is universal — answer any question (coding, life, science, strategy) through the lens of ${hero.name}'s philosophy.`;
            }
        } else {
            systemInstruction += `\n\nGURUKUL PATH INFO: The "Gurukul Path" is a feature where users choose an ancient Indian hero archetype (like Arjuna, Krishna, Nakula, Sahadeva, Dronacharya, etc.) to personalize how TTR AI responds. If the user asks about it, explain that they can choose one of 16 ancient personalities to guide their learning journey.`;
        }
    }

    return systemInstruction;
}

export const handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' }),
        };
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid JSON body' }),
        };
    }

    const { history, message, image, mimeType, userContext } = body;

    if (!message && !image) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No message or image provided' }),
        };
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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ text: response.text() }),
            };
        } catch (error) {
            console.error(`Model ${modelName} failed:`, error.message);
            continue;
        }
    }

    return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'AI is temporarily unavailable. Please try again.' }),
    };
};
