const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('./enquePages');
const productRender = require('./renderProduct');
const db = require('../util/db');

const url = "https://www.epic.com.cy/en/c/B1LxPIPi91l/mobile-phones/?/!f/price:123.84,2199/!s/o:d,-1/l:0";
var links = [];
enqLinks(url);

// Get links to crawl
async function enqLinks(url){
    const html = await utilFunction.ssr(url, '.mtn-component-product-image');
    var $ = cheerio.load(html)

    var numOfElems = $('.mtn-component-product-image').length;
    console.log("Products to crawl: "+numOfElems);
    
    var links = [];
    $('.mtn-component-product-image').each(async function(){
        var link = 'https://www.epic.com.cy' + $(this).find('.mtn-component-content a').attr('href');
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
    var numOfColors = $('.mtn-component-features-table table tbody tr:nth-child(2) td a').length;
    
    // Array to store memory and color options for __dopostBack func
    var colorLinks = [];
    
    // for(var i=0; i < numOfColors; i++){
    //     colorLinks[i] = ($('.col-md-8 .row .col .row .col-12 #pnlColor:nth-child('+(i+2)+') a').attr('href'));
    // }

    // get all options for each product
    const html = await productRender.ssr(link, '.col-md-12', numOfColors);
    
}