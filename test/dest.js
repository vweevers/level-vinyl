var test = require('tape')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')
  , concat = require('concat-stream')
  , fromFile = require('vinyl-file')
  , path = require('path')
  , eos = require('end-of-stream')

test.skip('dest resets streams', function(t){
  // TODO
  // "contents will have it's position reset to the beginning if it is a stream"
})

test.skip('dest updates vinyl files', function(t){
  // TODO: "The file will be modified after being written to this stream:
  // cwd, base, and path will be overwritten to match the folder
  // stat.mode will be overwritten if you used a mode parameter"
})

test.skip('dest folder', function(t){
  // TODO: we differ from vinyl-fs here, describe wanted behaviour.

  // vinyl-fs does this:
  // "The write path is calculated by appending the file relative path
  // to the given destination directory. In turn, relative paths are
  // calculated against the file base."

  // also: "options.cwd for the output folder, only has an effect if
  // provided output folder is relative."
})

test.skip('no conflicts between sublevel blobs', function(t){
  // TODO
})

test.skip('should allow piping multiple dests in streaming mode', function(t){
  // TODO
  // re-emits data
})

test.skip('should explode on invalid folder (empty)', function(t){
  // TODO
})

test.skip('path function', function(t) {
  // TODO
  // "a function that returns a path. the function will be provided a vinyl File instance."
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
