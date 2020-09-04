//. hatoya.js
var hatoya_token = null;  //. #99

async function listDbs(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/dbs',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function createDb( db ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/' + db,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function deleteDb( db ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'DELETE',
      url: '/api/' + db,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function listConfigs(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/configs',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function createConfig( config ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/config/',
      data: config,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function readConfig( id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/config/' + id,
      data: item,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function updateConfig( config, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'PUT',
      url: '/api/config/' + id,
      data: config,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function deleteConfig( id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'DELETE',
      url: '/api/config/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function listItems( db ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/' + db,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function createItem( db, item ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/' + db + '/new',
      data: item,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function createFile( db, file_id ){
  return new Promise( async ( resolve, reject ) => {
    var fd = new FormData();
    fd.append( "file", $("#"+file_id).prop("files")[0] );
    $.ajax({
      type: 'POST',
      url: '/api/' + db + '/attach',
      dataType: "text",
      data: fd,
      processData: false,
      contentType: false,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function createItems( db, items ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/' + db + '/bulk',
      data: items,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function readItem( db, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/' + db + '/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function readFile( db, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/' + db + '/attach/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function updateItem( db, item, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/' + db + '/' + id,
      data: item,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function updateFile( db, id, file_id ){
  return new Promise( async ( resolve, reject ) => {
    var fd = new FormData();
    fd.append( "file", $("#"+file_id).prop("files")[0] );
    $.ajax({
      type: 'PUT',
      url: '/api/' + db + '/attach/' + id,
      dataType: "text",
      data: fd,
      processData: false,
      contentType: false,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function updateItems( db, items ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'PUT',
      url: '/api/' + db + '/bulk',
      data: items,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function deleteItem( db, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'DELETE',
      url: '/api/' + db + '/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function deleteFile( db, id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'DELETE',
      url: '/api/' + db + '/attach/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function deleteItems( db, ids ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'DELETE',
      url: '/api/' + db + '/bulk',
      data: ids,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function getLedgers(){
  return new Promise( async ( resolve, reject ) => {
    var obj = await readServerId();
    if( obj && obj.serverid ){
      $.ajax({
        type: 'GET',
        url: '/api/ledgers',
        headers: {
          'x-access-token': hatoya_token,
          'serverid': obj.serverid
        },
        success: function( result ){
          resolve( result );
        },
        error: function( e ){
          resolve( null );
        }
      });
    }else{
      resolve( null );
    }
  });
}

/* #78
async function validate(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/validate',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}
*/

/* #77
async function reorg(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/reorg',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}
*/

/* #105
async function singlenode_reorg(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/singlenode_reorg',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}
*/

/* #73
async function sync( id ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'POST',
      url: '/api/sync/' + id,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}
*/

async function getToken(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/token',
      success: function( result ){
        if( result && result.status && result.token ){
          hatoya_token = result.token;
          resolve( result.token );
        }else{
          resolve( null );
        }
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

function showToken(){
  console.log( 'token = ' + hatoya_token );
}

async function readServerId(){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/serverid',
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

async function downloadServerId(){
  return new Promise( async ( resolve, reject ) => {
    var obj = await readServerId();
    if( obj && obj.serverid ){
      $.ajax({
        type: 'GET',
        url: '/api/serveridfile',
        headers: {
          'x-access-token': hatoya_token,
          'serverid': obj.serverid
        },
        success: function( result ){
          console.log( result );
          resolve( result );
        },
        error: function( e ){
          resolve( null );
        }
      });
    }
   });
}

async function uploadServerId( file_id ){
  return new Promise( async ( resolve, reject ) => {
    var obj = await readServerId();
    if( obj && obj.serverid ){
      var fd = new FormData();
      fd.append( "file", $("#"+file_id).prop("files")[0] );
      $.ajax({
        type: 'POST',
        url: '/api/serveridfile',
        headers: {
          'x-access-token': hatoya_token,
          'serverid': obj.serverid
        },
        dataType: "text",
        data: fd,
        processData: false,
        contentType: false,
        success: function( result ){
          resolve( result );
        },
        error: function( e ){
          resolve( null );
        }
      });
    }
  });
}

async function search( db, text ){
  return new Promise( async ( resolve, reject ) => {
    $.ajax({
      type: 'GET',
      url: '/api/' + db + '/search/' + text,
      headers: {
        'x-access-token': hatoya_token
      },
      success: function( result ){
        resolve( result );
      },
      error: function( e ){
        resolve( null );
      }
    });
  });
}

