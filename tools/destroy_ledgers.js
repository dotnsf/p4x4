//. destroy_ledgers.js
var crypto = require( 'crypto' );
var fs = require( 'fs' );
var jwt = require( 'jsonwebtoken' );
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
    var blocks = await get_block_chain();
    if( blocks && blocks.length > 1 ){
      var last2_block = await get_last2_block();
      var prev_id = last2_block.id;

      var ts = ( new Date() ).getTime();
      var block = {
        prev_id: prev_id,
        body: { name: "destroy_ledgers.js" },
        timestamps: [ ts ]
      };

      var id = null;
      var _nonce = 0;
      do{
        _nonce ++;
        block.nonce = _nonce;

        id = await get_hash( block );
      }while( settings.zerodigit > 0 && countTopZero( id ) < settings.zerodigit );

      block.id = id;

      var block_filepath = ledgers_folder + '/' + ts;
      await create_file( block, block_filepath );

      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function get_block_chain(){
  return new Promise( async ( resolve, reject ) => {
    var block_folder = ledgers_folder;
    var files = fs.readdirSync( block_folder );
    files.sort();  //. timestamp 順

    var blocks = [];
    for( var i = 0; i < files.length; i ++ ){
      if( !files[i].startsWith( '.' ) ){
        var block = await read_file( block_folder + '/' + files[i] );
        if( typeof block !== 'object' ){
          block = JSON.parse( block );
        }
        blocks.push( { name: files[i], block: block } );
      }
    }

    resolve( blocks );
  });
}

async function get_last2_block(){
  return new Promise( async ( resolve, reject ) => {
    var blocks = await get_block_chain();
    if( blocks.length > 1 ){
      resolve( blocks[blocks.length-2].block );
    }else{
      resolve( null );
    }
  });
}

async function create_file( json, filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( !fs.existsSync( filepath ) ){
      var body = ( typeof json == 'object' ? JSON.stringify( json ) : json );
      if( settings.enc_body ){
        body = await hc_encrypt( body );
      }
      fs.writeFileSync( filepath, body, 'utf-8' );
      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function read_file( filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( fs.existsSync( filepath ) ){
      var body = fs.readFileSync( filepath, 'utf-8' );
      if( settings.enc_body ){
        body = await hc_decrypt( body );
      }
      body = ( typeof body == 'string' ? JSON.parse( body ) : body );
      resolve( body );
    }else{
      resolve( null );
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

function countTopZero( str ){
  var cnt = 0;

  while( str.length <= cnt || str.charAt( cnt ) == '0' ){
    cnt ++;
  }

  return cnt;
}

async function hc_decrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings.secret; }

    jwt.verify( body, key, function( err, decbody ){
      if( err ){
        reject( err );
      }else{
        resolve( decbody );
      }
    });
  });
}

async function get_hash( block ){
  return new Promise( async ( resolve, reject ) => {
    var hash = crypto.createHash( 'sha512' );
    hash.update( JSON.stringify( block ) );
    var hash = hash.digest( 'hex' );

    resolve( hash );
  });
}

main();
