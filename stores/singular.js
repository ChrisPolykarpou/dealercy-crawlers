const axios = require('axios');
const cheerio = require('cheerio');
const { next } = require('cheerio/lib/api/traversing');
const { json } = require('express');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.singular.com.cy/telephones/mobile-phones/?items_per_page=1000';

crawl(url);
const bit=1;

async function crawl(url){
    console.time("RenderTime");
    let cat = ''
    if(url.includes('mobile-phones'))
        cat = 'phone'
    const html = await utilFunction.ssr(url, '.ab__sf_cat_desc', false, 1, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit = VALUES(bit)";
    
    var test = $('.ut2-pl__content').length;
    console.log("Products to crawl: "+test);
    var i=0;
    await $('.ut2-pl__content').each(function(){
        var sku = $(this).find('.ty-control-group.ty-sku-item span').text().trim()

        var title = $(this).find('.product-title').attr('title');
        title = title.substring(0, 110) + "...";
        
        // name = name.replace('Smartphone', "");
        var name = title.replaceAll(' /', "");
        name = name.replace('RAM', "");
        name = name.replace(' GB ', 'GB / ');
        name = name.replace(' GB', "GB");
        name = name.replace(' 4G', '');
        name = name.replace(' smartphone', "");
        name = name.replace(' Smartphone', "");
        name = name.replace(' dual-SIM', "");
        name = name.replaceAll('  ', " ");
        
        var link = $(this).find('.product-title').attr('href')
        var availability = $(this).find('.stock-wrap div span').text().trim();
        if(availability.includes('Out of stock'))
            availability = 'N';
        else
            availability = 'Y';
        
        var price = $(this).find('.ty-price span').text().trim()
        price = price.replace(',', '');
        price = Number(price.substring(1, price.indexOf('.')));
        
        var delivery = 4;
        if(price>100)
            delivery = 'Free';
        var shopID = 12;
        var color;

        pool.getConnection(function(err, connection) {
            if(err) throw(err);

            // Find prodID using fulltext search
            // if relevance is not >= 50% set prodID = -1
            function getID(cb){
                var id;

                var str;
                str = name.split(' ')
                color = str.slice(-3)
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
                        bit
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

