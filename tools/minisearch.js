//. minisearch.js
var MiniSearch = require( 'minisearch' );

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

var miniSearch = new MiniSearch({
  fields: [ 'title', 'text' ],
  storeFields: [ 'title', 'category' ]
});

miniSearch.addAll( docs );
var results0 = miniSearch.search( 'aiueo' );
console.log( results0 );
var results1 = miniSearch.search( 'タチツテト' );
console.log( results1 );
var results2 = miniSearch.search( 'ナニ' );
console.log( results2 );
var results3 = miniSearch.search( 'サシスセソ' );
console.log( results3 );
