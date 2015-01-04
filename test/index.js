var test = require('tape')
  , Vinyl = require('vinyl')
  , through2 = require('through2')
  , eos = require('end-of-stream')
  , concat = require('concat-stream')
  , create = require('./util-create-db')
  , path = require('path')
  , unixify = require('unixify')
  , fromFile = require('vinyl-file')

test.skip('dest() resets streams', function(){
  // TODO
})

test.skip('watch()', function(){
  // TODO
})

test.skip('no conflicts between sublevel blobs', function(){
  // TODO
})

test.skip('src should pass through writes', function(t){})

test('src with opts.since', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/file1',
    contents: new Buffer('one'),
    stat: { mtime: new Date('1980-01-01') }
  })

  var file2 = new Vinyl({
    path: __dirname+'/file2',
    contents: new Buffer('two'),
    stat: { mtime: new Date }
  })

  t.plan(1)

  var ws = vinylDb.dest()

  eos(ws, function(err){
    var opts = { since: new Date('1990-01-01') }
    vinylDb.src('**', opts).pipe(concat(function(files){
      if (files.length!==1) return t.fail()
      t.equal(files[0].relative, file2.relative)
    }))
  })

  ws.write(file1)
  ws.end(file2)
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
    var file = new Vinyl({
      path: __dirname+'/img/test.jpg',
      contents: new Buffer('foo')
    })

    t.plan(7)
    vinylDb.put(file, function(){
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
          vinylDb.put(file, function(){
            var ctime2 = file.stat.ctime.getTime()
              , mtime2 = file.stat.mtime.getTime()

            t.ok(ctime<ctime2, 'ctime changed')
            t.equal(mtime, mtime2, 'mtime unchanged')

            file.contents = new Buffer('baz')

            vinylDb.put(file, function(){
              var ctime3 = file.stat.ctime.getTime()
                , mtime3 = file.stat.mtime.getTime()

              t.ok(ctime2<ctime3, 'ctime changed')
              t.ok(mtime2<mtime3, 'mtime changed after content change')
            })
          })
        }, 1)
      }))
    })
  })
})

test('throws on invalid glob', function(t){
  var vinylDb = create()

  t.throws(vinylDb.src, 'no arguments')
  t.throws(vinylDb.src.bind(vinylDb, 123), 'number')
  t.throws(vinylDb.src.bind(vinylDb, ''), 'empty string')
  t.throws(vinylDb.src.bind(vinylDb, null), 'null')
  t.throws(vinylDb.src.bind(vinylDb, [123]), 'array with number')
  t.throws(vinylDb.src.bind(vinylDb, [null]), 'array with null')
  t.end()
})

test('dead stream if globs is empty array', function(t){
  var vinylDb = create()
  var file1 = new Vinyl({
    path: __dirname+'/img/test.jpg',
    contents: new Buffer('foo')
  })

  t.plan(1)
  vinylDb.put(file1, function(){
    vinylDb.src([]).pipe(concat(function(files){
      t.equal(files.length, 0)
    }))
  })
})

test('glob a directory', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/img/test.jpg',
    contents: new Buffer('foo')
  })

  var file2 = new Vinyl({
    path: __dirname+'/img/foo/test.png',
    contents: new Buffer('hello')
  })

  var file3 = new Vinyl({
    path: __dirname+'/other/test',
    contents: new Buffer('beep')
  })

  t.plan(5)

  var ws = vinylDb.dest()

  eos(ws, function(err){
    vinylDb.src('test/img/').pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[1], file2 = files[0]

      t.equal(file1.base, file1.cwd)
      t.equal(file1.base, file2.base)
      t.equal(unixify(file1.relative), 'test/img/test.jpg')
      t.equal(unixify(file2.relative), 'test/img/foo/test.png')
    }))

    vinylDb.src('test/img').pipe(concat(function(files){
      t.equal(files.length, 0, 'not without slash')
    }))
  })

  ws.write(file1)
  ws.write(file2)
  ws.end(file3)
})

test('src with opts.base', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/img/test.jpg',
    contents: new Buffer('foo')
  })

  var file2 = new Vinyl({
    path: __dirname+'/docs/foo/test.md',
    contents: new Buffer('hello')
  })

  t.plan(4)

  var ws = vinylDb.dest()

  eos(ws, function(err){
    var opts = { base: 'test' }
    vinylDb.src(['test/img/*.jpg', 'test/**/*.md'], opts).pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[0], file2 = files[1]

      t.equal(file1.base, path.resolve(file1.cwd, 'test'))
      t.equal(file1.base, file2.base)
      t.equal(unixify(file1.relative), 'img/test.jpg')
      t.equal(unixify(file2.relative), 'docs/foo/test.md')
    }))
  })

  ws.write(file1)
  ws.end(file2)
})

test('src glob sets base', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/img/test.jpg',
    contents: new Buffer('foo')
  })

  var file2 = new Vinyl({
    path: __dirname+'/docs/foo/test.md',
    contents: new Buffer('hello')
  })

  t.plan(4)

  var ws = vinylDb.dest()

  eos(ws, function(err){
    vinylDb.src(['test/img/*.jpg', 'test/**/*.md']).pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[0], file2 = files[1]

      t.equal(file1.base, path.resolve(file1.cwd, 'test/img'))
      t.equal(file1.relative, 'test.jpg')

      t.equal(file2.base, path.resolve(file2.cwd, 'test'))
      t.equal(unixify(file2.relative), 'docs/foo/test.md')
    }))
  })

  ws.write(file1)
  ws.end(file2)
})

test('src with opts.read = false', function(t){
  var vinylDb = create()

  var file = new Vinyl({
    path: __dirname+'/testfile',
    contents: new Buffer('foo')
  })

  t.plan(1)

  vinylDb.put(file, function(err){
    vinylDb.src('test**', { read: false}).pipe(concat(function(files){
      t.ok(files[0] && files[0].isNull(), 'is null')
    }))
  })
})

test('glob negation', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/test-document',
    contents: new Buffer('doc')
  })

  var file2 = new Vinyl({
    path: __dirname+'/test-image',
    contents: new Buffer('img')
  })

  t.plan(2)

  var ws = vinylDb.dest()

  eos(ws, function(err){
    vinylDb.src('**/test-*', { read: false}).pipe(concat(function(files){
      var paths = files.map(function(f){ return unixify(f.relative) })
      t.deepEqual(paths, ['test/test-document', 'test/test-image'])
    }))
    vinylDb.src(['**/test-*', '!**image'], { read: false}).pipe(concat(function(files){
      var paths = files.map(function(f){ return unixify(f.relative) })
      t.deepEqual(paths, ['test/test-document'])
    }))
  })

  ws.write(file1)
  ws.end(file2)
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

test('duplicate files, remove one, blob is kept', function(t){
  var vinylDb = create()

  var file1 = new Vinyl({
    path: __dirname+'/test1',
    contents: new Buffer('img')
  })

  var file2 = new Vinyl({
    path: __dirname+'/test2',
    contents: new Buffer('img')
  })

  t.plan(5)

  var ws = vinylDb.dest()
    , blobs = vinylDb.vinylBlobs()

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
