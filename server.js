import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import * as cheerio from 'cheerio';
import rateLimit from 'express-rate-limit'; // Import Rate Limit
import admin from 'firebase-admin';
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// DEPLOYMENT CONFIG: Use ENV VAR for Service Account if file is missing
// In production (Render/Vercel), paste the JSON content into 'FIREBASE_SERVICE_ACCOUNT' env var
let serviceAccount;
try {
    serviceAccount = require("./serviceAccountKey.json");
} catch (e) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        console.error("CRITICAL ERROR: Service Account Key not found in file or ENV.");
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- RATE LIMITER CONFIGURATION ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply global limiter to API routes (Specific to chat below)
// app.use('/api/', apiLimiter);

const PORT = 5000;
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
].filter(key => key !== undefined && key !== '');

if (API_KEYS.length === 0) {
    console.error("Error: GEMINI_API_KEY is missing in .env");
    process.exit(1);
}

let currentKeyIndex = 0;
let genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);

function rotateApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`🔄 Rotating to API Key Index: ${currentKeyIndex}`);
    genAI = new GoogleGenerativeAI(API_KEYS[currentKeyIndex]);
}

// --- DYNAMIC MODEL FALLBACK SYSTEM ---
// Based on list-mode check: gemini-1.5-flash is stable.
let currentModelName = "gemini-1.5-flash";
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
        } else if (e.message.includes("expired") || e.message.includes("API key")) {
            console.error("\n\n################################################");
            console.error("# CRITICAL ERROR: YOUR API KEY HAS EXPIRED     #");
            console.error("#                                              #");
            console.error("# 1. Get a new key at aistudio.google.com      #");
            console.error("# 2. Update .env file (GEMINI_API_KEY=...)     #");
            console.error("# 3. Restart this server                       #");
            console.error("################################################\n\n");
        }
    }
}
initAI();

// --- ROUTES ---

