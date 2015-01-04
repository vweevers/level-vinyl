var Vinyl = require('vinyl')
  , path = require('path')

module.exports = function(relative, content, props) {
  props || (props = {})

  if (props.stat && typeof props.stat.mtime == 'string')
    props.stat.mtime = new Date(props.stat.mtime)

  if (props.stat && typeof props.stat.ctime == 'string')
    props.stat.ctime = new Date(props.stat.ctime)

  props.path = path.resolve(__dirname, '..', relative)
  props.contents = typeof content == 'string' ? new Buffer(content) : content

  return new Vinyl(props)
}
