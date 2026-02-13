const express = require('express');
const cors = require('cors');
const path = require('path');
// Removed Cheerio as it might be missing or causing issues
require('dotenv').config();

const app = express();

// --- Express Middlewares ---
app.use(cors());
app.use(express.json({ limit: '50mb' })); // [v100.3] Fix PayloadTooLarge Error for images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Vercel deployment uses 'public/' directory automatically.
// For local 'npm start' support, we serve the 'public' folder.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicitly handle root for local dev
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Stock Logic with 30-minute Cache ---
const stockCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in ms

app.get('/api/stock', async (req, res) => {
    const code = req.query.code; // e.g., '005930' (KR) or 'NVDA' (US)
    if (!code) return res.status(400).json({ error: 'Code required' });

    // Check Cache
    const now = Date.now();
    if (stockCache[code] && (now - stockCache[code].timestamp < CACHE_DURATION)) {
        return res.json(stockCache[code].data);
    }

    try {
        const isKR = /^[0-9]+$/.test(code);
        let url, priceStr, changeStr, percentStr, name;
        let change = 0, percent = 0;

        if (isKR) {
            // --- KR Stock (Naver Finance) ---
            url = `https://finance.naver.com/item/main.naver?code=${code}`;
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await response.text();
            const $ = cheerio.load(html);

            // Detailed selectors for Naver Finance
            priceStr = $('.no_today .blind').first().text().replace(/,/g, '');
            const noExday = $('.no_exday');
            changeStr = noExday.find('.blind').first().text().replace(/,/g, '');
            percentStr = noExday.find('.blind').eq(1).text().replace(/%/g, '');
            name = $('.wrap_company h2 a').text().trim();

            const isDown = noExday.find('.ico.down').length > 0;
            change = parseFloat(changeStr) || 0;
            percent = parseFloat(percentStr) || 0;
            if (isDown) {
                change = -Math.abs(change);
                percent = -Math.abs(percent);
            }
        } else {
            // --- US Stock (Yahoo Finance API) ---
            try {
                const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}`;
                const response = await fetch(yfUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
                if (response.ok) {
                    const data = await response.json();
                    const meta = data.chart?.result?.[0]?.meta;
                    if (meta && meta.regularMarketPrice !== undefined) {
                        priceStr = meta.regularMarketPrice.toString();
                        const pc = meta.previousClose || meta.chartPreviousClose;
                        change = pc ? (meta.regularMarketPrice - pc) : 0;
                        percent = pc ? (change / pc * 100) : 0;
                        name = meta.longName || meta.shortName || code;
                    }
                }
            } catch (e) { console.error(`[Yahoo] Failed for ${code}:`, e.message); }

            // Fallback to Naver Search IF Yahoo fails
            if (!priceStr || isNaN(parseFloat(priceStr))) {
                const sUrl = `https://search.naver.com/search.naver?query=미국주식+${code}`;
                const sResp = await fetch(sUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const sHtml = await sResp.text();
                const $s = cheerio.load(sHtml);
                priceStr = $s('.sise_price .stock_price').text().replace(/,/g, '') || $s('.price_area .now_price').text().replace(/,/g, '');
                changeStr = $s('.sise_price .price_val').first().text().replace(/,/g, '') || $s('.price_area .change_price').text().replace(/,/g, '');
                percentStr = $s('.sise_price .per_val').first().text().replace(/[+%\-]/g, '') || $s('.price_area .change_percent').text().replace(/[+%\-]/g, '');
                name = $s('.sise_tit strong').text() || $s('.stock_name').text() || code;
                const isDown = $s('.sise_price .price_val').parent().hasClass('down') || $s('.price_area .ico.down').length > 0;
                change = parseFloat(changeStr) || 0;
                percent = parseFloat(percentStr) || 0;
                if (isDown) { change = -Math.abs(change); percent = -Math.abs(percent); }
            }
        }

        if (!priceStr || isNaN(parseFloat(priceStr))) throw new Error('Data parsing failed');

        const stockData = {
            price: parseFloat(priceStr),
            change: change || 0,
            percent: percent || 0,
            name: name || code,
            updatedAt: new Date().toISOString()
        };

        // Cache the result
        stockCache[code] = {
            timestamp: now,
            data: stockData
        };

        res.json(stockData);
    } catch (e) {
        console.error(`[Stock API Error] Fetched failed for ${code}:`, e);
        res.status(500).json({ error: 'Failed to fetch stock data', detail: e.message });
    }
});

