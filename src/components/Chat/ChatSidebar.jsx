import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DharmaChallenge } from '../DharmaChallenge';
import { KnowledgeGraph } from '../KnowledgeGraph';

import useChatStore from '../../store/useChatStore';

export const ChatSidebar = ({
    isSidebarHovered,
    setIsSidebarHovered,
    logo,
    exportChatAsPDF,
    exportChatAsExcel,
    dharmaXP,
    filteredSessions,
    loadSession,
    user,
    showSidebarExtra,
    setShowSidebarExtra,
    setShowThemeGallery,
    reducedMotion,
    setReducedMotion,
    autoSpeak,
    setAutoSpeak,
    MASTER_ADMINS,
    AdminStatsBadge,
    handleSend,
    recallSubject,
    lastStudyTime,
    displayName,
    signOut,
    getSafeStorage,
    setSafeStorage,
    setShowMarketplace
}) => {
    const navigate = useNavigate();
    
    // Zustand State
    const { 
        showSidebar, 
        setShowSidebar, 
        zenMode, 
        isAgentMode, 
        setIsAgentMode,
        chatMode,
        setChatMode, 
        startNewChat,
        currentSessionId,
        sessions,
        setInput,
        isFocusMode,
        setKnowledgeHubOpen
    } = useChatStore();

    return (
        <div 
            className={`chat-sidebar ${showSidebar ? 'show' : ''} ${zenMode ? 'zen-sidebar' : ''}`}
            onMouseEnter={() => setIsSidebarHovered(true)}
            onMouseLeave={() => setIsSidebarHovered(false)}
            style={{
                opacity: (zenMode && !isSidebarHovered && !showSidebar) ? 0.05 : 1,
                transition: 'opacity 0.8s ease-in-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: (zenMode && !isSidebarHovered && !showSidebar) ? 'none' : 'auto',
                filter: (zenMode && !isSidebarHovered && !showSidebar) ? 'grayscale(100%) blur(4px)' : 'none'
            }}
        >
            <div className="chat-sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={logo} alt="TTR-AI" style={{ height: '32px', width: 'auto' }} />
                    <h3>Chat History</h3>
                </div>
                <button className="chat-sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '0 10px', marginBottom: '15px' }}>
                <button className="new-chat-btn" onClick={startNewChat} style={{ flex: 1, margin: 0, border: '1px solid var(--accent)', background: 'var(--accent-glow)' }}>
                    <span style={{ fontSize: '18px' }}>+</span> <b>New Journey</b>
                </button>

                {/* Mode Master Toggle */}
                <div style={{ 
                    display: 'flex', 
                    background: 'var(--bg-tertiary)', 
                    borderRadius: '12px', 
                    padding: '3px', 
                    border: '1px solid var(--border)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <button 
                        onClick={() => setChatMode('guru')}
                        style={{ 
                            flex: 1,
                            padding: '6px 4px', 
                            background: chatMode === 'guru' ? 'var(--accent)' : 'transparent', 
                            color: chatMode === 'guru' ? 'white' : 'var(--text-secondary)', 
                            border: 'none', 
                            borderRadius: '10px', 
                            cursor: 'pointer', 
                            fontSize: '9px', 
                            fontWeight: 'bold', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                        }}
                        title="Learning Mentor (Friendly)"
                    >
                        🎓 GURU
                    </button>
                    <button 
                        onClick={() => setChatMode('normal')}
                        style={{ 
                            flex: 1,
                            padding: '6px 4px', 
                            background: chatMode === 'normal' ? '#10b981' : 'transparent', 
                            color: chatMode === 'normal' ? 'white' : 'var(--text-secondary)', 
                            border: 'none', 
                            borderRadius: '10px', 
                            cursor: 'pointer', 
                            fontSize: '9px', 
                            fontWeight: 'bold', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                        }}
                        title="TTR AI (Accurate & Principle-based)"
                    >
                        ✨ NORMAL
                    </button>
                    <button 
                        onClick={() => setChatMode('siddh')}
                        style={{ 
                            flex: 1,
                            padding: '6px 4px', 
                            background: chatMode === 'siddh' ? '#3b82f6' : 'transparent', 
                            color: chatMode === 'siddh' ? 'white' : 'var(--text-secondary)', 
                            border: 'none', 
                            borderRadius: '10px', 
                            cursor: 'pointer', 
                            fontSize: '9px', 
                            fontWeight: 'bold', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                        }}
                        title="Siddh Coding Agent (Pro)"
                    >
                        ⚡ SIDDH
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', padding: '0 10px', marginBottom: '8px' }}>
                <button onClick={exportChatAsPDF} style={{ flex: 1, padding: '5px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                    📄 PDF
                </button>
                <button onClick={exportChatAsExcel} style={{ flex: 1, padding: '5px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                    📊 Excel
                </button>
            </div>

            {/* Dharma XP Stat */}
            <div 
                className="dharma-xp-stat" 
                onClick={() => setShowMarketplace && setShowMarketplace(true)}
                style={{ 
                    padding: '8px 12px', 
                    background: 'rgba(255,255,255,0.05)', 
                    borderRadius: '10px', 
                    margin: '0 10px 8px 10px', 
                    border: '1px solid rgba(255, 215, 0, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.1)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                title="Open Dharma Marketplace"
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#ffd700', fontWeight: 'bold' }}>✨ DHARMA XP (Click to Spend)</span>
                    <span style={{ fontSize: '10px', color: '#fff' }}>{dharmaXP} PTS</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min((dharmaXP % 1000) / 10, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #ffd700, #ff8c00)', borderRadius: '10px' }} />
                </div>
            </div>

            {user ? (
                <>
                    <div className="sessions-list" style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredSessions.map((s, idx) => (
                            <div
                                key={s.id}
                                className={`session-item animate-in ${currentSessionId === s.id ? 'active' : ''}`}
                                onClick={() => loadSession(s)}
                                style={{ animationDelay: `${idx * 0.04}s` }}
                            >
                                <span style={{ fontSize: '15px', opacity: 0.5, flexShrink: 0 }}>💬</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span className="session-title">{s.title || 'New conversation'}</span>
                                </div>
                            </div>
                        ))}
                        {filteredSessions.length === 0 && (
                            <div className="no-sessions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '28px', opacity: 0.3 }}>💭</span>
                                <p style={{ margin: 0 }}>No conversations yet</p>
                            </div>
                        )}
                    </div>

                    {/* eslint-disable-next-line */}
                    {recallSubject && Date.now() - lastStudyTime > 3600000 && (
                        <div style={{
                            margin: '10px 14px', padding: '12px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(139, 92, 246, 0.1))',
                            border: '1px solid rgba(167, 139, 250, 0.2)', boxShadow: '0 0 15px rgba(139, 92, 246, 0.1)'
                        }}>
                            <div style={{ fontSize: '10px', color: '#a78bfa', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>⚡ Active Recall</div>
                            <div style={{ fontSize: '11px', color: '#e8e8f0', marginBottom: '8px', lineHeight: '1.4' }}>Seeker, it's time to test your memory on "{recallSubject}".</div>
                            <button
                                onClick={() => { setInput(`/quiz on ${recallSubject}`); setTimeout(() => handleSend(), 100); }}
                                style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#8b5cf6', color: 'white', border: 'none', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Start Recap (+20 Dharma XP)
                            </button>
                        </div>
                    )}

                    <div className="chat-sidebar-footer">
                        <div className="user-info" style={{ marginBottom: '8px' }}>
                            <div className="user-avatar">{displayName.charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span className="user-name" style={{ marginBottom: '2px' }}>{displayName}</span>
                                <div style={{ 
                                    display: 'flex', 
                                    background: 'rgba(var(--accent-rgb), 0.05)', 
                                    borderRadius: '12px', 
                                    padding: '2px', 
                                    border: '1px solid var(--border)', 
                                    width: 'fit-content',
                                    gap: '2px'
                                }}>
                                    <button 
                                        onClick={() => setIsAgentMode(false)}
                                        style={{ padding: '2px 6px', background: !isAgentMode ? 'var(--accent)' : 'transparent', border: 'none', color: !isAgentMode ? 'white' : 'var(--text-secondary)', borderRadius: '10px', fontSize: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >GURU</button>
                                    <button 
                                        onClick={() => setIsAgentMode(true)}
                                        style={{ padding: '2px 6px', background: isAgentMode ? '#3b82f6' : 'transparent', border: 'none', color: isAgentMode ? 'white' : 'var(--text-secondary)', borderRadius: '10px', fontSize: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                    >SIDDH</button>
                                </div>
                            </div>
                            <button
                                className="premium-toggle"
                                onClick={() => setShowSidebarExtra(!showSidebarExtra)}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--text-muted)',
                                    fontSize: '18px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: '4px',
                                    borderRadius: '50%',
                                    position: 'relative'
                                }}
                                title={showSidebarExtra ? "Collapse Menu" : "Expand Menu"}
                            >
                                <span className="premium-toggle-icon" style={{
                                    display: 'inline-block',
                                    transform: showSidebarExtra ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}>^</span>

                                {!showSidebarExtra && autoSpeak && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '0px',
                                        right: '0px',
                                        width: '8px',
                                        height: '8px',
                                        background: '#4ade80',
                                        borderRadius: '50%',
                                        border: '1.5px solid var(--sidebar-bg)',
                                        boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)'
                                    }} />
                                )}
                            </button>
                        </div>

                        {showSidebarExtra && (
                            <div className="sidebar-extra-content animate-in-sideways" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <small style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block', textAlign: 'center' }}>Theme Gallery</small>
                                <div className="theme-selector-mini" onClick={() => setShowThemeGallery(true)}>
                                    <div className="theme-dot dark"></div>
                                    <div className="theme-dot white"></div>
                                    <div className="theme-dot purple"></div>
                                    <div className="gallery-btn"><span>✨</span></div>
                                </div>

                                <button
                                    onClick={() => navigate('/pricing')}
                                    style={{
                                        width: '100%', padding: '6px', borderRadius: '8px',
                                        background: 'linear-gradient(90deg, #bb86fc, #8b5cf6)', color: '#fff',
                                        border: 'none', cursor: 'pointer',
                                        marginBottom: '6px', fontSize: '11px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        fontWeight: 'bold', boxShadow: '0 4px 10px rgba(139, 92, 246, 0.3)',
                                        transition: 'transform 0.2s',
                                    }}
                                >
                                    <span>💎</span> Upgrade Plan ({getSafeStorage('ttr_subscription_plan')?.toUpperCase() || 'FREE'})
                                </button>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', marginBottom: '10px', border: '1px solid #333' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>⚡</span>
                                        <span style={{ fontSize: '11px', color: '#ccc' }}>Performance Mode</span>
                                    </div>
                                    <button 
                                        onClick={() => setReducedMotion(!reducedMotion)}
                                        style={{ width: '32px', height: '18px', background: reducedMotion ? '#10b981' : '#333', borderRadius: '10px', border: 'none', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                        aria-label="Toggle reduced motion"
                                    >
                                        <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '3px', left: reducedMotion ? '17px' : '3px', transition: '0.3s' }} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => navigate('/intelligence-hub')}
                                    style={{
                                        width: '100%', padding: '6px', borderRadius: '8px',
                                        background: 'rgba(59, 130, 246, 0.05)', color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer',
                                        marginBottom: '6px', fontSize: '11px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span>🔱</span> Intelligence Hub
                                </button>

                                <button
                                    onClick={() => navigate('/download-app')}
                                    style={{
                                        width: '100%', padding: '6px', borderRadius: '8px',
                                        background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa',
                                        border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer',
                                        marginBottom: '6px', fontSize: '11px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span>📲</span> Download App
                                </button>

                                <button
                                    onClick={() => {
                                        const next = !autoSpeak;
                                        setAutoSpeak(next);
                                        setSafeStorage('ttr_auto_speak', next.toString());
                                    }}
                                    style={{
                                        width: '100%', padding: '6px', borderRadius: '8px',
                                        background: autoSpeak ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                        color: autoSpeak ? '#4ade80' : '#94a3b8',
                                        border: `1px solid ${autoSpeak ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                        cursor: 'pointer', marginBottom: '6px', fontSize: '11px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span>{autoSpeak ? '🔊' : '🔈'}</span> {autoSpeak ? 'Hands-free Guru ON' : 'Enable Voice Guru'}
                                </button>
                            </div>
                        )}

                        {user && MASTER_ADMINS.includes(user.email) && (
                            <>
                                <AdminStatsBadge />
                                <button
                                    onClick={() => navigate('/admin-ttrai-hq')}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '10px',
                                        background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa',
                                        border: '1px dashed rgba(139, 92, 246, 0.3)', cursor: 'pointer',
                                        marginBottom: '10px', fontSize: '13px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span>🛡️</span> Data Exporter
                                </button>
                                <button 
                                    className="premium-btn active"
                                    onClick={() => navigate('/roadmap')}
                                    style={{ width: '100%', marginBottom: '15px' }}
                                >
                                    <span>🚀</span> TTR-AI Roadmap
                                </button>


                            </>
                        )}

                        <button className="logout-btn" onClick={signOut}>Sign Out</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="sessions-list" style={{ flex: 1, overflowY: 'auto' }}>
                        <div className="guest-notice">
                            <div className="guest-icon">🔒</div>
                            <p>Sign in to save your chat history and access it from any device.</p>
                            <button className="signin-prompt-btn" onClick={() => navigate('/login?mode=login')}>
                                Sign In / Sign Up
                            </button>
                        </div>
                    </div>
                    <div className="chat-sidebar-footer">
                        <button
                            onClick={() => navigate('/download-app')}
                            style={{
                                width: '100%', padding: '8px', borderRadius: '10px',
                                background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer',
                                marginBottom: '15px', fontSize: '12px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.2s ease', fontWeight: 'bold'
                            }}
                        >
                            <span>📲</span> Download App
                        </button>
                        <small style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'block', textAlign: 'center' }}>Theme Gallery</small>
                        <div className="theme-selector-mini" onClick={() => setShowThemeGallery(true)}>
                            <div className="theme-dot dark"></div>
                            <div className="theme-dot white"></div>
                            <div className="theme-dot purple"></div>
                            <div className="gallery-btn"><span>✨</span></div>
                        </div>
                         <div className="user-info" style={{ gap: '10px' }}>
                            <div className="user-avatar guest">G</div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="user-name" style={{ fontSize: '13px' }}>Guest</span>
                                <div style={{ 
                                    display: 'flex', 
                                    background: 'rgba(var(--accent-rgb), 0.1)', 
                                    borderRadius: '15px', 
                                    padding: '3px', 
                                    border: '1px solid var(--border)', 
                                    marginTop: '10px' 
                                }}>
                                    <button 
                                        onClick={() => setIsAgentMode(false)}
                                        style={{ flex: 1, padding: '5px 10px', background: !isAgentMode ? 'var(--accent)' : 'transparent', border: 'none', color: !isAgentMode ? 'white' : 'var(--text-secondary)', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                    >
                                        {isFocusMode ? 'ZEN' : 'GURU'}
                                    </button>
                                    <button 
                                        onClick={() => setIsAgentMode(true)}
                                        style={{ flex: 1, padding: '5px 10px', background: isAgentMode ? '#3b82f6' : 'transparent', border: 'none', color: isAgentMode ? 'white' : 'var(--text-secondary)', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                    >
                                        SIDDH
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
