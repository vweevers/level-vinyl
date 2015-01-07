var constants = require('constants')
  , absolute  = require('absolute-glob')
  , path      = require('path')
  , Stats     = require('fs').Stats
  , Vinyl     = require('vinyl')
  , eos       = require('end-of-stream')
  , through2  = require('through2')

// should rename this
exports.save = save
exports.decode = decode

// save contents in blob store and update stat
function save(blobs, vinyl, opts, cb) {
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
    var key = value.path

    cb(null, value, key)
  })
}

function encode(vinyl) {
  var plain = {
    path: absolute(vinyl.relative),
    stat: encodeStat(vinyl.stat)
  }

  customProperties(vinyl).forEach(function(prop){
    var val = vinyl[prop]
    if (val!=null) this[prop] = val
  }, plain)

  return plain
}

function decode(blobs, file, opts) {
  if (opts && opts.base) file.base = opts.base

  var cwd = file.cwd = path.normalize('/')//process.cwd()

  // file.base = path.resolve(cwd, file.base || '.')
  // file.path = path.join(cwd, path.normalize(file.relative))

  file.base = path.normalize(file.base || '/')
  file.path = path.normalize(file.path)
  file.stat = decodeStat(file.stat)

  var vinyl = new Vinyl(file)

  customProperties(file).forEach(function(prop){
    vinyl[prop] = file[prop]
  })

  // TODO: vinyl.key instead of digest (so other stores can be used)
  if (opts && opts.read && vinyl.digest)
    vinyl.contents = blobs.createReadStream(vinyl.digest)

  return vinyl
}

function customProperties(file) {
  var stdProps =
    [ 'history', 'contents', 'cwd'
    , 'base', 'stat', 'path', 'relative' ]

  return Object.keys(file).filter(function(prop){
    return prop[0]!=='_' && stdProps.indexOf(prop)<0
  })
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
