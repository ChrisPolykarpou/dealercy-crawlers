const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.stephanis.com.cy/en/products/telecommunications/smartphones-and-mobile-phones/smartphones?view=thumbnails&sortBy=newest&recordsPerPage=100'
const url2 = 'https://www.stephanis.com.cy/en/products/telecommunications/smartphones-and-mobile-phones/smartphones?view=thumbnails&recordsPerPage=100&sortBy=newest&page=2'
const url3 = 'https://www.stephanis.com.cy/en/products/telecommunications/smartphones-and-mobile-phones/smartphones?view=thumbnails&recordsPerPage=100&sortBy=newest&page=3';
crawl(url);

const bit=1;

async function crawl(url){
    console.time("RenderTime");
    let cat = ''
    if(url.includes('smartphones'))
        cat = 'phone'
    let html = await utilFunction.ssr(url, '.pagination-next-page', false, 1, false);
    html = html + await utilFunction.ssr(url2, '.pagination-next-page', false, 1, false);
    html = html + await utilFunction.ssr(url3, '.pagination-next-page', false, 1, false);

    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit=VALUES(bit)";

    var prodCount= $('.prop-spotlight-details-wrapper-3').length;
    console.log("PRODUCTS TO CRAWL: "+prodCount)
    await $('.prop-spotlight-details-wrapper-3').each(function(){
        var name = $(this).find('.tile-product-name').text().trim()
        name = name.replace('Smartphone', "");
        name = name.replace('  ', " ");
        var price = $(this).find('.listing-details-heading.large-now-price.with-sale').text().trim();
        if(price == ''){
            price = $(this).find('.listing-details-heading.large-now-price.centered').text().trim();
        }
        price = price.replace(',', '');
        price = Number(price.substring(1, price.indexOf('.')));
        var sku = $(this).find('.product-code').text().trim();
        var availability = '?';
        var link = 'https://www.stephanis.com.cy/'+$(this).find('.spotlight-list-wrapper-3.w-clearfix').find('a').attr('href');
        var delivery = 'Free';
        var shopID = 5;

        pool.getConnection(function(err, connection) {
            if(err) throw(err);

            // Find prodID using fulltext search
            // if relevance is not >= 50% set prodID = -1
            function getID(cb){
                var id;

                var str;
                str = name.split(' ')
                var color = str.slice(-1)

                if(!name.includes("pro")){
                    connection.query("SELECT * FROM apple WHERE MATCH(name, description, color) AGAINST (? IN NATURAL LANGUAGE MODE) AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name NOT LIKE ? AND color LIKE ?", [name, '%'+str[0]+'%', '%'+str[1]+'%', '%'+str[2]+'%', '%'+str[3]+'%', '%pro%', '%'+color+'%'], function(err, result) {
                        if(err) throw(err);
                        id = result[0]
                        cb(null, id);
                    });
                }
                else{
                    connection.query("SELECT * FROM apple WHERE MATCH(name, description, color) AGAINST (? IN NATURAL LANGUAGE MODE) AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND color LIKE ?", [name, '%'+str[0]+'%', '%'+str[1]+'%', '%'+str[2]+'%', '%'+str[3]+'%', '%pro%', '%'+color+'%'], function(err, result) {
                        if(err) throw(err);
                        id = result[0]
                        cb(null, id);
                    });
                }
            }
            
            getID(function(err, id){
                if(err){
                    id = -1;
                }
                else{
                    if(id === undefined)
                        id=-1
                    else 
                        id=id.id;
                    products.push({
                        id,
                        name,
                        link,
                        price,
                        availability,
                        sku,
                        delivery,
                        shopID,
                        bit,
                    })

                    connection.query(sql, [products.map(item => [item.id, item.sku, item.name,  item.price, item.link, item.shopID, item.availability, item.delivery, item.bit])], function(err) {
                        if (err) throw(err);     
                        connection.release();
                    });
                }    
            });
        });
    })
}
