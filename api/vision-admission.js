import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { image, role, dataClass, dataSection } = req.body;
    if (!API_KEY) return res.status(500).json({ error: "Server Configuration Error: API_KEY is missing." });
    if (!image) return res.status(400).json({ error: "Analysis failed: No image was provided for the OCR process." });

    try {
        const cleanKey = API_KEY.replace(/["']/g, "").trim();
        const genAI = new GoogleGenerativeAI(cleanKey);

        const prompt = `You are an incredibly precise AI OCR tool explicitly developed to revolutionize school admissions.
Your job is to read carefully through the uploaded document/image and extract ALL names of people written (either handwritten or typed).
CRITICAL: 
1. Ignore headings, dates, scores, addresses, or phone numbers.
2. If there are names, return ONLY a strict, valid JSON array of strings containing the exact full names found. 
3. DO NOT wrap the response in markdown blocks like \`\`\`json. Return pure JSON string.
4. If the document is blank or contains no names, return [].
Example: ["Robert Thompson", "Sarah Jenkins"]`;

        // The image parameter comes in as base64 string from the frontend.
        const parts = [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: image } }
        ];

        let names = [];

        try {
            // Priority: gemini-1.5-flash for speed & excellent vision
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent(parts);
            let rawText = result.response.text();
            rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            names = JSON.parse(rawText);
        } catch (e) {
            console.error("1.5-flash AI Model Vision exception:", e.message);
            // Fallback (e.g. if quota issue or model restriction)
            try {
                const modelFallback = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
                const resultFallback = await modelFallback.generateContent(parts);
                let rawTextFall = resultFallback.response.text();
                rawTextFall = rawTextFall.replace(/```json/gi, '').replace(/```/g, '').trim();
                names = JSON.parse(rawTextFall);
            } catch (fallbackError) {
                console.error("Fallback Model failed too:", fallbackError.message);
                throw new Error("Unable to parse text via AI Core. Ensure the photo is clear.");
            }
        }

        // Step 1: Parse and structure the names
        let structuredNames = names.map(name => {
            const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim() || "Unknown";
            const nameParts = cleanName.split(' ');

            // Extract First and Last Name
            let firstName = nameParts[0] || "Student";
            let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

            // Capitalize first letters securely
            const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            firstName = capitalize(firstName);
            lastName = lastName ? capitalize(lastName) : "";

            return {
                originalName: cleanName,
                firstName: firstName,
                lastName: lastName
            };
        });

        // Step 2: Sort Alphabetically by Surname (Last Name) first, then First Name
        structuredNames.sort((a, b) => {
            if (a.lastName === b.lastName) {
                return a.firstName.localeCompare(b.firstName);
            }
            return a.lastName.localeCompare(b.lastName);
        });

        // Step 3: Map into final structured objects with Roll Number and formatting
        const parsedData = structuredNames.map((person, idx) => {
            const rollNumber = idx + 1; // Series number starts at 1

            // Generate Username/Password: RaviBitra37
            const loginCredentials = `${person.firstName}${person.lastName}${rollNumber}`;

            // We use this as the email/system ID for Firebase Auth
            const email = `${loginCredentials.toLowerCase()}@school.com`;

            return {
                name: person.originalName,
                email: email, // Acts as Username for sign in
                password: loginCredentials,
                role: role || 'student', // Admin's pre-selection
                class: role === 'student' ? `${dataClass}-${dataSection}` : 'N/A', // e.g. "9-C"
                rollNumber: rollNumber,
                isInstitutionCreated: true // Flag to skip manual approval for institution-created accounts
            };
        });

        return res.json({ students: parsedData });
    } catch (error) {
        console.error("TTR Core Vision Scan Error:", error);
        return res.status(500).json({ error: "AI Scan encountered a failure: " + error.message });
    }
}
