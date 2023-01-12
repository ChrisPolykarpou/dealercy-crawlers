const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('./enquePages');
const productRender = require('./renderProduct');
const db = require('../util/db');

const url = "https://www.cyta.com.cy/product-list/en?FamilySN=1";
var links = [];
enqLinks(url);

// Get links to crawl
async function enqLinks(url){
    const html = await utilFunction.ssr(url, '.device.col-12', 1);
    var $ = cheerio.load(html)

    var numOfElems = $('.device.col-12').length;
    console.log("Products to crawl: "+numOfElems);
    
    var links = [];
    $('.device.col-12').each(async function(){
        var link = 'https://www.cyta.com.cy' + $(this).attr('href');
        links.push(link);
    });
   
    for(var i=0; i < links.length; i++){
        await crawl(links[i]);
    }
    
}

async function crawl(link){
    const insideContent = await axios.get(link);
    // find options and colours links to pass them on puppeteer.. 
    var $ = cheerio.load(insideContent.data);
    var numOfColors = $('#pnlColor a').length;
    var numOfMem = $('#pnlMemory a').length;
    
    // Array to store memory and color options for __dopostBack func
    var colorLinks = [];
    var memLinks = [];

    for(var i=0; i < numOfColors; i++){
        colorLinks[i] = ($('#pnlColor:nth-child('+(i+2)+') a').attr('href'));
    }
    for(var i=0; i < numOfMem; i++){
        memLinks[i] = $('#pnlMemory:nth-of-type('+(i+1+numOfColors)+') a').attr('href');
    }

    // get all options for each product
    const html = await productRender.ssr(link, '.col-lg-4 ', colorLinks, memLinks);
    
}