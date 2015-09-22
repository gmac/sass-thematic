var path = require('path');
var assert = require('assert');
var fileImporter = require('../index');

function parse(file, handler) {
  fileImporter.parse({
    includePaths: [path.resolve(__dirname, 'lib/base')],
    cwd: path.resolve(__dirname, 'lib'),
    file: file
  }, handler);
}

function parseFile(file, handler) {
  new fileImporter({
    includePaths: [path.resolve(__dirname, 'lib/base')],
    cwd: path.resolve(__dirname, 'lib'),
    file: file
  }).render(handler);
}

describe('@import path', function() {
  it ('includes locally-pathed file dependencies.', function(done) {
    parse('paths/index', function(err, data) {
      // @import 'path/a'
      assert.contain(data, '.index');
      assert.contain(data, '.path_a');
      done();
    });
  });

  it ('resolves deep file dependencies, each import relative to the current file.', function(done) {
    parse('paths/index', function(err, data) {
      // @import 'path/a' => @import 'path/b'
      assert.contain(data, '.path_path_b');
      done();
    });
  });

  it ('resolves deep file dependencies with path backtraces.', function(done) {
    parse('paths/index', function(err, data) {
      // @import 'path/a' => @import 'path/b' => @import '../../c'
      assert.contain(data, '.c');
      done();
    });
  });

  it ('resolves files available via includePaths.', function(done) {
    parse('paths/index', function(err, data) {
      // @import 'common/d'
      assert.contain(data, '.common_d');
      done();
    });
  });

  it ('resolves a file reference into an absolute file path.', function(done) {
    parseFile('paths/index.scss', function(err, file) {
      assert.equal(file.filepath, path.join(__dirname, 'lib/paths/index.scss'));
      done();
    });
  });

  it ('resolves a directory reference into an absolute file path.', function(done) {
    parseFile('paths/path/path', function(err, file) {
      assert.equal(file.filepath, path.join(__dirname, 'lib/paths/path/path'));
      done();
    });
  });

});