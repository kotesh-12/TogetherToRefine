import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
    AnimatedMessage, 
    TypewriterMessage, 
    BreathingOrb, 
    BrainInsights 
} from '../ChatComponents';

import useChatStore from '../../store/useChatStore';
import { Virtuoso } from 'react-virtuoso';

// --- Perplexity-Style Source Citation Panel ---
const SourcePanel = ({ sources, toolCalled }) => {
    const [expanded, setExpanded] = useState(false);
    if (!sources || sources.length === 0) return null;

    const toolIcon = toolCalled === 'youtubeSearch' ? '🎬' 
        : toolCalled === 'academicSearch' ? '📚' 
        : '🌐';
    const toolLabel = toolCalled === 'youtubeSearch' ? 'YouTube' 
        : toolCalled === 'academicSearch' ? 'Research' 
        : 'Web';

    const displaySources = expanded ? sources : sources.slice(0, 3);

    return (
        <div className="ttr-source-panel">
            <button 
                className="ttr-source-toggle"
                onClick={() => setExpanded(!expanded)}
            >
                <span className="ttr-source-icon">{toolIcon}</span>
                <span className="ttr-source-label">{sources.length} {toolLabel} Sources</span>
                <span className={`ttr-source-chevron ${expanded ? 'expanded' : ''}`}>▾</span>
            </button>
            <div className={`ttr-source-list ${expanded ? 'expanded' : ''}`}>
                {displaySources.map((src, i) => {
                    const domain = (() => {
                        try { return new URL(src.url).hostname.replace('www.', ''); } 
                        catch { return 'source'; }
                    })();
                    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                    
                    return (
                        <a 
                            key={i} 
                            href={src.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ttr-source-item"
                            title={src.title || src.content}
                        >
                            <span className="ttr-source-num">{i + 1}</span>
                            <img src={favicon} alt="" className="ttr-source-favicon" onError={(e) => { e.target.style.display = 'none'; }} />
                            <div className="ttr-source-info">
                                <span className="ttr-source-title">{src.title || domain}</span>
                                <span className="ttr-source-domain">{domain}</span>
                            </div>
                        </a>
                    );
                })}
                {!expanded && sources.length > 3 && (
                    <button className="ttr-source-more" onClick={() => setExpanded(true)}>
                        +{sources.length - 3} more sources
                    </button>
                )}
            </div>
        </div>
    );
};

export const ChatMessageList = ({
    messagesEndRef,
    logo,
    feedback,
    handleLike,
    handleDislike,
    handleCopy,
    copiedIndex,
    customMarkdownComponents,
    remarkGfm,
    speakingText,
    roadmapData,
    devCanvasData,
    showMasteryConsolidator,
    setShowMasteryConsolidator,
    turnCount,
    navigate
}) => {
    // Zustand State
    const { 
        messages, 
        loading, 
        isAgentMode, 
        incognitoMode,
        isRoadmapMode,
        setIsRoadmapMode,
        isDevCanvasOpen,
        setIsDevCanvasOpen,
        suiAddress
    } = useChatStore();

    const MessageItem = ({ index, msg }) => (
        <AnimatedMessage msg={msg}>
            {msg.sender === 'ai' && (
                <div className="msg-avatar ai-avatar">
                    {isAgentMode ? (
                        <div style={{ position: 'relative' }}>
                            <img src={logo} alt="TTRAI" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                            {suiAddress && <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', background: '#38bdf8', borderRadius: '50%', border: '1px solid white' }} title="Sui Connected" />}
                        </div>
                    ) : (
                        <span style={{ fontSize: '20px' }}>🕉️</span>
                    )}
                </div>
            )}
            <div className="msg-content">
                {msg.image && <img src={msg.image} alt="User upload" className="msg-image" />}
                {msg.sender === 'ai' && index === messages.length - 1 && loading ? (
                    <TypewriterMessage text={msg.text} />
                ) : (
                    <div className={`ai-message-body ${speakingText === msg.text ? 'is-speaking' : ''}`}>
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={customMarkdownComponents}
                        >
                            {msg.text}
                        </ReactMarkdown>
                    </div>
                )}

                {/* Perplexity-Style Source Citations */}
                {msg.sender === 'ai' && msg.sources && (
                    <SourcePanel sources={msg.sources} toolCalled={msg.toolCalled} />
                )}
                
                {msg.sender === 'ai' && (
                    <div className="msg-actions">
                        <button className={`msg-action-btn ${feedback[index] === 'liked' ? 'active' : ''}`} onClick={() => handleLike(index)}>
                            {feedback[index] === 'liked' ? '❤️' : '🤍'}
                        </button>
                        <button className={`msg-action-btn ${feedback[index] === 'disliked' ? 'active' : ''}`} onClick={() => handleDislike(index)}>
                            👎
                        </button>
                        <button className="msg-action-btn" onClick={() => handleCopy(msg.text, index)}>
                            {copiedIndex === index ? '✅' : '📋'}
                        </button>
                        {speakingText === msg.text && (
                            <span className="speaking-indicator">🔊</span>
                        )}
                    </div>
                )}
            </div>
            {msg.sender === 'user' && (
                <div className="msg-avatar user-avatar">
                    {msg.sender.charAt(0).toUpperCase()}
                </div>
            )}
        </AnimatedMessage>
    );

    return (
        <div className="chat-messages" style={{ display: isRoadmapMode || isDevCanvasOpen ? 'none' : 'flex', height: '100%', flexDirection: 'column' }}>
            {incognitoMode && (
                <div className="incognito-banner" style={{ flexShrink: 0 }}>
                    <span>🕶️</span>
                    <div>
                        <strong>Incognito Mode</strong>
                        <small>Chat won't be saved. No training data collected.</small>
                    </div>
                </div>
            )}
            
            <div style={{ flex: 1, minHeight: 0 }}>
                <Virtuoso
                    data={messages}
                    itemContent={(index, msg) => <MessageItem index={index} msg={msg} />}
                    followOutput="auto"
                    atBottomThreshold={100}
                    style={{ height: '100%' }}
                    components={{
                        Footer: () => (
                            <>
                                {loading && (
                                    <div className="ai-message loading">
                                        <div className="msg-avatar ai-avatar">
                                            <img src={logo} alt="TTRAI" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                                        </div>
                                        <div className="msg-content">
                                            <div className="typing-indicator">
                                                <span></span><span></span><span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div style={{ height: '20px' }} />
                            </>
                        )
                    }}
                />
            </div>

            {/* AI Personality Visuals (Layered on top) */}
            <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 10 }}>
                <BreathingOrb isAgentMode={isAgentMode} />
                <BrainInsights messages={messages} />
            </div>

            {/* Performance/Mastery Overlays */}
            {turnCount >= 5 && (
                <div 
                    className="mastery-nudge animate-in-up" 
                    onClick={() => setShowMasteryConsolidator(true)}
                    style={{ position: 'fixed', bottom: '100px', right: '30px', padding: '12px 20px', background: 'var(--accent)', color: 'white', borderRadius: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 100, display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                    <span style={{ fontSize: '20px' }}>🧠</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Mastery Insight Available</span>
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>We've covered a lot. Synthesize now?</span>
                    </div>
                </div>
            )}
        </div>
    );
};