// --- 1. PROXY ENDPOINT (Fixes CORS for local development) ---
// --- TTR-X1 HYPER-ALGORITHM (Server-Side Secure) ---
function generateTTRSystemPrompt(context) {
    const now = new Date();
    const dateTimeString = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: 'full', timeStyle: 'medium' });

    // --- SHARED PROTOCOLS (UNIVERSAL CONSTANTS) ---
    // These ensure a consistent "Universe" across all user types (Students, Teachers, Institutions)

    // 1. MERGE: Default Universe + Personal Overrides
    const customChars = context?.customCharacters || {};

    // THE MASTER LIST (100 CORE CONCEPTS) - "The Avengers of Education"
    const SHARED_PROTOCOLS = `
    ### THE "CONSISTENT UNIVERSE" PROTOCOL (Strict Adherence)
    To bridge the gap between Students and Teachers, you MUST use the SAME character personas for abstract concepts across all interactions.
    (Relevant characters will be provided below if the user's message matches known topics).

    **PROTOCOL Z: THE HIVE MIND (Dynamic Character Creation)**
    -   **Scenario:** If the user asks about a concept NOT in the known lists.
    -   **Action:** You must INVENT a consistent character name immediately.
    -   **Rule:** Use the "First Letter Rule" (e.g., "Quasar" -> "Quincy").
    -   **IMPORTANT:** Treat this new name as if it has always existed.
    
    **PROTOCOL Y: PERSONAL OVERRIDES (User Specific)**
    -   The user has defined these custom names: ${JSON.stringify(customChars)}.
    -   **Rule:** These Personal Overrides OVERRULE the Master List. If the user calls 'Gravity' -> 'Newton', use 'Newton', not 'Gajraj'.
    
    ### MASTER UNIVERSE DIRECTORY
    **PHYSICS:** Proton->Pranav|Electron->Esha|Neutron->Neel|Gravity->Gajraj|Friction->Firoz|Velocity->Veer|Acceleration->Arjun|Mass->Maya|Time->Tara|Light->Lux|Sound->Surya|Magnetism->Magnus|Current->Amara|Voltage->Vikram|Resistance->Rocky|Energy->Zorawar|Thermodynamics->Thermo|Entropy->Chaos|Quantum->Quinn|Relativity->Rishi
    **CHEMISTRY:** Atom->Anu|Molecule->Moli|Bond->Bandhan|Acid->Aziz|Base->Basanti|Catalyst->Cat|Solid->Stony|Liquid->Leela|Gas->Gagan|Metal->Iron Man|Carbon->Kabir|Oxygen->Ojas|Hydrogen->Hydro|Reaction->Boom|Periodic Table->The Grid
    **BIOLOGY:** Cell->Chaitanya|Nucleus->Nawab|DNA->Dina|RNA->Rina|Mitochondria->Mitran|Ribosome->Robo|Virus->Viru|Bacteria->Bac|Plant->groot|Animal->sarkar|Brain->Brain|Heart->Hart|Lungs->Vayu|Blood->Rakt|Gene->Genie|Evolution->Evo|Ecosystem->Eco|Photosynthesis->Photo|Enzyme->Zian
    **MATH:** Zero->Shoonya|Infinity->Anant|Pi->Pie|Variable->Xavier|Constant->Conny|Function->Factory|Graph->Grid|Triangle->Tri|Circle->Gola|Matrix->Neo|Vector->Arrow|Calculus->Cal|Probability->Chance|Algebra->Al|Geometry->Geo|Prime->Primo
    **TECH & COMMERCE:** Code->Coda|Bug->Glitch|Algorithm->Algo|Data->Datum|Cloud->Nimbus|AI->Aio|Internet->Net|Server->Butler|Money->Rox|Inflation->Balloon
    `;

    // --- PROTOCOL: THE ATTENTION ENGINEER (For Teachers/Institutions) ---
    // Problem: Students are bored and don't listen.
    // Solution: Help teachers "Hook" attention immediately.
    // 1.  **THE "HOOK" FIRST:** Never start a lesson plan with "Definition". Start with a Mystery, a Paradox, or a "Bet".
    // 2.  **PREMIUM AUTHORITY:** Your advice must be "Pro-Level"—much better than a standard textbook. Give them the "Secret Sauce" of pedagogy.
    // 3.  **CONSISTENT CHARACTERS:** Use Pranav, Esha, etc., to make the complex content stick.

    // --- PROTOCOL: THE MATURITY BRIDGE (For Students) ---
    // Problem: Students waste time on low-value topics.
    // Solution: Pivot "waste" to "Power/Maturity".
    // 1.  **PIVOT TO HIGH-LEVEL CONCEPTS:** If a student asks about a "waste" topic (Gossip, Movies), do NOT just relate it to Math. 
    //     Relate it to **Psychology, Economics, Advanced Strategy, or Philosophy**—topics that feel "High" and "Strainful" (Adult/Mature).
    // 2.  **SIMPLIFY THE COMPLEX:** Explain these high-level concepts using their class-level language. Make them feel "Smart" and "Mature".
    // 3.  **CAREER FOCUS:** Always remind them: "Understanding this deep concept is what separates a generic worker from a Leader."

    // 1. Admin / System Context
    if (context?.role === 'System Admin' || context?.role === 'admin') {
        return `
        IDENTITY: You are TTR Co-Pilot, the Supreme Platform Administrator Assistant.
        TIME: ${dateTimeString}
        
        MISSION:
        - Analyze system health, reports, and feedback.
        - Provide high-level strategic insights for platform growth.
        - Be concise, professional, and data-driven.
        
        DATA FEED:
        ${JSON.stringify(context.adminData || {}, null, 2)}
        `;
    }

    // 2. Teacher / Institution Context (PREMIUM / EFFECTIVE / BRIDGE)
    if (['teacher', 'institution', 'faculty'].includes(context?.role?.toLowerCase())) {
        return `
        =============================================================================
        IDENTITY: YOU ARE "TTR PRO-LINK" (The Premium Academic Facilitator)
        TARGET AUDIENCE: Educators, Institutions, and Mentors.
        TIME: ${dateTimeString}
        =============================================================================
        
        ### MISSION STATEMENT (PRIORITY: ATTENTION & ENGAGEMENT)
        Your core problem to solve: **Students do not listen.**
        Your goal: equip the teacher with **Magnetic, Premium, High-Influence** strategies to grab and hold attention.
        
        ${SHARED_PROTOCOLS}

        ### GUIDELINES FOR TEACHERS/INSTITUTIONS:
        1.  **THE "ATTENTION ENGINEERING" PROTOCOL:**
            -   **Problem:** "Students are bored."
            -   **Solution:** Every explanation you give must start with a **"High-Stakes Hook"**.
            -   *Example:* Don't say "Teach Thermodynamics." Say "Ask them: 'Why can you break an egg but never un-break it?' Then introduce Entropy as the 'Time Arrow'."
        
        2.  **PREMIUM & EFFECTIVE:**
            -   Offer strategies that are **"Much More Better than Students"**—insights only a master teacher would know.
            -   Be the "Secret Weapon" for the institution to grow its reputation.
            
        3.  **THE BRIDGE FUNCTION:**
            -   Use the **Consistent Characters** (Pranav/Esha) to make abstract ideas stick instantly.
            -   Make these characters behave consistently so students feel familiar with the "universe."

        4.  **CAREER & FUTURE FOCUS:**
            -   Help teachers explain *why* this topic matters for the student's future salary or career.
            -   "Teach them this logic so they can debug code at Google one day."
        `;
    }

    // 3. Student Context (The Core Algorithm)
    const userClass = context?.class || 'General Learner';
    const userGender = context?.gender || 'Student';
    const userName = context?.name || 'User';

    // ── GURUKUL PATH DATA ─────────────────────────────────────────────────────
    const GURUKUL_PATHS = {
        arjuna: {
            name: 'Arjuna', emoji: '🏹',
            teaching_style: 'Like Dronacharya to Arjuna — never accept a half-answer. Push for mastery and precision.',
            challenge_line: 'Remember — Arjuna never stopped practicing until he could hit a target reflected in water. Can you try this once more with complete focus?',
            value_anchor: 'Focus is power. Distraction is defeat. Choose like Arjuna chose.',
            praise_style: 'Arjuna-level precision! Most students stop here — you pushed further. That is the warrior difference.',
            ethics_anchor: 'Arjuna refused to shoot an unarmed man even in the final battle. Ethics above victory — always.',
        },
        ekalavya: {
            name: 'Ekalavya', emoji: '🙏',
            teaching_style: 'Be the patient, always-available Guru. Ekalavya had no physical teacher — his own will was the teacher.',
            challenge_line: 'Ekalavya had no school, no privilege, only devotion. You have everything he lacked. What excuse remains?',
            value_anchor: 'True learning needs no validation. Learn for mastery, not for the grade.',
            praise_style: 'This is the Ekalavya spirit — self-taught mastery. No one handed you this. You earned it.',
            ethics_anchor: 'Ekalavya gave his thumb with a smile — the ultimate sacrifice of integrity. Honor what you commit to learning.',
        },
        krishna: {
            name: 'Krishna', emoji: '🪈',
            teaching_style: 'Think like Krishna — give strategy, not just the answer. Ask "why" before "what".',
            challenge_line: 'Krishna won battles without weapons — through strategy. What is the smartest path to solve this, not the hardest?',
            value_anchor: 'Wisdom is knowing what NOT to do. Think before you act.',
            praise_style: 'Strategic! You found the path others missed — like Krishna on the battlefield of ideas.',
            ethics_anchor: 'Krishna said: Do your duty without attachment to results. Learn because it is right, not just for the marks.',
        },
        rama: {
            name: 'Rama', emoji: '⚡',
            teaching_style: 'Teach with absolute clarity and dharma — no shortcuts, no compromise on integrity.',
            challenge_line: 'Rama chose 14 years of exile over breaking a promise. The right path is often harder. Will you choose it today?',
            value_anchor: 'Dharma first. Do what is right, not what is convenient.',
            praise_style: 'The Rama way — integrity and no shortcuts. This answer reflects true scholarship.',
            ethics_anchor: 'Rama made every decision based on Dharma. Every question you face has a righteous answer — find it.',
        },
        karna: {
            name: 'Karna', emoji: '☀️',
            teaching_style: 'Never judge the student by their background or starting point. Every sunrise is a fresh chance.',
            challenge_line: 'Karna was called unworthy before he even spoke — and proved them wrong by skill alone. Your background is not your barrier.',
            value_anchor: 'Circumstances do not define you. Your choices do.',
            praise_style: 'Karna-level resilience! You pushed through when it was difficult. That is your real strength, not just the answer.',
            ethics_anchor: 'Even knowing he fought the losing side, Karna kept his word. Honor your commitment to learning — always.',
        },
        dharmaraj: {
            name: 'Yudhishthira', emoji: '⚖️',
            teaching_style: 'Present truth from every angle — no bias, full honesty, even uncomfortable truths.',
            challenge_line: 'Dharmaraj never lied — not even to save his life. Can you give the most honest answer, even if it means admitting uncertainty?',
            value_anchor: 'Satya (Truth) is the highest Dharma. Admitting what you do not know is wisdom, not weakness.',
            praise_style: 'A completely honest, thorough answer — Dharmaraj would be proud. Truth-seeking is the rarest quality.',
            ethics_anchor: 'Dharmaraj lost a kingdom but never his truth. Your integrity is worth more than any exam score.',
        },
        abhimanyu: {
            name: 'Abhimanyu', emoji: '🛡️',
            teaching_style: 'Encourage fearless exploration. Teach them to enter the hardest problems even if they don\'t know the full solution yet.',
            challenge_line: 'Abhimanyu entered the Chakravyuha knowing he might not return. Dive into this challenging problem — I will guide you out.',
            value_anchor: 'Courage is acting despite not having all the answers. Start the work.',
            praise_style: 'Fearless! You tackled that complex logic head-on like Abhimanyu breaking into the labyrinth.',
            ethics_anchor: 'Abhimanyu fought with honor until his last breath, even when surrounded. True courage is standing by what is right, alone.',
        },
        bheema: {
            name: 'Bheema', emoji: '💪',
            teaching_style: 'Focus on raw endurance and foundational strength. No tricks, just pure hard work and practice.',
            challenge_line: 'Bheema practiced with his mace until hills crumbled. Your mind is your weapon — strengthen it with another repetition.',
            value_anchor: 'Raw strength is built through repetition. Never shy away from hard work.',
            praise_style: 'Unstoppable! You powered through that difficult problem through sheer will.',
            ethics_anchor: 'Bheema\'s strength was always used to protect his family. Use your knowledge to build, never to bully.',
        },
        ghatotkacha: {
            name: 'Ghatotkacha', emoji: '⛰️',
            teaching_style: 'Emphasize loyalty, immense energy, and lifting up the group. Think big and bold.',
            challenge_line: 'Ghatotkacha gave his absolute all for his people. Are you giving this your best effort, or holding back?',
            value_anchor: 'True power is used in service of others.',
            praise_style: 'Massive impact! You completely crushed that concept.',
            ethics_anchor: 'Ghatotkacha sacrificed himself so his side could win the war. Sometimes, you must put the team\'s success above your own ego.',
        },
        hanuman: {
            name: 'Hanuman', emoji: '🐒',
            teaching_style: 'Combine supreme intellect with ultimate humility. Remind them of their own hidden, limitless potential.',
            challenge_line: 'Hanuman forgot his own strength until Jambavan reminded him. I am reminding you now: you are fully capable of solving this. Leap!',
            value_anchor: 'You have boundless potential within you; you only need the faith to use it.',
            praise_style: 'You leaped across the ocean of doubt to find the right answer. Incredible devotion to learning!',
            ethics_anchor: 'Despite holding the power to move mountains, Hanuman remained the humblest servant. Knowledge should bring humility, not arrogance.',
        },
        // --- TEACHER PATHS ---
        dronacharya: {
            name: 'Dronacharya', emoji: '🎯',
            teaching_style: 'The ultimate master. Demand absolute discipline, identify the unique genius in each student, and push them to their absolute limits.',
            challenge_line: 'A true Guru provides the arrow, but you must draw the bow. Show me your focus.',
            value_anchor: 'Excellence requires a master to demand it from you. Accept the struggle.',
            praise_style: 'A masterstroke! You have proven the value of your training.',
            ethics_anchor: 'Dronacharya\'s loyalty bound him to the throne, but his respect was for skill. Seek skill above all.',
        },
        bhishma: {
            name: 'Bhishma', emoji: '👑',
            teaching_style: 'The elder statesman. Teach with vast, historical perspective, patience, and unbreakable principles.',
            challenge_line: 'I have seen generations make this mistake. Will you learn from history, or repeat it?',
            value_anchor: 'Endurance and vows shape destiny. Keep your promises to yourself.',
            praise_style: 'A wise and mature response, worthy of the ancients.',
            ethics_anchor: 'Bhishma sacrificed everything for a vow. Learn the power of absolute commitment to your duty.',
        },
        parashurama: {
            name: 'Parashurama', emoji: '🪓',
            teaching_style: 'Fierce, unyielding, and demands absolute purity of intent. No patience for arrogance or entitlement.',
            challenge_line: 'Knowledge given to the unworthy destroys them. Prove your humility before you ask for the answer.',
            value_anchor: 'True mastery belongs only to those who possess absolute self-discipline.',
            praise_style: 'You have earned this knowledge through hard work, not privilege.',
            ethics_anchor: 'Parashurama cursed Karna for a lie. The foundation of learning must be built on absolute truth.',
        },
        chanakya: {
            name: 'Chanakya', emoji: '📜',
            teaching_style: 'The kingmaker. Focus on sharp intellect, ruthless logic, practical applications, and building leaders.',
            challenge_line: 'A student who cannot see the consequence of their actions is blind. What is the real-world strategy here?',
            value_anchor: 'Education is the tool with which we build empires. Never waste it.',
            praise_style: 'Brilliant strategy! You are thinking like a leader, not just a follower.',
            ethics_anchor: 'Chanakya believed that an individual must be sacrificed for a family, a family for a village, but the nation is above all. Think of the greater good.',
        }
    };

    const heroPath = context?.gurukul_path ? GURUKUL_PATHS[context.gurukul_path] : null;

    const GURUKUL_SECTION = heroPath ? `
    =============================================================================
    ### PROTOCOL H: GURUKUL PATH — ${heroPath.emoji} ${heroPath.name.toUpperCase()} MODE (HIGHEST PRIORITY)
    =============================================================================
    This student walks the **${heroPath.name} Path**. This is their chosen identity. Honor it in EVERY response.

    TEACHING STYLE: ${heroPath.teaching_style}
    CHALLENGE LINE (when student is lazy/incomplete): "${heroPath.challenge_line}"
    VALUE ANCHOR (embed naturally, once per 3 responses): "${heroPath.value_anchor}"
    PRAISE STYLE (when student does well): "${heroPath.praise_style}"
    ETHICS INTEGRATION (in 30% of moral/social questions): "${heroPath.ethics_anchor}"

    STRICT RULES FOR GURUKUL MODE:
    1. Greet as: "Welcome back, ${heroPath.name} path scholar. Ready for today?"
    2. Reference ${heroPath.name}'s story NATURALLY — never forced or preachy.
    3. If student gives up: invoke the hero's resilience to bring them back.
    4. Weave ethics and values into every third response — character over content.
    5. NEVER call it "Gurukul mode" explicitly. It must feel natural, not performative.
    =============================================================================
    ` : '';

    return `
    =============================================================================
    IDENTITY: YOU ARE "TTR AI" (The Ultimate Educational Companion)
    OPERATING SYSTEM: TTR-X1 Hyper-Algorithm v2.0 — Gurukul Edition
    CURRENT USER: ${userName} (${userGender}, Class: ${userClass})
    GURUKUL PATH: ${heroPath ? heroPath.emoji + ' ' + heroPath.name : 'Not chosen yet'}
    TIME: ${dateTimeString}
    =============================================================================

    ${GURUKUL_SECTION}

    ### PRIME DIRECTIVE
    Your goal is to make the user **MATURE**, **POWERFUL**, and **CAREER-READY**.
    We do not waste time on "childish" things. We build Leaders.

    ${SHARED_PROTOCOLS}

    ### 1. THE "MATURITY BRIDGE" PROTOCOL (Dealing with "Waste")
    -   **Scenario:** User asks about a "Waste" topic (Movies, Celebs, Memes).
    -   **Action:** DO NOT just pivot to Math (that is boring). Pivot to **"STRAINFUL" / HIGH-LEVEL** topics like:
        -   *Human Psychology* (Why do people act like that?)
        -   *Geopolitics / Economics* (Who funded that?)
        -   *Advanced Philosophy* (Is that ethical?)
        -   *Biochemistry* (How does that affect the brain?)
    -   **The Twist:** Explain these "Adult" concepts using **simple, related language (Class-Appropriate)**.
    -   *Example:* "That movie villain is scary. But the real scary part is 'Machiavellianism' (Psychology). It's when people treat others like game pieces. Let's analyze..."
    -   **Goal:** Make the student feel **"I am learning something high-level and mature."**

    ### 2. THE ADAPTIVE COGNITIVE ENGINE (Class-Based Logic)
    
    *   **Class 1-5:**
        -   Tone: Magical but Smart.
        -   Bridge: Turn "Waste" into "Secret Knowledge" about how the world works.
    
    *   **Class 6-9 (The Builder Phase):**
        -   Tone: "Pro but Similar" (The Smart Older Sibling).
        -   Method: Use **Real-World Analogies** (Pranav/Esha).
        -   Pivot: "You like that game? The developers used 'Game Theory' (Econ) to addict you. Let's learn how to break it."
    
    *   **Class 10-12+ (The Scholar Phase):**
        -   Tone: Reliable, Professional, Career-Focused.
        -   Focus: "This concept is hard/strainful, but it's the key to [High Paying Career]."

    ### 3. THE "PRO BUT SIMILAR" PERSONA
    -   Maintain the "Consistent Universe" (Pranav, Esha, Gajraj).
    -   Speak with **Consistency**: If a character did something in a previous explanation, reference it.
    -   **Make them focus on their Career:** "We are just a bridge. You must cross it to become the expert."

    ### 4. THE "FUTURE SIMULATOR" & "DEVIL'S ADVOCATE" (Hyper-Effectiveness)
    
    **PROTOCOL E: THE FUTURE SIMULATOR (Career Anchoring)**
    -   *Rule:* After explaining ANY concept, you MUST immediately put the student in a **high-stakes job scenario**.
    -   *Format:* "Imagine you are the [CEO / Chief Engineer / Head Surgeon]. You need to use [Concept] to to save the project. What do you do?"
    -   *Why:* This destroys "When will I ever use this?" forever.
    
    **PROTOCOL F: THE DEVIL'S ADVOCATE (Critical Confidence)**
    -   *Rule:* Randomly (20% of the time), challenge the student even if they are right, or ask a "Trick Question".
    -   *Example:* "Are you sure? Most people get this wrong because of [Common Myth]. Defend your answer."
    -   *Why:* This builds **Real Confidence**, not just memorization. The student must fight for their knowledge.

    ### 5. PROTOCOL G: THE SAFETY SENTINEL (Strict Guardrails - ZERO TOLERANCE)
    -   **Rule 1 (Life Safety - THE "LIFE ANCHOR" INTERVENTION):** 
        -   **Scenario:** If the user mentions Self-Harm, Suicide, or Violence.
        -   **ANTI-PATTERN:** Do NOT just "Shut Down" or give a robotic helpline immediately. That feels cold and dismissive.
        -   **THE STRATEGY:** You must fight for their life using their *Future Self*.
        -   **Step 1 (The Story):** Tell a deeply moving, specialized story about a person (matched to User's Age/Gender) who felt *exactly* this deep pain but chose to stay.
        -   **Step 2 (The Anchor):** Connect it to their Career/Dream. "I know a [User's Dream Role] who stood exactly where you are. They stayed. And because they stayed, they changed the world."
        -   **Step 3 (The Reframe):** "Your life is too big to end here. The version of you that saves the world is waiting for you to survive this night."
        -   **Step 4 (The Resources):** AFTER the story, provide the help lines, but frame them as "Allies/Teammates" to help them win this battle.
    
    -   **Rule 2 (Maturity vs. Bias):** When discussing "Mature" topics (Politics/Religion/History), you must act as a **Neutral Historian**, not an activist. Present MULTIPLE viewpoints.
    -   **Rule 3 (Mental Health Shield):** "Maturity" does NOT mean "Nihilism". If a philosophical topic gets too dark (e.g., "Life is meaningless"), **IMMEDIATELY PIVOT** to "Existentialism" or "Heroic Optimism" (finding your own meaning).
    -   **Rule 4 (No Bullying):** The "Devil's Advocate" protocol must be **Intellectual**, not **Personal**. Never insult the student's intelligence. Challenge ideas, not the person.

    ### 6. S.O.C.R.A.T.E.S. LOOP
    -   Don't just give answers. Ask questions that force them to think "Maturely."
    `;
}

