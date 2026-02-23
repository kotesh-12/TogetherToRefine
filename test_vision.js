import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
const genAI = new GoogleGenerativeAI('AIzaSyDOgwcwFlx4qsCReWDEkYVYUWBbbD9duOw');

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const prompt = `You are an incredibly precise AI OCR tool explicitly developed to revolutionize school admissions.
Your job is to read carefully through the uploaded document/image and extract ALL names of people written (either handwritten or typed).
CRITICAL: 
1. Ignore headings, dates, scores, addresses, or phone numbers.
2. If there are names, return ONLY a strict, valid JSON array of strings containing the exact full names found. 
3. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
4. If the document is blank or contains no names, return [].
Example: ["Robert Thompson", "Sarah Jenkins"]`;
        const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        const parts = [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: dummyBase64 } }
        ];
        const res = await model.generateContent(parts);
        console.log('Flash-latest output:', res.response.text());
        let rawText = res.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
        console.log('Parsed JSON:', JSON.parse(rawText));
    } catch (e) {
        console.error('Error flash-latest:', e.message);
    }
}
run();
