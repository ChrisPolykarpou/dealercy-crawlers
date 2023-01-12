const axios = require('axios');
const cheerio = require('cheerio');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;

const url = 'https://www.public.cy/cat/tilefonia/kinita-smartphones?r=1000'
const bit=1;

crawl(url);

async function crawl(url){
    console.time("RenderTime");
    // Crawl website using headless crawler(puppeteer) and store products in array
    let cat = 'phone'
    const html = await utilFunction.ssr(url, '.product.product--grid.hasAnimation', true, 1, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []
    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit = VALUES(bit)";
    
    console.log("Products to crawl: "+$('.product.product--grid.hasAnimation').length);

    await $('.product.product--grid.hasAnimation').each(function(){
        var name = $(this).find('.mdc-link-button__label').text().trim()
        var link = 'https://www.public.cy/' + $(this).find('.mdc-link-button.animate.mdc-link-button--black.mdc-link-button--clamp.mdc-link-button--large.text-left').attr('href')
        // split name to get manufacturer
        if(cat == "phone")
            var name = name.split('Smartphone').pop().trim();
        
        var manufacturer = name.replace(/ .*/,'');  // Regex to store manufacturer
        var sku = link.split("/").pop();
        var price = $(this).find('.product__price.product__price--large.text-primary').text().trim()
        
        price = Number(price.substring(0, price.indexOf(',')));
        var availability = $(this).find('.mdc-typography--caption').text().trim()
        // check availability
        if(availability.includes('διαθέσιμο') || availability.includes('τελευταία κομμάτια'))
            availability = 'Y';
        else
            availability = 'N';
        var delivery = 4.90;
        if(price >= 30){
            delivery = 'Free';
        }
        var shopID = 2;
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
