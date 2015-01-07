var test = require('tape')
  , Vinyl = require('vinyl')
  , eos = require('end-of-stream')
  , concat = require('concat-stream')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')
  , path = require('path')
  , unixify = require('unixify')
  , fromFile = require('vinyl-file')

test('put and get', function(t){
  var vinylDb = create()
    , file = createFile('testfile', 'foo')

  // custom property
  file.count = 5

  t.plan(7)
  vinylDb.put(file, function(err){
    t.notOk(err)

    // saved as unix path..
    vinylDb.get('/test/testfile', function(err, same){
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

test('sublevel', function(t){
  var sub = create().subvinyl('foo')
    , file = createFile('testfile', 'subsub')

  sub.put(file, function(){
    sub.get('/test/testfile', function(err, file){
      t.ok(file)
      t.end()
    })
  })
})

test('stat', function(t){
  var vinylDb = create()

  t.test('stat is copied', function(t){
    t.plan(3)
    fromFile.read(path.join(__dirname, 'fixtures/text.md'), function(err, actual){
      vinylDb.put(actual, function(){
        vinylDb.src('**/*.md').pipe(concat(function(files){
          var file = files[0], stat = file && file.stat
          if (!stat) return t.fail()

          t.equal(stat.isFile(), true, 'is a file')
          t.ok(stat.ctime.getTime() >= actual.stat.ctime.getTime(), 'has ctime')
          t.equal(stat.mtime.getTime(), actual.stat.mtime.getTime(), 'mtime copied')
        }))
      })
    })
  })

  t.test('stat is created and updated', function(t){
    var file1 = createFile('img/test.jpg', 'foo')

    t.plan(7)
    vinylDb.put(file1, function(){
      vinylDb.src('**/*.jpg').pipe(concat(function(files){
        var file = files[0], stat = file && file.stat
        if (!stat) return t.fail()

        t.equal(stat.isFile(), true, 'is a file')

        var now = Date.now()
          , ctime = stat.ctime.getTime()
          , mtime = stat.mtime.getTime()

        t.ok(ctime <= now, 'has ctime Date')
        t.ok(mtime <= now, 'has mtime Date')

        setTimeout(function(){
          vinylDb.dest().on('data', function(file) {
            var ctime2 = file.stat.ctime.getTime()
              , mtime2 = file.stat.mtime.getTime()

            t.ok(ctime<ctime2, 'ctime changed')
            t.equal(mtime, mtime2, 'mtime unchanged')

            file.contents = new Buffer('baz')

            setTimeout(function(){
              vinylDb.put(file, function(err, file){
                var ctime3 = file.stat.ctime.getTime()
                  , mtime3 = file.stat.mtime.getTime()

                t.ok(ctime2<ctime3, 'ctime changed')
                t.ok(mtime2<mtime3, 'mtime changed after content change')
              })
            }, 2)
          }).end(file)
        }, 2)
      }))
    })
  })
})

test('deletes blobs', function(t){
  var db = create()
    , blobs = db.getBlobStore()
    , file = createFile('testfile', 'bloob')

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

test('duplicate files, remove one, blob is kept', function(t){
  var vinylDb = create()
    , file1 = createFile('test1', 'img')
    , file2 = createFile('test2', 'img')
    , ws = vinylDb.dest()
    , blobs = vinylDb.getBlobStore()

  t.plan(5)

  eos(ws, function(err){
    t.equal(file1.digest, file2.digest, 'same digest')

    blobs.exists({key: file1.digest}, function(err, exists){
      t.ok(exists, 'blob exists')
    })

    vinylDb.src('**', { read: false}).pipe(concat(function(files){
      var paths = files.map(function(f){ return unixify(f.relative) })
      t.deepEqual(paths, ['test/test1', 'test/test2'])

      vinylDb.del(file1, function(err){
        t.notOk(err)

        setTimeout(function(){
          blobs.exists({key: file2.digest}, function(err, exists){
            t.ok(exists, 'blob still exists')
          })
        }, 300)
      })
    }))
  })

  ws.write(file1)
  ws.end(file2)
})
