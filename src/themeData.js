export const THEME_CATEGORIES = {
    minimal: "Minimal & Clean",
    dark: "Midnight & Deep",
    nature: "Nature & Earth",
    retro: "Vintage & Retro",
    cyber: "Cyber & Neon",
    glass: "Glassmorphism",
    vibrant: "Vibrant & Fun"
};

export const THEMES = [
    // --- MINIMAL ---
    { id: 'dark', name: 'Midnight', category: 'dark', colors: { primary: '#0f0f14', accent: '#6C63FF' } },
    { id: 'white', name: 'Pure White', category: 'minimal', colors: { primary: '#ffffff', accent: '#2563eb' }, mode: 'light' },
    { id: 'soft-grey', name: 'Soft Grey', category: 'minimal', colors: { primary: '#f3f4f6', accent: '#4b5563' }, mode: 'light' },
    { id: 'ivory', name: 'Ivory Ease', category: 'minimal', colors: { primary: '#fdfcf0', accent: '#8b4513' }, mode: 'light' },
    { id: 'nordic', name: 'Nordic Snow', category: 'minimal', colors: { primary: '#eceff4', accent: '#5e81ac' }, mode: 'light' },
    { id: 'slate', name: 'Slate Calm', category: 'minimal', colors: { primary: '#1e293b', accent: '#38bdf8' } },

    // --- MIDNIGHT & DEEP ---
    { id: 'obsidian', name: 'Obsidian', category: 'dark', colors: { primary: '#050505', accent: '#ffffff' } },
    { id: 'space', name: 'Deep Space', category: 'dark', colors: { primary: '#0b0d17', accent: '#d0d6f9' } },
    { id: 'dracula', name: 'Dracula', category: 'dark', colors: { primary: '#282a36', accent: '#bd93f9' } },
    { id: 'tokyo-night', name: 'Tokyo Night', category: 'dark', colors: { primary: '#1a1b26', accent: '#7aa2f7' } },
    { id: 'monokai', name: 'Monokai Noir', category: 'dark', colors: { primary: '#272822', accent: '#a6e22e' } },
    { id: 'charcoal', name: 'Charcoal Deep', category: 'dark', colors: { primary: '#121212', accent: '#ff5722' } },
    { id: 'blood-moon', name: 'Blood Moon', category: 'dark', colors: { primary: '#1a0505', accent: '#ff4d4d' } },
    { id: 'void', name: 'The Void', category: 'dark', colors: { primary: '#000000', accent: '#00ff41' } },

    // --- NATURE & EARTH ---
    { id: 'emerald', name: 'Emerald', category: 'nature', colors: { primary: '#022c22', accent: '#10b981' } },
    { id: 'forest', name: 'Deep Forest', category: 'nature', colors: { primary: '#064e3b', accent: '#fbbf24' } },
    { id: 'desert', name: 'Sahara', category: 'nature', colors: { primary: '#fef3c7', accent: '#d97706' }, mode: 'light' },
    { id: 'ocean', name: 'Atlantic', category: 'nature', colors: { primary: '#0c4a6e', accent: '#38bdf8' } },
    { id: 'savanna', name: 'Savanna', category: 'nature', colors: { primary: '#451a03', accent: '#f59e0b' } },
    { id: 'autumn', name: 'Autumn Leaf', category: 'nature', colors: { primary: '#431407', accent: '#ea580c' } },
    { id: 'moss', name: 'Mossy Rock', category: 'nature', colors: { primary: '#14532d', accent: '#bef264' } },
    { id: 'arctic', name: 'Arctic Ice', category: 'nature', colors: { primary: '#f0f9ff', accent: '#0ea5e9' }, mode: 'light' },

    // --- RETRO ---
    { id: 'retro-c64', name: 'C64 Classic', category: 'retro', colors: { primary: '#4040a0', accent: '#ffffff' }, ux: 'retro' },
    { id: 'retro-terminal', name: 'Green Matrix', category: 'retro', colors: { primary: '#000000', accent: '#00ff00' }, ux: 'retro' },
    { id: 'retro-amber', name: 'Amber Monitor', category: 'retro', colors: { primary: '#1a1100', accent: '#ffb000' }, ux: 'retro' },
    { id: 'retro-gameboy', name: 'Gameboy DMG', category: 'retro', colors: { primary: '#8bac0f', accent: '#0f380f' }, ux: 'retro' },
    { id: 'retro-cassette', name: '80s Cassette', category: 'retro', colors: { primary: '#2d2d2d', accent: '#f9d423' }, ux: 'retro' },
    { id: 'retro-blueprint', name: 'Blueprint', category: 'retro', colors: { primary: '#0047ab', accent: '#ffffff' }, ux: 'retro' },

    // --- CYBER & NEON ---
    { id: 'cyber-neon', name: 'Cyber Neon', category: 'cyber', colors: { primary: '#0d0221', accent: '#00f5d4' } },
    { id: 'cyber-pink', name: 'Night City', category: 'cyber', colors: { primary: '#150050', accent: '#ff00ff' } },
    { id: 'cyber-acid', name: 'Acid Rain', category: 'cyber', colors: { primary: '#1a1a1a', accent: '#ccff00' } },
    { id: 'cyber-vapor', name: 'Vaporwave', category: 'cyber', colors: { primary: '#2d1b4d', accent: '#ff71ce' } },
    { id: 'cyber-pulse', name: 'Neon Pulse', category: 'cyber', colors: { primary: '#010101', accent: '#39ff14' } },

    // --- GLASSMORPHISM ---
    { id: 'glass-dark', name: 'Glass Dark', category: 'glass', colors: { primary: 'rgba(15, 15, 20, 0.85)', accent: '#6C63FF' }, ux: 'glass' },
    { id: 'glass-light', name: 'Glass Light', category: 'glass', colors: { primary: 'rgba(255, 255, 255, 0.7)', accent: '#2563eb' }, mode: 'light', ux: 'glass' },
    { id: 'glass-violet', name: 'Violet Glass', category: 'glass', colors: { primary: 'rgba(46, 16, 101, 0.8)', accent: '#c084fc' }, ux: 'glass' },
    { id: 'glass-ocean', name: 'Sea Glass', category: 'glass', colors: { primary: 'rgba(8, 51, 68, 0.8)', accent: '#22d3ee' }, ux: 'glass' },

    // --- VIBRANT ---
    { id: 'purple', name: 'Royal Purple', category: 'vibrant', colors: { primary: '#1a0b2e', accent: '#d946ef' } },
    { id: 'vibrant-sun', name: 'Sunset Glow', category: 'vibrant', colors: { primary: '#451a03', accent: '#f97316' } },
    { id: 'vibrant-berry', name: 'Wild Berry', category: 'vibrant', colors: { primary: '#831843', accent: '#fb7185' } },
    { id: 'vibrant-lava', name: 'Lava Rock', category: 'vibrant', colors: { primary: '#1a0000', accent: '#ef4444' } },
    { id: 'vibrant-indigo', name: 'Indigo Night', category: 'vibrant', colors: { primary: '#1e1b4b', accent: '#818cf8' } },
    { id: 'vibrant-gold', name: 'Royal Gold', category: 'vibrant', colors: { primary: '#000000', accent: '#fbbf24' } },
    { id: 'vibrant-rose', name: 'Rose Petal', category: 'vibrant', colors: { primary: '#fff1f2', accent: '#e11d48' }, mode: 'light' },
    { id: 'vibrant-lime', name: 'Electric Lime', category: 'vibrant', colors: { primary: '#052e16', accent: '#22c55e' } },
    { id: 'vibrant-sakura', name: 'Sakura Zen', category: 'vibrant', colors: { primary: '#fff5f7', accent: '#f472b6' }, mode: 'light' },
    { id: 'vibrant-coffee', name: 'Cold Brew', category: 'vibrant', colors: { primary: '#272320', accent: '#d2b48c' } },
    { id: 'vibrant-mint', name: 'Choco Mint', category: 'vibrant', colors: { primary: '#064e3b', accent: '#6ee7b7' } },
    { id: 'vibrant-honey', name: 'Honey Pot', category: 'vibrant', colors: { primary: '#fffbeb', accent: '#f59e0b' }, mode: 'light' },
    { id: 'vibrant-galaxy', name: 'Galaxy Mix', category: 'vibrant', colors: { primary: '#020617', accent: '#6366f1' } },
];
