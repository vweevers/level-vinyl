var test = require('tape')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')

test('emits `changed` and `nomatch`', function(t){
  var vinylDb = create()
    , a = createFile('a', '')
    , b = createFile('b', '')

  t.plan(7)

  vinylDb.watch(['**', '!**/b'], function(change){
    t.deepEqual(change, {type: 'changed', path: '/test/a'}, 'negation')
  })

  vinylDb.watch('/test/a', function(change){
    t.deepEqual(change, {type: 'changed', path: '/test/a'}, 'file path')
  })

  vinylDb.watch('**/b', function(change){
    t.deepEqual(change, {type: 'changed', path: '/test/b'}, 'globstar')
  })

  vinylDb.watch(function(change){
    t.deepEqual(change, {type: 'changed', path: '/test/b'}, 'globstar via add')
  }).add('**/b')

  vinylDb.watch('**', function(change){
    t.deepEqual(change, {type: 'changed', path: '/test/b'}, 'filter via remove()')
  }).remove('**/a')

  vinylDb.watch('/does-not-exist').on('nomatch', function(path){
    t.ok(path=='/test/a' || path=='/test/b', 'emits nomatch')
  })

  var dest = vinylDb.dest()
  dest.write(a)
  dest.end(b)
})

test('emits `deleted` event', function(t){
  var vinylDb = create()
    , a = createFile('a', '')
    , b = createFile('b', '')

  t.plan(4)

  var dest = vinylDb.dest()

  dest.on('finish', function(){
    vinylDb.watch(['**'], function(change){
      t.ok(change.path=='/test/a' || change.path=='/test/b')
    })

    vinylDb.watch(['**', '!**/b'], function(change){
      t.deepEqual(change, {type: 'deleted', path: '/test/a'}, 'negation')
    })

    vinylDb.watch('/test/a', function(change){
      t.deepEqual(change, {type: 'deleted', path: '/test/a'}, 'file path')
    })

    vinylDb.del('/test/a')
    vinylDb.del('/test/b')
  })

  dest.write(a)
  dest.end(b)
})

test('args', function(t){
  var vinylDb = create()

  t.test('options.debounce', function(t) {
    t.plan(3)

    vinylDb.watch('/test/a', function(change){
      t.deepEqual(change, {type: 'deleted', path: '/test/a'}, 'debounces by default')
    })

    var dest = vinylDb.dest()
    dest.on('finish', vinylDb.del.bind(vinylDb, '/test/a'))
    dest.end(createFile('a', 'foobar'))

    var opts = { debounceDelay: 0 }
    vinylDb.watch('/test/b', opts, function(change){
      t.equal(change.path, '/test/b', 'debounce disabled')
    })

    var dest2 = vinylDb.dest()
    dest2.on('finish', vinylDb.del.bind(vinylDb, '/test/b'))
    dest2.end(createFile('b', 'foobaz'))
  })

  t.test('options.maxListeners', function(t){
    var emitter = vinylDb.watch('/does/not/matter', {maxListeners: 0})
    for(var i=0; i<15; i++) emitter.on('change', function(){})
    t.ok(true) // nodejs only prints a warning
    t.end()
  })

  t.test('does nothing if `patterns` is empty', function(t){
    vinylDb.watch([], function(change){ t.fail() })
    vinylDb.put(createFile('random', 'fooz'), function(){
      process.nextTick(t.end.bind(t))
    })
  })

  t.test('watch with cb and listener', function(t){
    var a = createFile('a2', '')

    t.plan(2)

    vinylDb.watch('/test/a2', function(change){
      t.deepEqual(change, {type: 'changed', path: '/test/a2'}, 'with cb')
    }).on('change', function(change){
      t.deepEqual(change, {type: 'changed', path: '/test/a2'}, 'with listener')
    })

    vinylDb.dest().end(a)
  })
})

test('watch().end', function(t){
  var vinylDb = create()
    , a = createFile('a', '')
    , b = createFile('b', '')
    , changes = []

  t.plan(2)

  var emitter = vinylDb.watch('**', {debounceDelay: 0}, function(change){
    changes.push(change)
  })

  emitter.on('end', function(){
    t.ok(true, 'emits `end`')
  })

  vinylDb.put(a, function(){
    process.nextTick(function(){
      emitter.end()
      vinylDb.put(b, function(){
        process.nextTick(function(){
          t.deepEqual(changes, [{type: 'changed', path: '/test/a'}], 'unhooked')
        })
      })
    })
  })
})
