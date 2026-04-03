import React from 'react';
import ReactMarkdown from 'react-markdown';
import { 
    AnimatedMessage, 
    TypewriterMessage, 
    BreathingOrb, 
    BrainInsights 
} from '../ChatComponents';

import useChatStore from '../../store/useChatStore';
import { Virtuoso } from 'react-virtuoso';

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
