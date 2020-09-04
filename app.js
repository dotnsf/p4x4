// app.js
var basicAuth = require( 'basic-auth-connect' );
var express = require( 'express' );
var ejs = require( 'ejs' );
var fs = require( 'fs' );
var http = require( 'http' );
var https = require( 'https' );
var i18n = require( 'i18n' );
var app = express();

var http = require( 'http' ).createServer( app );
var io = require( 'socket.io' ).listen( http );

var settings = require( './settings' );
//. #45
var settings_port = 'PORT' in process.env ? process.env.PORT : settings.port;
var settings_basic_username = 'BASIC_USERNAME' in process.env ? process.env.BASIC_USERNAME : settings.basic_username;
var settings_basic_password = 'BASIC_PASSWORD' in process.env ? process.env.BASIC_PASSWORD : settings.basic_password;
var settings_ssl_key = 'SSL_KEY' in process.env ? process.env.SSL_KEY : settings.ssl_key;
var settings_ssl_cert = 'SSL_CERT' in process.env ? process.env.SSL_CERT : settings.ssl_cert;
var settings_ssl_ca = 'SSL_CA' in process.env ? process.env.SSL_CA : settings.ssl_ca;
var settings_cors_allow_origin = 'CORS_ALLOW_ORIGIN' in process.env ? process.env.CORS_ALLOW_ORIGIN : settings.cors_allow_origin;

app.use( express.static( __dirname + '/public' ) );
app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

//. i18n
i18n.configure({
  locales: ['ja', 'en'],
  directory: __dirname + '/locales'
});
app.use( i18n.init );

//. #68
if( settings_cors_allow_origin ){
  var allow_cross_origin = function( req, res, next ){
    res.header( 'Access-Control-Allow-Origin', settings_cors_allow_origin );
    res.header( 'Access-Control-Allow-Method', 'GET,PUT,POST,DELETE' );
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, access_token' 
    );

    if( 'OPTIONS' === req.method ){
      res.send( 200 );
    }else{
      next();
    }
  }

  app.use( allow_cross_origin );
}

var api = require( './api/api' );
app.use( '/api', api );


//. #43, #65
if( settings_basic_username && settings_basic_password ){
  app.all( '/*', basicAuth( function( user, pass ){
    return ( settings_basic_username === user && settings_basic_password === pass );
  }));
}


app.post( '/setcookie', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var value = req.body.value;
  //console.log( 'value = ' + value );
  res.setHeader( 'Set-Cookie', value );

  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});


app.get( '/screen', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  res.render( 'screen', { name: name, room: room, intervalms: 1000 } );
});

app.get( '/view', function( req, res ){
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var columns = req.query.columns;
  if( columns ){
    columns = parseInt( columns );
  }else{
    columns = settings.defaultcolumns;
  }
  var dbname = req.query.dbname;
  if( !dbname ){ dbname = settings.dbname; }
  res.render( 'view', { room: room, columns: columns, dbname: dbname } );
});


//. socket.io
var view_sockets = {};
io.sockets.on( 'connection', function( socket ){
  //console.log( 'connected.' );

  //. 一覧画面の初期化時
  socket.on( 'init_view', function( msg ){
    //console.log( 'init_view' );
    var room = msg.room ? msg.room : settings.defaultroom;

    var ts = ( new Date() ).getTime();
    if( !view_sockets[room] ){
      view_sockets[room] = { socket: socket, timestamp: ts };
    }else{
      //. expired の判断はしないことにする
      //if( view_sockets[room].timestamp + ( 10 * 60 * 60 * 1000 ) < ts ){ //. 10 hours
        view_sockets[room] = { socket: socket, timestamp: ts };
      //}else{
      //  console.log( 'Room: "' + room + '" is not expired yet.' );
      //}
    }
    //console.log( view_socket );
  });

  //. 初期化時（ロード後の最初の resized 時）
  socket.on( 'init_client', function( msg ){
    //. msg 内の情報を使って初期化
    //console.log( 'init_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'init_client_view', msg );
    }
  });

  //. 描画イベント時（ウェイトをかけるべき？）
  socket.on( 'image_client', function( msg ){
    //. evt 内の情報を使って描画
    //console.log( 'image_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'image_client_view', msg );
    }
  });

  socket.on( 'start_client', function( msg ){
    msg.socket_id = socket.id;
    var room = msg.room ? msg.room : settings.defaultroom;
    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'start_client_view', msg );
    }
  });

  socket.on( 'goal_client', function( msg ){
    msg.socket_id = socket.id;
    var room = msg.room ? msg.room : settings.defaultroom;
    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'goal_client_view', msg );
    }
  });
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


//. HTTP or HTTPS
http.listen( settings_port );
console.log( 'server started on ' + settings_port + " ..." );

