const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.smartech.com.cy/smartphones/page/';
crawl(url)
const bit=1;
// cryptography required to create sku from title.
var crypto = require('crypto');

async function crawl(url){
    console.time("RenderTime");
    let cat = ''
    if(url.includes('mobile-phones'))
        cat = 'phone'
    var html = ''
    for(var i=1; i<25; i++){
        html = html + await utilFunction.ssr(url+i, 'li .next', false, 1, false);
    }  
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit = VALUES(bit)";

    var test = $('.product.type-product').length;
    console.log("Products to crawl: "+test);

    await $('.product.type-product').each(function(){
        var attrib = $(this).find('.woocommerce-loop-product__title a');
        var name = attrib.text().trim();
        var link = attrib.attr('href');
        
        var sku = $(this).find('.button.product_type_simple').attr('data-product_sku'); 
        var availability = $(this).find('.button.product_type_simple').text().trim();
        if(sku == undefined){
            sku = $(this).find('.button.product_type_variable').attr('data-product_sku');
            availability = $(this).find('.button.product_type_variable').text().trim(); 
        }
        if(availability.includes('Add to cart'))
            availability = 'Y';
        else
            availability = 'N';
        
        var price = $(this).find('.woocommerce-Price-amount.amount').text().trim();
        // do not include product if price is not available
        if(price == "")
            return;
        price = price.substring(price.indexOf('€')+1);
        price = price.substring(price.indexOf('€')+1); 
        price = price.replace(',', '');
        price = Number(price.substring(0, price.indexOf('.')));
        var delivery = 3;
        var shopID = 13;
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

                if(!name.includes("pro")){
                    connection.query("SELECT * FROM apple WHERE MATCH(name, description, color) AGAINST (? IN NATURAL LANGUAGE MODE) AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name NOT LIKE ? AND color LIKE ?", [name, '%'+str[0]+'%', '%'+str[1]+'%', '%'+str[2]+'%', '%'+str[3]+'%', '%pro%', '%'+str[str.length-1]+'%'], function(err, result) {
                        if(err) throw(err);
                        id = result[0]
                        cb(null, id);
                    });
                }
                else{
                    connection.query("SELECT * FROM apple WHERE MATCH(name, description, color) AGAINST (? IN NATURAL LANGUAGE MODE) AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND name LIKE ? AND color LIKE ?", [name, '%'+str[0]+'%', '%'+str[1]+'%', '%'+str[2]+'%', '%'+str[3]+'%', '%pro%', '%'+str[str.length-1]+'%'], function(err, result) {
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
                        bit
                    })
                    
                    connection.query(sql, [products.map(item => [item.id, item.sku, item.name,  item.price, item.link, item.shopID, item.availability, item.delivery, item.bit])], function(err) {
                        if (err) throw(err);     
                        connection.release();
                    });
                }    
            });
        });
    });
}

