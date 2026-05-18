import React from 'react';
import { MagneticSubmitButton } from '../ChatComponents';
import { useNativeAgent } from '../../hooks/useNativeAgent';


import useChatStore from '../../store/useChatStore';

export const ChatInput = ({
    handleSend,
    inputRef,
    handleMicClick,
    isListening,
    handleFileChange,
    fileInputRef,
    selectedImage,
    setSelectedImage,
    selectedDocs,
    setSelectedDocs,
    isDragging,
    setIsDragging,
    showSlashMenu,
    setShowSlashMenu,
    showLangMenu,
    setShowLangMenu,
    fourWayMode,
    availablePills = ['Explain simply', 'Deep dive', 'Summarize', 'Verify']
}) => {
    // Zustand State
    const {
        input,
        setInput,
        loading,
        isAgentMode,
        motherTongue,
        setMotherTongue,
        zenMode
    } = useChatStore();

    const { captureHomework, vibrate } = useNativeAgent();

    const adjustInputHeight = (textarea) => {
        if (!textarea) return;
        textarea.style.height = 'auto';
        const height = Math.min(textarea.scrollHeight, 150);
        textarea.style.height = `${height}px`;
        textarea.style.overflowY = textarea.scrollHeight > 150 ? 'auto' : 'hidden';
    };

    const handleCameraClick = async () => {
        try {
            vibrate(); // Feedback
            const base64 = await captureHomework();
            if (base64) {
                setSelectedImage(`data:image/jpeg;base64,${base64}`);
            }
        } catch (e) {
            console.error('Camera capture failed', e);
        }
    };

    return (
        <div className="input-container" style={{ display: zenMode ? 'flex' : 'block' }}>
            {/* Contextual Action Pills (Signature UX 1) */}
            <div className="input-pills" role="list" aria-label="Suggested actions" style={{ display: zenMode ? 'none' : 'flex' }}>
                {availablePills.map((pill) => (
                    <button 
                        key={pill} 
                        className="pill" 
                        onClick={() => setInput(pill)}
                        aria-label={`Action: ${pill}`}
                    >
                        {pill}
                    </button>
                ))}
            </div>

            <form className={`input-bar ${isDragging ? 'dragging' : ''}`} onSubmit={(e) => { e?.preventDefault(); handleSend(e); }}>
                {selectedImage && (
                    <div className="preview-container">
                        <img src={selectedImage} alt="Preview" className="image-preview" />
                        <button className="remove-preview" onClick={() => setSelectedImage(null)}>✕</button>
                    </div>
                )}
                {selectedDocs.length > 0 && (
                    <div className="preview-container docs-preview">
                        {selectedDocs.map(doc => (
                            <div key={doc.id} className="doc-pill" style={{ background: doc.processing ? 'rgba(255,255,255,0.05)' : doc.color }}>
                                <span className="doc-icon">{doc.processing ? '⌛' : doc.icon}</span>
                                <span className="doc-name">{doc.fileName}</span>
                                {doc.pages && <span className="doc-pages">{doc.pages} pgs</span>}
                                <button className="remove-doc" onClick={() => setSelectedDocs(prev => prev.filter(d => d.id !== doc.id))}>✕</button>
                                {doc.processing && <div className="doc-progress-bar"></div>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-row">
                    <button className="action-btn camera-btn" onClick={handleCameraClick} title="Scan Homework (Camera)">
                        📷
                    </button>

                    <button className="action-btn file-btn" onClick={() => fileInputRef.current?.click()} title="Attach (Image/PDF/DOCX)">

                        📎
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            accept="image/*,.pdf,.docx,.txt"
                            style={{ display: 'none' }}
                        />
                    </button>

                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                requestAnimationFrame(() => adjustInputHeight(e.target));

                                if (e.target.value.startsWith('/')) {
                                    setShowSlashMenu(true);
                                } else {
                                    setShowSlashMenu(false);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                    if (inputRef.current) {
                                        requestAnimationFrame(() => adjustInputHeight(inputRef.current));
                                    }
                                }
                            }}
                            placeholder={isAgentMode ? "Deploy Siddh Protocol..." : "Message TTR..."}
                            rows="1"
                            spellCheck="false"
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                outline: 'none',
                                resize: 'none',
                                maxHeight: '150px',
                                overflowY: 'hidden',
                                padding: '8px 4px',
                                lineHeight: '1.5',
                                fontFamily: 'inherit',
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                boxSizing: 'border-box',
                                WebkitUserSelect: 'text',
                                userSelect: 'text',
                                textRendering: 'optimizeLegibility',
                                willChange: 'auto'
                            }}
                        />
                        
                        {showSlashMenu && input.startsWith('/') && (
                            <div className="slash-menu animate-in-up">
                                <div className="slash-item" onClick={() => { setInput('/quiz on '); setShowSlashMenu(false); }}>
                                    <span>📝</span> <b>/quiz on [topic]</b> — Practice Mastery
                                </div>
                                <div className="slash-item" onClick={() => { setInput('/roadmap for '); setShowSlashMenu(false); }}>
                                    <span>🗺️</span> <b>/roadmap for [goal]</b> — Career Guidance
                                </div>
                                <div className="slash-item" onClick={() => { setInput('/explain '); setShowSlashMenu(false); }}>
                                    <span>🧠</span> <b>/explain [concept]</b> — Deep Dive
                                </div>
                                <div className="slash-item" onClick={() => { setInput('/audit '); setShowSlashMenu(false); }}>
                                    <span>🛡️</span> <b>/audit [code/text]</b> — Siddh Tactical Review
                                </div>
                                <div className="slash-item" onClick={() => { setInput('/cheatsheet '); setShowSlashMenu(false); }}>
                                    <span>📄</span> <b>/cheatsheet</b> — Generate Summary PDF Notes
                                </div>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {fourWayMode === 'teaching' && (
                            <div className="mother-tongue-selector" style={{ position: 'relative' }}>
                                <button className="lang-btn" onClick={() => setShowLangMenu(!showLangMenu)}>
                                    🌐 {motherTongue}
                                </button>
                                {showLangMenu && (
                                    <div className="lang-dropdown animate-in-up">
                                        {['English', 'Hindi', 'Telugu', 'Tamil', 'Spanish', 'French'].map(l => (
                                            <div key={l} className="lang-item" onClick={() => { setMotherTongue(l); setShowLangMenu(false); }}>
                                                {l}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <button className={`action-btn mic-btn ${isListening ? 'active' : ''}`} onClick={handleMicClick} title="Voice Journey">
                            {isListening ? '⬤' : '🎤'}
                        </button>
                        <MagneticSubmitButton 
                            type="submit"
                            loading={loading}
                            onClick={(e) => { e?.preventDefault(); handleSend(e); }}
                            style={{ 
                                background: 'var(--accent)', 
                                color: 'white', 
                                border: 'none', 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                cursor: 'pointer',
                                transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 12px var(--accent-glow)'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </MagneticSubmitButton>
                    </div>
                </div>
            </form>
        </div>
    );
};
