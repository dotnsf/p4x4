//. add_nonobj.js
var fs = require( 'fs' );
var settings = require( '../settings' );

var system_folder = '../' + settings.system_folder;
if( !fs.existsSync( system_folder ) ){
  fs.mkdirSync( system_folder );
}
var dbs_folder = system_folder + '/.dbs';
if( !fs.existsSync( dbs_folder ) ){
  fs.mkdirSync( dbs_folder );
}
var hatoya_folder = system_folder + '/.hatoya';
if( !fs.existsSync( hatoya_folder ) ){
  fs.mkdirSync( hatoya_folder );
}
var ledgers_folder = hatoya_folder + '/.ledgers';
if( !fs.existsSync( ledgers_folder ) ){
  fs.mkdirSync( ledgers_folder );
}
var config_folder = hatoya_folder + '/.config';
if( !fs.existsSync( config_folder ) ){
  fs.mkdirSync( config_folder );
}


async function main(){
  return new Promise( async ( resolve, reject ) => {
    var body = { this_is_the: "object" };
    await add_nonobj_block( body );

    resolve( true );
  });
}

async function add_nonobj_block( body ){
  return new Promise( async ( resolve, reject ) => {
    var ts = ( new Date() ).getTime();
    var block = JSON.stringify( body );

    var block_filepath = ledgers_folder + '/' + ts;
    await create_file( block, block_filepath );

    resolve( true );
  });
}

async function create_file( text, filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( !fs.existsSync( filepath ) ){
      text = ( typeof text == 'object' ? JSON.stringify( text ) : text );
      if( settings.enc_body ){
        text = await hc_encrypt( text );
      }
      fs.writeFileSync( filepath, text, 'utf-8' );
      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function hc_encrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings.secret; }
    var encbody = jwt.sign( body, key, {} );  //. body は string or object

    resolve( encbody );
  });
}

main();
