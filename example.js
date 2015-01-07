// To run, install devDependencies plus `imagemin-jpegtran`

var levelvinyl = require('./')
  , level      = require('level-test')()
  , sublevel   = require('level-sublevel')
  , buffer     = require('vinyl-buffer')
  , imagemin   = require('imagemin-jpegtran')()
  , vfs        = require('vinyl-fs')

// Create database
var db = level();
var sdb = sublevel(db, { valueEncoding: 'json'});
var vinylDb = levelvinyl(sdb, './example/blobs')

// Create a sublevel for minified images
var min  = vinylDb.subvinyl('minified').dest('/')
var main = vinylDb.dest('/')

vfs.src('*.jpg')     // file.contents is a buffer
  .pipe(main)        // save to db
  .pipe(imagemin())  // minify
  .pipe(min)         // save minified to db
  .on('end', reversed)

function reversed() {
  // Same thing, other way around
  var min  = vfs.dest('./example/minified')
  var main = vfs.dest('./example')

  vinylDb.src('*.jpg') // file.contents is a stream
    .pipe(main)        // copy to fs
    .pipe(buffer())    // imagemin wants buffers
    .pipe(imagemin())  // minify
    .pipe(min)         // copy minified to fs
    .on('end', verify)
}

function verify() {
  console.log('verifying that this example works..\n')

  var fs = require('fs')

  fs.exists('./example/example.jpg', function(exists){
    log('fs', './example/example.jpg', exists)
  })

  fs.exists('./example/minified/example.jpg', function(exists){
    log('fs', './example/minified/example.jpg', exists)
  })

  vinylDb.get('/example.jpg', function(err, file){
    log('db', '/example.jpg', !!file)
    file && vinylDb.getBlobStore().exists({key: file.digest}, function(err, exists){
      log('blobs', file.digest.slice(0,10)+'..', exists)
    })
  })

  var min = vinylDb.subvinyl('minified')
  min.get('/example.jpg', function(err, file){
    log('minified sublevel', '/example.jpg', !!file)
    file && min.getBlobStore().exists({key: file.digest}, function(err, exists){
      log('minified blobs', file.digest.slice(0,10)+'..', exists)
    })
  })

  function log(store, subject, exists) {
    if (exists) console.log('ok. %s has "%s"', store, subject)
    else console.log('not ok! %s does not have "%s"', store, subject)
  }
}
