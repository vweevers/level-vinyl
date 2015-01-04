# level-vinyl

> leveldb vinyl adapter and blob store. Saves file contents in a content
addressable blob store, file metadata in leveldb. Supports globbing, but no
"base" magic yet.

[![npm status](http://img.shields.io/npm/v/level-vinyl.svg?style=flat-square)](https://www.npmjs.org/package/level-vinyl) [![Stability](http://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](http://nodejs.org/api/documentation.html#documentation_stability_index) [![Travis build status](https://img.shields.io/travis/vweevers/level-vinyl.svg?style=flat-square&label=travis)](http://travis-ci.org/vweevers/level-vinyl) [![AppVeyor build status](https://img.shields.io/appveyor/ci/vweevers/level-vinyl.svg?style=flat-square&label=appveyor)](https://ci.appveyor.com/project/vweevers/level-vinyl) [![Dependency status](https://img.shields.io/david/vweevers/level-vinyl.svg?style=flat-square)](https://david-dm.org/vweevers/level-vinyl)

Jump to: [example](#example) / [api](#api) / [progress](#progress) / [install](#install) / [license](#license)

## why?

Because `level-vinyl` is a vinyl adapter, you can use 1000+ gulp plugins to transform files. Because the file metadata is saved in leveldb, you can:

- (theoretically) pipe to and from other databases, local and elsewhere. Use `opts.since` to only stream new files!
- index file properties, do map-reduces
- use sublevels to for example, save multiple versions of the same files
- use triggers and hooks to process new files

In other words, this is a nice abstraction for a file processing service.

## example

```js
var levelvinyl = require('level-vinyl')
  , level      = require('level-test')()
  , sublevel   = require('level-sublevel')
  , buffer     = require('vinyl-buffer')
  , imagemin   = require('imagemin-jpegtran')()
  , vfs        = require('vinyl-fs')
  , fromFile   = require('vinyl-file')

// Create database
var db = level();
var sdb = sublevel(db, { valueEncoding: 'json'});
var vinylDb = levelvinyl(sdb, './example/blobs')

// Create a virtual file
var file = fromFile.readSync('example.jpg')

// Save it
vinylDb.put(file, function(){

  // Create a sublevel for minified images
  var min = vinylDb.subvinyl('minified')

  // Minify
  vinylDb.src('*.jpg')
    .pipe(buffer())
    .pipe(imagemin())
    .pipe(min.dest())

    // Copy to actual file
    .pipe(vfs.dest('example/minified'))
})
```

## api

## progress

In terms of compatibility with gulp / vinyl-fs.

### `src(globs, opts)`

**Differences:**

- `file.contents` is a stream, `opts.buffer` is not supported (use `vinyl-buffer` to convert streams to buffers)

**Features:**

- [x] multiple globs, negation
- [ ] consistent order (needs test)
- [x] Base: `file.base` is set to "glob base" or `opts.base`
- [x] No read: `file.isNull()` when `opts.read == false`
- [ ] should pass through writes (needs test)
- [x] should glob a directory
- [x] return dead stream if globs is empty array
- [x] throw on invalid glob (not a string or array)
- [x] Support `opts.since`

### `dest(path, opts)`

**Differences:**

- Files are saved in leveldb with a relative path, so the behavior of `dest`
  is gonna be different from vinyl-fs. Under consideration.
- Only saves a subset of `file.stat`: mtime, ctime, mode and size. Always sets the file flag on mode (in other words: `stat.isFile()` is always true).
- Doesn't have a notion of directories

**Features:**

- [ ] resets streams
- [ ] updates vinyl files (cwd, base, path, mode)
- [ ] opts.mode
- [ ] doesn't write null files (needs specific test)
- [ ] writes buffers (needs specific test)
- [ ] writes streams (needs specific test)
- [ ] should allow piping multiple dests
- [ ] new files get file mode 777
- [ ] throw on invalid (empty) folder
- [ ] support `path` as function

## install

With [npm](https://npmjs.org) do:

```
npm install level-vinyl
```

## license

[MIT](http://opensource.org/licenses/MIT) © [Vincent Weevers](http://vincentweevers.nl)
