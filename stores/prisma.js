const cheerio = require('cheerio');
const utilFunction = require('../util/render');
const db = require('../util/db');

// CONNECT TO DB
const pool = db.pool;
    
const url1 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_423&sort=20a";
const url2 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_424";
const url3 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_425";
const url4 = "https//www.prismastore.com.cy/index.php?main_page=index&cPath=174_426";
const url5 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_392";
const url6 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_391";
const url7 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_354";
const url8 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_286";
const url9 = "https://www.prismastore.com.cy/index.php?main_page=index&cPath=174_187";
crawl();
const bit=1;

async function crawl(){
    console.time("RenderTime");

    var html = await utilFunction.ssr(url1, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url2, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url3, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url4, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url5, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url6, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url7, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url8, '.page-item a', false, 3, false);
    html = html + await utilFunction.ssr(url9, '.page-item a', false, 3, false);
    console.timeEnd("RenderTime");
    const $ = cheerio.load(html)
    var products = []

    const sql = "INSERT INTO stores (prodID, sku, title, price, link, shopID, availability, delivery, bit) VALUES ? ON DUPLICATE KEY UPDATE price = VALUES(price), availability = VALUES(availability), title = VALUES(title), bit = VALUES(bit)";
    var test = $('.card.mb-3.p-3.centerBoxContentsListing');
    console.log("Products to crawl: "+test.length);
    await $('.card.mb-3.p-3.centerBoxContentsListing').each(function(){
        var link = $(this).find('.itemTitle').find('a').attr('href')
        var name = $(this).find('.itemTitle').find('a').text().trim()
        var sku = link.substring(link.indexOf('_id')+4)
        var name2 = ''
        
        var availability = name
        // check availability
        if(availability.includes('IN STOCK')){
            name2 = name.substring(0, name.indexOf('IN STOCK'))
            availability = 'Y';
        }
        else{
            name2 = name
            availability = 'N';
        }
            
        
        var price = $(this).find('.productSpecialPrice').text()
        if(price == '')
            price = $(this).find('.productBasePrice').text()
        price = price.substring(price.indexOf('€')+1); 
        price = price.replace(',', '');
        price = Number(price);

        var delivery = '?'
        if(price >= 100){
            delivery = 'Free';
        }
        var shopID = 16;
    
        pool.getConnection(function(err, connection) {
            if(err) throw(err);

            function getID(cb){
                var id;
                var str;
                
                var str = name2.split(' ')
            
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
                    console.log(products.id, products.name, products.price)
        
                    connection.query(sql, [products.map(item => [item.id, item.sku, item.name,  item.price, item.link, item.shopID, item.availability, item.delivery, item.bit])], function(err) {
                        if (err) throw(err);     
                        connection.release();
                    });
                }    
            });
        });
    })
}

        

        