/**
 * 3. Market \u0026 Coding List (Mock Data)
 */
// ... (rest of the file)
// Explicitly handle root for local dev
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- API Credentials ---
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CAR_DB_ID = process.env.CAR_DB_ID || 'c7e86753244d80a18770cdf8cb99589d';
const RECIPE_DB_ID = process.env.RECIPE_DB_ID || '80ca6753244d806385d9cca956f77918';
const CODING_DB_ID = process.env.CODING_DB_ID || '2e8a6753244d80b3b40fd541753022a2';
const GUESTBOOK_DB_ID = process.env.GUESTBOOK_DB_ID || '301a6753244d8045b498d56f10eae762';
const URL_COLLECTION_DB_ID = process.env.URL_COLLECTION_DB_ID || '2eea6753244d80bfafb6c56005a83812';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

const EMAIL_USER = process.env.EMAIL_USER || 'YOUR_GMAIL@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD';
const BOARD_DB_ID = GUESTBOOK_DB_ID; // Aliased to Guestbook for shared DB

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

// [v145] URL Collection System (Notion)
app.get('/api/urls', async (req, res) => {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${URL_COLLECTION_DB_ID}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sorts: [{ property: '이름', direction: 'descending' }]
            })
        });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: 'DB Fetch Failed', detail: data });

        const items = data.results.map(page => {
            const props = page.properties;
            return {
                name: props['이름']?.title[0]?.plain_text || 'Untitled',
                link: props['URL']?.url || props['링크']?.url || '#',
                summary: props['비고']?.rich_text[0]?.plain_text || '',
                pubDate: new Date(page.created_time).toLocaleDateString()
            };
        });
        res.json({ items });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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
        res.json({ items: processedItems, hasMore: (data.total || 0) > start + 20, nextStart: start + 20 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * 3. Notion System (Cars & Recipes)
 */
async function getRobustPageDetails(page) {
    try {
        let name = 'Untitled';
        const titleProp = Object.values(page.properties).find(p => p.type === 'title');
        if (titleProp && titleProp.title?.length > 0) {
            name = titleProp.title[0].plain_text;
        } else {
            // [v119] Fallback: Look for common title property names if generic finder fails
            const fallbacks = ['이름', '차량명', 'Name', 'Title', '차이름', '상품명'];
            for (const key of fallbacks) {
                if (page.properties[key] && page.properties[key].rich_text?.length > 0) {
                    name = page.properties[key].rich_text[0].plain_text;
                    break;
                }
            }
        }

        let imageUrl = null;
        let summary = '';
        let youtubeId = null;
        let mediaType = 'image';
        const media = [];

        // Helper to Proxy blocked domains
        const getProxiedUrl = (url) => {
            if (!url) return null;
            if (url.includes('catbox.moe')) {
                return `/api/proxy-image?url=${encodeURIComponent(url)}`;
            }
            return url;
        };

        const props = page.properties;

        // 1. Check 'Media' or '미디어' property (Priority - supports multiple files)
        const mediaProp = props['Media'] || props['미디어'];
        if (mediaProp && mediaProp.files && mediaProp.files.length > 0) {
            mediaProp.files.forEach(f => {
                const url = f.type === 'external' ? f.external.url : f.file.url;
                const type = f.name?.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image';
                media.push({ url: getProxiedUrl(url), type: type });
                if (!imageUrl && type === 'image') imageUrl = url;
            });
        }

        // 2. Check Page Cover (Fallback)
        if (media.length === 0 && page.cover) {
            if (page.cover.type === 'external') {
                const url = page.cover.external.url;
                media.push({ url: getProxiedUrl(url), type: 'image' });
                if (!imageUrl) imageUrl = url;
            } else if (page.cover.type === 'file') {
                const url = page.cover.file.url;
                media.push({ url: getProxiedUrl(url), type: 'image' });
                if (!imageUrl) imageUrl = url;
            }
        } else if (media.length === 0) {
            // [v119] Multi-fallback for image properties
            const imgFallbacks = ['File', '파일', '이미지', 'Image', 'Thumbnail', '썸네일', 'Photo', '사진'];
            for (const key of imgFallbacks) {
                const p = props[key];
                if (p && p.files && p.files.length > 0) {
                    const f = p.files[0];
                    const url = f.type === 'external' ? f.external.url : f.file.url;
                    media.push({ url: getProxiedUrl(url), type: 'image' });
                    if (!imageUrl) imageUrl = url;
                    break;
                } else if (p && p.url) { // property type 'url'
                    media.push({ url: getProxiedUrl(p.url), type: 'image' });
                    if (!imageUrl) imageUrl = p.url;
                    break;
                }
            }
        }

        // Check for explicit mediaType from '비고' or similar columns
        for (const [key, prop] of Object.entries(page.properties)) {
            if (key === '비고' || key === 'MediaType') {
                const val = prop.rich_text?.[0]?.plain_text;
                if (val === 'video') mediaType = 'video';
            }
        }

        // Fetch text content and video from blocks
        const blocksResp = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
            headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
        });

        if (blocksResp.ok) {
            const blocksData = await blocksResp.json();
            blocksData.results.forEach(block => {
                // [v120] Extract images from body blocks (similar to recipes)
                if (block.type === 'image') {
                    const url = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
                    media.push({ url: getProxiedUrl(url), type: 'image' });
                    if (!imageUrl) imageUrl = url;
                }

                if (block.type === 'video' && block.video.type === 'external') {
                    const url = block.video.external.url;
                    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                    if (match) {
                        youtubeId = match[1];
                        mediaType = 'video';
                        media.push({ url: url, type: 'video', youtubeId: match[1] });
                    } else {
                        if (!imageUrl) imageUrl = url;
                        mediaType = 'video';
                        media.push({ url: getProxiedUrl(url), type: 'video' });
                    }
                }
                if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
                    const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
                    summary += text + ' ';
                    if (!youtubeId) {
                        const match = text.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                        if (match) {
                            youtubeId = match[1];
                            mediaType = 'video';
                            media.push({ url: text, type: 'video', youtubeId: match[1] });
                        }
                    }
                }
            });
        }

        // Final fallback for Free Board compatibility
        const dateProp = page.properties['날짜']?.date?.start;
        // [v120] Robust author detection (trying multiple property names)
        const authorProp = page.properties['사용자ID']?.rich_text?.[0]?.plain_text ||
            page.properties['작성자']?.rich_text?.[0]?.plain_text ||
            page.properties['이름']?.title?.[0]?.plain_text;
        const textProp = page.properties['텍스트']?.rich_text?.[0]?.plain_text;

        return {
            name,
            title: name,
            imageUrl: getProxiedUrl(imageUrl),
            mediaUrl: getProxiedUrl(imageUrl), // Compatibility
            media: media, // [v109] MULTI MEDIA ARRAY
            summary: summary.trim() || textProp || '',
            content: textProp || summary.trim() || '',
            id: page.id,
            youtubeId,
            mediaType,
            author: authorProp || 'Anonymous',
            date: dateProp ? new Date(dateProp).toLocaleDateString() : ''
        };
    } catch (e) {
        console.error(`[Notion Details Error] ${page.id}:`, e);
        return null;
    }
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


