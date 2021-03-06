var test = require('tape')
  , Vinyl = require('vinyl')
  , eos = require('end-of-stream')
  , concat = require('concat-stream')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')
  , path = require('path')
  , unixify = require('unixify')
  , fromFile = require('vinyl-file')

test.skip('src should pass through writes', function(t){
  // TODO
})

// should test these, because we use a different glob implementation
test.skip('glob options', function(t){
  t.test('glob matchBase', function(t){
    // If the pattern has no slashes in it, then it will
    // seek for any file anywhere in the tree with a matching basename.
    // For example, *.js would match test/simple/basic.js.
  })

  t.test('glob dotfiles', function(t){
    // dot Include .dot files in normal matches and globstar matches.
    // Note that an explicit dot in a portion of the pattern will always match dot files.
  })

  t.test('glob nobrace', function(t){
    // nobrace Do not expand {a,b} and {1..3} brace sets.
  })

  t.test('glob noglobstar', function(t){
    // noglobstar Do not match ** against multiple filenames. (Ie, treat it as a normal * instead.)
  })

  t.test('glob noext', function(t){
    // noext Do not match +(a|b) "extglob" patterns.
  })

  t.test('glob nonegate', function(t){
    // nonegate Suppress negate behavior.
  })

  t.test('glob nocomment', function(t){
    // nocomment Suppress comment behavior.
  })
})

test('src with glob', function(t){
  var vinylDb = create()
    , file1 = createFile('file1', 'foo')
    , file2 = createFile('file2', 'bar')

  t.plan(12)

  function map(expectedPaths, msg) {
    return concat(function(files) {
      var paths = files.map(function(file){ return file.relative })
      t.deepEqual(paths, expectedPaths, msg)
    })
  }

  var dest = vinylDb.dest()

  dest.on('end', function(err){
    vinylDb.src('**').pipe(map([file1.relative, file2.relative]))
    vinylDb.src('test/*').pipe(map(['file1', 'file2']))
    vinylDb.src('test/file1').pipe(map([file1.relative], 'single file'))
    vinylDb.src('test\\file1').pipe(map([file1.relative], 'unixifies'))
    vinylDb.src('**/*').pipe(map([file1.relative, file2.relative]))
    vinylDb.src('no**').pipe(map([]))

    vinylDb.src('/**').pipe(map([file1.relative, file2.relative]))
    vinylDb.src('/test/*').pipe(map(['file1', 'file2']))
    vinylDb.src('/test/file1').pipe(map([file1.relative], 'single file'))
    vinylDb.src('C:\\test\\file1').pipe(map([file1.relative], 'unixifies'))
    vinylDb.src('/**/*').pipe(map([file1.relative, file2.relative]))
    vinylDb.src('/no**').pipe(map([]))
  })

  dest.write(file1)
  dest.end(file2)
})

test('glob negation', function(t){
  var vinylDb = create()
    , file1 = createFile('test-document', 'doc')
    , file2 = createFile('test-image', 'img')
    , ws = vinylDb.dest()

  t.plan(2)

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

test('glob a directory', function(t){
  var vinylDb = create()
    , file1 = createFile('img/test.jpg', 'foo')
    , file2 = createFile('img/foo/test.png', 'hello')
    , file3 = createFile('other/test', 'beep')
    , ws = vinylDb.dest()

  t.plan(4)

  eos(ws, function(err){
    vinylDb.src('test/img/').pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[1], file2 = files[0]

      // t.equal(file1.base, file1.cwd)
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
    , file1 = createFile('img/test.jpg', 'foo')
    , file2 = createFile('docs/foo/test.md', 'hello')
    , ws = vinylDb.dest()

  t.plan(4)

  eos(ws, function(err){
    var opts = { base: '/test' } // TODO: test relative base
    vinylDb.src(['test/img/*.jpg', 'test/**/*.md'], opts).pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[0], file2 = files[1]

      t.equal(file1.base, path.normalize('/test'), 'base')
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
    , file1 = createFile('img/test.jpg', 'foo')
    , file2 = createFile('docs/foo/test.md', 'hello')
    , ws = vinylDb.dest()

  t.plan(4)

  eos(ws, function(err){
    vinylDb.src(['test/img/*.jpg', 'test/**/*.md']).pipe(concat(function(files){
      if (files.length!==2) return t.fail()
      var file1 = files[0], file2 = files[1]

      t.equal(file1.base, path.normalize('/test/img'), 'base')
      t.equal(file1.relative, 'test.jpg', 'relative')

      t.equal(file2.base, path.normalize('/test'), 'base')
      t.equal(unixify(file2.relative), 'docs/foo/test.md', 'relative')
    }))
  })

  ws.write(file1)
  ws.end(file2)
})

test('src with opts.read = false', function(t){
  var vinylDb = create()
    , file = createFile('testfile', 'foo')

  t.plan(1)

  vinylDb.put(file, function(err){
    vinylDb.src('**', { read: false }).pipe(concat(function(files){
      t.ok(files[0] && files[0].isNull(), 'is null')
    }))
  })
})

test('src with opts.since', function(t){
  var vinylDb = create()
  var file1 = createFile('file1', 'one', { stat: { mtime: '1980-01-01' } })
  var file2 = createFile('file2', 'two', { stat: { mtime: new Date } })

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

test('dead stream if globs is empty array', function(t){
  var vinylDb = create()
  var file1 = createFile('img/test.jpg', 'foo')

  t.plan(1)
  vinylDb.put(file1, function(){
    vinylDb.src([]).pipe(concat(function(files){
      t.equal(files.length, 0)
    }))
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

test('streams regular files', function(t){
  t.plan(1)

  var constants = process.binding('constants')
    , S_IFMT = constants.S_IFMT   // bit mask for the file type bit fields
    , S_IFREG = constants.S_IFREG // regular file

  var vinylDb = create()
  fromFile.read(path.join(__dirname, 'fixtures/text.md'), function(err, actual){
    var dest = vinylDb.dest()

    eos(dest, function(){
      vinylDb.src('**').on('data', function(file){
        var stat = file && file.stat
        if (!stat) return t.fail('no stat')
        t.equal(stat.mode & S_IFMT, S_IFREG)
      })
    })

    dest.end(actual)
  })
})
