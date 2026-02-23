import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
const genAI = new GoogleGenerativeAI('AIzaSyDOgwcwFlx4qsCReWDEkYVYUWBbbD9duOw');
async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        await model.generateContent('hi');
        console.log('Success flash-latest');
    } catch (e) {
        fs.writeFileSync('error2.txt', e.message);
    }
}
run();
