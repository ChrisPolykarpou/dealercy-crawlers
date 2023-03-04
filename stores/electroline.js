const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.electroline.com.cy/en/product-category/phones-smart-tech/mobile-phones/smartphones/';
const bit=1;
crawl(url);

async function crawl(url){
    console.time("RenderTime");
    const html = await utilFunction.ssr(url, '.next.page-numbers', false, 50, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), bit = VALUES(bit)";

    var test = $('.listing-product__contents');
    console.log("Products to crawl: "+test.length);
    
    await $('.listing-product').each(function(){
        var name = $(this).find('.listing-product__title').text().trim()
        name = name.replace('Smartphone', "");
        name = name.replace(',', "");
        name = name.replace('with', "");
        name = name.replace(' GB', 'GB');
        name = name.replace('  ', " ");
        
        var link = $(this).find('.listing-product__image-link').attr('href')
        var sku = $(this).find('.listing-product__sku').text()
        var availability = $(this).find('.listing-product-availability-text--online').text().trim()
        if(!availability.includes(' Not available online'))
            availability = 'Y';
        else
            availability = 'N';
        var price = $(this).find('.listing-product-price').text().trim()
        var count = price.split('.').length - 1;
        if(count > 1){
            price = price.substring(1)
            price = price.substring(price.indexOf('€')+1);
            price = Number(price.substring(0, price.indexOf('.')));
        }
        else
            price = Number(price.substring(1, price.indexOf('.')));
        var link = $(this).find('.listing-product__image-link').attr('href')
        var delivery = 'Free';
        var shopID = 3;
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

                if(!name.toLowerCase().includes("pro")){
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
                    else{
                        if(storage!=""|| !storage === undefined){
                            // last check if storage of product matched is correct
                            var storage = id.storage;
                            if(!name.includes(storage) && id.id!=-1){
                                id=0
                            }
                            else{
                                id=id.id;
                            }
                        }
                        else
                            id=id.id;
                    }
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
    });
}
