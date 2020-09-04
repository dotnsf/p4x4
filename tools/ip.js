//. ip.js
var os = require( 'os' );
var networkInterfaces = os.networkInterfaces();
//console.log( networkInterfaces );
for( var key in networkInterfaces ){
  if( key.startsWith( "wifi" ) || key.startsWith( "eth" ) ){
    var networkifs = networkInterfaces[key];
    networkifs.forEach( function( networkif ){
      if( networkif.family == 'IPv4' ){
        console.log( networkif.address );
      }
    });
  }
}
