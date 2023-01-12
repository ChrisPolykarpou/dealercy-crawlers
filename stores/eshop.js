const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.e-shop.cy/search_main?table=TEL&category=%CA%C9%CD%C7%D4%CF+%D4%C7%CB%C5%D6%D9%CD%CF&filter-2535=1&filter-9845=1&filter-13393=1&filter-1495=1&filter-27315=1&filter-27285=1&filter-13392=1&filter-14529=1&filter-11661=1&filter-27623=1&filter-3373=1&filter-1492=1&filter-1493=1';

crawl(url);

async function crawl(url){
    console.time("RenderTime");
    let cat = 'phone'
    const html = await utilFunction.ssr(url, '.mobile_list_navigation_link:last-child', false, 40, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title)";

    await $('.web-product-container').each(function(){
        var name = $(this).find('.web-product-title').find('a').find('h2').text().trim()
        name = name.replace('ΚΙΝΗΤΟ ', "");
        name = name.replace('GR', "");
        name = name.replace('  ', " ");
        var price = $(this).find('.web-product-price').find('b').text().trim();
        price = Number(price.substring(0, price.indexOf('.')));
        var link = $(this).find('.web-product-title').find('a').attr('href');
        var availability = $(this).find('.web-product-buttons').find('div').text().trim();
        if(availability.includes('διαθέσιμο'))
            availability = 'Y';
        else
            availability = 'N';
        var sku = $(this).find('.web-product-title').find('font').text().trim();
        var shopID = 6;
        var delivery = 5;
        
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
                    })
                    
                    connection.query(sql, [products.map(item => [item.id, item.sku, item.name,  item.price, item.link, item.shopID, item.availability, item.delivery])], function(err) {
                        if (err) throw(err);     
                        connection.release();
                    });
                }    
            });
        });
    });
}