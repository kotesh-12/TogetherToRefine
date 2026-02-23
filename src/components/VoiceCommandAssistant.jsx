import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useUser } from '../context/UserContext';
import axios from 'axios';

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://together-to-refine.vercel.app';

// WEB SPEECH API COMPATIBILITY
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceCommandAssistant({ onAnnouncement }) {
    const navigate = useNavigate();
    const { userData } = useUser();

    // States
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [responseMessage, setResponseMessage] = useState(null);
    const recognition = useRef(null);

    // Initialize Recognition
    useEffect(() => {
        if (SpeechRecognition) {
            recognition.current = new SpeechRecognition();
            recognition.current.continuous = false;
            recognition.current.lang = 'en-IN'; // Default to Indian English, catches Hindi words too often
            recognition.current.interimResults = false;

            recognition.current.onstart = () => setIsListening(true);
            recognition.current.onend = () => setIsListening(false);

            recognition.current.onresult = (event) => {
                const text = event.results[0][0].transcript;
                setTranscript(text);
                processCommand(text);
            };

            recognition.current.onerror = (event) => {
                console.error("Voice Error:", event.error);
                setIsListening(false);
                setResponseMessage("⚠️ Could not hear you. Try again.");
                setTimeout(() => setResponseMessage(null), 3000);
            };
        } else {
            console.warn("Speech Recognition not supported in this browser.");
        }
    }, []);

    const toggleListening = () => {
        if (!SpeechRecognition) {
            alert("Voice features rely on Web Speech API (Chrome/Edge/Safari). Please use a supported browser.");
            return;
        }

        if (isListening) {
            recognition.current.stop();
        } else {
            setTranscript("Listening...");
            setResponseMessage(null);
            recognition.current.start();
        }
    };

    // --- MAIN INTELLIGENCE (GEMINI + REGEX) ---
    const processCommand = async (command) => {
        setIsProcessing(true);
        const lowerCmd = command.toLowerCase();

        // 1. SIMPLE NAVIGATION COMMANDS (Instant)
        if (lowerCmd.includes("attendance")) {
            navigate('/attendance');
            resetUI("Opening Attendance...");
            return;
        }
        if (lowerCmd.includes("timetable") || lowerCmd.includes("schedule") || lowerCmd.includes("my class")) {
            navigate('/timetable');
            resetUI("Opening Timetable...");
            return;
        }
        if (lowerCmd.includes("video") || lowerCmd.includes("library") || lowerCmd.includes("movie")) {
            navigate('/video-library');
            resetUI("Opening Video Library...");
            return;
        }
        if (lowerCmd.includes("marks") || lowerCmd.includes("result") || lowerCmd.includes("score")) {
            navigate('/marks');
            resetUI("Opening Marks Management...");
            return;
        }
        if (lowerCmd.includes("group") || lowerCmd.includes("students") || lowerCmd.includes("my class")) {
            navigate('/group');
            resetUI("Opening Class Groups...");
            return;
        }
        if (lowerCmd.includes("homework") || lowerCmd.includes("assignment")) {
            navigate('/homework');
            resetUI("Opening Homework...");
            return;
        }
        if (lowerCmd.includes("analytic") || lowerCmd.includes("report") || lowerCmd.includes("progress")) {
            navigate('/analytics');
            resetUI("Opening Analytics...");
            return;
        }
        if (lowerCmd.includes("feedback") || lowerCmd.includes("comment")) {
            navigate('/general-feedback');
            resetUI("Opening Feedback...");
            return;
        }
        if (lowerCmd.includes("exam") || lowerCmd.includes("seating")) {
            navigate('/view-exam-seating');
            resetUI("Opening Exam Seating...");
            return;
        }
        if (lowerCmd.includes("scan") || lowerCmd.includes("digitize") || lowerCmd.includes("paper")) {
            navigate('/universal-scanner');
            resetUI("Opening AI Scanner...");
            return;
        }

        // 2. COMPLEX GENERATIVE COMMANDS (AI Powered)
        // Check for specific intents
        if (lowerCmd.includes("test") || lowerCmd.includes("paper") || lowerCmd.includes("quiz")) {
            await handleTestGeneration(command);
        } else if (lowerCmd.includes("announce") || lowerCmd.includes("message") || lowerCmd.includes("tell the class")) {
            // Extract message content roughly
            const msg = command.replace(/announce|announcement|send message|tell class|tell the class/gi, "").trim();
            if (onAnnouncement && msg) {
                onAnnouncement(capitalize(msg));
                resetUI("Drafting Announcement...");
            } else {
                setResponseMessage("📢 Say: 'Announce tomorrow is a holiday'");
                setIsProcessing(false);
            }
        } else if (lowerCmd.includes("explain") || lowerCmd.includes("what is") || lowerCmd.includes("how to")) {
            // Priority to general queries for "Explain..."
            await handleGeneralQuery(command);
        } else {
            // Fallback: Try to find a route anyway
            setResponseMessage("🤔 Searching for that page...");
            setIsProcessing(false);
        }
    };

    // INTENT 1: GENERATE TEST PAPER
    const handleTestGeneration = async (prompt) => {
        setResponseMessage("🤖 AI is writing the test paper...");

        try {
            // Call Backend to generate structured JSON for the test
            const systemPrompt = `
                You are a Teacher's Assistant. The user wants a test paper.
                Extract the Subject, Topic, Class, and Number of Questions from: "${prompt}".
                If missing, assume General Knowledge, 5 questions.
                
                OUTPUT JSON ONLY:
                {
                    "title": "Class Test: [Topic]",
                    "questions": [
                        { "q": "Question text", "options": ["A", "B", "C", "D"], "correct": "A" }
                    ]
                }
            `;

            // Use existing generic chat endpoint but with high temp for creativity
            const token = await userData.getIdToken();
            // Note: In real app, we should use a dedicated endpoint or secure token. 
            // Assuming we have a helper or can direct fetch.
            // Using the /api/chat endpoint from server.js

            const res = await axios.post(`${API_BASE}/api/chat`, {
                message: prompt,
                // userContext: removed to force use of systemInstruction for JSON output
                systemInstruction: systemPrompt
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const text = res.data.text;
            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json|```/g, '').trim();
            const data = JSON.parse(jsonStr);

            generatePDF(data);
            resetUI("✅ Test Paper Downloaded!");

        } catch (e) {
            console.error(e);
            setResponseMessage("❌ AI Error. Please try again.");
            setIsProcessing(false);
        }
    };

    // INTENT 2: GENERAL EXPLANATION / TRANSLATION
    const handleGeneralQuery = async (prompt) => {
        setResponseMessage("🤔 Thinking...");
        try {
            const token = await userData.getIdToken();
            const res = await axios.post(`${API_BASE}/api/chat`, {
                message: prompt,
                userContext: { role: 'teacher', name: userData.name },
                // Allow the server's default "Teacher" persona to handler it, which interprets pedagogical questions well
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // For now, just show the result in an alert or small modal. 
            // Ideally we'd have a chat bubble, but this is a "Command" interface.
            alert(`AI Response:\n\n${res.data.text}`);
            resetUI("Done.");
        } catch (e) {
            setResponseMessage("Error.");
            setIsProcessing(false);
        }
    };

    const generatePDF = (data) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text(userData?.institutionName || "School Test", 105, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text(data.title || "Class Test", 105, 25, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 105, 32, { align: 'center' });

        // Questions
        let y = 45;
        doc.setFontSize(11);

        data.questions.forEach((q, i) => {
            if (y > 270) { doc.addPage(); y = 20; }

            // Question Text
            const qTitle = `${i + 1}. ${q.q}`;
            doc.setFont('helvetica', 'bold');
            const splitTitle = doc.splitTextToSize(qTitle, 170);
            doc.text(splitTitle, 15, y);
            y += (splitTitle.length * 6) + 2;

            // Options
            doc.setFont('helvetica', 'normal');
            q.options.forEach((opt, idx) => {
                doc.text(`   ${String.fromCharCode(97 + idx)}) ${opt}`, 15, y);
                y += 6;
            });
            y += 4; // Spacing between questions
        });

        doc.save("Generated_Test.pdf");
    };

    const resetUI = (msg) => {
        setResponseMessage(msg);
        setIsProcessing(false);
        setTimeout(() => {
            setTranscript('');
            setResponseMessage(null);
        }, 2500);
    };

    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
        <>
            {/* FLOATING ACTION BUTTON */}
            <button
                onClick={toggleListening}
                style={{
                    position: 'fixed', bottom: '90px', right: '20px',
                    width: '60px', height: '60px', borderRadius: '50%',
                    background: isListening ? '#ff4757' : '#2ed573',
                    color: 'white', border: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    zIndex: 9999, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px', transition: 'all 0.3s'
                }}
            >
                {isListening ? '🛑' : '🎙️'}
            </button>

            {/* STATUS OVERLAY */}
            {(isListening || responseMessage || transcript) && (
                <div style={{
                    position: 'fixed', bottom: '160px', right: '20px',
                    background: 'white', padding: '15px', borderRadius: '15px',
                    boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
                    maxWidth: '300px', zIndex: 1999,
                    border: '1px solid #eee',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#636e72' }}>
                        {isProcessing ? '⚡ AI Processing...' : (isListening ? '👂 Listening...' : '✅ Assistant')}
                    </h4>

                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#2d3436' }}>
                        {responseMessage || transcript || "Speak now..."}
                    </p>

                    {!SpeechRecognition && (
                        <p style={{ color: 'red', fontSize: '10px' }}>Browser not supported.</p>
                    )}
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </>
    );
}
