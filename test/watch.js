var test = require('tape')
  , create = require('./utils/create-db')
  , createFile = require('./utils/create-file')

test('basic watch', function(t){
  var vinylDb = create()
    , a = createFile('a', '')
    , b = createFile('b', '')

  t.plan(4)

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

  var dest = vinylDb.dest()
  dest.write(a)
  dest.end(b)
})