// [v144] Unified Stock Scraper (Naver for KR, Yahoo for US)
app.get('/api/stock', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code required' });

    try {
        let price = 0, change = 0, percent = 0;

        if (code.match(/^\d+$/)) { // KR Stock (Naver Finance)
            const url = `https://finance.naver.com/item/main.naver?code=${code}`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
            const html = await resp.text();

            // More robust regex for Naver Finance
            const pMatch = html.match(/<em class="no_up">[^]*?<span class="blind">([\d,]+)/) ||
                html.match(/<em class="no_down">[^]*?<span class="blind">([\d,]+)/) ||
                html.match(/<em class="no_none">[^]*?<span class="blind">([\d,]+)/);

            // Fallback for different HTML structure
            const pFallback = html.match(/class="now_value">([\d,]+)/) || html.match(/class="price">([\d,]+)/);
            const finalPrice = pMatch ? pMatch[1] : (pFallback ? pFallback[1] : null);

            const cMatch = html.match(/<span class="ico (?:up|down)">([\d,]+)/);
            const rMatch = html.match(/<span class="tah p11 (?:red02|nv01)">([+-][\d.]+)/);

            if (finalPrice) price = parseInt(finalPrice.replace(/,/g, ''));
            if (cMatch) change = parseInt(cMatch[1].replace(/,/g, ''));
            if (rMatch) percent = parseFloat(rMatch[1]);
        } else { // US Stock (Yahoo Finance Proxy)
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
            const data = await resp.json();
            const meta = data.chart?.result?.[0]?.meta;
            if (meta) {
                price = meta.regularMarketPrice;
                change = price - meta.previousClose;
                percent = (change / meta.previousClose) * 100;
            }
        }
        res.json({ price, change, percent });
    } catch (e) {
        console.error(`[Stock Error] ${code}:`, e.message);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});



