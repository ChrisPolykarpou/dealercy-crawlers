const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');
// cryptography required to create sku from title.
var crypto = require('crypto');

// CONNECT TO DB
const pool = db.pool;

const url1 = 'https://bestbuycyprus.com/511-mobile-phones?page=1';
const url2 = 'https://bestbuycyprus.com/511-mobile-phones?page=2';
const url3 = 'https://bestbuycyprus.com/511-mobile-phones?page=3';
const url4 = 'https://bestbuycyprus.com/511-mobile-phones?page=4';
const url5 = 'https://bestbuycyprus.com/511-mobile-phones?page=5';
const url6 = 'https://bestbuycyprus.com/511-mobile-phones?page=6';
const url7 = 'https://bestbuycyprus.com/511-mobile-phones?page=7';
const url8 = 'https://bestbuycyprus.com/511-mobile-phones?page=8';
const url9 = 'https://bestbuycyprus.com/511-mobile-phones?page=9';
const url10 = 'https://bestbuycyprus.com/511-mobile-phones?page=10';
const url11 = 'https://bestbuycyprus.com/511-mobile-phones?page=11';
const url12 = 'https://bestbuycyprus.com/511-mobile-phones?page=12';
const url13 = 'https://bestbuycyprus.com/511-mobile-phones?page=13';
const url14 = 'https://bestbuycyprus.com/511-mobile-phones?page=14';
const url15 = 'https://bestbuycyprus.com/511-mobile-phones?page=15';
const url16 = 'https://bestbuycyprus.com/511-mobile-phones?page=16';
crawl(url1);

async function crawl(url){
    console.time("RenderTime");
    let cat = 'phone'
    let html = await utilFunction.ssr(url1, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url2, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url3, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url4, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url5, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url6, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url7, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url8, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url9, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url10, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url11, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url12, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url13, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url14, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url15, 'a.next', false, 1, false);
    html = html + await utilFunction.ssr(url16, 'a.next', false, 1, false);
    console.timeEnd("RenderTime");

    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title)";
    var test = $('.product_desc');
    console.log("Products to crawl: "+test.length);
    await $('.product_desc').each(function(){
        var name = $(this).find('div.product-desc').text().trim();
        if(name == '')
            name = $(this).find('.product_name ').text().trim();
        name = name.replace('RAM', '/');
        name = name.replace('EU', '');
        name = name.replace('DE', '');
        var link = $(this).find('.product_name').attr('href');
        var price = $(this).find('.price').text();
        price = price.replace(',', '');
        price = Number(price.substring(1, price.indexOf('.')));
        var shopID = 11;
        var delivery = 'Free';
        var availability = '?';
        var sku = crypto.createHash('md5').update(name).digest('hex');
        sku = sku.substring(0, 11);

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

process.on('SIGTERM', () => {
    console.log("Updated DB");
    process.exit(1);
})