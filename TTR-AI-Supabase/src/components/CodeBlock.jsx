import React, { useState, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * LANGUAGE_DISPLAY_NAMES - Maps language identifiers to display names
 */
const LANGUAGE_DISPLAY_NAMES = {
    js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
    ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
    py: 'Python', python: 'Python',
    java: 'Java', c: 'C', cpp: 'C++', 'c++': 'C++', cs: 'C#', csharp: 'C#',
    html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'SASS', less: 'LESS',
    json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML',
    sql: 'SQL', graphql: 'GraphQL',
    bash: 'Bash', shell: 'Shell', sh: 'Shell', powershell: 'PowerShell', ps1: 'PowerShell',
    go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin',
    dart: 'Dart', r: 'R', matlab: 'MATLAB', scala: 'Scala',
    markdown: 'Markdown', md: 'Markdown', text: 'Text', txt: 'Text',
    dockerfile: 'Dockerfile', docker: 'Docker',
};

/**
 * Custom theme based on oneDark but matching TTRAI's aesthetic
 */
const ttraiCodeTheme = {
    ...oneDark,
    'pre[class*="language-"]': {
        ...oneDark['pre[class*="language-"]'],
        background: 'transparent',
        margin: 0,
        padding: '16px',
        fontSize: '13.5px',
        lineHeight: '1.6',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
    },
    'code[class*="language-"]': {
        ...oneDark['code[class*="language-"]'],
        background: 'transparent',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace",
        fontSize: '13.5px',
    },
};

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

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-block-lang">{displayLang}</span>
                <CopyButton text={code} />
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
export const markdownCodeRenderers = {
    code({ node, inline, className, children, ...props }) {
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
        return <InlineCode {...props}>{children}</InlineCode>;
    },
};
