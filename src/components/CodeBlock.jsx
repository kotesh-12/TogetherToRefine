import React, { useState, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { LANGUAGE_DISPLAY_NAMES, ttraiCodeTheme } from '../utils/codeBlockConfig';

/**
 * CopyButton - Animated copy-to-clipboard button
 */
const CopyButton = memo(({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`code-copy-btn ${copied ? 'copied' : ''}`}
            title={copied ? 'Copied!' : 'Copy code'}
        >
            {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
            )}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
    );
});

/**
 * CodeBlock - Syntax highlighted code block with language label and copy button
 */
export const CodeBlock = memo(({ language, children }) => {
    const code = String(children).replace(/\n$/, '');
    const lang = language || 'text';
    const displayLang = LANGUAGE_DISPLAY_NAMES[lang.toLowerCase()] || lang.toUpperCase();

    const [isExecuting, setIsExecuting] = useState(false);
    const [executionOutput, setExecutionOutput] = useState(null);

    const runnableLanguages = ['js', 'javascript', 'python', 'py', 'java', 'c', 'cpp', 'c++', 'cs', 'c#', 'ruby', 'go', 'rust', 'php', 'sql', 'html'];
    const isRunnable = runnableLanguages.includes(lang.toLowerCase());

    const handleRunCode = async () => {
        setIsExecuting(true);
        setExecutionOutput("Executing in cloud sandbox...");
        
        const targetLang = lang.toLowerCase();

        if (targetLang === 'html') {
            // Browser Sandbox for HTML
            const newWindow = window.open();
            if (newWindow) {
                newWindow.document.write(code);
                newWindow.document.close();
                setExecutionOutput("Opened HTML output securely in a new tab.");
            } else {
                setExecutionOutput("Error: Popup blocked! Allow popups to preview HTML.");
            }
            setIsExecuting(false);
            return;
        }

        const languageMap = {
            'js': 63, 'javascript': 63,
            'py': 71, 'python': 71,
            'java': 62, 'c': 50, 'cpp': 54, 'c++': 54,
            'cs': 51, 'c#': 51, 'ruby': 72, 'rb': 72,
            'go': 60, 'rust': 73, 'rs': 73, 'php': 68, 'sql': 82
        };

        const languageId = languageMap[targetLang];
        if (!languageId) {
            setExecutionOutput("Error: Sandbox runner does not support this language configuration yet.");
            setIsExecuting(false);
            return;
        }

        try {
            const response = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_code: code,
                    language_id: languageId,
                    stdin: ""
                })
            });
            const data = await response.json();
            
            if (data.error) {
                 setExecutionOutput("Sandbox Error: " + data.error);
                 setIsExecuting(false);
                 return;
            }

            let result = data.stdout || "";
            if (data.stderr) result += "\n[Error Output]:\n" + data.stderr;
            if (data.compile_output) result = "[Compilation Error]:\n" + data.compile_output;
            if (data.message) result += "\n[System Message]: " + data.message;

            setExecutionOutput(result.trim() || "Executed successfully with no output.");
        } catch (error) {
            setExecutionOutput("Sandbox Connection Error: " + error.message);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="code-block-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="code-block-header">
                <span className="code-block-lang">{displayLang}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isRunnable && (
                        <button 
                            className="code-runner-btn" 
                            onClick={handleRunCode}
                            disabled={isExecuting}
                            title="Run in Live Sandbox"
                            style={{
                                background: 'linear-gradient(90deg, #10b981, #059669)',
                                color: 'white', border: 'none', padding: '4px 10px',
                                borderRadius: '6px', fontSize: '10px', fontWeight: 'bold',
                                cursor: isExecuting ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                opacity: isExecuting ? 0.7 : 1
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            {isExecuting ? 'RUNNING...' : 'RUN CODE'}
                        </button>
                    )}
                    <CopyButton text={code} />
                </div>
            </div>
            <div className="code-block-body">
                <SyntaxHighlighter
                    style={ttraiCodeTheme}
                    language={lang}
                    PreTag="div"
                    showLineNumbers={code.split('\n').length > 3}
                    lineNumberStyle={{
                        minWidth: '2.5em',
                        paddingRight: '1em',
                        color: 'rgba(255,255,255,0.2)',
                        fontSize: '12px',
                        userSelect: 'none',
                    }}
                    wrapLines
                    customStyle={{
                        margin: 0,
                        borderRadius: 0,
                        background: 'transparent',
                    }}
                >
                    {code}
                </SyntaxHighlighter>
            </div>
            {executionOutput !== null && (
                <div style={{ background: '#000', color: executionOutput.includes('Error') ? '#ef4444' : '#10b981', padding: '10px', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', borderTop: '1px solid #333', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', marginBottom: '4px', fontSize: '9px' }}>
                        <span>TERMINAL OUTPUT</span>
                        <span onClick={() => setExecutionOutput(null)} style={{ cursor: 'pointer', color: '#999' }}>✖ CLEAR</span>
                    </div>
                    {executionOutput}
                </div>
            )}
        </div>
    );
});

/**
 * InlineCode - Styled inline code element
 */
export const InlineCode = memo(({ children }) => (
    <code className="inline-code">{children}</code>
));

/**
 * MarkdownRenderers - Custom renderers for ReactMarkdown
 * Use this as the `components` prop for ReactMarkdown
 */
export function MarkdownCode(props) {
    const { _node, inline, className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');

    // If it's a fenced code block (has language or is multi-line)
    if (!inline && (match || String(children).includes('\n'))) {
        return (
            <CodeBlock language={match ? match[1] : 'text'}>
                {children}
            </CodeBlock>
        );
    }

    // Otherwise render as inline code
    return <InlineCode {...rest}>{children}</InlineCode>;
}

export function MarkdownTable(props) {
    return (
        <div className="custom-table-wrapper">
            <table {...props} />
        </div>
    );
}

// Renderers are imported and mapped where used.
