const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;
    
const url = "https://www.kotsovolos.cy/mobile-phones-gps/mobile-phones/smartphones?pageSize=1000";

crawl(url);
const bit=1;

async function crawl(url){
    console.time("RenderTime");

    const html = await utilFunction.ssr(url, '.pagination_next a', false, 1, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []

    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit = VALUES(bit)";
    var test = $('.product');
    console.log("Products to crawl: "+test.length);
    await $('.product').each(function(){
        var link = $(this).find('.img').find('a').attr('href')
        var name = $(this).find('.title').find('h2').find('a').contents()
                    .filter(function () {
                    return this.type === "text";
                    }).text().trim();
        var sku = $(this).find('.prCode').text().trim();
        
        var price = $(this).find('.priceWithVat').find('.simplePrice').contents()
                    .filter(function () {
                    return this.type === "text";
                    }).text().trim();
        if(price === undefined || price == 0){
            price = $(this).find('.priceWithVat').children('.price').contents()
                    .filter(function () {
                    return this.type === "text";
                    }).text().trim();
        }
        var availability = $(this).find('.availability__title').text().trim()
        // check availability
        if(availability.includes('Διαθέσιμο'))
            availability = 'Y';
        else
            availability = 'N';
        
        var delivery = 3.99;
        if(price >= 100){
            delivery = 'Free';
        }
        var shopID = 1;
        
        pool.getConnection(function(err, connection) {
            if(err) throw(err);

            function getID(cb){
                var id;
                var str;
                
                var str = name.split(' ')
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
                    id = '-2';
                }
                else{
                    if(id === undefined)
                        return
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

        

        