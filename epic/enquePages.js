const chromium = require('chrome-aws-lambda');  // deployed in aws lambda

// selector -> string used to click a button
async function ssr(url, selector) {

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