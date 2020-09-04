//. my_remote_addr.js
var client = require( 'cheerio-httpcli' );

client.set( 'browser', 'chrome' );
client.set( 'referer', false );

client.fetch( 'http://tools.up2a.info/ja/requestheaders', {}, 'UTF-8', function( err, $, res, body ){
  if( err ){
    console.log( err );
  }else{
    console.log( $('.YOUR_IP_ADDR').text().trim() );
  }
}); 