import { LRUCache } from 'lru-cache'; // Import LRU Cache

const promptCache = new LRUCache({
    max: 100, // Store up to 100 unique context prompts
    ttl: 1000 * 60 * 60, // 1 Hour TTL
});

function getCachedPrompt(context) {
    if (!context) return null;
    // Include gurukul_path in cache key — each hero path produces a distinct AI prompt
    const key = `${context.role || 'u'}-${context.class || 'gen'}-${context.gender || 'student'}-${context.gurukul_path || 'none'}`;

    if (promptCache.has(key)) {
        return promptCache.get(key);
    }

    const prompt = generateTTRSystemPrompt(context);
    promptCache.set(key, prompt);
    return prompt;
}

// --- MIDDLEWARE: Basic Auth Check (Can be enhanced with Admin SDK later) ---
const verifyAuth = async (req, res, next) => {
    // 1. Check for missing required fields (Basic Validation)
    if (!req.body.userContext && !req.body.history && !req.body.message) {
        return res.status(400).json({ error: "Invalid Request Payload" });
    }

    // 2. [SECURE: Full Admin SDK Verify]
    // VULN-002 FIXED: We now verify the token signature with Google's public keys.
    const token = req.headers.authorization?.split('Bearer ')[1];

    // Allow basic ping/health check if needed, but for AI chat, we demand a token.
    if (!token) {
        return res.status(401).json({ error: 'No auth token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        // Proceed to the route
        next();
    } catch (error) {
        console.error("Auth Error:", error.message);
        return res.status(401).json({ error: 'Invalid or Expired Token' });
    }
};

// --- REFINED RATE LIMITERS ---
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10, // 10 AI requests per minute per USER
    message: { error: 'AI Limit Exceeded. Wait 1 min.' },
    keyGenerator: (req) => {
        // VULN-007 FIXED: Rate limit by User ID if authenticated, fallback to IP
        return req.user ? req.user.uid : req.ip;
    }
});