/**
 * 5. Idea Board (Cloudinary Integration) [v75]
 */
app.get('/api/idea/list', async (req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'deoed1tri';
    const folderTag = process.env.CLOUDINARY_FOLDER_TAG || 'test1';

    console.log(`[Cloudinary] Fetching list for cloud: ${cloudName}, tag: ${folderTag}`);

    try {
        // Fetch from Cloudinary Public List JSON
        const response = await fetch(`https://res.cloudinary.com/${cloudName}/image/list/${folderTag}.json`);

        if (!response.ok) {
            console.error(`[Cloudinary] API Error: ${response.status} ${response.statusText}`);
            console.error(`[Cloudinary] URL: https://res.cloudinary.com/${cloudName}/image/list/${folderTag}.json`);
            console.error(`[Cloudinary] NOTE: If 404, check if 'Resource List' is enabled in Cloudinary Settings.`);
            return res.status(response.status).json({
                error: 'Cloudinary List API failed',
                status: response.status,
                hint: 'Check Cloudinary "Resource List" security setting'
            });
        }

        const data = await response.json();
        console.log(`[Cloudinary] Successfully fetched ${data.resources?.length || 0} items.`);

        if (!data.resources || data.resources.length === 0) {
            console.warn(`[Cloudinary] No resources found for tag: ${folderTag}`);
        }

        // [v80] Re-interpret and optimize URLs
        const items = (data.resources || []).map(img => {
            // Optimization parameters: w_400 (width), q_auto (quality), f_auto (format)
            const optimizedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/w_400,q_auto,f_auto/v${img.version}/${img.public_id}.${img.format}`;

            return {
                name: img.public_id.split('/').pop(),
                imageUrl: optimizedUrl,
                link: optimizedUrl, // Direct link to optimized image
                pubDate: new Date(img.created_at).toLocaleDateString('ko-KR')
            };
        });

        res.json({ items });
    } catch (e) {
        console.error('[Cloudinary] fetch error:', e);
        res.status(500).json({ error: 'Failed to fetch Cloudinary gallery', details: e.message });
    }
});

/**
 * 6. Guestbook System (Notion) [v81]
 */
app.get('/api/guestbook', async (req, res) => {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${GUESTBOOK_DB_ID}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sorts: [{ property: '날짜', direction: 'descending' }]
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[Database GET Error]', data);
            return res.status(response.status).json({ error: 'Database Fetch Failed', detail: data });
        }

        const items = data.results.map(page => {
            const props = page.properties;
            // Support both '내용' and '텍스트' for flexibility
            const contentProp = props['내용'] || props['텍스트'];
            return {
                id: page.id,
                name: props['이름']?.title[0]?.plain_text || 'Anonymous',
                text: contentProp?.rich_text[0]?.plain_text || '',
                username: props['사용자ID']?.rich_text[0]?.plain_text || '',
                date: props['날짜']?.date?.start
                    ? new Date(props['날짜'].date.start).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : ''
            };
        });
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/guestbook', async (req, res) => {
    const { name, text, username } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    try {
        const body = {
            parent: { database_id: GUESTBOOK_DB_ID },
            properties: {
                '이름': { title: [{ text: { content: name || 'Anonymous' } }] },
                '사용자ID': { rich_text: [{ text: { content: username || '' } }] },
                '날짜': { date: { start: new Date().toISOString() } }
            }
        };
        body.properties['텍스트'] = { rich_text: [{ text: { content: text } }] };

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const resData = await response.json();
        if (response.ok) {
            res.json({ success: true });
        } else {
            console.error('[Database POST Error]', resData);
            res.status(response.status).json({ error: 'Database API Error', detail: resData });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/guestbook/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
        // 1. Verify ownership
        const pageResp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
        });
        const pageData = await pageResp.json();
        const owner = pageData.properties['사용자ID']?.rich_text[0]?.plain_text;

        if (owner !== username && username !== 'admin') {
            return res.status(403).json({ error: '본인 글만 삭제할 수 있습니다.' });
        }

        // 2. Archive the page
        const delResp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ archived: true })
        });

        if (delResp.ok) res.json({ success: true });
        else res.status(delResp.status).json({ error: 'Delete failed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 7. URL Collection System (Notion) [v82]
 */
app.get('/api/urls', async (req, res) => {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${URL_COLLECTION_DB_ID}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filter: {
                    property: 'URL',
                    url: { is_not_empty: true }
                }
            })
        });
        const data = await response.json();
        const items = data.results.map(page => {
            const props = page.properties;
            return {
                name: props['이름']?.title[0]?.plain_text || 'Untitled',
                url: props['URL']?.url || '',
                note: props['비고']?.rich_text[0]?.plain_text || ''
            };
        });
        res.json(items);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 8. Board System (Notion + Cloudinary) [v92]
 * Since we can't easily install new packages globally, we use existing fetch for Cloudinary.
 */
app.get('/api/board', async (req, res) => {
    try {
        const response = await fetch(`https://api.notion.com/v1/databases/${BOARD_DB_ID}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sorts: [{ property: '날짜', direction: 'descending' }]
            })
        });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: 'DB Fetch Failed', detail: data });

        const items = await Promise.all(data.results.map(page => getRobustPageDetails(page)));
        res.json(items.filter(i => i !== null));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/board', async (req, res) => {
    const { title, content, mediaUrl, mediaType, username } = req.body;
    try {
        const children = [];

        // 1. Add text content as paragraph
        if (content) {
            children.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: content } }]
                }
            });
        }

        // 2. Add media (image or video) as block in body
        if (mediaUrl) {
            if (mediaType === 'video') {
                children.push({
                    object: 'block',
                    type: 'video',
                    video: {
                        type: 'external',
                        external: { url: mediaUrl }
                    }
                });
            } else {
                children.push({
                    object: 'block',
                    type: 'image',
                    image: {
                        type: 'external',
                        external: { url: mediaUrl }
                    }
                });
            }
        }

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { database_id: BOARD_DB_ID },
                properties: {
                    '이름': { title: [{ text: { content: title || 'Untitled' } }] },
                    // [v115] Simplified Properties to reduce 400 Errors
                    // '텍스트', '사용자ID', '날짜' must exist in DB.
                    // Removed '비고' and 'URL' as they might be missing and cause failure.
                    '텍스트': { rich_text: [{ text: { content: content?.substring(0, 2000) || '' } }] },
                    '사용자ID': { rich_text: [{ text: { content: username || 'Anonymous' } }] },
                    '날짜': { date: { start: new Date().toISOString() } }
                },
                children: children.length > 0 ? children : undefined
            })
        });

        const resData = await response.json();
        if (response.ok) {
            res.json({ success: true });
        } else {
            console.error('[Notion API Error]', resData);
            res.status(response.status).json({
                error: '노션 저장 실패',
                detail: resData.message || 'Unknown error'
            });
        }
    } catch (e) {
        console.error('[Board API Internal Error]', e);
        res.status(500).json({ error: '서버 내부 오류', detail: e.message });
    }
});

