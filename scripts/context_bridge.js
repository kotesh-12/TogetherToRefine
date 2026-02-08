import fs from 'fs';
import path from 'path';

// Configuration
const OUTPUT_FILE = 'TTR_AI_CONTEXT.txt';
const INCLUDED_FILES = [
    'package.json',
    'mysql_schema.sql',
    'firestore.rules',
    'server.js',
    'src/App.jsx',
    'src/App.css',
    'src/firebase.js',
    'src/components/ProtectedRoute.jsx',
    'src/pages/Login.jsx',
    'src/pages/Signup.jsx',
    'src/pages/Details.jsx'
];

function generateContext() {
    let context = "PROJECT CONTEXT FOR AI COLLABORATION (TogetherToRefine)\n";
    context += "========================================================\n\n";

    // 1. Project Tech Stack
    context += "## 1. TECH STACK (package.json)\n";
    try {
        const pkg = fs.readFileSync('package.json', 'utf8');
        context += pkg + "\n\n";
    } catch (e) {
        context += "Error reading package.json\n\n";
    }

    // 2. Database Schema
    context += "## 2. DATABASE SCHEMA (MySQL)\n";
    try {
        if (fs.existsSync('mysql_schema.sql')) {
            context += fs.readFileSync('mysql_schema.sql', 'utf8') + "\n\n";
        } else {
            context += "No schema file found.\n\n";
        }
    } catch (e) {
        context += "Error reading schema.\n\n";
    }

    // 3. Key Files Listing
    context += "## 3. KEY SOURCE FILES\n";
    INCLUDED_FILES.forEach(file => {
        if (file === 'package.json' || file === 'mysql_schema.sql') return; // Already added
        context += `\n--- START OF FILE: ${file} ---\n`;
        try {
            if (fs.existsSync(file)) {
                context += fs.readFileSync(file, 'utf8');
            } else {
                context += "(File not found)";
            }
        } catch (e) {
            context += "(Error reading file)";
        }
        context += `\n--- END OF FILE: ${file} ---\n`;
    });

    // Write Output
    fs.writeFileSync(OUTPUT_FILE, context);
    console.log(`\n✅ CONTEXT GENERATED: ${OUTPUT_FILE}`);
    console.log(`\n📋 HOW TO USE WITH ANTHROPIC/CLAUDE:`);
    console.log(`1. Open ${OUTPUT_FILE}`);
    console.log(`2. Copy all text.`);
    console.log(`3. Paste into https://claude.ai (Free Web Chat)`);
    console.log(`4. Ask: "Conduct a Final Go-Live Audit. Verify that previously identified critical vulnerabilities (VULN 1-20) are patched. Review code quality, performance logic, and security posture for a production launch."`);
}

generateContext();
