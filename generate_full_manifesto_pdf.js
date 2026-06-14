import { jsPDF } from 'jspdf';
import fs from 'fs';

const doc = new jsPDF();
const margin = 15;
const pageWidth = doc.internal.pageSize.getWidth();
let y = 20;

const addTitle = (text, size = 22) => {
    doc.setFontSize(size);
    doc.setTextColor(139, 92, 246);
    doc.text(text, margin, y);
    y += size / 2 + 5;
};

const addSubTitle = (text) => {
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.text(text, margin, y);
    y += 10;
};

const addText = (text, size = 10, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * (size / 2) + 5;
    checkPage();
};

const checkPage = () => {
    if (y > 270) {
        doc.addPage();
        y = 20;
    }
};

// Start PDF
addTitle("TTR-AI Technical Manifesto");
addText("Together To Refine — Elevating Human Intelligence through Ancient Wisdom & Modern AI", 12, [100, 100, 100]);

addSubTitle("1. Core Philosophy");
addText("Unlike standard AI that focuses on providing answers, TTR-AI focuses on providing understanding. Our core mission is to refine raw information into distilled wisdom using the 'Together To Refine' methodology.");

addSubTitle("2. Key Features");
addText("• 4-Way Learning System: Conceptual, Fictional, Storytelling, and Teaching modes to adapt to and user's specific learning style.");
addText("• Gurukul Path: Personality alignment with Arjuna, Krishna, and Chanakya for character-driven mentorship.");
addText("• Technical Sandbox: Real-time execution of web code (HTML/CSS/JS) within the chat interface.");
addText("• Multi-Source Intelligence: Deep integration with Tavily (Web), YouTube (Visual), and Academic searches.");

addSubTitle("3. Operational Mechanics");
addText("• Contextual Alignment: Fetches Hero archetype, learning mode, and user history before every prompt generation.");
addText("• Logic Refinement: Enforces the 'Granular Problem-Solving Protocol' which mandates formula usage and zero-skip calculations.");
addText("• Gamification: Tracks 'Dharma XP' and awards mastery points for high-quality interactions.");

addSubTitle("4. Recursive Training Loop");
addText("TTR-AI implements a 'Liked Response' system where high-quality AI answers are saved to a Supabase training database, exported via an Admin Dashboard, and used to further align the model's future outputs.");

// Finalize
const pdfPath = "C:/Users/hp/OneDrive/Documents/Desktop/TTR-AI/TTR_AI_COMPLETE_MANIFESTO.pdf";
const data = doc.output('arraybuffer');
fs.writeFileSync(pdfPath, Buffer.from(data));

console.log("Manifesto PDF generated at: " + pdfPath);
