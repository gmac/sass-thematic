var path = require('path');
var assert = require('assert');
var fileImporter = require('../index');

function parse(file, handler) {
  return fileImporter.parse({
    cwd: path.resolve(__dirname, 'lib'),
    file: file
  }, handler);
}

describe('@import statement', function() {
  it ('includes a peer file dependency.', function(done) {
    parse('imports/index', function(err, data) {
      // @import 'sibling-a';
      assert.contain(data, '.index');
      assert.contain(data, '.sibling-a');
      done();
    });
  });

  it ('includes a prefixed peer dependency.', function(done) {
    parse('imports/index', function(err, data) {
      // @import 'sibling-b';
      assert.contain(data, '.sibling-b');
      done();
    });
  });

  it ('includes deeply-nested peer dependencies.', function(done) {
    parse('imports/index', function(err, data) {
      // @import 'sibling-c'; => @import 'sibling-d';
      assert.contain(data, '.sibling-c');
      assert.contain(data, '.sibling-d');
      done();
    });
  });

  it ('includes group dependencies.', function(done) {
    parse('imports/index', function(err, data) {
      // @import 'group';
      assert.contain(data, '.group_a');
      assert.contain(data, '.group_b');
      done();
    });
  });

  it ('removes original @import statement during resolution.', function(done) {
    parse('imports/index', function(err, data) {
      assert.doesNotContain(data, '@import');
      done();
    });
  });

  it ('emits a reference to each imported file.', function(done) {
    var files = [];
    parse('imports/index')
      .on('file', function(filename) {
        files.push(filename);
      })
      .on('end', function() {
        assert.equal(files.length, 7)
        done();
      });
  });
});