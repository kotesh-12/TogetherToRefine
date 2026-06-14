import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import pLimit from 'p-limit';

/**
 * Exports the active chat messages to a single PDF document using html2canvas.
 */
export const exportChatAsPDF = async (messages, theme, setLoading) => {
    const chatElement = document.querySelector('.messages-container');
    if (!chatElement || messages.length <= 1) {
        alert('No chat history to export.');
        return;
    }
    setLoading(true);
    try {
        const canvas = await html2canvas(chatElement, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: theme === 'dark' ? '#0f0f14' : '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`TTR_AI_Chat_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } catch (error) {
        console.error('Failed to export PDF:', error);
        alert('Failed to export chat as PDF.');
    } finally {
        setLoading(false);
    }
};

/**
 * Exports a single message as a formatted PDF document.
 */
export const exportMessageAsDoc = (msgText) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFontSize(22);
    pdf.setTextColor(139, 92, 246); // TTR Accent
    pdf.text("TTRAI Premium Document", 20, 20);

    pdf.setFontSize(12);
    pdf.setTextColor(40, 40, 40);
    const cleanText = msgText.replace(/[*~_`#]/g, '');
    const splitText = pdf.splitTextToSize(cleanText, 170);

    let y = 35;
    for (let i = 0; i < splitText.length; i++) {
        if (y > 280) {
            pdf.addPage();
            y = 20;
        }
        pdf.text(splitText[i], 20, y);
        y += 7; // Line spacing
    }
    pdf.save(`TTRAI_Doc_${Date.now()}.pdf`);
};

/**
 * Converts and exports a single text response into a structured PPTX slide deck.
 */
export const exportMessageAsPPT = async (msgText, setLoading) => {
    setLoading(true);
    try {
        const pres = new pptxgen();
        pres.layout = 'LAYOUT_16x9';
        pres.author = 'TTRAI';

        let slide1 = pres.addSlide();
        slide1.background = { color: 'FFFFFF' };
        slide1.addText('TTRAI Presentation', { x: 1, y: 1.5, w: '100%', h: 1.5, fontSize: 44, color: '000000', align: 'center', bold: true });

        // Clean up the entire text before splitting to avoid markdown artifacts breaking the parser
        let cleanMsg = msgText.replace(/\*\*/g, '').replace(/__/g, '').replace(/###/g, '').replace(/##/g, '');

        // STRICT SPLITTING: Split only when "Slide [Number]:" appears, usually at the start of a block
        const slideRegex = /(?:^|\n)Slide\s*\d*[:\n]/gi;
        
        // Get all slide content blocks by splitting
        let rawBlocks = cleanMsg.split(slideRegex).map(b => b.trim()).filter(b => b.length > 30);

        // Fallback: If no "Slide:" markers found, split by double newlines but insist on large blocks
        if (rawBlocks.length <= 1) {
            rawBlocks = cleanMsg.split(/\n\n+/g).map(b => b.trim()).filter(b => b.length > 50);
        }

        const limit = pLimit(2); // Only allow 2 simultaneous requests

        const slidePromises = rawBlocks.map((block, index) => limit(async () => {
            let slide = pres.addSlide();
            slide.background = { color: 'FFFFFF' };

            let title = `Topic ${index + 1}`;
            let content = '';
            let notes = '';

            let blockText = block;
            
            // Extract Notes first (usually at the end of the block)
            if (blockText.toLowerCase().includes('notes:')) {
                const notesIndex = blockText.toLowerCase().lastIndexOf('notes:');
                notes = blockText.substring(notesIndex + 6).trim();
                blockText = blockText.substring(0, notesIndex).trim();
            }

            // Extract Content (if the AI used specific "Content:" labels)
            if (blockText.toLowerCase().includes('content:')) {
                const contentIndex = blockText.toLowerCase().indexOf('content:');
                title = blockText.substring(0, contentIndex).trim();
                content = blockText.substring(contentIndex + 8).trim();
            } else {
                // Title is the first line, content is the rest
                const lines = blockText.split('\n');
                title = lines[0].trim();
                content = lines.slice(1).join('\n').trim();
            }

            title = title.replace(/^[0-9.\-:]+\s*/, '').substring(0, 100);
            if (!title) title = "Key Concept";

            slide.addText(title, { x: 0.5, y: 0.5, w: 9.0, h: 1, fontSize: 26, bold: true, color: '000000' });

            if (content) {
                const bulletLines = content.split('\n')
                    .map(line => line.replace(/^[*-•]\s*/, '').trim())
                    .filter(line => line.length > 0);

                const bulletObjects = bulletLines.map(line => {
                    return { text: line, options: { bullet: true, color: '000000', paraSpaceAfter: 12 } };
                });

                if (bulletObjects.length > 0) {
                    slide.addText(bulletObjects, { x: 0.5, y: 1.6, w: 9.0, h: 4.5, fontSize: 16, valign: 'top' });
                }
            }

            if (notes) {
                slide.addNotes(notes);
            }
        }));

        // Wait until ALL slides have resolved
        await Promise.all(slidePromises);

        await pres.writeFile({ fileName: `TTRAI_Enterprise_PPT_${Date.now()}.pptx` });
    } catch (error) {
        console.error('PPTX Generation Failed:', error);
        alert('Failed to generate visual presentation. Formatting was too complex.');
    } finally {
        setLoading(false);
    }
};

/**
 * Exports the active chat messages to an Excel (.xlsx) spreadsheet.
 */
export const exportChatAsExcel = (messages) => {
    if (messages.length <= 1) {
        alert('No chat history to export.');
        return;
    }
    try {
        const exportData = messages.filter(m => m.text).map(msg => ({
            Sender: msg.sender === 'ai' ? 'TTRAI' : 'You',
            Message: msg.text,
            Time: new Date().toLocaleString()
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Chat History");
        XLSX.writeFile(workbook, `TTRAI_Chat_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch (err) {
        console.error(err);
        alert('Failed to export Excel.');
    }
};
