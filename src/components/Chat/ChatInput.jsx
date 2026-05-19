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
        const height = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${height}px`;
        textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
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
            {/* Contextual Action Pills */}
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
                        <button type="button" className="remove-preview" onClick={() => setSelectedImage(null)}>✕</button>
                    </div>
                )}
                {selectedDocs.length > 0 && (
                    <div className="preview-container docs-preview">
                        {selectedDocs.map(doc => (
                            <div key={doc.id} className="doc-pill" style={{ background: doc.processing ? 'rgba(255,255,255,0.05)' : doc.color }}>
                                <span className="doc-icon">{doc.processing ? '⌛' : doc.icon}</span>
                                <span className="doc-name">{doc.fileName}</span>
                                {doc.pages && <span className="doc-pages">{doc.pages} pgs</span>}
                                <button type="button" className="remove-doc" onClick={() => setSelectedDocs(prev => prev.filter(d => d.id !== doc.id))}>✕</button>
                                {doc.processing && <div className="doc-progress-bar"></div>}
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-row-standard">
                    {/* Attach button (Left) */}
                    <button 
                        type="button"
                        className="std-action-btn" 
                        onClick={() => fileInputRef.current?.click()} 
                        title="Attach files"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            accept="image/*,.pdf,.docx,.txt"
                            style={{ display: 'none' }}
                        />
                    </button>

                    {/* Textarea (Center) */}
                    <div className="std-textarea-wrapper">
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
                            placeholder={isAgentMode ? "Ask Siddh anything..." : "Message TTR..."}
                            rows="1"
                            spellCheck="false"
                            className="std-textarea"
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

                    {/* Right side actions */}
                    <div className="std-actions-right">
                        {fourWayMode === 'teaching' && (
                            <div className="mother-tongue-selector" style={{ position: 'relative' }}>
                                <button type="button" className="std-action-btn" onClick={() => setShowLangMenu(!showLangMenu)}>
                                    🌐
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

                        <button 
                            type="button"
                            className={`std-action-btn mic-btn ${isListening ? 'active' : ''}`} 
                            onClick={handleMicClick} 
                            title="Voice input"
                        >
                            {isListening ? (
                                <span style={{ color: '#ef4444', fontSize: '18px' }}>⬤</span>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                </svg>
                            )}
                        </button>

                        <button 
                            type="submit"
                            className={`std-send-btn ${input.trim() || selectedImage || selectedDocs.length > 0 ? 'active' : ''}`}
                            disabled={loading || (!input.trim() && !selectedImage && selectedDocs.length === 0)}
                            onClick={(e) => { e?.preventDefault(); handleSend(e); }}
                            title="Send message"
                        >
                            {loading ? (
                                <div className="send-spinner" />
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </form>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.8 }}>
                TTR AI can make mistakes. Please verify important information.
            </div>
        </div>
    );
};
