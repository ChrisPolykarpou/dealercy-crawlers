const chromium = require('chrome-aws-lambda');
const cheerio = require('cheerio');
const db = require('../util/db');

const connection = db.pool;
// get promises instead of using callbacks
const util = require('util')
const queryCallback = connection.query.bind(connection)
const queryPromise = util.promisify(queryCallback) // now this returns a promise we can "await"
const sql = "INSERT INTO plans (prodID, sku, title, planTitle, upfrontCost, perMonthCost, perMonthOffer, contractLength, data, minutes, messages, costOfDevice, link, shopID, availability, bit) VALUES ? ON DUPLICATE KEY UPDATE upfrontCost = VALUES(upfrontCost), perMonthCost = VALUES(perMonthCost), perMonthOffer = VALUES(perMonthOffer), bit = VALUES(bit), availability = VALUES(availability), costOfDevice = VALUES(costOfDevice), link = VALUES(link)";
const sqlStore = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), bit = VALUES(bit)";

// colorLinks -> 
async function ssr(url, selector, colorNum) {

  let data, currentNum=0;

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

    // Crawl options
    while (currentNum <= colorNum){
        
        if (currentNum <= colorNum) {
            if(colorNum > 0){
                await Promise.all([
                    page.click('.mtn-component-features-table table tbody tr:nth-child(2) td a:nth-child('+(currentNum+1)+')'),
                    page.waitForNavigation({ waitUntil: 'networkidle0' })
                ])
            }
            // store content
            data = await page.content();
            // pass each new option for processing
            var urlPass = await page.evaluate(() => document.location.href);
            processData(data, urlPass); 
        }
        
        currentNum++;
    }        
    
        
  } catch (err) {
        // Timeout error is OK. 
        // Means button does not exists or all products are fetched
        console.log(err);
        await console.log("Rendered url: "+url);
        await browser.close();
        return data;
        
    }

  await browser.close();
  
}

// This function uses cheerio to process our html and import into DB
async function processData(html, link){
    var $ = cheerio.load(html);

    var title = $('.col-md-12 h1').text().trim();
    
    var sku = link.substring(link.indexOf('en/i/')+5);
    sku = sku.substring(0, sku.indexOf('/'));
    var availability = $(".mtn-component-availability-status").text();
    if(availability == 'temporarily out of stock')
        availability = 'N';
    else
        availability = 'Y';
    
    var retailPrice = $(".price span:nth-child(2)").text()
    if (retailPrice == ''){
        retailPrice = $(".mtn-component-buy-without-plan div div span").text()
        retailPrice = retailPrice.replace('Online Price: €', '');
    }

    // Store plan info
    var plans = $('.mtn-component-plans-table-new');
    
    var planTitle=[], upfrontCost=[], perMonthCost=[], data=[], minutes=[], messages=[], perMonthOffer=[];
    for(var i=0; i<4; i++){ 
        planTitle.push($(plans[i]).find('.mtn-name h3').text().trim());
        upfrontCost.push($(plans[i]).find('.mtn-upto .price').text().trim());
        upfrontCost[i] = upfrontCost[i].substring(1);
        perMonthCost.push($(plans[i]).find('.mtn-from .price').text().trim());
        perMonthCost[i] = perMonthCost[i].substring(1);
        perMonthOffer.push($(plans[i]).find('.mtn-offer').find('strong').text().trim());
        perMonthOffer[i] = perMonthOffer[i].substring(perMonthOffer[i].indexOf('€'));
        perMonthOffer[i] = perMonthOffer[i].substring(1, perMonthOffer[i].indexOf(' '));

        minutes.push($(plans[i]).find('.mtn-includes-container div:nth-child(1) h4 strong').text().trim());
        messages.push($(plans[i]).find('.mtn-includes-container div:nth-child(2) h4 strong').text().trim());
        data.push($(plans[i]).find('.mtn-includes-container div:nth-child(3) h4 strong').text().trim());
        data[i] = data[i] + ' GB';

        // insert into DB
        await queryPromise(sql, [[[-1, sku+i, title, planTitle[i], upfrontCost[i], perMonthCost[i], perMonthOffer[i], '24 Months', data[i], minutes[i], messages[i], retailPrice, link, 15, availability, 1]]]);
    
    }
    await queryPromise(sqlStore, [[[-1, sku, title, retailPrice, [link], 15, availability, 'Free', 1]]]);
}

module.exports = { ssr };