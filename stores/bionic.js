const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://bionic.com.cy/products/c/mobile-phones/f/yes/multi-touch';

crawl(url);

async function crawl(url){
    console.time("RenderTime");
    let cat = 'phone'
    const html = await utilFunction.ssr(url, '.load-more button', false, 50, true);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title)";
    var test = $('.product-details');
    console.log("Products to crawl: "+test.length);
    var bit=1;

    await $('.product-details').each(function(){
        var name = $(this).find('.product-title').find('h4').find('a').text().trim()
        var sku = $(this).find('.sku h5 span').text().trim();
        var price = $(this).find('.retail-price h3').text();
        if(price.length < 1)
            price = $(this).find('.price.regular h3').text();
        price = price.replace(',', '');
        price = Number(price.substring(1, price.indexOf('.')));
        var shopID = 7;
        var delivery = 3;
        if(price > 20)
            delivery = 'Free';
        var availability = '?';
        var link = "https://bionic.com.cy" + $(this).find('.product-title').find('h4').find('a').attr('href');
        var color = $(this).find('.short-title h6 span').text().trim();
        color = color.split(',');
        // find storage(GB)
        var i = color.findIndex(element => element.includes("GB"))
        // fixing name to match more accurately
        if(!name.includes('GB'))
            name = name + color[i];
        name = name.replace(' GB', 'GB');
        if(!name.includes(color[0]))
            name = name + " " + color[0];
        name = name.replace('  ', ' ');

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
                        bit
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




