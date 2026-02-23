import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Enable CORS for Vercel Serverless
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { image, expectedClass, expectedSection, expectedExamType } = req.body;

    if (!API_KEY) return res.status(500).json({ error: "Server Configuration Error: API_KEY is missing." });
    if (!image) return res.status(400).json({ error: "Analysis failed: No image provided." });

    try {
        const cleanKey = API_KEY.replace(/["']/g, "").trim();
        const genAI = new GoogleGenerativeAI(cleanKey);

        const prompt = `You are a highly advanced OCR and Data Verification AI explicitly developed to revolutionize school grading.
Your job is to read carefully through the uploaded teacher's grading sheet or students' test papers and extract the Marks data.

CRITICAL INSTRUCTIONS:
1. Identify the CLASS (e.g. 1 to 12) if visible. (Expected: ${expectedClass || 'Any'})
2. Identify the SECTION (e.g. A, B, C) if visible. (Expected: ${expectedSection || 'Any'})
3. Identify the EXAM TYPE from: [Assignment 1, Assignment 2, Mid-Term 1, Mid-Term 2, Final Exam]. (Expected: ${expectedExamType || 'Any'})
4. For every student visible, extract their FULL NAME and their MARKS. If absent, marks = 0.
5. If max marks is mentioned, adjust to standard out of 100 or simply capture what is written. For simplicity, just return the marks number.

OUTPUT FORMAT:
Return ONLY a valid JSON object. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
{
  "class": "String (number)",
  "section": "String",
  "examType": "String",
  "data": [
      { "nameKey": "John Doe", "marks": 85 }
  ]
}`;

        const parts = [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: image } }
        ];

        let parsedData = null;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const result = await model.generateContent(parts);
            let rawText = result.response.text();

            const startIdx = rawText.indexOf('{');
            const endIdx = rawText.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1) {
                rawText = rawText.substring(startIdx, endIdx + 1);
            } else {
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            }
            parsedData = JSON.parse(rawText);
        } catch (e) {
            console.error("AI Model Vision exception:", e.message);
            throw new Error(e.message);
        }

        // Clean and prepare the data for the frontend
        if (!parsedData.class) parsedData.class = expectedClass || "";
        if (!parsedData.section) parsedData.section = expectedSection || "";
        if (!parsedData.examType) parsedData.examType = expectedExamType || "";

        if (parsedData.class && !isNaN(parseInt(parsedData.class))) {
            parsedData.class = String(parseInt(parsedData.class));
        }
        if (parsedData.data) {
            parsedData.data = parsedData.data.map(item => ({
                nameKey: String(item.nameKey || "Unknown").trim(),
                marks: isNaN(Number(item.marks)) ? 0 : Number(item.marks),
                matchedStudentId: null // to be filled on frontend
            }));
        } else {
            parsedData.data = [];
        }

        return res.json(parsedData);
    } catch (error) {
        console.error("TTR Marks Vision Scan Error:", error);
        return res.status(500).json({ error: "Marks AI Scan encountered a failure: " + error.message });
    }
}