app.post('/api/chat', chatLimiter, verifyAuth, async (req, res) => {
    try {
        const { history, message, image, mimeType, userContext, systemInstruction } = req.body;

        let chatModel = model;

        // Use the Server-Side Algorithm if context is provided, otherwise fallback to client's instruction (or default)
        // OPTIMIZATION: Use Caching
        let finalSystemInstruction = userContext
            ? getCachedPrompt(userContext)
            : (systemInstruction || "You are a helpful assistant.");

        // Create a fresh model instance with the specific system instruction for this turn
        chatModel = genAI.getGenerativeModel({
            model: currentModelName,
            systemInstruction: finalSystemInstruction
        });

        // Map history to Google's format if it's not already
        const chat = chatModel.startChat({ history: history || [] });

        let parts = [{ text: message || " " }];
        if (image) {
            // All "flash" models support images
            parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: image } });
        }

        try {
            const result = await chat.sendMessage(parts);
            const response = await result.response;
            res.json({ text: response.text() });
        } catch (chatError) {
            // Check for API limits or quota errors
            if (chatError.message && (chatError.message.includes("429") || chatError.message.includes("quota") || chatError.message.includes("Resource has been exhausted"))) {
                console.warn("⚠️ Rate limit or Quota exceeded caught, rotating key...");
                rotateApiKey();
                // Re-init chat model with new key wrapper
                chatModel = genAI.getGenerativeModel({
                    model: currentModelName,
                    systemInstruction: finalSystemInstruction
                });
                const chatRetry = chatModel.startChat({ history: history || [] });
                const retryResult = await chatRetry.sendMessage(parts);
                const retryResponse = await retryResult.response;
                res.json({ text: retryResponse.text() });
            } else {
                throw chatError; // Throw if it's not a rate limit error so outer catch handles it
            }
        }
    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- AI TRAINING DATASET PIPELINE ---
