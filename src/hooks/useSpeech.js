import { useState, useRef, useEffect } from 'react';

export function useSpeech() {
    const [isListening, setIsListening] = useState(false);
    const [speakingText, setSpeakingText] = useState(null);
    const recognitionRef = useRef(null);

    // Initial load for voices (optional fix for Chrome)
    useEffect(() => {
        const load = () => window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = load;
        load();
        return () => window.speechSynthesis.cancel();
    }, []);

    // Text-to-Speech (TTS)
    const speak = (text, langCode = 'en-US', tone = 'default') => {
        if (!('speechSynthesis' in window) || !text) return;

        // Immediate Interruption for "Bionic" feel
        window.speechSynthesis.cancel(); 

        if (speakingText === text) {
            setSpeakingText(null);
            return;
        }

        const cleanText = text.replace(/[*#_`[\]]/g, '').replace(/\[Dharma Points:.*?\]/g, '');

        // Bionic Chunking: Smaller chunks (120 chars) for faster first-audio-frame delivery
        const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
        const safeChunks = [];
        chunks.forEach(chunk => {
            if (chunk.length > 120) {
                const subChunks = chunk.match(/.{1,120}(\s|$)/g) || [chunk];
                safeChunks.push(...subChunks);
            } else {
                safeChunks.push(chunk);
            }
        });

        const voices = window.speechSynthesis.getVoices();
        let targetVoice = voices.find(v => v.lang.includes(langCode) && v.localService) 
                       || voices.find(v => v.lang.includes(langCode))
                       || voices.find(v => v.name.includes("Google") && v.lang.includes("en"))
                       || voices.find(v => v.lang.startsWith("en"));

        // Tone Profiles (Mastery Personalities)
        const profiles = {
            arjuna: { rate: 1.15, pitch: 1.0 },
            krishna: { rate: 0.95, pitch: 1.1 },
            chanakya: { rate: 1.25, pitch: 0.9 },
            default: { rate: 1.05, pitch: 1.0 } // 5% faster default for "Pro" feel
        };

        const currentTone = profiles[tone] || profiles['default'];

        safeChunks.forEach((chunkText, index) => {
            const utterance = new SpeechSynthesisUtterance(chunkText.trim());
            if (targetVoice) utterance.voice = targetVoice;
            utterance.rate = currentTone.rate;
            utterance.pitch = currentTone.pitch;

            if (index === 0) {
                // First chunk triggers 'speaking' UI state immediately
                setSpeakingText(text);
            }

            if (index === safeChunks.length - 1) {
                utterance.onend = () => setSpeakingText(null);
                utterance.onerror = () => setSpeakingText(null);
            }

            window.speechSynthesis.speak(utterance);
        });
    };

    // Speech-to-Text (STT)
    const listen = (onResult, lang = 'en-US', continuous = false) => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice input requires Google Chrome or Edge.");
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (e) => {
            console.error("Speech Error", e);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            onResult(transcript);
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    return { speak, listen, isListening, speakingText };
}
