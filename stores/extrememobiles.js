const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.extrememobiles.com.cy/product-category/smart-devices/smart-devices-smartphones/';

crawl(url);
// cryptography required to create sku from title.
var crypto = require('crypto');

async function crawl(url){
    console.time("RenderTime");
    let cat = 'phone'
    const html = await utilFunction.ssr(url, '.next.page-numbers', false, 70, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title)";
    
    await $('.product').each(function(){
        var name = $(this).find('.woocommerce-loop-product__title').text().trim();
        var link = $(this).find('.woocommerce-LoopProduct-link.woocommerce-loop-product__link').attr('href');
        if(link == '')
            link = $(this).find('a').attr('href');
        var price = $(this).find('.woocommerce-Price-amount.amount').text();
        price = price.replace(',', '');
        price = Number(price.substring(1, price.indexOf('.')));
        var shopID = 9;
        var delivery = 3.60;
        var availability = $(this).find('.product_btn').text();
        if(availability.includes('Buy Now'))
            availability = 'Y';
        else
            availability = 'N';
        var sku = crypto.createHash('md5').update(name).digest('hex');
        sku = sku.substring(0, 10);

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
                        sku,
                        name,
                        link,
                        price,
                        availability,
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
    })
}