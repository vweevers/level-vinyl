# level-vinyl

> leveldb vinyl adapter and blob store. Saves file contents in a content
addressable blob store, file metadata in leveldb. Supports globbing, most of the vinyl-fs / gulp 4.0 options and emits streaming vinyl files.

[![npm status](http://img.shields.io/npm/v/level-vinyl.svg?style=flat-square)](https://www.npmjs.org/package/level-vinyl) [![Travis build status](https://img.shields.io/travis/vweevers/level-vinyl.svg?style=flat-square&label=travis)](http://travis-ci.org/vweevers/level-vinyl) [![AppVeyor build status](https://img.shields.io/appveyor/ci/vweevers/level-vinyl.svg?style=flat-square&label=appveyor)](https://ci.appveyor.com/project/vweevers/level-vinyl) [![Dependency status](https://img.shields.io/david/vweevers/level-vinyl.svg?style=flat-square)](https://david-dm.org/vweevers/level-vinyl)

Jump to: [example](#example) / [api](#api) / [progress](#progress) / [install](#install) / [license](#license)

## why?

Because level-vinyl is a vinyl adapter, you can:

- use 1000+ gulp plugins to transform files
- aggregate files using multiple globs and negation
- do `gulp.src('src/*.png').pipe(db.dest('assets'))` like a pro: `src/1.png` ends up
  in your database at `assets/1.png`
- stream only modified files with `opts.since`
- save on memory because `file.contents` is a stream

Because level-vinyl saves metadata (stat, digest and custom properties) to leveldb by unixified relative path, you can:

- pipe to and from other databases, local and elsewhere (theoretically).
- index metadata, do map-reduces
- use sublevels to for example, save multiple versions of the same files
- use triggers and hooks to process new files

**In other words, this is a nice abstraction for a file processing service.**

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

### `src(globs[, opts])`

**Differences:**

- `file.contents` is a stream, `opts.buffer` is not supported (use `vinyl-buffer` to convert streams to buffers)
- Only streams regular files (`file.stat.isFile()` is always true).

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
- [ ] set glob opts (`nobrace` etc.)

### `dest([path][, opts])`

**Differences:**

- Files are saved in leveldb by their `relative` property, optionally prefixed
with `path`. Note that `dest('/docs')` does the same as `dest('docs')`.
- Saves a small subset of `file.stat`: mtime, ctime, mode and size. Mode is 777
  or `opts.mode`; only permission flags are saved.
- Doesn't have a notion of directories

**Features:**

- [ ] resets streams
- [x] updates files after write (cwd, base, path, mode)
- [x] opts.mode
- [x] doesn't write null files
- [x] writes buffers
- [x] writes streams
- [ ] should allow piping multiple dests (needs test)
- [x] <strike>throw on invalid (empty) folder</strike>
- [x] support `path` as function (gets a vinyl file, should return a path)
- [x] support `opts.cwd` (irrelevant for save, but does set `file.cwd`)

### `watch([pattern(s)][, opts][, cb])`

Not yet implemented.

**Differences:**

- emits change events with relative paths
- no `ready` event or callback argument for `add()`, because initialization is synchronous
- does not support the change types "renamed" and "added"

**Features:**

- [x] add `cb` as change listener
- [x] `opts.debounceDelay`: debounce events for the same file/event, default delay is 500
- [x] `opts.maxListeners`
- [ ] keeps process alive
- [x] does nothing if `patterns` is empty

Returns an EventEmitter with these features:

- [x] emits `change` with `{type, path}` data where type is "changed" or "deleted".
- [x] `.end()`: unwatch and emit "end"
- [x] `.add(patterns)`: add patterns to be watched
- [x] `.remove(path)`: "removes a file or directory from being watched. Does not recurse directories"
- [x] emits `nomatch`

## install

With [npm](https://npmjs.org) do:

```
npm install level-vinyl
```

## license

[MIT](http://opensource.org/licenses/MIT) © [Vincent Weevers](http://vincentweevers.nl)
