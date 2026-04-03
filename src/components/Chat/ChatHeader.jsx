import React from 'react';
import { FocusSoundscape } from '../FocusSoundscape';

import useChatStore from '../../store/useChatStore';

export const ChatHeader = ({
    logo,
    activeModule,
    setActiveModule,
    showHeaderActions,
    setShowHeaderActions,
    setShowPathModal,
    currentPath,
    activeHeroes,
    roadmapData,
    devCanvasData,
    user,
    navigate
}) => {
    // Zustand State
    const {
        setShowSidebar,
        isFocusMode,
        setIsFocusMode,
        currentSessionId,
        messages,
        incognitoMode,
        setIncognitoMode,
        isRoadmapMode,
        setRoadmapMode,
        isDevCanvasOpen,
        setDevCanvasOpen,
        isKnowledgeHubOpen,
        setKnowledgeHubOpen,
        setZenMode,
        zenMode
    } = useChatStore();
    return (
        <div className="chat-header">
            <button className="menu-btn" onClick={() => setShowSidebar(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>
            <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logo} alt="TTRAI" style={{ height: '32px', width: 'auto', display: 'block', marginRight: '6px' }} />
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{activeModule ? activeModule.replace('_', ' ').toUpperCase() : 'TTRAI'}</span>
                
                <div style={{ display: 'flex', gap: '4px' }}>
                    {activeModule && (
                        <button
                            onClick={() => setActiveModule(null)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            EXIT
                        </button>
                    )}
                    {(navigator.connection?.effectiveType === '2g' || navigator.connection?.effectiveType === 'slow-2g') && (
                        <span style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '9px', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ⚡ LOW SIGNAL
                        </span>
                    )}
                </div>
            </div>
            <div className="header-actions">
                <button
                    className={`path-header-btn premium-toggle ${showHeaderActions ? 'active' : ''}`}
                    onClick={() => setShowHeaderActions(!showHeaderActions)}
                    title={showHeaderActions ? "Hide Tools" : "Show Tools"}
                    style={{
                        marginRight: '6px',
                        background: showHeaderActions ? 'var(--accent)' : 'rgba(108, 99, 255, 0.1)',
                        border: '1px solid rgba(108, 99, 255, 0.2)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: showHeaderActions ? 'white' : 'var(--accent)'
                    }}
                >
                    <span className="premium-toggle-icon" style={{
                        transform: showHeaderActions ? 'rotate(180deg)' : 'rotate(0deg)',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}>{showHeaderActions ? '✕' : '🛠️'}</span>

                    {!showHeaderActions && (incognitoMode || isFocusMode || zenMode) && (
                        <span style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '8px',
                            height: '8px',
                            background: incognitoMode ? '#ef4444' : '#4ade80',
                            borderRadius: '50%',
                            border: '1.5px solid #0f0f14',
                            boxShadow: `0 0 8px ${incognitoMode ? '#ef444488' : '#4ade8088'}`
                        }} />
                    )}
                </button>
                <div className={`header-actions-group ${showHeaderActions ? 'show-mobile' : 'hide-mobile'}`} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    overflowX: 'auto', 
                    scrollbarWidth: 'none' 
                }}>
                    <FocusSoundscape onToggle={(active) => setZenMode(active)} />
                    <button className={`path-header-btn ${isFocusMode ? 'active' : ''}`} onClick={() => setIsFocusMode(!isFocusMode)} title="Focus">
                        {isFocusMode ? '🔍' : '🧘‍♂️'}
                    </button>
                    <button className="path-header-btn" onClick={() => setShowPathModal(true)} title="AI Path">
                        {currentPath && activeHeroes[currentPath] ? activeHeroes[currentPath].emoji : '🎗️'}
                    </button>
                    <button className="path-header-btn" disabled={!currentSessionId} onClick={() => {
                        if (!currentSessionId) return;
                        const shareUrl = `${window.location.origin}${window.location.pathname}#/nexus/${currentSessionId}`;
                        navigator.clipboard.writeText(shareUrl);
                        alert("Nexus Link copied!");
                    }} title="Nexus">
                        🤝
                    </button>
                    <button className={`path-header-btn incognito-btn ${incognitoMode ? 'active' : ''}`} onClick={() => setIncognitoMode(!incognitoMode)} title="Incognito">
                        {incognitoMode ? '🕶️' : '🥷'}
                    </button>

                    {showHeaderActions && (
                        <>
                            {roadmapData && (
                                <button onClick={() => setRoadmapMode(!isRoadmapMode)} style={{ padding: '8px 12px', background: isRoadmapMode ? '#10b981' : 'rgba(255,255,255,0.1)', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                                    🗺️ ROADMAP
                                </button>
                            )}
                            {devCanvasData && (
                                <button onClick={() => setDevCanvasOpen(!isDevCanvasOpen)} style={{ padding: '8px 12px', background: isDevCanvasOpen ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '10px', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                                    💻 DEVROOM
                                </button>
                            )}
                            <button onClick={() => setKnowledgeHubOpen(!isKnowledgeHubOpen)} style={{ padding: '8px 12px', background: isKnowledgeHubOpen ? '#8b5cf6' : 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', borderRadius: '10px', color: '#fff', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>
                                🧠 KNOWLEDGE
                            </button>
                        </>
                    )}
                </div>

                {messages.length > 1 && (
                    <div className="context-badge" title="Context Memory Active" style={{ 
                        fontSize: '10px', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        color: '#10b981', 
                        padding: '2px 8px', 
                        borderRadius: '20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        transition: '0.3s',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                    }}>
                        <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }} /> 
                        Context: {messages.length - 1} turns
                    </div>
                )}
                
                {!user && (
                    <button className="signin-header-btn" onClick={() => navigate('/login')}>
                        Sign In
                    </button>
                )}
            </div>
        </div>
    );
};
