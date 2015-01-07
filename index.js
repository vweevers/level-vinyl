var through2   = require('through2')
  , BlobStore  = require('content-addressable-blob-store')
  , xtend      = require('xtend')
  , path       = require('path')
  , index      = require('level-map-index')
  , dest       = require('./lib/dest')
  , watch      = require('./lib/watch')
  , encoder    = require('./lib/encoder')
  , globStream = require('level-glob')
  , absolute   = require('absolute-glob')

var readDefaults = { read: true }

module.exports = levelVinyl

function levelVinyl(db, opts) {
  opts = typeof opts == 'string' ? { path: opts } : opts || {}
  if (!opts.path) throw new Error('Missing or empty `opts.path`')
  opts.path = path.resolve(process.cwd(), opts.path)

  var put = db.put
    , get = db.get
    , batch = db.batch
    , createReadStream = db.createReadStream

  var blobsPath = opts.path
    , blobs = BlobStore(opts)

  var decode = encoder.decode.bind(null, blobs)
    , save   = encoder.save.bind(null, blobs)

  // don't coerce to vinyl while indexing
  index(db, {get: { valueEncoding: 'json' }});

  // TODO: test keys/values
  db.createReadStream = function(opts) {
    var stream = createReadStream.call(this, opts)

    if (opts && opts.since && opts.values!==false) {
      var since = +opts.since
      var kv = opts.keys!==false

      stream = stream.pipe(through2.obj(function(item, _, next){
        var file = kv ? item.value : item
        var mtime = file.stat && file.stat.mtime
        if (mtime && (since >= +mtime)) next()
        else next(null, item)
      }))
    }

    return stream
  }

  db.src = function(globs, opts) {
    opts = xtend(readDefaults, opts || {}, {values: true, keys: false})
    var stream = globStream(this, globs, opts)
    return stream.pipe(through2.obj(function(file, _, next){
      next(null, decode(file, opts))
    }))
  }

  db.dest = dest
  db.watch = watch

  db.getBlobStore = function() { return blobs }

  db.get = function(path, opts, cb) {
    if (typeof opts == 'function') cb = opts, opts = {}
    opts = xtend(readDefaults, opts || {})

    if (opts.valueEncoding || opts.encoding)
      return get.call(db, path, opts, cb) //as-is

    get.call(db, absolute(path), function(err, file){
      if (err) return cb(err)
      cb(null, decode(file, opts))
    })
  }

  db.subvinyl = function(prefix, opts) {
    if (typeof prefix != 'string') throw new Error('Not supported')
    var sub = db.sublevel(prefix, opts)
    return levelVinyl(sub, path.join(blobsPath, '_'+prefix))
  }

  // key, value, [opts], cb
  // vinyl, [opts], cb
  db.put = function(key, vinyl, opts, cb) {
    if (typeof key != 'string') cb = opts, opts = vinyl, vinyl = key, key = vinyl.path
    if (typeof opts == 'function') cb = opts, opts = {}
    if (!opts) opts = {}

    if (!isVinyl(vinyl) || opts.valueEncoding || opts.encoding)
      return put.call(db, key, vinyl, opts, cb) // as-is

    // dont modify incoming files?
    // vinyl = vinyl.clone()

    save(vinyl, opts, function(err, value, key){
      if (err || value==null) return cb && cb(err, vinyl)

      put.call(db, key, value, opts, function(err){
        cb && cb(err, vinyl)
      })
    })
  }

  // note that blobs are auto-deleted in a post hook (see below)
  var del = db.del; db.del = function(key, cb) {
    // todo: remove this. consumer must be explicit
    key = absolute(key.relative || key)
    del.call(db, key, cb)
  }

  // extra opts: `mode`
  db.batch = function(ops, opts, cb) {
    if (typeof opts == 'function') cb = opts, opts = {}

    var len = ops.length

    ;(function next(i) {
      // skip dels and non-vinyl
      while(i<len && (ops[i].type!='put' || !isVinyl(ops[i].value))) i++
      if (i==len) return batch.call(db, ops, cb)

      var op = ops[i], vinyl = op.value

      op.mode = op.mode || opts.mode

      save(vinyl, op, function(err, value, key){
        if (err) return cb(err)

        if (value==null) {
          ops = ops.splice(i, 1); --len
          return setImmediate(next.bind(null, i))
        }

        op.value = value; op.key = key
        setImmediate(next.bind(null, i+1))
      })
    })(0)
  }

  // remove blob on file removal
  db.index('digest').post(function(op){
    if (op.type=='del') {
      // TODO: index ranges without item key, so the extra
      // lookup becomes unneccesary?
      var digest = op.key[0]
      db.getBy('digest', digest, function(err, item){
        if (!item) blobs.remove(digest)
      })
    }
  })

  return db
}

function isVinyl(vinyl) {
  return typeof vinyl == 'object' && '_contents' in vinyl
}
