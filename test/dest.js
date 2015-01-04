var test = require('tape')

test.skip('dest resets streams', function(t){
  // TODO
  // "contents will have it's position reset to the beginning if it is a stream"
})

test.skip('dest updates vinyl files', function(t){
  // TODO: "The file will be modified after being written to this stream:
  // cwd, base, and path will be overwritten to match the folder
  // stat.mode will be overwritten if you used a mode parameter"
})

test.skip('dest folder', function(t){
  // TODO: we differ from vinyl-fs here, describe wanted behaviour.

  // vinyl-fs does this:
  // "The write path is calculated by appending the file relative path
  // to the given destination directory. In turn, relative paths are
  // calculated against the file base."

  // also: "options.cwd for the output folder, only has an effect if
  // provided output folder is relative."
})

test.skip('opts.mode', function(t){
  // TODO
  // only applies to files for us
  // "options.mode Octal permission string specifying mode for any folders that
  // need to be created for output folder."
})

test.skip('no conflicts between sublevel blobs', function(t){
  // TODO
})

test.skip('should not write null files', function(t){
  // TODO
})

test.skip('writes buffers', function(t){
  // TODO
})

test.skip('writes streams', function(t){
  // TODO
})

test.skip('should allow piping multiple dests in streaming mode', function(t){
  // TODO
  // re-emits data
})

test.skip('should write new files with the default user mode (777)', function(t){
  // TODO
})

test.skip('should explode on invalid folder (empty)', function(t){
  // TODO
})

test.skip('path function', function(t) {
  // TODO
  // "a function that returns a path. the function will be provided a vinyl File instance."
})
