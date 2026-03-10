/**
 * DocumentProcessor - Extracts text from PDF, DOCX, PPTX, and TXT files
 * Used by TTR AI to analyze uploaded documents
 */
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Supported file types and their MIME types
 */
const SUPPORTED_DOCS = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'text/markdown': 'MD',
};

/**
 * Check if a file type is a supported document
 */
export function isDocumentFile(file) {
    if (!file) return false;
    const type = file.type;
    const name = file.name?.toLowerCase() || '';

    if (SUPPORTED_DOCS[type]) return true;

    // Fallback to extension check
    const ext = name.split('.').pop();
    return ['pdf', 'pptx', 'ppt', 'docx', 'doc', 'txt', 'csv', 'md'].includes(ext);
}

/**
 * Check if a file is an image
 */
export function isImageFile(file) {
    return file?.type?.startsWith('image/');
}

/**
 * Get file type info for display
 */
export function getFileTypeInfo(file) {
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const typeMap = {
        pdf: { icon: '📄', label: 'PDF Document', color: '#ef4444' },
        pptx: { icon: '📊', label: 'PowerPoint', color: '#f97316' },
        ppt: { icon: '📊', label: 'PowerPoint', color: '#f97316' },
        docx: { icon: '📝', label: 'Word Document', color: '#3b82f6' },
        doc: { icon: '📝', label: 'Word Document', color: '#3b82f6' },
        txt: { icon: '📃', label: 'Text File', color: '#6b7280' },
        csv: { icon: '📈', label: 'CSV Data', color: '#22c55e' },
        md: { icon: '📋', label: 'Markdown', color: '#8b5cf6' },
    };
    return typeMap[ext] || { icon: '📎', label: 'Document', color: '#6b7280' };
}

/**
 * Extract text from a PDF file
 */
async function extractPDF(arrayBuffer) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        let fullText = '';

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            if (pageText.trim()) {
                fullText += `\n--- Page ${i} ---\n${pageText}`;
            }
        }

        return {
            text: fullText.trim(),
            pages: totalPages,
            type: 'PDF',
        };
    } catch (err) {
        throw new Error(`Failed to read PDF: ${err.message}`);
    }
}

/**
 * Extract text from a DOCX file
 */
async function extractDOCX(arrayBuffer) {
    try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        return {
            text: result.value.trim(),
            pages: Math.ceil(result.value.length / 3000), // Approximate
            type: 'DOCX',
        };
    } catch (err) {
        throw new Error(`Failed to read DOCX: ${err.message}`);
    }
}

/**
 * Extract text from a PPTX file (PowerPoint)
 * PPTX files are ZIP archives containing XML files for each slide
 */
async function extractPPTX(arrayBuffer) {
    try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const slides = [];
        let slideNum = 1;

        // Find all slide XML files
        const slideFiles = Object.keys(zip.files)
            .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)/)?.[1] || 0);
                const numB = parseInt(b.match(/slide(\d+)/)?.[1] || 0);
                return numA - numB;
            });

        for (const slideFile of slideFiles) {
            const xml = await zip.file(slideFile).async('text');

            // Extract text from XML (remove tags, decode entities)
            const textContent = xml
                .replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi, (_, text) => text + ' ')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            if (textContent) {
                slides.push(`\n--- Slide ${slideNum} ---\n${textContent}`);
            }
            slideNum++;
        }

        return {
            text: slides.join('\n').trim(),
            pages: slideFiles.length,
            type: 'PPTX',
        };
    } catch (err) {
        throw new Error(`Failed to read PPTX: ${err.message}`);
    }
}

/**
 * Extract text from a plain text file
 */
async function extractText(arrayBuffer) {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(arrayBuffer);
    return {
        text: text.trim(),
        pages: 1,
        type: 'TXT',
    };
}

/**
 * Main function: Process a document file and return extracted text
 * @param {File} file - The file to process
 * @returns {Promise<{ text: string, pages: number, type: string, fileName: string }>}
 */
export async function processDocument(file) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';

    let result;

    switch (ext) {
        case 'pdf':
            result = await extractPDF(arrayBuffer);
            break;
        case 'pptx':
            result = await extractPPTX(arrayBuffer);
            break;
        case 'docx':
            result = await extractDOCX(arrayBuffer);
            break;
        case 'txt':
        case 'csv':
        case 'md':
            result = await extractText(arrayBuffer);
            break;
        case 'ppt':
        case 'doc':
            throw new Error('Old .ppt/.doc formats are not supported. Please convert to .pptx/.docx format.');
        default:
            throw new Error(`Unsupported file type: .${ext}`);
    }

    // Truncate very long documents (Gemini has token limits)
    const MAX_CHARS = 30000;
    if (result.text.length > MAX_CHARS) {
        result.text = result.text.substring(0, MAX_CHARS) + `\n\n[... Document truncated. Showing first ${MAX_CHARS} characters of ${result.text.length} total ...]`;
    }

    return {
        ...result,
        fileName: file.name,
    };
}
