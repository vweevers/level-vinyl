var level = require('level-test')({ valueEncoding: 'json' })
  , levelVinyl = require('../../')
  , sub = require('level-sublevel')
  , path = require('path')
  , tmpdir = require('osenv').tmpdir()
  , mkdirp = require('mkdirp')
  , prefix = 'level-vinyl-tests/' + Date.now()
  , blobs = path.join(tmpdir, prefix, 'vinyl-blobs')

mkdirp.sync(blobs)

var ldb = level(prefix+'/db')
  , sdb = sub(ldb, { valueEncoding: 'json' })
  , vdb = levelVinyl(sdb, blobs)
  , n   = 1

module.exports = function() {
  return vdb.subvinyl( '' + n++ )
}
