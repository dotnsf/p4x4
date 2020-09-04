// api.js
var express = require( 'express' );
var fs = require( 'fs' );
var bodyParser = require( 'body-parser' );
var crypto = require( 'crypto' );
var FlexSearch = require( 'flexsearch' );
var jwt = require( 'jsonwebtoken' );
var multer = require( 'multer' );
var schedule = require( 'node-schedule' );
var request = require( 'request' );
var uuidv1 = require( 'uuid/v1' );
var router = express.Router();

var settings = require( '../settings' );

//. #45
var settings_zerodigit = 'ZERODIGIT' in process.env ? process.env.ZERODIGIT : settings.zerodigit;
var settings_enable_reset = 'ENABLE_RESET' in process.env ? process.env.ENABLE_RESET : settings.enable_reset;
var settings_enc_body = 'ENC_BODY' in process.env ? process.env.ENC_BODY : settings.enc_body;
var settings_system_folder = 'SYSTEM_FOLDER' in process.env ? process.env.SYSTEM_FOLDER : settings.system_folder;
var settings_secret = 'SECRET' in process.env ? process.env.SECRET : settings.secret;
var settings_ftsearch = 'FTSEARCH' in process.env ? process.env.FTSEARCH : settings.ftsearch;
var settings_restrict_apicall = 'RESTRICT_APICALL' in process.env ? process.env.RESTRICT_APICALL : settings.restrict_apicall; //. #99
var settings_singlenode_reorg = 'SINGLENODE_REORG' in process.env ? process.env.SINGLENODE_REORG : settings.singlenode_reorg; //. #99

var settings_dbname = 'DBNAME' in process.env ? process.env.DBNAME : settings.dbname;

router.use( multer( { dest: './tmp/' } ).single( 'file' ) );
router.use( bodyParser.urlencoded( { extended: true, limit: '1000mb' } ) );
router.use( bodyParser.json( { extended: true, limit: '1000mb' } ) );  //. #63

var system_folder = settings_system_folder;
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
//. #99
var token_folder = hatoya_folder + '/.token';
if( !fs.existsSync( token_folder ) ){
  fs.mkdirSync( token_folder );
}


//. #25
var serverid_filepath = hatoya_folder + '/.serverid';
var serverid = null;
if( !fs.existsSync( serverid_filepath ) ){
  serverid = '' + getID();
  create_file( serverid, serverid_filepath ).then( function( r ){
  }, function( r ){
  });
}else{
  read_file( serverid_filepath ).then( function( v ){
    serverid = v;
  }, function( r ){
  });
}

//. #99
var tokenfile_status = 0;
var token_filepath = token_folder + '/.token';
if( settings_restrict_apicall ){
  var files = fs.readdirSync( token_folder );
  for( var file in files ){
    if( files[file] == '.token' ){
      tokenfile_status = -1;
    }else if( files[file] != '.gitkeep' ){
      tokenfile_status = 1;
    }
  }

  if( tokenfile_status == 0 ){
    //. '.gitkeep' 以外のファイルは存在していない
    var ts = '' + getID();
    create_file( ts, token_filepath ).then( function( r ){
    }, function( r ){
    });
  }else if( tokenfile_status == -1 ){
    //. '.token' ファイルが存在していた
  }else{
    //. '.token', '.gitkeep' 以外のファイルが存在していた
  }
}

//. #3, #37
var ftindex = null;
if( settings_ftsearch ){
  init_ftindex().then( function( r ){
  }, function( r ){
  });
}

//. #58
var jobs = {};
init_jobs().then( function(){}, function(){} );


//. #99
router.get( '/token', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( settings_restrict_apicall ){
    if( fs.existsSync( token_filepath ) ){
      var token = await read_file( token_filepath );
      var auth_filepath = token_folder + '/' + token;
      fs.renameSync( token_filepath, auth_filepath );

      res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'no token file' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'no token needed' }, 2, null ) );
    res.end();
  }
});

//. POST /:db の前に置かないと receive_sync というデータベースが作られてしまう
//. ** internal API **
router.post( '/receive_sync', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var _remote_addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || null;
  var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
  //console.log( 'POST /api/receive_sync : _remote_addr = ' + _remote_addr + ', _server_id = ' + _serverid );

  var timestamp = getID();  //. #59

  //. 許可済みのホストからのリクエストのみ受け付ける
  var b = false;
  var configs = await list_config();
  for( var i = 0; i < configs.length && !b; i ++ ){
    var config_id = configs[i];
    var config = await read_config( config_id );  //. #54
    //. #42
    if( config.remote_addr && config.serverid ){
      if( config.remote_addr == _remote_addr && config.serverid == _serverid ){
        b = true;
      }
    }else if( config.remote_addr ){
      if( config.remote_addr == _remote_addr ){
        b = true;
      }
    }else if( config.serverid ){
      if( config.serverid == _serverid ){
        b = true;
      }
    }
  }

  if( b ){
    //. 自分の ledgers を validate
    var blocks = await get_block_chain();
    var idx = await validate( blocks );
  //console.log( 'POST /api/receive_sync : idx = ' + idx );
    if( idx > -1 ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'block index: ' + idx + ' had problem.' }, null, 2 ) );
      res.end();
    }else{
      //. validate できたら、リクエストで送られてきた ledgers をマージしてダブリを削除
      var req_blocks = req.body.blocks;
      if( req_blocks && req_blocks.length ){
        //. 送られてきた ledgers と自分の ledgers を結合
        var new_blocks = myConcat( blocks, req_blocks ); //. #30
        new_blocks.sort( compareByName );

        //. 再度 ledgers を reorg して書き込む
        new_blocks = await reorg( new_blocks );

        //. ここで #59 の処理が必要
        await comparedUpdateBlockFiles( new_blocks, timestamp );

        res.write( JSON.stringify( { status: true, ledgers: new_blocks }, null, 2 ) );
        res.end();
      }else{
        res.write( JSON.stringify( { status: true, ledgers: blocks }, null, 2 ) );
        res.end();
      }
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'your host is not allowed for this operation.' }, null, 2 ) );
    res.end();
  }
});

//. #84 ** internal API **
router.post( '/receive_restore', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
  //console.log( 'POST /api/receive_restore :  _server_id = ' + _serverid );

  if( _serverid ){
    //. 自分の ledgers を validate
    var blocks = await get_block_chain();
    var idx = await validate( blocks );
    if( idx > -1 ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'block index: ' + idx + ' had problem.' }, null, 2 ) );
      res.end();
    }else{
      //. validate できたら、リクエストで送られてきた serverid を含む ledger だけを取り出す
      var ledgers = [];
      blocks.forEach( async function( block ){
        var body_array = block.block.body;  //. typeof body_array == Array
        body_array.forEach( async function( body ){
          if( body.serverid && body.serverid == _serverid ){
            var timestamp = block.block.timestamps[0];
            var ledger = { timestamp: timestamp, body: body };
            ledgers.push( ledger );
          }
        });
      });

      //console.log( 'POST /api/receive_restore : ledgers ', ledgers );
      res.write( JSON.stringify( { status: true, ledgers: ledgers }, null, 2 ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'invalid header: serverid.' }, null, 2 ) );
    res.end();
  }
});

//. #99
//. ここより上で定義する API には認証フィルタをかけない
//. ここより下で定義する API には認証フィルタをかける
router.use( function( req, res, next ){
  if( settings_restrict_apicall ){
    var access_token = req.headers['x-access-token'];
    if( !access_token ){
      return res.status( 400 ).send( { status: false, message: 'No token provided.' } );
    }
    var auth_filepath = token_folder + '/' + access_token;
    if( fs.existsSync( auth_filepath ) ){
      //. 正しいトークンが提供されていた
      next();
    }else{
      return res.status( 400 ).send( { status: false, message: 'Wrong token provided.' } );
    }
  }else{
    //. トークン不要
    next();
  }
});

