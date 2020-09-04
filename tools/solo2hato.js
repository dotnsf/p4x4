//. solo2hato.js
var crypto = require( 'crypto' );
var fs = require( 'fs' );
var jwt = require( 'jsonwebtoken' );
var request = require( 'request' );
var uuidv1 = require( 'uuid/v1' );
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
var token_folder = hatoya_folder + '/.token';
if( !fs.existsSync( token_folder ) ){
  fs.mkdirSync( token_folder );
}

//. 変数
var solo_ledgers_url = 'https://manholemap-solo.mybluemix.net/validate';
var db = 'manholemap';


var serverid = null;

async function main(){
  return new Promise( async ( resolve, reject ) => {

    //. DB
    var db_folderpath = dbs_folder + '/' + db;
    if( !fs.existsSync( db_folderpath ) ){
      fs.mkdirSync( db_folderpath );

      await add_block( { serverid: serverid, method: 'create_db', db: db } );
    }

    var option = {
      url: solo_ledgers_url,
      method: 'GET'
    };
    request( option, async ( err, res, body ) => {
      if( err ){
        console.log( err );
      }else{
        if( typeof body == 'string'){ body = JSON.parse( body ); }
        //console.log( body );
        if( body && body.status ){
          console.log( '#docs = ' + body.docs.length );
          for( var i = 0; i < body.docs.length; i ++ ){
            var doc = body.docs[i];
            /*
            doc = {
              _id: "_id", 
              body: {
                body: {
                  id: "2019id",
                  username: "dotnsf",
                  created: "2019-09-19 01:23:02",
                  updated: "2019-09-19 01:23:02",
                  tag: "tag1 tag2",
                  filename: "filename",
                  type: "image/jpeg",
                  address: "",
                  text: "text",
                  lat: 34.678,
                  lng: 135.177,
                  nice: 0,
                  niceby: "",
                  width: 480,
                  height: 360,
                  imgkey: "",
                  misc: "misc",
                  action: "POST /upload",
                  imghash: "xxxx"
                }
              },
              hashchainsolo_system: {
                timestamp: 1568277,
                remote_ip: "10.246.213.91",
                prev_hash: "00prev_hash",
                nonce: 1,
                hash: "00hash"
              }
            }
             */

            var item = ( doc.body.body ? doc.body.body : doc.body );
            if( item ){
              if( !item.id ){
                item.id = uuidv1();
              }

              var item_filepath = db_folderpath + '/' + item.id;
              await create_file( item, item_filepath );

              //. ブロックチェーン
              switch( item.action ){
              case 'POST /upload':  //. 現状はこれだけしか記録していない（著作権管理目的ならこれだけで充分）
                await add_block( { serverid: serverid, method: 'create_item', db: db, item: item } );
                break;
              case 'POST /edit':    //. 以前はここも
                //await add_block( { serverid: serverid, method: 'update_item', db: db, item: item } );
                break;
              }

              //. ftindex はここでは無視。サーバー再起動時に反映させる
            }
          }
        }
      }
    });

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

async function add_block( body ){
  return new Promise( async ( resolve, reject ) => {
    var last_block = await get_last_block();
    var prev_id = null;
    if( last_block ){
      prev_id = last_block.id;
    }

    var ts = getID();
    var block = {
      prev_id: prev_id,
      body: [ body ],  //. #29
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
  });
}

async function get_block_chain( limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    var block_folder = ledgers_folder;
    var files = fs.readdirSync( block_folder );
    files.sort();  //. timestamp 順

    var blocks = [];
    var start_idx = 0;
    var end_idx = files.length;
    if( offset ){ start_idx = offset; }
    if( limit ){ end_idx = offset + limit; }

    var ids = [];
    for( var i = 0; i < files.length; i ++ ){
      if( !files[i].startsWith( '.' ) ){
        ids.push( files[i] );
      }
    }

    if( end_idx > ids.length ){ end_idx = ids.length; }
    for( var i = start_idx; i < end_idx; i ++ ){
      var block = await read_file( block_folder + '/' + ids[i] );
      if( typeof block !== 'object' ){
        //. block がただの string だった場合は JSON.parse() できない
        try{
          block = JSON.parse( block );
        }catch( e ){
        }
      }

      if( block ){
        //. block がただの string だった場合でも、ここでは string のまま返す
        blocks.push( { name: ids[i], block: block } );
      }
    }

    resolve( blocks );
  });
}

async function get_last_block(){
  return new Promise( async ( resolve, reject ) => {
    var blocks = await get_block_chain();
    if( blocks.length > 0 ){
      resolve( blocks[blocks.length-1].block );
    }else{
      resolve( null );
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
      try{
        body = ( typeof body == 'string' ? JSON.parse( body ) : body );
      }catch( e ){
      }
      resolve( body );
    }else{
      resolve( null );
    }
  });
}

function getID(){
  return ( new Date() ).getTime();
}

async function get_hash( block ){
  return new Promise( async ( resolve, reject ) => {
    var hash = crypto.createHash( 'sha512' );
    hash.update( JSON.stringify( block ) );
    var hash = hash.digest( 'hex' );

    resolve( hash );
  });
}

function countTopZero( str ){
  var cnt = 0;

  while( str.length <= cnt || str.charAt( cnt ) == '0' ){
    cnt ++;
  }

  return cnt;
}


//. serverid
var serverid_filepath = hatoya_folder + '/.serverid';
read_file( serverid_filepath ).then( function( v ){
  serverid = v;
  main();
}, function( r ){
});
