
import React, { createContext, useContext, useState, useEffect } from 'react';
import { resources } from '../translations/resources';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    // Default to 'en' (English), but load from localStorage if available
    const [language, setLanguage] = useState(localStorage.getItem('ttr_language') || 'en');

    useEffect(() => {
        localStorage.setItem('ttr_language', language);
        // Optionally update <html> lang attribute for accessibility
        document.documentElement.lang = language;
    }, [language]);

    const toggleLanguage = () => {
        setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'));
    };

    // Helper translation function
    const t = (key) => {
        return resources[language]?.translation[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
