//. api.spec.js
var request = require( 'supertest' );
var chai = require( 'chai' );
var app = require( '../app' );

chai.should();

/*
//. initial ledgers
describe( 'GET /api/ledgers', function(){
  it( 'should be blank array', async function(){
    var result = await request( app ).get( '/api/ledgers' );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});
*/

//. db for this test
var dt = new Date();
var db = '_test_db_' + dt.getTime();

//. initialize db
describe( 'GET /api/' + db, function(){
  it( 'should be empty', async function(){
    var result = await request( app ).get( '/api/' + db );
    result.statusCode.should.equal( 400 );
    result.body.status.should.equal( false );
  });
});

describe( 'POST /api/' + db, function(){
  it( 'should succeed', async function(){
    var result = await await request( app ).post( '/api/' + db );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

describe( 'GET /api/' + db, function(){
  it( 'should exist', async function(){
    var result = await request( app ).get( '/api/' + db );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

//. crud item
var item_id = null;
describe( 'POST /api/' + db + '/', function(){
  it( 'should succeed', async function(){
    //. '/api/db/new' にリクエスト
    var result = await request( app ).post( '/api/' + db + '/new' ).send( { name: "K.Kimura", age: 51 } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    item_id = result.body.id;
  });
});

describe( 'GET /api/' + db + '/(item_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/' + item_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.item.age.should.equal( 51 );
  });
});

describe( 'POST /api/' + db + '/(item_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).post( '/api/' + db + '/' + item_id ).send( { name: "Kei KIMURA", age: 52 } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.id.should.equal( item_id );
  });
});

describe( 'GET /api/' + db + '/(item_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/' + item_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.item.age.should.equal( 52 );
  });
});

describe( 'DELETE /api/' + db + '/(item_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).delete( '/api/' + db + '/' + item_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

//. search
var item1_id = null;
describe( 'POST /api/' + db + '/', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).post( '/api/' + db + '/new' ).send( { text: "あいうえおかきくけこ" } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    item1_id = result.body.id;
  });
});

var item2_id = null;
describe( 'POST /api/' + db + '/', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).post( '/api/' + db + '/new' ).send( { text: "ABCDE fghij" } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    item2_id = result.body.id;
  });
});

var item3_id = null;
describe( 'POST /api/' + db + '/', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).post( '/api/' + db + '/new' ).send( { text: "12345 ６７８９０" } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    item3_id = result.body.id;
  });
});

describe( 'GET /api/' + db + '/search/うえ', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/search/' + encodeURI('うえ') );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.ids.indexOf( item1_id ).should.equal( 0 );
  });
});

describe( 'GET /api/' + db + '/search/ABCDE', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/search/ABCDE' );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.ids.indexOf( item2_id ).should.equal( 0 );
  });
});

describe( 'GET /api/' + db + '/search/45', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/search/45' );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.ids.indexOf( item3_id ).should.equal( 0 );
  });
});

describe( 'GET /api/' + db + '/search/６７', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/' + db + '/search/' + encodeURI('６７') );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.ids.indexOf( item3_id ).should.equal( 0 );
  });
});

//. finalize db
describe( 'DELETE /api/' + db, function(){
  it( 'should succeeded', async function(){
    var result = await await request( app ).delete( '/api/' + db );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

describe( 'GET /api/' + db, function(){
  it( 'should be empty', async function(){
    var result = await request( app ).get( '/api/' + db );
    result.statusCode.should.equal( 400 );
    result.body.status.should.equal( false );
  });
});

//. crud config
var config_id = null;
describe( 'POST /api/config', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).post( '/api/config' ).send( { name: "_test_config_", remote_addr: '192.168.0.1', url: 'http://192.168.0.2:4126' } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    config_id = result.body.id;
  });
});

describe( 'GET /api/config/(config_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/config/' + config_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

describe( 'PUT /api/config/(config_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).put( '/api/config/' + config_id ).send( { name: "_test_config_", remote_addr: '192.168.0.3', url: 'http://192.168.0.4:4126' } );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
    result.body.id.should.equal( '' + config_id );
  });
});

describe( 'GET /api/config/(config_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).get( '/api/config/' + config_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

describe( 'DELETE /api/config/(config_id)', function(){
  it( 'should succeed', async function(){
    var result = await request( app ).delete( '/api/config/' + config_id );
    result.statusCode.should.equal( 200 );
    result.body.status.should.equal( true );
  });
});

describe( 'GET /api/config/(config_id)', function(){
  it( 'should fail', async function(){
    var result = await request( app ).get( '/api/config/' + config_id );
    result.statusCode.should.equal( 400 );
    result.body.status.should.equal( false );
  });
});
