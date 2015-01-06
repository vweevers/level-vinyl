var level = require('level-test')({ valueEncoding: 'json' })
  , levelVinyl = require('../../')
  , sub = require('level-sublevel')
  , path = require('path')
  , tmpdir = require('osenv').tmpdir()

module.exports = function() {
  var prefix = 'level-vinyl-tests/' + Date.now()
  var blobs = path.join(tmpdir, prefix, 'blobs');
  var sdb = sub(level(prefix+'/db'), { valueEncoding: 'json'});
  return levelVinyl(sdb, blobs)
}
