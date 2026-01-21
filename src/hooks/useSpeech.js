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
    const speak = (text) => {
        if (!('speechSynthesis' in window) || !text) return;

        window.speechSynthesis.cancel(); // Stop valid current speech

        if (speakingText === text) {
            // Toggle off if clicking same text
            setSpeakingText(null);
            return;
        }

        const cleanText = text.replace(/[*#_`]/g, ''); // Remove Markdown chars
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utteranceRef.current = utterance;

        // Try to pick a better voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes("Google") && v.lang.includes("en"))
            || voices.find(v => v.lang.startsWith("en"));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => setSpeakingText(null);
        utterance.onerror = () => setSpeakingText(null);

        setSpeakingText(text);
        window.speechSynthesis.speak(utterance);
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
