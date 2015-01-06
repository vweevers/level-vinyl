# level-vinyl

> leveldb vinyl adapter and blob store. Saves file contents in a content
addressable blob store, file metadata in leveldb. Supports globbing, most of the gulp 4.0 options and emits streaming [vinyl](https://github.com/wearefractal/vinyl) files.

[![npm status](http://img.shields.io/npm/v/level-vinyl.svg?style=flat-square)](https://www.npmjs.org/package/level-vinyl) [![Travis build status](https://img.shields.io/travis/vweevers/level-vinyl.svg?style=flat-square&label=travis)](http://travis-ci.org/vweevers/level-vinyl) [![AppVeyor build status](https://img.shields.io/appveyor/ci/vweevers/level-vinyl.svg?style=flat-square&label=appveyor)](https://ci.appveyor.com/project/vweevers/level-vinyl) [![Dependency status](https://img.shields.io/david/vweevers/level-vinyl.svg?style=flat-square)](https://david-dm.org/vweevers/level-vinyl)

Jump to: [example](#example) / [api](#api) / [progress](#progress) / [install](#install) / [license](#license)

## why?

**level-vinyl gives you the combined power of vinyl and levelup.**

Because level-vinyl is a vinyl adapter, you can:

- use [1000+ gulp plugins](http://gulpjs.com/plugins) to transform files
- aggregate files using multiple globs and negation
- do `gulp.src('src/*.png').pipe(db.dest('/assets'))` like a pro: `src/1.png` ends up
  in your database at `/assets/1.png`
- stream only modified files with `options.since`

Because level-vinyl saves metadata (stat, digest and custom properties) to leveldb by a virtual path, you can:

- pipe to and from other databases, local and elsewhere (theoretically).
- index metadata, do map-reduces
- use sublevels to for example, save multiple versions of the same files
- use triggers and hooks to process new files
- or do [something else](https://github.com/rvagg/node-levelup/wiki/Modules) entirely

## example

```js
var levelvinyl = require('level-vinyl')
  , level      = require('level-test')()
  , sublevel   = require('level-sublevel')
  , buffer     = require('vinyl-buffer')
  , imagemin   = require('imagemin-jpegtran')()
  , vfs        = require('vinyl-fs')

// Create database
var db = level();
var sdb = sublevel(db, { valueEncoding: 'json'});
var vinylDb = levelvinyl(sdb, './example/blobs')

// Create a sublevel for minified images
var min  = vinylDb.subvinyl('minified').dest('/')
var main = vinylDb.dest('/')

vfs.src('*.jpg')     // file.contents is a buffer
  .pipe(main)        // save to db
  .pipe(imagemin())  // minify
  .pipe(min)         // save minified to db
```

Same thing, other way around:

```js
var min  = vfs.dest('./example/minified')
var main = vfs.dest('./example')

vinylDb.src('*.jpg') // file.contents is a stream
  .pipe(main)        // copy to fs
  .pipe(buffer())    // imagemin wants buffers
  .pipe(imagemin())  // minify
  .pipe(min)         // copy minified to fs
```

Note though, it's a levelup database:

```js
vinylDb.get('/example.jpg', function(err, file){
  file.contents.pipe(somewhere)
})

vinylDb.get('/example.jpg', { read: false }, function(err, file){
  console.log( file.isNull() === true )
})
```

## api

## progress

In terms of compatibility with gulp / vinyl-fs.

### `src(pattern(s)[, options])`

**Differences**

- `file.contents` is a stream; `options.buffer` is not supported. You can use [vinyl-buffer](https://www.npmjs.com/package/vinyl-buffer) to convert streams to buffers (as the above example does).
- Only streams regular files (`file.stat.isFile()` is always true).

**Features**

- aggregate multiple glob patterns, negation
- results are ordered
- `file.base` is set to the "glob base" or `options.base`
- `file.isNull()` when `options.read == false`
- should glob a directory
- return dead stream if globs is empty array
- throw on invalid glob (not a string or array)
- support `options.since`

**Missing  / partial support**

- should pass through writes (*needs test*)
- set glob options (`nobrace` etc).

### `dest([path][, options])`

**Differences**

- The `path` argument is optional and defaults to `/`. Files are identified in leveldb by an absolute
virtual path, which is constructed from a file's `relative` property, optionally prefixed
with `path`. Note that `dest('/docs')` currently does the same as `dest('docs')`,
because there is no concept of a "current working directory" within the tree.
- Saves a small subset of `file.stat`: mtime, ctime, mode and size. Mode is 777
  or `options.mode`; only permission flags are saved.

**Features**

- updates files after write (`cwd`, `base`, `path` and `stat`)
- custom mode with `options.mode` (this is just metadata and has no effect on the blob store)
- writes buffers and streams, skips null files
- supports `path` as function (gets a vinyl file, should return a path).

**Missing  / partial support**

- should allow piping multiple dests and should reset streams (*needs specific test*)
- support `options.cwd` (*irrelevant for save, but does set `file.cwd`*)

### `watch([pattern(s)][, options][, cb])`

**Differences**

- does not emit a `ready` event and `add()` has no callback argument
- the change types `renamed` and `added` are not supported
- does not keep the process alive
- both `add()` and `remove()` accept glob patterns.

**Features**

- adds `cb` as change listener
- `options.debounceDelay`: debounce events for the same file, default delay is 500
- `options.maxListeners` is passed to [emitter.setMaxListeners](http://nodejs.org/api/events.html#events_emitter_setmaxlisteners_n)
- does nothing if `patterns` is empty.

Returns an emitter with these events:

- `change` with `{type, path}` data where type is `changed` or `deleted`.
- `nomatch`, when a changed or deleted file doesn't match the patterns
- `end` when stopped.

And these methods:

- `add(pattern(s))`: add patterns to be watched
- `remove(pattern(s))`: exclude files from being matched
- `end()`: stop watching.

## install

With [npm](https://npmjs.org) do:

```
npm install level-vinyl
```

## license

[MIT](http://opensource.org/licenses/MIT) © [Vincent Weevers](http://vincentweevers.nl)