router.get( '/serverid', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( serverid ){
    res.write( JSON.stringify( { status: true, serverid: '' + serverid }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

//. #98
router.get( '/serveridfile', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( serverid ){
    var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
    if( _serverid == serverid ){
      if( fs.existsSync( serverid_filepath ) ){
        var body = fs.readFileSync( serverid_filepath, 'utf-8' );
        res.contentType( 'application/force-download' );
        res.set({
          'Content-Disposition': 'attachment; filename=.serverid'
        });
        res.end( body, 'binary' );
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'no serverid file found' }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'wrong serverid parameter' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'no serverid found' }, 2, null ) );
    res.end();
  }
});

router.post( '/serveridfile', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

    if( req.file ){
      var filepath = req.file.path;
      if( filepath ){
        var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
        if( _serverid == serverid ){
          //. リセット処理
          await reset();

          var body = fs.readFileSync( filepath, 'utf-8' );
          serverid = body;
          if( settings_enc_body ){
            serverid = await hc_decrypt( body );
          }

          fs.writeFileSync( serverid_filepath, body, 'utf-8' );

          //. blockchain
          await add_block( { serverid: serverid, method: 'serverid_upload' } );
          await realtime_sync();
  
          fs.unlinkSync( filepath );
          res.write( JSON.stringify( { status: true }, 2, null ) );
          res.end();
        }else{
          fs.unlinkSync( filepath );
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'wrong serverid parameter' }, 2, null ) );
          res.end();
        }
      }else{
        fs.unlinkSync( filepath );
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'no file found' }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'no file uploaded' }, 2, null ) );
      res.end();
    }
});


router.get( '/ledgers', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  //. #86 正しい serverid が指定されたリクエストのみ受け付ける
  var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
  if( _serverid == serverid ){
    //. #35
    var limit = 0;
    var offset = 0;
    var _limit = 0;
    var _offset = 0;
    if( req.query.limit ){
      try{
        _limit = parseInt( req.query.limit );
      }catch( e ){
      }
    }
    if( _limit ){ limit = _limit; }
    if( req.query.offset ){
      try{
        _offset = parseInt( req.query.offset );
      }catch( e ){
      }
    }
    if( _offset ){ offset = _offset; }

    var blocks = await get_block_chain( limit, offset );
    var ledgers = [];
    blocks.forEach( function( block ){
      ledgers.push( block.block );
    });

    res.write( JSON.stringify( { status: true, ledgers: ledgers, limit: limit, offset: offset }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'not valid header information' }, null, 2 ) );
    res.end();
  }
});


router.get( '/dbs', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var dbs = await list_db();

  res.write( JSON.stringify( { status: true, dbs: dbs }, 2, null ) );
  res.end();
});

router.get( '/configs', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var configs = await list_config();

  res.write( JSON.stringify( { status: true, configs: configs }, 2, null ) );
  res.end();
});


//. POST /:db の前に置かないと reset というデータベースが作られてしまう
router.post( '/reset', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( settings_enable_reset ){
    //. #90 正しい serverid が指定されたリクエストのみ受け付ける
    var _serverid = req.headers['serverid'] ? req.headers['serverid'] : null; //. #44
    if( _serverid == serverid ){
      await reset();
      /*
      //. delete config
      var configs = await list_config();
      if( configs.length ){
        configs.forEach( async function( config ){
          await delete_config( config, true );
        });
      }

      //. delete dbs
      var dbs = await list_db();
      if( dbs.length ){
        dbs.forEach( async function( db ){
          await delete_db( db, true );
        });
      }

      //. delete ledgers
      var blocks = await get_block_chain(); //. #38
      blocks.forEach( async function( block ){
        if( block.block && block.block.timestamps ){
          var ts = block.block.timestamps[0];
          await delete_file( ledgers_folder + '/' + ts );
        }
      });

      //. #3, #37
      await init_ftindex();

      //. #58
      await init_jobs();
      */

      res.write( JSON.stringify( { status: true }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not valid header information' }, null, 2 ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'prohibited in settings.js' }, null, 2 ) );
    res.end();
  }
});

async function reset(){
  return new Promise( async ( resolve, reject ) => {
    //. delete config
    var configs = await list_config();
    if( configs.length ){
      configs.forEach( async function( config ){
        await delete_config( config, true );
      });
    }

    //. delete dbs
    var dbs = await list_db();
    if( dbs.length ){
      dbs.forEach( async function( db ){
        await delete_db( db, true );
      });
    }

    //. delete ledgers
    var blocks = await get_block_chain(); //. #38
    blocks.forEach( async function( block ){
      if( block.block && block.block.timestamps ){
        var ts = block.block.timestamps[0];
        await delete_file( ledgers_folder + '/' + ts );
      }
    });

    //. #3, #37
    await init_ftindex();

    //. #58
    await init_jobs();

    resolve( true );
  });
}

/* #78 
//. POST /:db の前に置かないと validate というデータベースが作られてしまう
router.post( '/validate', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var include_ledgers = false;
  if( req.body && req.body.include_ledgers ){
    include_ledgers = true;
  }

  var blocks = await get_block_chain();
  var idx = await validate( blocks );
  var ledgers = [];
  blocks.forEach( function( block ){
    ledgers.push( block.block );
  });

  var obj = { status: ( idx == -1 ) };
  if( idx == -1 && include_ledgers ){
    //. not validated の場合、ledgers を返す必要はない？
    obj.ledgers = ledgers;
  }
  if( idx != -1 ){
    obj.error_index = idx;
  }

  res.write( JSON.stringify( obj, null, 2 ) );
  res.end();
});
*/

/* #77 
//. POST /:db の前に置かないと reorg というデータベースが作られてしまう
router.post( '/reorg', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var blocks = await get_block_chain();
  var idx = await validate( blocks );
  if( idx > -1 ){
    blocks = await reorg( blocks );
  }
  var ledgers = [];
  blocks.forEach( function( block ){
    ledgers.push( block.block );
  });

  if( idx == -1 ){
    res.write( JSON.stringify( { status: true, ledgers: ledgers }, null, 2 ) );
    res.end();
  }else{
    res.write( JSON.stringify( { status: true, ledgers: ledgers, error_index: idx }, null, 2 ) );
    res.end();
  }
});
*/

//. #105
//. POST /:db の前に置かないと singlenode_reorg というデータベースが作られてしまう
router.post( '/singlenode_reorg', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( settings_singlenode_reorg > 0 ){
    var config_ids = await list_config();
    if( config_ids && config_ids.length > 0 ){
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'no configs would be appropriate to execute this API.' }, null, 2 ) );
      res.end();
    }else{
      var blocks = await get_block_chain();
      var idx = await validate( blocks );
      if( idx == -1 ){
        blocks = await singlenode_reorg( blocks );
        var ledgers = [];
        blocks.forEach( function( block ){
          ledgers.push( block.block );
        });

        res.write( JSON.stringify( { status: true, ledgers: ledgers }, null, 2 ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: 'validation error at ' + idx }, null, 2 ) );
        res.end();
      }
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'prohibited in settings.js' }, null, 2 ) );
    res.end();
  }
});