// [v117] Board Delete Route (본인 글만 삭제 가능)
app.delete('/api/board/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.body;

    try {
        // 1. Verify ownership
        const pageResp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28' }
        });
        const pageData = await pageResp.json();
        const props = pageData.properties;
        const owner = props['사용자ID']?.rich_text[0]?.plain_text ||
            props['작성자']?.rich_text[0]?.plain_text ||
            props['이름']?.title[0]?.plain_text;

        if (owner !== username && username !== 'admin') {
            return res.status(403).json({ error: '본인 글만 삭제할 수 있습니다.' });
        }

        // 2. Archive the page
        const delResp = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ archived: true })
        });

        if (delResp.ok) res.json({ success: true });
        else res.status(delResp.status).json({ error: 'Delete failed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// [v144] Secure Firebase Config Endpoint
app.get('/api/config/firebase', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
});

// Cloudinary Upload API (Base64 approach for simplicity without multer in Vercel)
app.post('/api/board/upload', express.json({ limit: '10mb' }), async (req, res) => {
    const { file, type } = req.body;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    // [v100.6] Emergency Keyless Hand-Coded Multipart Upload (Catbox.moe)
    // Since we cannot install 'form-data' or 'multer', we construct the body manually.

    try {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        // [v111.0] Enhanced Base64 handling
        let base64Content = file;
        if (file.includes(',')) {
            base64Content = file.split(',')[1];
        }
        const fileData = Buffer.from(base64Content, 'base64');

        // [v111.0] Better MIME/Extension detection
        const mimeType = type || 'image/png';
        const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';

        // [v112.0] Switched to Catbox.moe for reliable file hosting
        // Catbox requires 'reqtype=fileupload' and 'fileToUpload' field

        let postData = `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`;
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="fileToUpload"; filename="upload.${extension}"\r\n`;
        postData += `Content-Type: ${mimeType}\r\n\r\n`;

        const payload = Buffer.concat([
            Buffer.from(postData, 'utf8'),
            fileData,
            Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
        ]);

        console.log(`[Catbox Upload] Uploading ${payload.length} bytes...`);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            body: payload
        });

        const resultText = await response.text();

        if (response.ok && resultText.startsWith('http')) {
            console.log('[Upload Success]', resultText);
            res.json({ url: resultText.trim() });
        } else {
            console.error('[Catbox Failed]', resultText);
            throw new Error('Upload provider rejected the file.');
        }
    } catch (e) {
        console.error('[Upload Provider Error]', e);
        res.status(500).json({ error: 'Upload Failed', detail: e.message });
    }
});

// Global Error Handler to always return JSON
app.use((err, req, res, next) => {
    console.error('[Global Error Internal]', err);
    res.status(500).json({
        error: 'Global Server Error',
        detail: err.message,
        path: req.path
    });
});

// [v108] Image Proxy to bypass ISP blocking (e.g., Catbox.moe in Korea)
app.get('/api/proxy-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL is required');

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`External Upstream Error: ${response.status}`);

        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (e) {
        console.error('[Proxy Success Failed]', e.message);
        res.status(500).send('Proxy Failed');
    }
});

// Vercel Serverless Function export
module.exports = app;

// 로컬 실행용 (node api/index.js)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}
