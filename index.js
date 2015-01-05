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
  , Minimatch = require("minimatch").Minimatch
  , ordered = require('ordered-read-streams')
  , unique = require('unique-stream')
  , glob2base = require('glob2base')
  , Stats = require('fs').Stats
  , constants = require('constants')

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
  // TODO: what if it's an absolute path?
  db.src = function(globs, opts) {
    if (typeof globs == 'string') globs = [globs]
    else if (!Array.isArray(globs)) throw new Error('Invalid glob')

    globs = globs.map(function(glob){
      if (!glob || typeof glob != 'string') throw new Error('Invalid glob')
      return unixify(glob, true)
    })

    opts = xtend({ read: true }, opts || {})

    if (!globs.length) {
      // Like vinyl-fs, return a dead stream
      var stream = through2.obj()
      process.nextTick(stream.end.bind(stream))
      return stream
    }

    var negatives = [], positives = []

    // separate globs
    globs.forEach(function(glob, i){
      var a = glob[0] === '!' ? negatives : positives
      a.push({index: i, glob: glob})
    })

    var numPositive = positives.length

    if (!numPositive || (numPositive==1 && positives[0]=='**')) {
      return db.createValueStream()
        .pipe(filterNegatives(negatives.map(toGlob)))
        .pipe(toVinyl(opts))
    }

    // create stream for each positive glob, so indices get reused
    // the logic for this (and some code) is copied from `glob-stream`
    var streams = positives.map(function(positive){
      var glob = positive.glob, i = positive.index

      if (isGlob(glob)) {
        db.index(glob, function (path, file, globs){
          return micromatch(path, globs).length ? [] : null
        });

        var stream = db.streamBy(glob)

        // set file.base to glob base
        if (!opts.base) stream = stream.pipe(setBase(glob))
      } else {
        // get by path
        if (glob[glob.length-1]!=='/') {
          // assume a single file is wanted
          var range = { gte: glob, limit: 1, lt: glob+'*'}
        } else {
          // effectively a directory glob
          range = { gt: glob, lt: glob+'\xff' }
        }

        stream = db.createValueStream(range)
      }

      // only filter if negative glob came after this positive glob
      var negativeGlobs = negatives.filter(indexGreaterThan(i)).map(toGlob)

      if (negativeGlobs.length)
        stream = stream.pipe(filterNegatives(negativeGlobs))

      return stream
    })

    // aggregate into stream of unique items
    return ordered(streams).pipe(unique('relative')).pipe(toVinyl(opts))
  }

  db.vinylBlobs = function() { return blobs }

  db.get = function(path, opts, cb) {
    if (typeof opts == 'function') cb = opts, opts = {}
    opts = xtend({read: true}, opts || {})

    if (opts.valueEncoding || opts.encoding)
      return get.call(db, path, opts, cb) //as-is

    get.call(db, unixify(path, true), function(err, file){
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
    if (typeof key != 'string') cb = opts, opts = vinyl, vinyl = key, key = vinyl.relative
    if (typeof opts == 'function') cb = opts, opts = {}
    if (!opts) opts = {}

    if (!isVinyl(vinyl) || opts.valueEncoding || opts.encoding)
      return put.call(db, key, vinyl, opts, cb) // as-is

    // dont modify incoming files?
    // vinyl = vinyl.clone()

    save(vinyl, opts, function(err, value, key){
      if (err || value==null) return cb(err, vinyl)
      put.call(db, key, value, opts, function(err){
        cb(err, vinyl)
      })
    })
  }

  // note that blobs are auto-deleted in a post hook (see below)
  var del = db.del; db.del = function(key, cb) {
    key = unixify(key.relative || key, true)
    del.call(db, key, cb)
  }

  db.dest = function(prefix, opts) {
    opts || (opts = {})

    if (typeof prefix === 'function') {
      prefix = function(fn, vinyl) {
        return normalizePrefix(fn(vinyl))
      }.bind(null, prefix)
    } else {
      prefix = normalizePrefix(prefix)
    }

    var cwd = opts.cwd || process.cwd()

    // "The write path is calculated by appending the file relative path
    // to the given destination directory."

    var stream = through2.obj(function(vinyl, _, next){
      var relative = vinyl.relative
      var vprefix = typeof prefix === 'function' ? prefix(vinyl) : prefix

      vinyl.base = vinyl.cwd = cwd
      vinyl.path = path.resolve(cwd, vprefix, relative)

      db.put(vinyl, opts, next)
    })

    stream.resume()
    return stream
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

  function isVinyl(vinyl) {
    return typeof vinyl == 'object' && '_contents' in vinyl
  }

  function toVinyl(opts) {
    var since = opts.since ? +opts.since : 0

    return through2.obj(function(file, _, next){
      if (since && since >= file.stat.mtime)
        return next()

      if (opts.base) file.base = opts.base
      next(null, decode(file, opts.read))
    })
  }

  // save contents in blob store and update stat
  function save(vinyl, opts, cb) {
    if (vinyl.isNull()) return cb()

    var ws = blobs.createWriteStream()

    eos(vinyl.pipe(ws), function(err) {
      if (err) return cb(err)

      var stat = vinyl.stat = vinyl.stat || new Stats
        , oldDigest = vinyl.digest
        , now = new Date

      vinyl.digest = ws.key

      stat.size = ws.size
      stat.ctime = now

      if (!stat.mtime || (oldDigest && vinyl.digest!==oldDigest))
        stat.mtime = now

      // default perm is 777, always set file flag
      stat.mode = (opts.mode || 0777) | constants.S_IFREG

      var value = encode(vinyl)
      var key = value.relative

      cb(null, value, key)
    })
  }

  function decode(file, read) {
    var cwd = file.cwd = process.cwd()

    file.base = path.resolve(cwd, file.base || '.')
    file.path = path.join(cwd, path.normalize(file.relative))
    file.stat = decodeStat(file.stat)

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

function encode(vinyl) {
  var plain = {
    relative: unixify(vinyl.relative, true),
    stat: encodeStat(vinyl.stat)
  }

  customProperties(vinyl).forEach(function(prop){
    var val = vinyl[prop]
    if (val!=null) this[prop] = val
  }, plain)

  return plain
}

function encodeStat(stat) {
  return {
    ctime: +stat.ctime,
    mtime: +stat.mtime,
    mode : 0777 & stat.mode, // only save permissions
    size : stat.size
  }
}

function decodeStat(plain) {
  var stat = new Stats()

  stat.mtime = new Date(plain.mtime)
  stat.ctime = new Date(plain.ctime)
  stat.mode  = constants.S_IFREG | plain.mode // set regular file flag
  stat.size  = plain.size

  return stat
}

function setBase(glob) {
  var mm = new Minimatch(glob)
  var base = glob2base({minimatch: mm})

  return through2.obj(function(file, _, next){
    file.base = base
    next(null, file)
  })
}

function filterNegatives(globs) {
  if (!globs.length) return through2.obj()

  globs.unshift('**') // or micromatch won't match
  return through2.obj(function(file, _, next){
    if (micromatch(file.relative, globs).length) this.push(file)
    next()
  })
}

// taken from `glob-stream`
function toGlob(item) {
  return item.glob
}

// taken from `glob-stream`
function indexGreaterThan(index) {
  return function(obj) {
    return obj.index > index;
  };
}

function normalizePrefix(prefix) {
  if (!prefix) return '.'

  prefix = unixify(prefix)
  if (prefix[0]==='/') prefix = prefix.slice(1)

  return prefix
}
