var level = require('level-test')({ valueEncoding: 'json' })
  , levelVinyl = require('../')
  , sub = require('level-sublevel')
  , path = require('path')
  , tmpdir = require('osenv').tmpdir()

module.exports = function() {
  var blobs = path.join(tmpdir, 'level-vinyl', String(Date.now()));
  var sdb = sub(level(), { valueEncoding: 'json'});
  return levelVinyl(sdb, blobs)  
}
