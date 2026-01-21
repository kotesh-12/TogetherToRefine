import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // Security: Restrict Access
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:5000'];
    const origin = req.headers.origin;

    if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();

        const text = $('body').text().replace(/\s+/g, ' ').trim();

        // Limit text length
        const truncatedText = text.substring(0, 10000);

        res.status(200).json({ content: truncatedText });
    } catch (error) {
        console.error("URL Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch URL content", details: error.message });
    }
}
