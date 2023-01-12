const chromium = require('chrome-aws-lambda');
const cheerio = require('cheerio');
const db = require('../util/db');

const connection = db.pool;
// get promises instead of using callbacks
const util = require('util')
const queryCallback = connection.query.bind(connection)
const queryPromise = util.promisify(queryCallback) // now this returns a promise we can "await"
const sql = "INSERT INTO plans (prodID, sku, title, planTitle, upfrontCost, perMonthCost, contractLength, data, minutes, messages, costOfDevice, link, shopID, availability, bit) VALUES ? ON DUPLICATE KEY UPDATE upfrontCost = VALUES(upfrontCost), perMonthCost = VALUES(perMonthCost), bit = VALUES(bit), availability = VALUES(availability), costOfDevice = VALUES(costOfDevice), link = VALUES(link), data = VALUES(data), minutes = VALUES(minutes), messages = VALUES(messages)";
const sqlStore = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), bit = VALUES(bit)";

// colorLinks -> 
async function ssr(url, selector, colorLinks, memLinks) {

  let data, num=2;

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

    data = data + '\n' + await page.content();

    // Crawl options
    for(var mem=0; mem < memLinks.length; mem++){
        // Click memory options to crawl
        var str = memLinks[mem].replace('javascript:__doPostBack', '');
        await Promise.all([
            await console.log(await page.evaluate(memLinks[mem], () => memLinks[mem])),
            await page.waitForSelector(selector, {timeout: 15000})
        ])
        for(var col=0; col < colorLinks.length; col++){
            await Promise.all([
                await console.log(await page.evaluate(colorLinks[col], () => colorLinks[col])),
                await page.waitForSelector(selector, {timeout: 15000})
            ])
            // store content
            data = await page.content();
            // pass each new option for processing
            processData(data, url); 
        }
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

    var selectedColor = $('.FilterSelectedColour a').attr('title');
    var selectedStorage = $('.FilterSelectedMemory a').attr('title');

    if(selectedColor !== undefined){
        var title = $("*[itemprop = 'name']").text().trim()
        title = title + " " + selectedStorage + " " + selectedColor;

        var sku = link.substring(link.indexOf('productsn=')+10, link.indexOf('&')) + selectedColor.substring(0, 2) + selectedStorage;
    }
    else{
        var title = $("*[itemprop = 'name']").text().trim()

        var sku = link.substring(link.indexOf('productsn=')+10, link.indexOf('&'));
    }
    if(title === undefined)
        return
    var availability = $(".InStock")
    if(availability.length>0)
        availability = 'Y';
    else
        availability = 'N';
    
    var retailPrice = $("#cphContent_ucp_lblRetailPrice").text()
    retailPrice = retailPrice.replace(',','.');
    retailPrice = retailPrice.substring(retailPrice.indexOf('€')+1)

    // Store plan info
    var planCount = $('.planbox');
    
    var planTitle=[], upfrontCost=[], perMonthCost=[], data=[], minutes=[], messages=[];
    for(var i=0; i<planCount.length; i++){
        planTitle.push($(planCount[i]).find('h2').text().trim());
        upfrontCost.push($(planCount[i]).find('.col-lg-auto.my-2 .priceLabels.pt-2').text().trim());
        if(i!=planCount.length-1)
            upfrontCost[i] = upfrontCost[i].substring(0, upfrontCost[i].indexOf('\n'));
        upfrontCost[i] = (upfrontCost[i].substring(1));
        upfrontCost[i] = upfrontCost[i].replace(',','.');
        perMonthCost.push($(planCount[i]).find('.col-lg-3.my-2 .priceLabels.pt-2 span').text().trim());
        
        perMonthCost[i] = (perMonthCost[i].substring(1))
        perMonthCost[i] = perMonthCost[i].replace(',','.');
        data.push($(planCount[i]).find('.float-left a b').text().trim());
        if(data[i] == '')
            data[i] = $(planCount[i]).find('li:nth-child(2)').text().trim();
        
        if(data[i].includes('Απεριόριστα'))
            data[i] = 'Unlimited';
        minutes.push($(planCount[i]).find('li:nth-child(1)').text().trim());
        minutes[i] = minutes[i].substring(0, minutes[i].indexOf('\n'));
        if(minutes[i].includes('Απεριόριστα'))
            minutes[i] = 'Unlimited';
        messages.push(minutes[i]);

        // // insert into DB
        await queryPromise(sql, [[[-1, sku+i, title, planTitle[i], upfrontCost[i], perMonthCost[i], '24 Months', data[i], minutes[i], messages[i], retailPrice, link, 14, availability, 1]]]);
    }
    await queryPromise(sqlStore, [[[-1, sku, title, retailPrice, [link], 14, availability, 'Free', 1]]]);
}

module.exports = { ssr };