//. #84 ** restore API **
router.post( '/restore', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var url = req.body.url;
  if( url ){
    var ledgers = await req_restore( url );
    if( ledgers == null || ledgers.length == 0 ){
      res.write( JSON.stringify( { status: true, url: url, count: 0 }, null, 2 ) );
      res.end();
    }else{
      //. #95
      var config_index = FlexSearch.create({
        encode: false,
        tokenize: function( str ){
          return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
        }
      });
      ftindex = { config: config_index };

      //ledgers = [ { timestamp: id, body: { serverid: 'serverid', .. } }, .. ]
      //ledgers.forEach( async function( ledger ){ //. #94
      for( var i = 0; i < ledgers.length; i ++ ){
        var ledger = ledgers[i];
        var body = ledger.body;

        switch( body.method ){
        case 'create_db': //. { serverid: 'serverid', db: 'db' }
          var db_folderpath = dbs_folder + '/' + body.db;
          var b = await exist_folder( db_folderpath );
          if( !b ){
            var cnt = await create_folder( db_folderpath );

            if( settings_ftsearch ){
              var _db_index = FlexSearch.create({
                encode: false,
                tokenize: function( str ){
                  return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
                }
              });
              ftindex[body.db] = _db_index;
            }
          }
          break;
        case 'delete_db': //. { serverid: 'serverid', db: 'db' }
          var db_folderpath = dbs_folder + '/' + body.db;
          var b = await exist_folder( db_folderpath );
          if( b ){
            var files = fs.readdirSync( db_folderpath );
            for( var file in files ){
              fs.unlinkSync( db_folderpath + '/' + files[file] );
            }
            await delete_folder( db_folderpath );

            if( settings_ftsearch ){
              delete ftindex[body.db];
            }
          }
          break;
        case 'create_config': //. { serverid: 'serverid', config: config }
          if( body.config && body.config.name && ( body.config.url || body.config.remote_addr || body.config.serverid ) ){
            var config = {
              id: body.config.id,
              name: body.config.name
            };
            if( body.config.url ){
              config.url = body.config.url;
              if( body.config.cron ){
                config.cron = body.config.cron;
              }
            }
            if( body.config.remote_addr ){
              config.remote_addr = body.config.remote_addr;
            }
            if( body.config.serverid ){
              config.serverid = body.config.serverid;
            }

            var config_filepath = config_folder + '/' + body.config.id;
            await create_file( config, config_filepath );
          }
          break;
        case 'update_config': //. { serverid: 'serverid', config: config }
          var config_filepath = config_folder + '/' + body.config.id;
          var b = await exist_file( config_filepath );
          if( b ){
            var config = body.config;
            config.id = body.config.id;
            await update_file( config, config_filepath );
          }
          break;
        case 'delete_config': //. { serverid: 'serverid', id: 'id' }
          var config_filepath = config_folder + '/' + body.id;
          var b = await exist_file( config_filepath );
          if( b ){
            await delete_file( config_filepath );
          }
          break;
        case 'create_item': //. { serverid: 'serverid', db: 'db0', item: item }
          if( body.item && body.item.id ){
            var db_filepath = dbs_folder + '/' + body.db;
            var b = await exist_folder( db_filepath );
            if( b ){
              var item_filepath = db_filepath + '/' + body.item.id;
              var a = await create_file( body.item, item_filepath );

              if( settings_ftsearch ){
                var text = await textify( body.item );
                ftindex[body.db].add( body.item.id, text );
              }
            }
          }
          break;
        case 'create_items': //. { serverid: 'serverid', db: 'db0', items: items }
          if( body.db && body.items && Array.isArray( body.items ) && body.items.length > 0 ){
            var db_filepath = dbs_folder + '/' + body.db;
            var b = await exist_folder( db_filepath );
            if( b ){
              body.items.forEach( async function( item ){
                var item_filepath = db_filepath + '/' + item.id;
                await create_file( item, item_filepath );

                if( settings_ftsearch ){
                  var text = await textify( item );
                  ftindex[body.db].add( item.id, text );
                }
              });
            }
          }
          break;
        case 'update_item': //. { serverid: 'serverid', db: 'db0', item: item }
          var db_filepath = dbs_folder + '/' + body.db;
          var item_filepath = db_filepath + '/' + body.item.id;
          var b = await exist_file( item_filepath );
          if( b ){
            await update_file( body.item, item_filepath );

            if( settings_ftsearch ){
              var text = await textify( body.item );
              ftindex[body.db].update( body.item.id, text );
            }
          }
          break;
        case 'update_items': //. { serverid: 'serverid', db: 'db0', items: items }
          if( body.db && body.items && Array.isArray( body.items ) && body.items.length > 0 ){
            var db_filepath = dbs_folder + '/' + body.db;
            var b = await exist_folder( db_filepath );
            if( b ){
              body.items.forEach( async function( item ){
                if( item && item.id ){
                  var item_filepath = db_filepath + '/' + item.id;
                  await update_file( item, item_filepath );

                  if( settings_ftsearch ){
                    var text = await textify( item );
                    ftindex[body.db].update( item.id, text );
                  }
                }
              });
            }
          }
          break;
        case 'delete_item': //. { serverid: 'serverid', db: 'db0', id: 'id' }
          var db_filepath = dbs_folder + '/' + body.db;
          var item_filepath = db_filepath + '/' + body.id;
          var b = await exist_file( item_filepath );
          if( b ){
            await delete_file( item_filepath );

            if( settings_ftsearch ){
              ftindex[body.db].remove( body.id );
            }
          }
          break;
        case 'delete_items': //. { serverid: 'serverid', db: 'db0', ids: ids }
          if( body.db && body.ids && Array.isArray( body.ids ) && body.ids.length > 0 ){
            var db_filepath = dbs_folder + '/' + body.db;
            var b = await exist_folder( db_filepath );
            if( b ){
              body.ids.forEach( async function( body_id ){
                var item_filepath = db_filepath + '/' + body_id;
                await delete_file( item_filepath );

                if( settings_ftsearch ){
                  ftindex[body.db].remove( body_id );
                }
              });
            }
          }
          break;
        case 'restore': //. { serverid: 'serverid', url: 'url' }
          break;
        case 'serverid_upload': //. { serverid: 'serverid' }
          break;
        case 'singlenode_reorg': //. { serverid: 'serverid' }
          break;
        }
      }

      //. blockchain
      await add_block( { serverid: serverid, method: 'restore', url: url } );

      //. #95
      await realtime_sync();

      res.write( JSON.stringify( { status: true, url: url, count: ( ledgers.length + 1 ) }, null, 2 ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'invalid parameter: url.' }, null, 2 ) );
    res.end();
  }
});


/* #73
//. 外部からの強制 sync リクエスト実行用
router.post( '/sync/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = req.params.id;
  if( id ){
    var config = await read_config( id );
    if( config && config.url ){
      var dst = config.url;
      var ledgers = await req_sync( dst );

      res.write( JSON.stringify( { status: true, ledgers: ledgers }, null, 2 ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, error: 'not valid id.' }, null, 2 ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'parameter id required.' }, null, 2 ) );
    res.end();
  }
});
*/

//. #58
async function sync_request( config_id ){
  return new Promise( async ( resolve, reject ) => {
    if( config_id ){
      var config = await read_config( config_id );
      if( config && config.url ){
        var dst = config.url;
        var ledgers = await req_sync( dst );

        resolve( ledgers );
      }else{
        reject( 'not valid id.' );
      }
    }else{
      reject( 'parameter id required.' );
    }
  });
}

