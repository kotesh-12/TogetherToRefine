
import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSelector({ style }) {
    const { language, setLanguageOverride } = useLanguage();

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'hi', label: 'हिंदी (Hindi)' },
        { code: 'te', label: 'తెలుగు (Telugu)' },
        { code: 'mr', label: 'मराठी (Marathi)' },
        { code: 'ta', label: 'தமிழ் (Tamil)' },
        { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
        { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' }
    ];

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '14px' }}>
                🌐
            </span>
            <select
                value={language}
                onChange={(e) => setLanguageOverride(e.target.value)}
                style={{
                    padding: '6px 10px 6px 30px', // Left padding for globe icon
                    borderRadius: '20px',
                    border: '1px solid var(--divider)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 500,
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none', // Custom arrow if desired, or keep native
                    minWidth: '120px',
                    ...style
                }}
            >
                {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                        {lang.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