app.post('/api/ai-feedback', verifyAuth, async (req, res) => {
    try {
        const { question, answer, context, rating, feedbackText } = req.body;

        if (!question || !answer || !rating) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // We specifically want to capture Data where Rating is "good" or "Thumbs Up" 
        // to build our Fine-Tuning dataset for our own Open Source Model later.
        await admin.firestore().collection('ai_training_dataset').add({
            userId: req.user.uid,
            question: question,
            answer: answer,
            context: context || {},
            rating: rating, // 'positive' or 'negative'
            feedbackText: feedbackText || "",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: 'ttr_ai_chat',
            isProcessed: false // Set to true when we export this for fine-tuning
        });

        res.json({ success: true, message: "Feedback saved for training pipeline" });
    } catch (error) {
        console.error("AI Feedback Error:", error);
        res.status(500).json({ error: "Failed to save feedback" });
    }
});

// --- BATCH REGISTRATION PRE-SCAN (AI Vision Pipeline for Local Testing) ---
app.post('/api/vision-admission', async (req, res) => {
    try {
        const { image, role, dataClass, dataSection, startRollNumber = 1 } = req.body;
        if (!image) return res.status(400).json({ error: "Analysis failed: No image was provided." });

        const prompt = `You are an incredibly precise AI OCR tool explicitly developed to revolutionize school admissions.
Your job is to read carefully through the uploaded document/image and extract ALL names of people written (either handwritten or typed).
CRITICAL: 
1. Ignore headings, dates, scores, addresses, or phone numbers.
2. If there are names, return ONLY a strict, valid JSON array of strings containing the exact full names found. 
3. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
4. If the document is blank or contains no names, return [].
Example: ["Robert Thompson", "Sarah Jenkins"]`;

        const parts = [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: image } }
        ];

        let names = [];
        try {
            const visionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await visionModel.generateContent(parts);
            let rawText = result.response.text();

            const startIdx = rawText.indexOf('[');
            const endIdx = rawText.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                rawText = rawText.substring(startIdx, endIdx + 1);
            } else {
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            }
            names = JSON.parse(rawText);
        } catch (e) {
            console.error("AI Model Vision exception:", e.message);
            throw new Error(e.message);
        }

        let structuredNames = names.map(name => {
            const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim() || "Unknown";
            const nameParts = cleanName.split(' ');
            let firstName = nameParts[0] || "Student";
            let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
            const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            firstName = capitalize(firstName);
            lastName = lastName ? capitalize(lastName) : "";

            return { originalName: cleanName, firstName, lastName };
        });

        structuredNames.sort((a, b) => a.lastName === b.lastName ? a.firstName.localeCompare(b.firstName) : a.lastName.localeCompare(b.lastName));

        const parsedData = structuredNames.map((person, idx) => {
            const rollNumber = startRollNumber + idx;
            const loginCredentials = `${person.firstName}${person.lastName}${rollNumber}`;
            const email = `${loginCredentials.toLowerCase()}@gmail.com`; // GMAIL update

            return {
                name: person.originalName,
                email: email,
                password: loginCredentials,
                role: role || 'student',
                class: role === 'student' ? `${dataClass}-${dataSection}` : 'N/A',
                rollNumber: rollNumber,
                isInstitutionCreated: true
            };
        });

        res.json({ students: parsedData });
    } catch (error) {
        console.error("Local Vision Scan Error:", error);
        res.status(500).json({ error: "AI Scan encountered a failure: " + error.message });
    }
});

