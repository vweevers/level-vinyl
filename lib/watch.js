var xtend = require('xtend')
  , EventEmitter = require('events').EventEmitter
  , micromatch = require('micromatch')
  , absolute = require('absolute-glob')

// [pattern(s)][, opts][, cb])
module.exports = function(patterns, opts, cb) {
  if (typeof patterns == 'function') cb = patterns, opts = {}, patterns = null
  else if (typeof opts == 'function') cb = opts, opts = {}

  opts = xtend({ debounceDelay: 500 }, opts || {})

  var changes = {}

  function debounce(path, change) {
    if (!opts.debounceDelay)
      return emitter.emit('change', {type: change, path: path})

    var has = changes[path]
    changes[path] = change

    if (!has) setTimeout(function(){
      var change = changes[path]
      delete changes[path]
      emitter.emit('change', {type: change, path: path})
    }, opts.debounceDelay)
  }

  var removeHook = this.post(function(op){
    var path = op.key
      , patterns = emitter.patterns

    if (!patterns.length || !micromatch(path, patterns).length) {
      return emitter.emit('nomatch', path)
    }

    debounce(path, op.type=='del' ? 'deleted' : 'changed')
  })

  var emitter = new EventEmitter()

  if (typeof opts.maxListeners == 'number')
    emitter.setMaxListeners(opts.maxListeners)

  emitter.patterns = []

  emitter.add = function(patterns) {
    if (typeof patterns == 'string') patterns = [patterns]
    patterns.forEach(function(ptn){
      this.push(absolute(ptn))
    }, this.patterns)
    return this
  }

  emitter.remove = function(patterns) {
    if (typeof patterns == 'string') var negative = '!' + patterns
    else negative = patterns.map(function(p){ return '!'+p })
    this.add(negative)
    return this
  }

  emitter.end = function() {
    removeHook()
    emitter.emit('end')
    return this
  }

  if (patterns) emitter.add(patterns)
  if (cb) emitter.on('change', cb)

  return emitter
}
