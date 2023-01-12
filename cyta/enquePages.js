/***
 * This function uses puppeteer(Headless-Chrome)
 * returns every link for each product to be crawled.
 * Then renderProduct.js is used to crawl each link and find(click)
 * all options (color, storage) of every single product and process
 * them before saving them into the database.
 * The reason of this implementations is to achieve concurrency
 * in AWS lambda */ 

const chromium = require('chrome-aws-lambda');  // deployed in aws lambda

// selector -> string used to click a button
// num -> int var for number of pages to scrape
async function ssr(url, selector, num) {

  let data;

  const browser = await chromium.puppeteer.launch({
                        args: chromium.args,
                        defaultViewport: chromium.defaultViewport,
                        executablePath: await chromium.executablePath,
                        headless: chromium.headless,
                        ignoreHTTPSErrors: true,
                    });

  const page = await browser.newPage();
  // set user-agent
  await page.setUserAgent(
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9'
 )
  try {
    // networkidle0 waits for the network to be idle (no requests for 500ms).
    // The page's JS has likely produced markup by this point, but wait longer
    // if site lazy loads, etc.
    await page.goto(url, {waitUntil: 'networkidle0'});

    // This website uses __doPostBack functions for every button clicked.. -.-
    // We have to console.log to be able to click the button through the crawler
    var nextPage = "__doPostBack('ctl00$cphContent$grvProducts', 'Page$"+num+"')";

    if(num>1){
      await Promise.all([
        await console.log(await page.evaluate(nextPage, () => nextPage)),
        await page.waitForSelector(selector, {timeout: 25000})  // Check if page has changed successfully
      ])
    }
    
    data = await page.content();
        
  } catch (err) {
        console.log(err);
        await browser.close();
        
    }

  await browser.close();
  
  await console.log("Getting products to crawl from: "+url);
  return data; 
}

module.exports = { ssr };