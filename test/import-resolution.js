var path = require('path');
var assert = require('assert');
var fileImporter = require('../index');

function parse(file, handler) {
  fileImporter.parse({
    cwd: path.resolve(__dirname, 'lib'),
    file: file
  }, handler);
}

describe('file resolution', function() {
  it ('resolves a requested file using file base name.', function(done) {
    parse('resolution/index', function(err, data) {
      assert.contain(data, '.index');
      done();
    });
  });

  it ('resolves a requested file with a full filename.', function(done) {
    parse('resolution/index.scss', function(err, data) {
      assert.contain(data, '.index');
      done();
    });
  });

  it ('resolves a requested file partial without underscore prefix.', function(done) {
    parse('resolution/prefix', function(err, data) {
      assert.contain(data, '.prefix');
      done();
    });
  });

  it ('resolves a requested file partial with underscore prefix.', function(done) {
    parse('resolution/_prefix', function(err, data) {
      assert.contain(data, '.prefix');
      done();
    });
  });

  it ('resolves a requested file partial without underscore prefix, but with file extension.', function(done) {
    parse('resolution/prefix.scss', function(err, data) {
      assert.contain(data, '.prefix');
      done();
    });
  });

  it ('resolves a requested file partial with underscore prefix and file extension.', function(done) {
    parse('resolution/_prefix.scss', function(err, data) {
      assert.contain(data, '.prefix');
      done();
    });
  });

  it ('resolves a requested directory into its complete ".scss" file contents.', function(done) {
    parse('resolution/group', function(err, data) {
      assert.contain(data, '.group_a');
      assert.contain(data, '.group_b');
      done();
    });
  });

  it ('resolves contents of a provided data string.', function(done) {
    fileImporter.parse({
      cwd: path.resolve(__dirname, 'lib'),
      data: '@import "resolution/group";'
    }, function(err, data) {
      assert.contain(data, '.group_a');
      assert.contain(data, '.group_b');
      done();
    });
  });
});