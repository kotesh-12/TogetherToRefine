export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    // SSRF Protection
    try {
        const parsedUrl = new URL(url);
        const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];
        if (blockedHostnames.includes(parsedUrl.hostname) || parsedUrl.hostname.startsWith('10.') || parsedUrl.hostname.startsWith('192.168.') || parsedUrl.hostname.startsWith('172.') || !['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(403).json({ error: 'Blocked URL' });
        }
    } catch (e) {
        console.error("URL Parse error:", e);
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const response = await fetch(url.replace(/ /g, '%20'), {
            headers: {
                'User-Agent': 'TTR-AI-Proxy/1.0',
                'Accept': 'image/jpeg,image/png,image/webp,*/*'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        // Enable CORS for local dev and production
        const ALLOWED_ORIGINS = ['https://www.ttrai.in', 'https://ttrai.in', 'https://ttr-ai-psi.vercel.app', 'http://localhost:5173', 'http://localhost:5000'];
        const origin = req.headers.origin;
        if (ALLOWED_ORIGINS.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.send(buffer);
    } catch (e) {
        console.error("Image proxy error:", e);
        res.status(500).json({ error: 'Failed to fetch image', details: e.message });
    }
}
