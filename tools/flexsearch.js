//. flexsearch.js
var FlexSearch = require( 'flexsearch' );

var docs = [
  {
    id: 1,
    title: 'あいうえお',
    text: 'aiueo あいうえお アイウエオ',
    category: 'c1'
  },
  {
    id: 2,
    title: 'かきくけこ',
    text: 'kakikukeko かきくけこ カキクケコ',
    category: 'c1'
  },
  {
    id: 3,
    title: 'さしすせそ',
    text: 'sashisusesoさしすせそサシスセソ',
    category: 'c2'
  },
  {
    id: 4,
    title: 'たちつてと',
    text: 'tachitsuteto たちつてと タチツテト',
    category: 'c3'
  },
  {
    id: 5,
    title: 'なにぬねの',
    text: 'naninuneno なにぬねの ナニヌネノ',
    category: 'c2'
  }
];

var index = FlexSearch.create({
  encode: false,
  tokenize: function( str ){
    return str.replace( /[0x80-0x7F]/g, "" ).split( "" );
  }
});

docs.forEach( function( doc ){
  var str = JSON.stringify( doc );
  index.add( doc.id, str );
});

var results0 = index.search( 'aiueo' );
console.log( results0 );
var results1 = index.search( 'タチツテト' );
console.log( results1 );
var results2 = index.search( 'ナニ' );
console.log( results2 );
var results3 = index.search( 'サシスセソ' );
console.log( results3 );
var results4 = index.search( 'title' );
console.log( results4 );
var results5 = index.search( 'あいうえこ' );
console.log( results5 );
