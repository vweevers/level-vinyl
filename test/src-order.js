var test = require('tape')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')
  , unixify = require('unixify')
  , through2 = require('through2')

test('order', function(t){
  var vinylDb = create()
    , expectedPaths = { js: [], md: [] }
    , dest = vinylDb.dest()
    , max = 20

  dest.once('finish', function() {
    var i = -1, correct = 0
    var expected = expectedPaths.js.concat(expectedPaths.md)

    vinylDb.src(['*.js', '*.md'], { read: false })
      .pipe(through2.obj(function(file, _, next) {
        if (unixify(file.path, true)===expected[++i]) ++correct
        next()
      })).on('finish', function(err){
        t.equal(correct, max)
        t.end()
      })
  })

  var i = 0

  ;(function write() {
    var ready = true

    while(ready && i<max) {
      var num = pad(i)
        , ext = i++ % 2 ? 'js' : 'md'
        , path = '/a'+num+'.'+ext

      expectedPaths[ext].push(path)
      ready = dest.write(createFile(path, num))
    }

    if (i>=max) return dest.end()
    dest.once('drain', function(){ setImmediate(write) })
  })()
})

function pad(i) {
  var num = ''+i, pad = 5 - num.length
  while (pad--) num = '0'+num
  return num
}
