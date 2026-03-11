export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
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
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.send(buffer);
    } catch (error) {
        console.error('Image Proxy Error:', error);
        res.status(500).json({ error: 'Failed to proxy image' });
    }
}
