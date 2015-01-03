var test = require('tape')
  , Vinyl = require('vinyl')
  , through2 = require('through2')
  , eos = require('end-of-stream')
  , concat = require('concat-stream')
  , create = require('./util-create-db')
  , path = require('path')

test.skip('src with opts.read = false', function(){
  // TODO
})

test.skip('src/dest use the glob base', function(){
  // TODO
})

test.skip('src/dest with opts.base', function(){
  // TODO
})

test.skip('dest() resets streams', function(){
  // TODO
})

test.skip('glob negation', function(){
  // TODO
})

test.skip('stat', function(){
  // TODO
})

test.skip('watch()', function(){
  // TODO
})

test.skip('duplicate files, remove one, blob is kept', function(){
  // TODO
})

test.skip('no conflicts between sublevel blobs', function(){
  // TODO
})

test('put and get', function(t){
  var vinylDb = create()

  var file = new Vinyl({
    path: __dirname+'/testfile',
    contents: new Buffer('foo')
  })

  file.count = 5

  t.plan(7)
  vinylDb.put(file, function(err){
    t.notOk(err)

    // saved as unix path..
    vinylDb.get('test/testfile', function(err, same){
      t.notOk(err)

      // .. but normalized locally
      t.equal(same.relative, path.normalize('test/testfile'))
      t.equal(same.relative, file.relative)
      t.ok(same.contents)
      t.equal(same.count, file.count)

      same.contents.pipe(concat(function(buf){
        t.equal(String(buf), 'foo')
      }))
    })
  })
})

test('src with glob', function(t){
  var vinylDb = create()

  var file = new Vinyl({
    path: __dirname+'/testfile',
    contents: new Buffer('foo')
  })

  t.plan(5)

  vinylDb.put(file, function(err){
    vinylDb.src('test**').pipe(concat(function(files){
      t.equal(files[0] && files[0].relative, file.relative)
    }))

    vinylDb.src('test/testfile').pipe(concat(function(files){
      t.equal(files[0] && files[0].relative, file.relative)
    }))

    vinylDb.src('test\\testfile').pipe(concat(function(files){
      t.equal(files[0] && files[0].relative, file.relative)
    }))

    vinylDb.src('**/*').pipe(concat(function(files){
      t.equal(files[0] && files[0].relative, file.relative)
    }))

    vinylDb.src('no**').pipe(concat(function(files){
      t.equal(files.length, 0)
    }))
  })
})

test('sublevel', function(t){
  var sub = create().subvinyl('foo')

  var file = new Vinyl({
    path: __dirname+'/testfile',
    contents: new Buffer('subsub')
  })

  sub.put(file, function(){
    sub.get('test/testfile', function(err, same){
      t.notOk(err)
      t.end()
    })
  })
})

test('deletes blobs', function(t){
  var db = create()
  var blobs = db.vinylBlobs()
  var file = new Vinyl({
    path: __dirname+'/testfile',
    contents: new Buffer('subsub')
  })

  t.plan(2)
  db.put(file, function(){
    db.get('test/testfile', function(err, same){
      if (err) return t.fail(err)

      blobs.exists({key: same.digest}, function(err, exists){
        t.ok(exists, 'blob exists')
      })

      db.del('test/testfile', function(){
        setTimeout(function(){
          blobs.exists({key: same.digest}, function(err, exists){
            t.notOk(exists, 'blob is deleted')
          })
        }, 300)
      })
    })
  })
})
