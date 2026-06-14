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
export const CodeBlock = memo(({ language, children, onRun }) => {
    const code = String(children).replace(/\n$/, '');
    const lang = language || 'text';
    const displayLang = LANGUAGE_DISPLAY_NAMES[lang.toLowerCase()] || lang.toUpperCase();

    const isRunnable = ['js', 'javascript', 'html', 'css'].includes(lang.toLowerCase());

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-block-lang">{displayLang}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isRunnable && onRun && (
                        <button 
                            className="code-runner-btn" 
                            onClick={() => onRun(code, lang)}
                            title="Run in Sandbox"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Run
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
