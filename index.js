var Vinyl = require('vinyl')
  , through2 = require('through2')
  , BlobStore = require('content-addressable-blob-store')
  , eos = require('end-of-stream')
  , xtend = require('xtend')
  , path = require('path')
  , index = require('level-map-index')
  , micromatch = require('micromatch')
  , isGlob = require('is-glob')
  , unixify = require('unixify')

module.exports = levelVinyl

function levelVinyl(db, opts) {
  opts = typeof opts == 'string' ? { path: opts } : opts || {}
  if (!opts.path) throw new Error('Missing or empty `opts.path`')
  opts.path = path.resolve(process.cwd(), opts.path)

  var put = db.put, get = db.get, batch = db.batch
    , blobsPath = opts.path, blobs = BlobStore(opts)

  // don't coerce to vinyl while indexing
  index(db, {get: { valueEncoding: 'json' }});

  // TODO: auto-remove old indices (but when?)
  // TODO: base should be glob base or opts.base
  // TODO: what if it's an absolute path?
  db.src = function(globs, opts) {
    if (typeof globs == 'string') globs = [globs]
    else if (!Array.isArray(globs)) opts = globs, globs = []

    opts = xtend({ read: true }, opts || {})

    if (!globs.length) {
      var stream = db.createValueStream()
    } else if (globs.length==1 && !isGlob(globs[0])) { // get by path
      globs[0] = unixify(globs[0])
      stream = db.createValueStream({start: globs[0], limit: 1})
    } else if (db.hasIndex(globs)) {
      stream = db.streamBy(globs)
    } else {
      stream = through2.obj() // passthrough

      db.index(globs, function (path, file, globs){
        return micromatch(path, globs).length ? [] : null
      }).on('complete', function(){
        db.streamBy(globs).pipe(stream)
      }).start()
    }

    return stream.pipe(through2.obj(function(value, _, next){
      next(null, decode(value, opts.read))
    }))
  }

  db.vinylBlobs = function() { return blobs }

  db.get = function(path, opts, cb) {
    if (typeof opts == 'function') cb = opts, opts = {}
    opts = xtend({read: true}, opts || {})

    if (opts.valueEncoding || opts.encoding)
      return get.call(db, path, opts, cb) //as-is

    get.call(db, path, function(err, file){
      if (err) return cb(err)
      cb(null, decode(file, opts.read))
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
    if (isVinyl(key)) cb = opts, opts = vinyl, vinyl = key, key = vinyl.relative
    if (typeof opts == 'function') cb = opts, opts = {}
    if (!isVinyl(vinyl) || opts.valueEncoding || opts.encoding)
      return put.call(db, key, vinyl, opts, cb) // as-is
    db.batch([{type: 'put', value: vinyl, key: key}], opts, cb)
  }

  // note that blobs are auto-deleted in a post hook (see below)
  var del = db.del; db.del = function(key, cb) {
    key = key.relative || key
    del.call(db, key, cb)
  }

  // TODO: adhere to gulp rules:
  // - https://github.com/gulpjs/gulp/blob/master/docs/API.md
  // - https://github.com/wearefractal/vinyl-fs
  // TODO: "The file will be modified after being written to this stream:
  // cwd, base, and path will be overwritten to match the folder
  // stat.mode will be overwritten if you used a mode parameter
  // contents will have it's position reset to the beginning if it is a stream"
  db.dest = function(folder) {
    var stream = through2.obj(function(vinyl, _, next){
      db.put(vinyl.relative, vinyl, function (err) {
        next(err, vinyl)
      })
    })
    stream.resume()
    return stream
  }

  db.batch = function(ops, opts, cb) {
    if (typeof opts == 'function') cb = opts, opts = null

    var len = ops.length

    ;(function next(i) {
      // skip dels and non-vinyl
      while(i<len && (ops[i].type!='put' || !isVinyl(ops[i].value))) i++
      if (i==len) return batch.call(db, ops, cb)

      var op = ops[i], vinyl = op.value

      writeContents(vinyl, function(err){
        if (err) return cb(err)
        op.value = encode(vinyl)
        op.key = op.value.relative
        setImmediate(next.bind(null, i+1))
      })
    })(0)

    function writeContents(vinyl, cb) {
      // todo: should we delete the blob? (not if opts.read was false)
      if (vinyl.isNull()) return cb()

      // save contents in blob store
      var ws = blobs.createWriteStream()
      eos(vinyl.pipe(ws), function(err) {
        if (!err) vinyl.digest = ws.key
        cb(err)
      })
    }
  }

  // remove blob on file removal
  db.index('digest').post(function(op){
    if (op.type=='del') blobs.remove(op.key[0])
  })

  return db

  function isVinyl(vinyl) {
    return typeof vinyl == 'object' && '_contents' in vinyl
  }

  function encode(vinyl) {
    var plain = {
      relative: unixify(vinyl.relative)
    }

    customProperties(vinyl).concat('stat').forEach(function(prop){
      var val = vinyl[prop]
      if (val!=null) this[prop] = val
    }, plain)

    return plain
  }

  function decode(file, read) {
    file.relative = path.normalize(file.relative)

    // TODO: does this even matter? because these paths are virtual
    file.base = file.cwd = blobsPath
    file.path = path.join(blobsPath, file.relative)

    var vinyl = new Vinyl(file)

    customProperties(file).forEach(function(prop){
      vinyl[prop] = file[prop]
    })

    // TODO: vinyl.key instead of digest (so other stores can be used)
    if (read && vinyl.digest)
      vinyl.contents = blobs.createReadStream(vinyl.digest)

    return vinyl
  }
}

function customProperties(file) {
  var stdProps =
    [ 'history', 'contents', 'cwd'
    , 'base', 'stat', 'path', 'relative' ]

  return Object.keys(file).filter(function(prop){
    return prop[0]!=='_' && stdProps.indexOf(prop)<0
  })
}
