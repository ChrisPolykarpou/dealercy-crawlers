const chromium = require('chrome-aws-lambda');

/***** Headless Crawler to get rendered page ******/
const RENDER_CACHE = new Map();

// selector -> string used to click a button
// scroll -> boolean var (if page needs autoscroll)
// pages -> int var for number of pages to scrape
// loadMoreExists -> Boolean var (if load more button exists)
async function ssr(url, selector, scroll, pages, loadMoreExists) {
   
  if (RENDER_CACHE.has(url)) {
    return RENDER_CACHE.get(url);
  }

  let data;

  const browser = await chromium.puppeteer.launch({
                        args: chromium.args,
                        defaultViewport: chromium.defaultViewport,
                        executablePath: await chromium.executablePath,
                        headless: chromium.headless,
                        ignoreHTTPSErrors: true,
                    });

  const page = await browser.newPage();
  let currentPage = 1, pagestoscrape = pages;
  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if site lazy loads, etc.
    await page.goto(url, {waitUntil: 'networkidle0'});

    // if scroll is needed to load lazy data
    if(scroll)
        await autoScroll(page);

    // iterate pages to get data
    while (currentPage < pagestoscrape){
        if (currentPage < pagestoscrape) {
            await Promise.all([
                await page.click(selector),
                await page.waitForSelector(selector, {timeout: 4000})
            ])
        }
        
        currentPage++;
        // if load more button exists wait until page is filled with all products
        // avoid duplicating data
        if(!loadMoreExists)
            data = data + '\n' + await page.content();
    }
  } catch (err) {
        // Timeout error is OK. 
        // Means button does not exists or all products are fetched
        if(chromium.timeout){
            await console.log("Rendered url: "+url);
            data = data + '\n' + await page.content();
            return data;
        }
        else
            console.log(err)
        
    }

  data = data + '\n' + await page.content();
  await browser.close();
  
  await console.log("Rendered url: "+url);
  return data; 
}
// Scroll down for lazy fields to be filled (if product is available or not)
async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    });
}

module.exports = { ssr };