const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://icellshop.com.cy/product-category/smartphones/';

crawl(url);
const bit=1;

async function crawl(url){
    console.time("RenderTime");
    let cat = ''
    if(url.includes('mobile-phones'))
        cat = 'phone'
    const html = await utilFunction.ssr(url, '.next.page-numbers', false, 80, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit=VALUES(bit)";

    var test = $('.product-wrapper.gridview');
    console.log("Products to crawl: "+test.length);

    await $('.product-wrapper.gridview').each(function(){
        var sku = $(this).find('.product.woocommerce.add_to_cart_inline a').attr('data-product_sku');
        var attrib = $(this).find('.product-name a');
        var title = attrib.text().trim();
        var link = attrib.attr('href');
        
        var name = title.replace('RAM', "/");
        
        var availability = $(this).find('.button.product_type_simple').text().trim();
        if(availability.includes('Read more'))
            availability = 'N';
        else
            availability = 'Y';
        
        var price = $(this).find('.price-box-inner').text().trim();
        price = price.substring(price.indexOf('€')+1);
        price = price.substring(price.indexOf('€')+1); 
        price = price.replace(',', '');
        price = Number(price.substring(0, price.indexOf('.')));
        var delivery = 2;
        var shopID = 4;
        var color;

        pool.getConnection(function(err, connection) {
            if(err) throw(err);

            // Find prodID using fulltext search
            // if relevance is not >= 50% set prodID = -1
            function getID(cb){
                var id;

                var str;
                str = name.split(' ')
                color = str.slice(-1)
                color = color[0];

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
                        title,
                        link,
                        price,
                        availability,
                        sku,
                        delivery,
                        shopID,
                        bit,
                    })
                    
                    connection.query(sql, [products.map(item => [item.id, item.sku, item.title,  item.price, item.link, item.shopID, item.availability, item.delivery, item.bit])], function(err) {
                        if (err) throw(err);     
                        connection.release();
                    });
                }    
            });
        });
    });
}

