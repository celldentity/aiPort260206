const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
// --- Express Middlewares ---
app.use(cors());
app.use(express.json());

// Vercel deployment uses 'public/' directory automatically.
// For local 'npm start' support, we serve the 'public' folder.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicitly handle root for local dev
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- API Credentials (환경 변수) ---
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CAR_DB_ID = process.env.CAR_DB_ID;
const RECIPE_DB_ID = process.env.RECIPE_DB_ID;
const CODING_DB_ID = process.env.CODING_DB_ID || '2e8a6753244d80b3b40fd541753022a2';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const EMAIL_USER = process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD';

const verificationCodes = {};

/**
 * 1. Auth System
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodes[email] = code;
    try {
        if (EMAIL_USER === 'YOUR_GMAIL@gmail.com') {
            return res.json({ message: 'Dev Mode: Code sent', success: true });
        }
        await transporter.sendMail({
            from: EMAIL_USER, to: email,
            subject: '[MBC AIX] Verification Code',
            text: `Your code is [${code}]`
        });
        res.json({ message: 'Code sent!', success: true });
    } catch (e) { res.status(500).json({ error: 'Mail failed' }); }
});

app.post('/api/auth/verify-code', (req, res) => {
    const { email, code } = req.body;
    if (verificationCodes[email] && verificationCodes[email] === code) {
        delete verificationCodes[email];
        res.json({ success: true, message: 'Verified' });
    } else { res.status(400).json({ success: false, message: 'Invalid code' }); }
});

/**
 * 2. News System (Turbo Naver & OG Scraper)
 */
async function fetchThumbnail(url) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(1500) });
        if (!response.ok) return null;
        const html = await response.text();
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        return ogMatch ? ogMatch[1] : null;
    } catch (e) { return null; }
}

app.get('/api/news', async (req, res) => {
    const query = req.query.query || '인공지능 뉴스';
    const start = parseInt(req.query.start) || 1;
    try {
        const response = await fetch(`https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=20&start=${start}&sort=sim`, {
            headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }
        });
        const data = await response.json();
        const processedItems = await Promise.all(data.items.map(async (item) => {
            const thumb = await fetchThumbnail(item.link);
            return {
                name: item.title.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"'),
                link: item.link,
                summary: item.description.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"'),
                imageUrl: thumb || null,
                pubDate: item.pubDate
            };
        }));
        res.json({ items: processedItems, hasMore: data.total > start + 20, nextStart: start + 20 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * 3. Notion System (Cars & Recipes)
 */
async function getRobustPageDetails(page) {
    try {
        let name = 'Untitled';
        const titleProp = Object.values(page.properties).find(p => p.type === 'title');
        if (titleProp && titleProp.title?.length > 0) name = titleProp.title[0].plain_text;
        let imageUrl = null; let summary = ''; let youtubeId = null;
        if (page.cover) imageUrl = page.cover.type === 'external' ? page.cover.external.url : page.cover.file.url;
        const blocksResp = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
            headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
        });
        if (blocksResp.ok) {
            const blocks = await blocksResp.json();
            blocks.results.forEach(block => {
                if (!imageUrl && block.type === 'image') imageUrl = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
                if (block.type === 'video' && block.video.type === 'external') {
                    const url = block.video.external.url;
                    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                    if (match) youtubeId = match[1];
                }
                if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
                    const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
                    summary += text + ' ';
                    if (!youtubeId) {
                        const match = text.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                        if (match) youtubeId = match[1];
                    }
                }
            });
        }
        return (imageUrl || youtubeId) ? { name, imageUrl, summary: summary.trim(), id: page.id, youtubeId } : null;
    } catch (e) { return null; }
}

async function handleNotionRequest(req, res, dbId, filter) {
    const { cursor, size = 20 } = req.query;
    try {
        const queryBody = { page_size: parseInt(size), start_cursor: cursor || undefined };
        if (filter) queryBody.filter = filter;

        const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
            body: JSON.stringify(queryBody)
        });
        const data = await response.json();
        const results = [];
        for (let i = 0; i < data.results.length; i += 5) {
            const chunk = data.results.slice(i, i + 5);
            const chunkResults = await Promise.all(chunk.map(page => getRobustPageDetails(page)));
            results.push(...chunkResults.filter(r => r !== null));
        }
        res.json({ items: results, nextCursor: data.next_cursor, hasMore: data.has_more });
    } catch (e) { res.status(500).json({ error: e.message }); }
}

app.get('/api/cars', (req, res) => handleNotionRequest(req, res, CAR_DB_ID));
app.get('/api/recipes', (req, res) => handleNotionRequest(req, res, RECIPE_DB_ID));
app.get('/api/coding', (req, res) => handleNotionRequest(req, res, CODING_DB_ID, {
    or: [
        {
            property: 'Category',
            select: { equals: 'Coding' }
        },
        {
            property: 'Category',
            select: { equals: 'AI' }
        }
    ]
}));

/**
 * 4. AI Insights (ArXiv & Market)
 */
async function translateToKorean(text) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        return data[0][0][0];
    } catch (e) { return text; }
}

app.get('/api/insights/papers', async (req, res) => {
    try {
        const response = await fetch('https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=5');
        const xml = await response.text();

        const rawEntries = [];
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;

        while ((match = entryRegex.exec(xml)) !== null) {
            const content = match[1];
            const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim().replace(/\s+/g, ' ');
            const summary = (content.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.trim().replace(/\s+/g, ' ');
            const link = (content.match(/<link[^>]+href=["']([^"']+)["']/) || [])[1];
            const published = (content.match(/<published>([\s\S]*?)<\/published>/) || [])[1];

            if (title && link) {
                rawEntries.push({ title, summary: summary ? summary.substring(0, 200) + '...' : '', link, published });
            }
        }

        // Translate titles to Korean
        const processedEntries = await Promise.all(rawEntries.map(async (entry) => {
            const translatedTitle = await translateToKorean(entry.title);
            return { ...entry, originalTitle: entry.title, title: translatedTitle };
        }));

        res.json(processedEntries);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/insights/market', (req, res) => {
    // Simulated real-time-like data for demonstration
    // In production, integrate with Alpha Vantage or Finnhub
    const stocks = [
        { symbol: 'NVDA', name: 'NVIDIA', price: 135.22, change: 2.45, percent: 1.84 },
        { symbol: 'MSFT', name: 'Microsoft', price: 412.15, change: -1.20, percent: -0.29 },
        { symbol: 'GOOGL', name: 'Alphabet', price: 154.88, change: 0.95, percent: 0.62 },
        { symbol: 'AMD', name: 'AMD', price: 178.45, change: 3.10, percent: 1.77 },
        { symbol: 'TSLA', name: 'Tesla', price: 185.30, change: -2.15, percent: -1.15 }
    ];
    res.json(stocks);
});


// Vercel Serverless Function export
module.exports = app;

// 로컬 실행용 (node api/index.js)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}
