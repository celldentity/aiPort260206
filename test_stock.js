const cheerio = require('cheerio');

async function testStock(code) {
    const url = `https://search.naver.com/search.naver?query=미국주식+${code}`;
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' }
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        const price = $('.sise_price .stock_price').first().text() || $('.price_area .now_price').first().text();
        const change = $('.sise_price .price_val').first().text() || $('.price_area .change_price').first().text();
        const percent = $('.sise_price .per_val').first().text() || $('.price_area .change_percent').first().text();
        const name = $('.sise_tit strong').text() || $('.stock_name').text() || code;

        console.log(`[${code}] Name: ${name}, Price: ${price}, Change: ${change}, Percent: ${percent}`);

        // Debug first 500 chars if empty
        if (!price) {
            console.log("Empty result. Snippet:");
            console.log(html.substring(0, 500));
        }
    } catch (e) {
        console.error(e);
    }
}

testStock('NVDA');
testStock('AAPL');
testStock('TSLA');
