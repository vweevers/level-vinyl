var level = require('level-test')({ valueEncoding: 'json' })
  , levelVinyl = require('../../')
  , sub = require('level-sublevel')
  , path = require('path')
  , tmpdir = require('osenv').tmpdir()
  , mkdirp = require('mkdirp')

module.exports = function() {
  var prefix = 'level-vinyl-tests/' + Date.now()
  mkdirp.sync(path.join(tmpdir, prefix))

  var blobs = path.join(tmpdir, prefix, 'vinyl-blobs');
  var sdb = sub(level(prefix+'/db'), { valueEncoding: 'json'});
  return levelVinyl(sdb, blobs)
}
