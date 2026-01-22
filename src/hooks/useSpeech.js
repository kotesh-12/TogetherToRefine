import { useState, useRef, useEffect } from 'react';

export function useSpeech() {
    const [isListening, setIsListening] = useState(false);
    const [speakingText, setSpeakingText] = useState(null);
    const recognitionRef = useRef(null);
    const utteranceRef = useRef(null);

    // Initial load for voices (optional fix for Chrome)
    useEffect(() => {
        const load = () => window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = load;
        load();
        return () => window.speechSynthesis.cancel();
    }, []);

    // Text-to-Speech (TTS)
    const speak = (text, langCode = 'en-US') => {
        if (!('speechSynthesis' in window) || !text) return;

        window.speechSynthesis.cancel(); // Clears queue

        if (speakingText === text) {
            setSpeakingText(null);
            return;
        }

        const cleanText = text.replace(/[*#_`\[\]]/g, '');

        // Chunking logic for Mobile stability
        // Split by reasonable punctuation or length
        const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];

        // Refine chunks if still too long (fallback split by simple length)
        const safeChunks = [];
        chunks.forEach(chunk => {
            if (chunk.length > 180) {
                const subChunks = chunk.match(/.{1,180}(\s|$)/g) || [chunk];
                safeChunks.push(...subChunks);
            } else {
                safeChunks.push(chunk);
            }
        });

        // Determine voice ONCE
        const voices = window.speechSynthesis.getVoices();
        let targetVoice = null;
        if (langCode && langCode !== 'en-US') {
            targetVoice = voices.find(v => v.lang.includes(langCode))
                || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
        }
        if (!targetVoice) {
            targetVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en"))
                || voices.find(v => v.lang.startsWith("en"));
        }

        // Queue utterances
        safeChunks.forEach((chunkText, index) => {
            const utterance = new SpeechSynthesisUtterance(chunkText);

            if (targetVoice) {
                utterance.voice = targetVoice;
                utterance.lang = targetVoice.lang;
            }

            // Only clear state on the very last chunk
            if (index === safeChunks.length - 1) {
                utterance.onend = () => setSpeakingText(null);
                utterance.onerror = () => setSpeakingText(null);
            }

            window.speechSynthesis.speak(utterance);
        });

        setSpeakingText(text);
    };

    // Speech-to-Text (STT)
    const listen = (onResult, lang = 'en-US') => {
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
        recognition.continuous = false;
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
