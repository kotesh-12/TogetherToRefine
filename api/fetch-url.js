import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "No URL provided" });

        const r = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(r.data);

        // Cleanup content
        $('script, style, nav, header, footer, iframe, ads, .ad').remove();

        const content = $('body').text().trim().substring(0, 10000);
        res.json({ content });
    } catch (e) {
        console.error("Fetch URL Error:", e.message);
        res.status(500).json({ error: e.message });
    }
}