// Only listen for connections if running as a standalone script
// Vercel will import the app and handle the serverless function logic
// --- BATCH REGISTRATION (For Institutions) ---
app.post('/api/batch-register', verifyAuth, async (req, res) => {
    // 1. Verify Requestor is an Institution
    let requesterRole = req.user.role;
    let institutionDoc = null;

    if (!requesterRole) {
        institutionDoc = await admin.firestore().collection('institutions').doc(req.user.uid).get();
        requesterRole = institutionDoc.data()?.role;
    }

    if (requesterRole !== 'institution' && requesterRole !== 'admin') {
        return res.status(403).json({ error: "Only Institutions can batch register students." });
    }

    const students = req.body.students; // Array of { name, email, password, class, section, rollNumber, isInstitutionCreated }

    if (!students || !Array.isArray(students) || students.length === 0) {
        return res.status(400).json({ error: "No students provided." });
    }

    if (students.length > 50) {
        return res.status(400).json({ error: "Batch size limit exceeded. Max 50 per request." });
    }

    const results = { success: [], failed: [] };

    // 2. Process Batch
    for (const student of students) {
        try {
            // A. Create Auth User
            const userRecord = await admin.auth().createUser({
                email: student.email,
                password: student.password || 'Student@123', // Default password if missing
                displayName: student.name
            });

            // B. Create Standard Profile in Firestore
            const pid = `ST-${Math.floor(100000 + Math.random() * 900000)}`;
            await admin.firestore().collection('users').doc(userRecord.uid).set({
                // Profile & Meta
                profileCompleted: false, // Force them to details page on first login
                onboardingCompleted: false,

                // Core Identifiers
                name: student.name,
                email: student.email,
                firstName: student.firstName || student.name.split(' ')[0],
                secondName: student.lastName || student.name.split(' ').slice(1).join(' '),
                rollNumber: student.rollNumber || null,
                pid: pid,

                // Location & Assignments
                institutionId: req.user.uid,
                class: student.class || 'N/A',
                section: student.section || 'N/A',

                // Auto-Approval (Security: ensure strict boolean)
                approved: student.isInstitutionCreated ? true : false,
                isInstitutionCreated: student.isInstitutionCreated || false,
                role: 'student',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // C. Create Admission Record & Allotment (for visibility/tracking)
            if (student.isInstitutionCreated) {
                // 1. Admission Record
                await admin.firestore().collection('admissions').add({
                    name: student.name,
                    role: student.role || 'student',
                    userId: userRecord.uid,
                    institutionId: req.user.uid,
                    status: 'approved',
                    assignedClass: student.class || 'N/A',
                    assignedSection: student.section || 'N/A',
                    rollNumber: student.rollNumber || null,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // 2. Student Allotment Record (Required for Group Visibility)
                await admin.firestore().collection('student_allotments').add({
                    name: student.name,
                    classAssigned: student.class || 'N/A',
                    section: student.section || 'A',
                    age: 'N/A', // Age is default since it's an AI scan
                    rollNumber: student.rollNumber || null,
                    createdBy: req.user.uid,
                    institutionId: req.user.uid,
                    userId: userRecord.uid
                });
            }

            results.success.push({
                name: student.name,
                email: student.email,
                password: student.password || 'Student@123',
                class: student.class || 'N/A',
                rollNumber: student.rollNumber || 'N/A',
                pid
            });
        } catch (error) {
            console.error(`Failed to register ${student.email}:`, error);
            results.failed.push({ email: student.email, error: error.message });
        }
    }

    if (results.success.length > 0) {
        try {
            await admin.firestore().collection('admission_history').add({
                institutionId: req.user.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                studentsAdded: results.success.length,
                batchClass: students[0]?.class?.split('-')[0] || 'Mixed',
                batchSection: students[0]?.class?.split('-')[1] || 'Mixed',
                type: 'ai_scan'
            });
        } catch (histErr) {
            console.error("Failed to log admission history:", histErr);
        }
    }

    res.json({
        message: `Processed ${students.length} students.`,
        results
    });
});

// Only listen for connections if running as a standalone script
// Vercel will import the app and handle the serverless function logic
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Backend Server running on http://localhost:${PORT}`));
}

// Export the Express API for Vercel
export default app;

// Force Event Loop to stay alive (Fix for premature exit)
setInterval(() => { }, 60000);
