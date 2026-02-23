import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
const genAI = new GoogleGenerativeAI('AIzaSyDOgwcwFlx4qsCReWDEkYVYUWBbbD9duOw');
async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        await model.generateContent('hi');
        console.log('Success 1.5-flash');
    } catch (e) {
        fs.writeFileSync('error.txt', e.message);
    }
}
run();