//. POST /:db の前に置かないと config というデータベースが作られてしまう
router.post( '/config', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var body = req.body;  //. { name: 'name', remote_addr: 'xx.xx.xx.xx', serverid: 'serverid', url: 'url', cron: '* * * * *' }
  if( body && body.name && ( body.url || body.remote_addr || body.serverid ) ){  //. #50
    //. #51
    if( body.url ){
      while( body.url.endsWith( '/' ) ){
        body.url = body.url.substring( 0, body.url.length - 1 );
      }
    }

    var id = await create_config( body );
    if( id ){
      //. #3
      body.id = id;
      //. #40
      if( settings_ftsearch ){
        //. #37
        var text = await textify( body );
        ftindex.config.add( id, text );
      }

      //. #58
      if( body.url && body.cron ){
        console.log( 'job #' + id + ' registered.' );
        var job = schedule.scheduleJob( body.cron, function(){
          console.log( 'job #' + id + ' start.' );
          sync_request( id );
        });
        jobs[id] = job;
      }

      res.write( JSON.stringify( { status: true, id: id }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.get( '/config/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  if( id ){
    var config = await read_config( id );
    if( config ){
      res.write( JSON.stringify( { status: true, config: config }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.put( '/config/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  var body = req.body;  //. { name: 'name', url: 'url' }
  if( id && body && body.name && ( body.url || body.remote_addr || body.serverid ) ){ //. #50
    //. #51
    if( body.url ){
      while( body.url.endsWith( '/' ) ){
        body.url = body.url.substring( 0, body.url.length - 1 );
      }
    }

    var config = await read_config( id );
    if( config ){
      var _id = await update_config( id, body );
      if( _id ){
        //. #3
        body.id = id;
        //. #40
        if( settings_ftsearch ){
          //. #47
          var text = await textify( body );
          ftindex.config.update( id, text );
        }

        //. #58
        if( body.url && body.cron ){
          console.log( 'job #' + id + ' updated.' );
          if( jobs[id] ){
            jobs[id].cancel();
            delete jobs[id];
          }

          var job = schedule.scheduleJob( body.cron, function(){
            console.log( 'job #' + id + ' start.' );
            sync_request( id );
          });
          jobs[id] = job;
        }

        res.write( JSON.stringify( { status: true, id: _id }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.delete( '/config/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  if( id ){
    var r = await delete_config( id );
    if( r ){
      //. #3, #40
      if( settings_ftsearch ){
        //. #47
        ftindex.config.remove( id );
      }

      //. #58
      if( jobs[id] ){
        console.log( 'job #' + id + ' canceled.' );
        jobs[id].cancel();
        delete jobs[id];
      }

      res.write( JSON.stringify( { status: true }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});


router.get( '/:db', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  if( db ){
    //. #35
    var limit = 0;
    var offset = 0;
    var _limit = 0;
    var _offset = 0;
    if( req.query.limit ){
      try{
        _limit = parseInt( req.query.limit );
      }catch( e ){
      }
    }
    if( _limit ){ limit = _limit; }
    if( req.query.offset ){
      try{
        _offset = parseInt( req.query.offset );
      }catch( e ){
      }
    }
    if( _offset ){ offset = _offset; }

    var items = await read_items( db, limit, offset );

    if( items ){
      res.write( JSON.stringify( { status: true, items: items, limit: limit, offset: offset }, null, 2 ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, null, 2 ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, null, 2 ) );
    res.end();
  }
});

router.post( '/:db', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  if( db ){
    //. #106
    var body = req.body;
    var keys = ( body && typeof body == 'object' ) ? Object.keys( body ) : [];
    if( keys.length > 0 ){
      //. create item in db
      var r = await create_item( body, db );

      if( r ){
        //. #3
        body.id = r;
        //. #40
        if( settings_ftsearch ){
          //. #37
          var text = await textify( body );
          ftindex[db].add( r, text );
        }

        res.write( JSON.stringify( { status: true, id: r }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }else{
      //. create db
      var r = await create_db( db );

      if( r > 0 ){
        //. #3, #40
        if( settings_ftsearch ){
          //. #37
          var db_index = FlexSearch.create({
            encode: false,
            tokenize: function( str ){
              return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
            }
          });
          ftindex[db] = db_index;
        }

        res.write( JSON.stringify( { status: true }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }

  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.delete( '/:db', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  if( db ){
    var r = await delete_db( db );

    if( r ){
      //. #3, #40
      if( settings_ftsearch ){
        //. #37
        delete ftindex[db];
      }

      res.write( JSON.stringify( { status: true }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});


//. #3
router.get( '/:db/search/:text', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  if( settings_ftsearch ){
    var limit = 0;
    var offset = 0;
    var _limit = 0;
    var _offset = 0;
    if( req.query.limit ){
      try{
        _limit = parseInt( req.query.limit );
      }catch( e ){
      }
    }
    if( _limit ){ limit = _limit; }
    if( req.query.offset ){
      try{
        _offset = parseInt( req.query.offset );
      }catch( e ){
      }
    }
    if( _offset ){ offset = _offset; }

    var db = req.params.db;
    var text = req.params.text;
    if( db && text ){
      var ids = await ftsearch_db( db, text, limit, offset );
      if( ids ){
        res.write( JSON.stringify( { status: true, db: db, text: text, ids: ids, limit: limit, offset: offset }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'ftsearch is disabled in settings' }, 2, null ) );
    res.end();
  }
});

//. #71(bulk functions)
router.post( '/:db/bulk', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var items = req.body;
  if( db && items && Array.isArray( items ) && items.length > 0 ){
    var ids = [];
    var new_items = [];
    var db_filepath = dbs_folder + '/' + db;
    var b = await exist_folder( db_filepath );
    if( b ){
      items.forEach( async function( item ){
        //. create
        var id = uuidv1();
        if( item && !item.id ){
          item.id = id;

          var item_filepath = db_filepath + '/' + id;
          await create_file( item, item_filepath );

          ids.push( id );
          new_items.push( item );

          if( settings_ftsearch ){
            var text = await textify( item );
            ftindex[db].add( id, text );
          }
        }
      });

      //. blockchain
      await add_block( { serverid: serverid, method: 'create_items', db: db, items: new_items } );

      //. #66
      await realtime_sync();
    }

    res.write( JSON.stringify( { status: true, db: db, ids: ids }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'not valid parameters.' }, 2, null ) );
    res.end();
  }
});

router.put( '/:db/bulk', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var items = req.body;
  if( db && items && Array.isArray( items ) && items.length > 0 ){
    var ids = [];
    var new_items = [];
    var db_filepath = dbs_folder + '/' + db;
    var b = await exist_folder( db_filepath );
    if( b ){
      items.forEach( async function( item ){
        if( item && item.id ){
          //. update
          var item_filepath = db_filepath + '/' + item.id;
          await update_file( item, item_filepath );

          ids.push( item.id );
          new_items.push( item );

          if( settings_ftsearch ){
            var text = await textify( item );
            ftindex[db].update( item.id, text );
          }
        }
      });

      //. blockchain
      await add_block( { serverid: serverid, method: 'update_items', db: db, items: new_items } );

      //. #66
      await realtime_sync();
    }

    res.write( JSON.stringify( { status: true, db: db, ids: ids }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'not valid parameters.' }, 2, null ) );
    res.end();
  }
});

router.delete( '/:db/bulk', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var ids = req.body;
  if( db && ids && Array.isArray( ids ) && ids.length > 0 ){
    var new_ids = [];
    var db_filepath = dbs_folder + '/' + db;
    var b = await exist_folder( db_filepath );
    if( b ){
      ids.forEach( async function( id ){
        //. delete
        var item_filepath = db_filepath + '/' + id;
        await delete_file( item_filepath );

        new_ids.push( id );

        if( settings_ftsearch ){
          ftindex[db].remove( id );
        }
      });

      //. blockchain
      await add_block( { serverid: serverid, method: 'delete_items', db: db, ids: new_ids } );

      //. #66
      await realtime_sync();
    }

    res.write( JSON.stringify( { status: true, ids: ids }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'not valid parameters.' }, 2, null ) );
    res.end();
  }
});


router.get( '/:db/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db && id ){
    var item = await read_item( id, db );

    if( item ){
      res.write( JSON.stringify( { status: true, item: item }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

//. #56
router.get( '/:db/attach/:id', async function( req, res ){
  //get.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db && id ){
    var item = await read_item( id, db );

    if( item && item.type == 'attach' && item.mimetype && item._attachment && item._attachment.file ){
      var mimetype = item.mimetype;
      var originalname = item.originalname ? item.originalname : id;
      var file64 = item._attachment.file;
      var body = new Buffer( file64, 'base64' );

      res.contentType( mimetype );
      res.set({
        'Content-Disposition': 'attachment; filename=' + originalname
      });
      res.end( body, 'binary' );
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.delete( '/:db/attach/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db && id ){
    var r = await delete_item( id, db );

    if( r ){
      if( settings_ftsearch ){
        ftindex[db].remove( id );
      }

      res.write( JSON.stringify( { status: true, db: db, id: id }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.put( '/:db/attach/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db && id ){
    if( req.file ){
      var filepath = req.file.path;
      var filetype = req.file.mimetype;
      //var filesize = req.file.size;
      var ext = filetype.split( "/" )[1];
      //var filename = req.file.filename;
      var originalname = req.file.originalname;
      var ts = ( new Date() ).getTime();
      
      if( filepath ){
        var bin = fs.readFileSync( filepath );
        var bin64 = new Buffer( bin ).toString( 'base64' );

        var body = {
          type: 'attach',
          originalname: originalname,
          mimetype: filetype,
          _attachment: {
            file: bin64
          }
        };

        var r = await update_item( id, body, db );

        if( r ){
          if( settings_ftsearch ){
            var text = originalname;
            ftindex[db].update( id, text );
          }

          fs.unlink( filepath, function( err ){} );

          res.write( JSON.stringify( { status: true, db: db, id: id }, 2, null ) );
          res.end();
        }else{
          fs.unlink( filepath, function( err ){} );

          res.status( 400 );
          res.write( JSON.stringify( { status: false }, 2, null ) );
          res.end();
        }
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    if( req.file && req.file.path ){
      fs.unlink( req.file.path, function( err ){} );
    }

    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.post( '/:db/attach', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  if( db ){
    if( req.file ){
      var filepath = req.file.path;
      var filetype = req.file.mimetype;
      //var filesize = req.file.size;
      var ext = filetype.split( "/" )[1];
      //var filename = req.file.filename;
      var originalname = req.file.originalname;
      var ts = ( new Date() ).getTime();
      
      if( filepath ){
        var bin = fs.readFileSync( filepath );
        var bin64 = new Buffer( bin ).toString( 'base64' );

        var body = {
          type: 'attach',
          originalname: originalname,
          mimetype: filetype,
          _attachment: {
            file: bin64
          }
        };

        var r = await create_item( body, db );

        if( r ){
          if( settings_ftsearch ){
            var text = originalname;
            ftindex[db].add( r, text );
          }

          fs.unlink( filepath, function( err ){} );

          res.write( JSON.stringify( { status: true, db: db }, 2, null ) );
          res.end();
        }else{
          fs.unlink( filepath, function( err ){} );

          res.status( 400 );
          res.write( JSON.stringify( { status: false }, 2, null ) );
          res.end();
        }
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    if( req.file && req.file.path ){
      fs.unlink( req.file.path, function( err ){} );
    }

    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.post( '/:db/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db ){
    if( !id || id == 'new' || id == 'undefined' ){
      //. create
      var r = await create_item( req.body, db );

      if( r ){
        //. #3
        req.body.id = r;
        //. #40
        if( settings_ftsearch ){
          //. #37
          var text = await textify( req.body );
          ftindex[db].add( r, text );
        }
      }
    }else{
      //. update
      var r = await update_item( id, req.body, db );

      if( r ){
        //. #3
        req.body.id = id;
        //. #40
        if( settings_ftsearch ){
          //. #37
          var text = await textify( req.body );
          ftindex[db].update( id, text );
        }
      }
    }

    if( r ){
      res.write( JSON.stringify( { status: true, id: r }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});

router.delete( '/:db/:id', async function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var db = req.params.db;
  var id = req.params.id;
  if( db && id ){
    //. delete
    var r = await delete_item( id, db );

    if( r ){
      //. #3, #40
      if( settings_ftsearch ){
        //. #37
        ftindex[db].remove( id );
      }

      res.write( JSON.stringify( { status: true, id: id }, 2, null ) );
      res.end();
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false }, 2, null ) );
    res.end();
  }
});



function compareByTimestamp( a, b ){
  var r = 0;

  if( a['timestamps'][0] < b['timestamps'][0] ){ r = -1; }
  else if( a['timestamps'][0] > b['timestamps'][0] ){ r = 1; }

  return r;
}

function compareByTimestampRev( a, b ){
  var r = 0;

  if( a['timestamps'][0] < b['timestamps'][0] ){ r = 1; }
  else if( a['timestamps'][0] > b['timestamps'][0] ){ r = -1; }

  return r;
}

function compareByName( a, b ){
  var r = 0;

  if( a['name'] < b['name'] ){ r = -1; }
  else if( a['name'] > b['name'] ){ r = 1; }

  return r;
}

function compareByNameRev( a, b ){
  var r = 0;

  if( a['name'] < b['name'] ){ r = 1; }
  else if( a['name'] > b['name'] ){ r = -1; }

  return r;
}


function countTopZero( str ){
  var cnt = 0;

  while( str.length <= cnt || str.charAt( cnt ) == '0' ){
    cnt ++;
  }

  return cnt;
}

async function hc_encrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings_secret; }
    var encbody = jwt.sign( body, key, {} );  //. body は string or object

    resolve( encbody );
  });
}

async function hc_decrypt( body, key ){
  return new Promise( ( resolve, reject ) => {
    if( !key ){ key = settings_secret; }

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


//. #20
async function req_sync( dst ){
  return new Promise( async ( resolve, reject ) => {
    //. 各 ledger を validation
    var blocks = await get_block_chain();
    var validated = true;
    if( blocks.length > 0 ){
      for( var i = 0; i < blocks.length && validated; i ++ ){
        validated = await is_valid_block( blocks[i].block, ( i == 0 ? null : blocks[i-1].block.id ) );
        //if( !validated ){ console.log( 'req_sync : is_valid_block failed at ' + i, blocks[i] ); }
      }
    }

    if( validated ){
      var timestamp = getID();  //. #59
      var result = await send_sync( dst, blocks );
      //console.log( 'req_sync : result = ', result );
      if( !result || !result.status ){
        //. 何もしない
        resolve( null );
      }else{
        //. #59 比較して更新
        //await comparedUpdateBlockFiles( result.blocks, timestamp );
        await comparedUpdateBlockFiles( result.ledgers, 0 );  //. #76 リクエスト送信側は無条件に上書きするべき？

        var ledgers = [];
        result.ledgers.forEach( async function( ledger ){
          ledgers.push( ledger.block );
        });

        resolve( ledgers );
      }
    }else{
      //. 何もしない
      resolve( null );
    }
  });
}


//. #84
async function req_restore( dst ){
  //. この結果が null または長さゼロになってしまっている
  return new Promise( async ( resolve, reject ) => {
    var blocks = await get_block_chain();
    if( blocks.length > 0 ){
      resolve( null );
    }else{
      var result = await send_restore( dst );
      //console.log( 'req_restore: result', result );  //. { status: true, blocks: [..] }
      if( !result || !result.status ){
        resolve( null );
      }else{
        resolve( result.blocks );
      }
    }
  });
}


async function send_sync( dst, blocks ){
  return new Promise( async ( resolve, reject ) => {
    var option = {
      url: dst + '/api/receive_sync',
      method: 'POST',
      //json: { blocks: blocks, serverid: serverid }
      //. #44
      headers: { 'serverid': serverid },
      json: { blocks: blocks }
    };
    request( option, ( err, res, body ) => {
      if( err ){
        resolve( { status: false, error: err } );
      }else{
        //console.log( 'send_sync: body', body );  // body = { status: false, error: 'block index: 0 had problem.' }
        if( body.status && body.ledgers ){
          resolve( { status: true, ledgers: body.ledgers } );
        }else{
          resolve( { status: false, error: body.error } );
        }
      }
    });
  });
}


//. #84
async function send_restore( dst ){
  return new Promise( async ( resolve, reject ) => {
    var option = {
      url: dst + '/api/receive_restore',
      method: 'POST',
      headers: { 'serverid': serverid }
    };
    request( option, ( err, res, body ) => {
      if( typeof body == 'string' ){
        body = JSON.parse( body );
      }
      if( err ){
        resolve( { status: false, error: err } );
      }else{
        if( body.status && body.ledgers ){
          resolve( { status: true, blocks: body.ledgers } );
        }else{
          resolve( { status: false, error: body.error } );
        }
      }
    });
  });
}

//. #105
async function singlenode_reorg( blocks ){
  return new Promise( async ( resolve, reject ) => {
    var new_blocks = [];
    var new_block = { body: [], timestamps: [] };
    var idx = 0;
    for( var i = 0; i < blocks.length; i ++ ){
      //. blocks[i].block が object ですら無かった場合はいったん無視
      if( typeof blocks[i].block != 'object' ){
        //. どうせ後で消すのでここでは無視
        //await delete_file( ledgers_folder + '/' + filename );
      }else{
        if( is_blockable( blocks[i].block ) ){
          var body = blocks[i].block.body;
          var timestamps = blocks[i].block.timestamps;
          new_block.body = new_block.body.concat( body );
          new_block.timestamps = new_block.timestamps.concat( timestamps );
          new_block.timestamps.sort();
          if( new_block.body.length >= settings_singlenode_reorg ){
            //new_block.timestamps.push( getID() );
            var filename = new_block.timestamps[0];
            new_block.prev_id = ( idx == 0 ? null : new_blocks[idx-1].id );

            var id = null;
            var _nonce = 0;
            do{
              _nonce ++;
              new_block.nonce = _nonce;

              id = await get_hash( new_block );
            }while( settings_zerodigit > 0 && countTopZero( id ) < settings_zerodigit );
            new_block.id = id;

            new_blocks.push( { name: filename, block: new_block } );

            new_block = { body: [], timestamps: [] };
            idx ++;
          }
        }
      }
    }

    //. 最後に１ブロック追加
    new_block.body.push( { serverid: '' + serverid, method: 'singlenode_reorg' } );
    new_block.timestamps.push( getID() );
    var filename = new_block.timestamps[0];
    new_block.prev_id = ( idx == 0 ? null : new_blocks[idx-1].block.id );

    var id = null;
    var _nonce = 0;
    do{
      _nonce ++;
      new_block.nonce = _nonce;

      id = await get_hash( new_block );
    }while( settings_zerodigit > 0 && countTopZero( id ) < settings_zerodigit );
    new_block.id = id;

    new_blocks.push( { name: filename, block: new_block } );

    //. 古いブロックを削除
    for( var i = 0; i < blocks.length; i ++ ){
      var filename = blocks[i].name;
      await delete_file( ledgers_folder + '/' + filename );
    }

    //. 新しいブロックを生成
    for( var i = 0; i < new_blocks.length; i ++ ){
      var filename = new_blocks[i].name;
      var block_filepath = ledgers_folder + '/' + filename;
      await create_file( new_blocks[i].block, block_filepath );
    }
    
    //. #107 再度 reorg
    new_blocks = await reorg( new_blocks );

    resolve( new_blocks );
  });
}

//. #76 の問題が発覚
//. 第0ブロック以外に prev_id == null が存在しているパターンを想定して調査
//. sync 受信側では正しく処理されているが、送信側に戻った後の reorg でうまくマージできていない？
async function reorg( blocks ){
  return new Promise( async ( resolve, reject ) => {
    var reorged = false;
    for( var i = 0; i < blocks.length; i ++ ){
      var b = await is_valid_block( blocks[i].block, ( i == 0 ? null : blocks[i-1].block.id ) );
      if( reorged || !b ){
        reorged = true;
        var filename = blocks[i].name;

        //. blocks[i].block が object ですら無かった場合は reorg 時に block とファイルを削除する
        if( typeof blocks[i].block != 'object' ){
          blocks.splice( i, 1 );
          await delete_file( ledgers_folder + '/' + filename );
          i --;
        }else{
          //. 再ブロック化可能かどうかの判断
          if( is_blockable( blocks[i].block ) ){
            //. 再ブロック化
            delete blocks[i].block.id;
            blocks[i].block.timestamps.push( getID() );
            blocks[i].block.prev_id = ( i == 0 ? null : blocks[i-1].block.id );
            var id = null;
            var _nonce = 0;
            do{
              _nonce ++;
              blocks[i].block.nonce = _nonce;

              id = await get_hash( blocks[i].block );
            }while( settings_zerodigit > 0 && countTopZero( id ) < settings_zerodigit );
            blocks[i].block.id = id;

            //. 再ブロックした内容を上書き
            var block_filepath = ledgers_folder + '/' + filename;
            await update_file( blocks[i].block, block_filepath );
          }else{
            //. ledgers からは削除
            blocks.splice( i, 1 );
            await delete_file( ledgers_folder + '/' + filename );
            i --;
          }
        }
      }
    }

    resolve( blocks );
  });
}

async function validate( blocks ){
  return new Promise( async ( resolve, reject ) => {
    var b = true;
    var idx = -1;
    if( blocks.length == 0 ){
    }else if( blocks.length == 1 ){
      b = await is_valid_block( blocks[0].block, null );
      if( !b ){
        idx = 0;
      }
    }else{
      for( var i = 0; i < blocks.length && b; i ++ ){
        b = await is_valid_block( blocks[i].block, ( i == 0 ? null : blocks[i-1].block.id ) );
        if( !b ){
          idx = i;
        }
      }
    }

    resolve( idx );
  });
}

function is_blockable( block ){
  var b = false;
  try{
    b = ( block.id && block.timestamps && block.timestamps.length >= 0 && block.nonce && block.body );
  }catch( e ){
  }

  return b;
}

async function is_valid_block( block, prev_id ){
  return new Promise( async ( resolve, reject ) => {
    var text = await textify( block );
    var _block = JSON.parse( text );
    var b = true;
    if( !is_blockable( _block ) ){
      b = false;
    }

    if( b ){
      b = ( _block.prev_id == prev_id );
    }

    if( b ){
      var id = _block.id;
      delete _block.id;
      var _id = await get_hash( _block );
      b = ( id == _id );
    }

    resolve( b );
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
    }while( settings_zerodigit > 0 && countTopZero( id ) < settings_zerodigit );

    block.id = id;

    var block_filepath = ledgers_folder + '/' + ts;
    await create_file( block, block_filepath );

    resolve( true );
  });
}


async function list_db(){
  return new Promise( async ( resolve, reject ) => {
    var dbs = [];
    var files = fs.readdirSync( dbs_folder );
    files.forEach( function( file ){
      if( !file.startsWith( '.' ) ){
        dbs.push( file );
      }
    });
    resolve( dbs );
  });
}

async function list_config(){
  return new Promise( async ( resolve, reject ) => {
    var configs = [];
    var files = fs.readdirSync( config_folder );
    files.forEach( function( file ){
      if( !file.startsWith( '.' ) ){
        configs.push( file );
      }
    });
    resolve( configs );
  });
}

async function create_config( body ){
  return new Promise( async ( resolve, reject ) => {
    if( body && body.name && ( body.url || body.remote_addr || body.serverid ) ){
      var ts = getID();
      var config = {
        id: ts,  //. #52
        name: body.name
      };
      if( body.url ){
        config.url = body.url;
        if( body.cron ){
          config.cron = body.cron;
        }
      }
      if( body.remote_addr ){
        config.remote_addr = body.remote_addr;
      }
      if( body.serverid ){
        config.serverid = body.serverid;
      }

      var config_filepath = config_folder + '/' + ts;
      await create_file( config, config_filepath );

      //. blockchain
      await add_block( { serverid: serverid, method: 'create_config', config: config } );

      //. #66
      await realtime_sync();

      resolve( ts );
    }else{
      resolve( false );
    }
  });
}

async function read_config( id ){
  return new Promise( async ( resolve, reject ) => {
    var config_filepath = config_folder + '/' + id;
    var b = await exist_file( config_filepath );
    if( b ){
      var config = await read_file( config_filepath );
      resolve( config );
    }else{
      resolve( null );
    }
  });
}

async function update_config( id, config ){
  return new Promise( async ( resolve, reject ) => {
    var config_filepath = config_folder + '/' + id;
    var b = await exist_file( config_filepath );
    if( b ){
      config.id = id;
      await update_file( config, config_filepath );

      //. blockchain
      await add_block( { serverid: serverid, method: 'update_config', config: config } );

      //. #66
      await realtime_sync();

      resolve( id );
    }else{
      resolve( null );
    }
  });
}

async function delete_config( id, ignore_newblock ){
  return new Promise( async ( resolve, reject ) => {
    var config_filepath = config_folder + '/' + id;
    var b = await exist_file( config_filepath );
    if( b ){
      await delete_file( config_filepath );

      if( !ignore_newblock ){
        //. blockchain
        await add_block( { serverid: serverid, method: 'delete_config', id: id } );
      }

      //. #66
      await realtime_sync();

      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function create_db( db ){
  return new Promise( async ( resolve, reject ) => {
    var db_folderpath = dbs_folder + '/' + db;
    var b = await exist_folder( db_folderpath );
    if( b ){
      resolve( -1 );
    }else{
      var cnt = await create_folder( db_folderpath );
      if( cnt > 0 ){
        //. blockchain
        await add_block( { serverid: serverid, method: 'create_db', db: db } );
      }

      //. #66
      await realtime_sync();

      resolve( cnt );
    }
  });
}

async function delete_db( db, ignore_newblock ){
  return new Promise( async ( resolve, reject ) => {
    var db_folderpath = dbs_folder + '/' + db;
    var b = await exist_folder( db_folderpath );
    if( b ){
      var files = fs.readdirSync( db_folderpath );
      for( var file in files ){
        fs.unlinkSync( db_folderpath + '/' + files[file] );
      }
      var r = await delete_folder( db_folderpath );

      if( !ignore_newblock ){
        //. blockchain
        await add_block( { serverid: serverid, method: 'delete_db', db: db } );
      }

      //. #66
      await realtime_sync();

      resolve( true );
    }else{
      resolve( false );
    }
  });
}


async function create_item( item, db ){
  return new Promise( async ( resolve, reject ) => {
    var r = null;
    var id = uuidv1();
    if( item ){
      if( !item.id ){
        item.id = id;
      }else{
        id = item.id;
      }

      var db_filepath = dbs_folder + '/' + db;
      var b = await exist_folder( db_filepath );
      if( b ){
        var item_filepath = db_filepath + '/' + id;
        await create_file( item, item_filepath );

        //. blockchain
        await add_block( { serverid: serverid, method: 'create_item', db: db, item: item } );

        //. #66
        await realtime_sync();

        r = id;
      }
    }

    resolve( r );
  });
}

async function read_items( db, limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    var db_filepath = dbs_folder + '/' + db;
    var b = await exist_file( db_filepath );
    if( b ){
      var items = await read_files( db_filepath, limit, offset );
      resolve( items );
    }else{
      resolve( null );
    }
  });
}

async function read_item( id, db ){
  return new Promise( async ( resolve, reject ) => {
    var db_filepath = dbs_folder + '/' + db;
    var item_filepath = db_filepath + '/' + id;
    var b = await exist_file( item_filepath );
    if( b ){
      var item = await read_file( item_filepath );
      resolve( item );
    }else{
      resolve( null );
    }
  });
}

async function update_item( id, item, db ){
  return new Promise( async ( resolve, reject ) => {
    var db_filepath = dbs_folder + '/' + db;
    var item_filepath = db_filepath + '/' + id;
    var b = await exist_file( item_filepath );
    if( b ){
      item.id = id;
      await update_file( item, item_filepath );

      //. blockchain
      await add_block( { serverid: serverid, method: 'update_item', db: db, item: item } );

      //. #66
      await realtime_sync();

      resolve( id );
    }else{
      resolve( null );
    }
  });
}

async function delete_item( id, db ){
  return new Promise( async ( resolve, reject ) => {
    var db_filepath = dbs_folder + '/' + db;
    var item_filepath = db_filepath + '/' + id;
    var b = await exist_file( item_filepath );
    if( b ){
      await delete_file( item_filepath );

      //. blockchain
      await add_block( { serverid: serverid, method: 'delete_item', db: db, id: id } );

      //. #66
      await realtime_sync();

      resolve( true );
    }else{
      resolve( false );
    }
  });
}


async function create_folder( folderpath ){
  return new Promise( async ( resolve, reject ) => {
    var cnt = 0;
    var tmp = folderpath.split( '/' );
    var idx = 0;
    var folder = tmp[idx];
    do{
      if( !fs.existsSync( folder ) ){
        try{
          fs.mkdirSync( folder );
          cnt ++;
        }catch( e ){
        }
      }

      idx ++;
      if( idx < tmp.length ){
        folder += '/' + tmp[idx];
      }
    }while( idx < tmp.length );
    resolve( cnt );
  });
}

async function exist_folder( folderpath ){
  return new Promise( async ( resolve, reject ) => {
    var b = fs.existsSync( folderpath );
    resolve( b );
  });
}

async function delete_folder( folderpath ){
  return new Promise( async ( resolve, reject ) => {
    fs.rmdirSync( folderpath );
    //resolve( true );
    setTimeout( function(){  //. #84
      resolve( true );
    }, 100 );
  });
}

async function create_file( json, filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( !fs.existsSync( filepath ) ){
      var body = ( typeof json == 'object' ? JSON.stringify( json ) : json );
      if( settings_enc_body ){
        body = await hc_encrypt( body );
      }
      fs.writeFileSync( filepath, body, 'utf-8' );
      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function exist_file( filepath ){
  return new Promise( async ( resolve, reject ) => {
    var b = fs.existsSync( filepath );
    resolve( b );
  });
}

async function read_files( folderpath, limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    if( fs.existsSync( folderpath ) ){
      var files = fs.readdirSync( folderpath );
      for( var file in files ){
        if( files[file].startsWith( '.' ) ){
          delete files[file];
        }
      }

      //. #35
      if( offset ){
        if( limit ){
          files = files.slice( offset, offset + limit );
        }else{
          files = files.slice( offset );
        }
      }else if( limit ){
        files = files.slice( 0, limit );
      }

      resolve( files );
    }else{
      resolve( null );
    }
  });
}

async function read_file( filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( fs.existsSync( filepath ) ){
      var body = fs.readFileSync( filepath, 'utf-8' );
      if( settings_enc_body ){
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

async function update_file( json, filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( fs.existsSync( filepath ) ){
      var body = ( typeof json == 'object' ? JSON.stringify( json ) : json );
      if( settings_enc_body ){
        body = await hc_encrypt( body );
      }
      fs.writeFileSync( filepath, body, 'utf-8' );
      resolve( true );
    }else{
      resolve( false );
    }
  });
}

async function delete_file( filepath ){
  return new Promise( async ( resolve, reject ) => {
    if( fs.existsSync( filepath ) ){
      fs.unlinkSync( filepath );
      resolve( true );
    }else{
      resolve( false );
    }
  });
}

//. #30
function myConcat( arr1, arr2 ){
  arr1.sort( compareByName );
  arr2.sort( compareByName );
  var arr = [];
  if( arr1.length == 0 ){
    arr = arr2;
  }else if( arr2.length == 0 ){
    arr = arr1;
  }else{
    for( var i = 0, j = 0; i < arr1.length && j < arr2.length; ){
      if( j >= arr2.length || arr1[i].name < arr2[j].name ){
        arr.push( arr1[i] );
        i ++;
        if( i == arr1.length ){
          for( var k = j; k < arr2.length; k ++ ){
            arr.push( arr2[k] );
          }
        }
      }else if( i >= arr1.length || arr1[i].name > arr2[j].name ){
        arr.push( arr2[j] );
        j ++;
        if( j == arr2.length ){
          for( var k = i; k < arr1.length; k ++ ){
            arr.push( arr1[k] );
          }
        }
      }else{ //. arr1[i].name == arr2[j].name
        //. block = { id: 123, nonce: 100, prev_id: prev_id, body: [ body ], timestamps: [ ts ] }
        //. #61
        var id1 = arr1[i].block.id;
        var id2 = arr2[j].block.id;
        var timestamps1 = arr1[i].block.timestamps;
        var timestamps2 = arr2[j].block.timestamps;
        var body1 = arr1[i].block.body;
        var body2 = arr2[j].block.body;
        var nonce1 = arr1[i].block.nonce;
        var nonce2 = arr2[j].block.nonce;
        //if( id1 != id2 || nonce1 != nonce2 || JSON.stringify( timestamps1 ) != JSON.stringify( timestamps2 ) || JSON.stringify( body1 ) != JSON.stringify( body2 ) ){
        if( timestamps1[0] != timestamps2[0] && JSON.stringify( body1 ) != JSON.stringify( body2 ) ){  //. #91 重ね合わせ条件を変更、作成日時と中身が異なる場合のみマージ
          arr1[i].block.body = arr1[i].block.body.concat( arr2[j].block.body );
          arr1[i].block.timestamps = arr1[i].block.timestamps.concat( arr2[j].block.timestamps );
          arr1[i].block.timestamps.sort();
        }
        arr.push( arr1[i] );

        i ++;
        j ++;

        if( i == arr1.length && j < arr2.length ){
          for( var k = j; k < arr2.length; k ++ ){
            arr.push( arr2[k] );
          }
        }else if( j == arr2.length && i < arr1.length ){
          for( var k = i; k < arr1.length; k ++ ){
            arr.push( arr1[k] );
          }
        }
      }
    }
  }

  return arr;
}

//. #37
function getID(){
  return ( new Date() ).getTime();
}


//. #3, #37
async function init_ftindex(){
  if( settings_ftsearch ){
    var config_index = FlexSearch.create({
      encode: false,
      tokenize: function( str ){
        return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
      }
    });
    ftindex = { config: config_index };

    //. index config
    var _config_ids = await list_config();
    _config_ids.forEach( async function( _config_id ){
      var _config = await read_config( _config_id );
      //_config.id = _config_id;
      ftindex.config.add( _config_id, JSON.stringify( _config ) );
    });
    //. index dbs
    var _dbs = await list_db();
    _dbs.forEach( async function( _db ){
      var _db_index = FlexSearch.create({
        encode: false,
        tokenize: function( str ){
          return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
        }
      });
      ftindex[_db] = _db_index;

      var _item_ids = await read_items( _db );
      _item_ids.forEach( async function( _item_id ){
        var _item = await read_item( _item_id, _db );
        if( !_item.type || _item.type != 'attach' ){
          ftindex[_db].add( _item_id, JSON.stringify( _item ) );
        }else{
          //delete _item._attachment;
          //ftindex[_db].add( _item_id, JSON.stringify( _item ) );
          ftindex[_db].add( _item_id, _item.originalname );
        }
      });
    });
  }

  return settings_ftsearch;
}

//. #3, #37
async function ftsearch_db( db, text, limit, offset ){
  return new Promise( async ( resolve, reject ) => {
    if( settings_ftsearch ){
      if( db && text ){
        if( ftindex[db] ){
          var _ids = ftindex[db].search( text );

          var ids = [];
          var start_idx = 0;
          var end_idx = _ids.length;
          if( offset ){ start_idx = offset; }
          if( limit ){ end_idx = offset + limit; }
          if( end_idx > _ids.length ){ end_idx = _ids.length; }
          for( var i = start_idx; i < end_idx; i ++ ){
            ids.push( _ids[i] );
          }

          resolve( ids );
        }else{
          resolve( null );
        }
      }else{
        resolve( null );
      }
    }else{
      resolve( null );
    }
  });
}

//. #49
async function textify( obj ){
  return new Promise( async ( resolve, reject ) => {
    resolve( JSON.stringify( obj ) );
  });
}

//. #58
async function init_jobs(){
  return new Promise( async ( resolve, reject ) => {
    Object.keys( jobs ).forEach( function( id ){
      if( jobs[id] ){
        console.log( 'job #' + id + ' canceled.' );
        jobs[id].cancel();
        delete jobs[id];
      }
    });

    jobs = {};

    var config_ids = await list_config();
    config_ids.forEach( async function( config_id ){
      var config = await read_config( config_id );
      if( config && config.url && config.cron ){
        console.log( 'job #' + config_id + ' registered.' );
        var job = schedule.scheduleJob( config.cron, function(){
          console.log( 'job #' + config_id + ' start.' );
          sync_request( config_id );
        });
        jobs[config_id] = job;
      }
    });

    resolve( true );
  });
}


//. #59
async function comparedUpdateBlockFiles( new_blocks, timestamp ){
  return new Promise( async ( resolve, reject ) => {
    //var new_blocks = myConcat( blocks, req_blocks ); //. #30
    //new_blocks.sort( compareByName );
    //new_blocks = await reorg( new_blocks );
    //new_blocks.forEach( async function( new_block ){ //. #87
    for( var i = 0; i < new_blocks.length; i ++ ){
      var new_block = new_blocks[i];
      var name = new_block.name;
      var block = await read_file( ledgers_folder + '/' + name );
      if( typeof block !== 'object' ){
        //. block がただの string だった場合は JSON.parse() できない
        try{
          block = JSON.parse( block );
        }catch( e ){
        }
      }

      if( block == null ){
        //. 存在しないファイルを作成する
        await create_file( new_block.block, ledgers_folder + '/' + name );
      }else{
        //. 最終更新日時を比較して書き込む
        var last_timestamp = block.timestamps[block.timestamps.length-1];
        //. システムの時刻にズレがあるなどの原因で、
        //. リクエスト送信側の timestamp が、受信側の timestamp よりも著しく遅れている（新しい）とファイルが更新されない可能性がある？？ 
        if( timestamp < last_timestamp ){
          await update_file( new_block.block, ledgers_folder + '/' + name );
        }
      }

      resolve( true );
    }
  });
}


//. #66
async function realtime_sync(){
  return new Promise( async ( resolve, reject ) => {
    var config_ids = await list_config();
    //config_ids.forEach( async function( config_id ){ //. #87
    for( var i = 0; i < config_ids.length; i ++ ){
      var config_id = config_ids[i];
      var config = await read_config( config_id );
      //. url が定義されていて、cron が定義されていないものはリアルタイム同期の設定
      if( config && config.url && !config.cron ){
        await sync_request( config_id );
      }
    }

    resolve( true );
  });
}


async function init_hatoya(){
  return new Promise( async ( resolve, reject ) => {
    var items = await read_items( settings_dbname, 0, 0 );
    if( items == null ){
      var r = await create_db( settings_dbname );
      resolve( ( r > 0 ) );
    }else{
      resolve( true );
    }
  });
}

init_hatoya().then( function(){});
  

module.exports = router;
