// To run:
// `npm i imagemin-jpegtran`
// `node example`

var levelvinyl = require('./')
  , level      = require('level-test')()
  , sublevel   = require('level-sublevel')
  , buffer     = require('vinyl-buffer')
  , imagemin   = require('imagemin-jpegtran')()
  , vfs        = require('vinyl-fs')
  , fromFile   = require('vinyl-file')

// Create database
var db = level();
var sdb = sublevel(db, { valueEncoding: 'json'});
var vinylDb = levelvinyl(sdb, './example/blobs')

// Create a virtual file
var file = fromFile.readSync('example.jpg')

// Save it
vinylDb.put(file, function(){

  // Create a sublevel for minified images
  var min = vinylDb.subvinyl('minified')

  // Minify
  vinylDb.src('*.jpg')
    .pipe(buffer())
    .pipe(imagemin())
    .pipe(min.dest())

    // Copy to actual file
    .pipe(vfs.dest('example/minified'))
})
