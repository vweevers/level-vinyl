var test = require('tape')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')
  , concat = require('concat-stream')
  , fromFile = require('vinyl-file')
  , path = require('path')
  , eos = require('end-of-stream')
  , unixify = require('unixify')

test.skip('dest resets streams', function(t){
  // TODO
  // "contents will have it's position reset to the beginning if it is a stream"
})

test.skip('no conflicts between sublevel blobs', function(t){
  // TODO
})

test.skip('should allow piping multiple dests in streaming mode', function(t){
  // TODO
  // re-emits data
})

test('dest path', function(t){
  var vinylDb = create()

  t.plan(6)

  var file1 = createFile('bar', 'text')
  t.equal(unixify(file1.relative), 'test/bar')

  vinylDb.dest('/foo').on('data', function(modified){
    t.equal(unixify(modified.relative), 'foo/test/bar')
  }).end(file1)

  var file2 = createFile('boo/word', 'bam')
  t.equal(unixify(file2.relative), 'test/boo/word')

  vinylDb.dest('foo').on('data', function(modified){
    t.equal(unixify(modified.relative), 'foo/test/boo/word')
  }).end(file2)

  var file3 = createFile('baz', 'hellooo')
  t.equal(unixify(file3.relative), 'test/baz')

  vinylDb.dest().on('data', function(modified){
    t.equal(unixify(modified.relative), 'test/baz')
  }).end(file3)
})

test('path function', function(t) {
  var vinylDb = create()
    , file = createFile('a', 'ok')

  t.plan(2)
  t.equal(unixify(file.relative), 'test/a')

  function p(vinyl) { return 'custom' }

  vinylDb.dest(p).on('data', function(modified){
    t.equal(unixify(modified.relative), 'custom/test/a')
  }).end(file)
})

test('opts.mode', function(t){
  t.plan(1)

  var vinylDb = create()
  fromFile.read(path.join(__dirname, 'fixtures/text.md'), function(err, actual){
    var dest = vinylDb.dest('', {mode: 0455})

    eos(dest, function(){
      vinylDb.src('**').on('data', function(file){
        var stat = file && file.stat
        if (!stat) return t.fail('no stat')
        t.equal(stat.mode & 0777, 0455)
      })
    })

    dest.end(actual)
  })
})

test('default mode is 777', function(t){
  t.plan(1)

  var vinylDb = create()
  fromFile.read(path.join(__dirname, 'fixtures/text.md'), function(err, actual){
    var dest = vinylDb.dest()

    eos(dest, function(){
      vinylDb.src('**').on('data', function(file){
        var stat = file && file.stat
        if (!stat) return t.fail('no stat')
        t.equal(stat.mode & 0777, 0777)
      })
    })

    dest.end(actual)
  })
})

test('should not write null files', function(t){
  var vinylDb = create()
    , file = createFile('foo', null)

  t.plan(2)

  t.ok(file.isNull(), 'isNull')
  vinylDb.put(file, function(){
    vinylDb.get(file.relative, function(err, same){
      t.ok(err, 'no file saved')
    })
  })
})

test('writes buffers and streams', function(t){
  var fixture = path.join(__dirname, 'fixtures/text.md')
    , vinylDb = create()

  t.plan(4)

  fromFile.read(fixture, {buffer: false}, function(err, file1){
    t.ok(file1.isStream(), 'isStream')
    testSave(file1)

    var file2 = createFile('foo', '# text')
    t.ok(file2.isBuffer(), 'isBuffer')
    testSave(file2)
  })

  function testSave(file) {
    vinylDb.put(file, function(){
      vinylDb.get(file.relative, function(err, same){
        same.contents.pipe(concat(function(buf){
          t.equal(String(buf).trim(), '# text', 'file saved')
        }))
      })
    })
  }
})
