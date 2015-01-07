var absolute = require('absolute-glob')
  , through2 = require('through2')
  , path     = require('path')

module.exports = function(prefix, opts) {
  opts || (opts = {})

  if (typeof prefix === 'function') {
    prefix = function(fn, vinyl) {
      return absolute(fn(vinyl))
    }.bind(null, prefix)
  } else {
    prefix = absolute(prefix)
  }

  var cwd = opts.cwd || '/'

  // "The write path is calculated by appending the file relative path
  // to the given destination directory."

  var stream = through2.obj(function(vinyl, _, next){
    var relative = vinyl.relative
    var vprefix = typeof prefix === 'function' ? prefix(vinyl) : prefix

    vinyl.base = vinyl.cwd = cwd
    vinyl.path = path.join(cwd, vprefix, relative)

    this.put(vinyl, opts, next)
  }.bind(this))

  stream.resume()
  return stream
}
