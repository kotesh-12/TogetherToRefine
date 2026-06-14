import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import React from 'react';

/**
 * LANGUAGE_DISPLAY_NAMES - Maps language identifiers to display names
 */
export const LANGUAGE_DISPLAY_NAMES = {
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
export const ttraiCodeTheme = {
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

export const markdownCodeRenderers = (MarkdownCode, MarkdownTable) => ({
    code: MarkdownCode,
    table: MarkdownTable
});
