var path = require('path');
var assert = require('assert');
var fileImporter = require('../index');

function parse(file, handler) {
  return fileImporter.parse({
    cwd: path.resolve(__dirname, 'lib'),
    file: file
  }, handler);
}

describe('other import scenarios', function() {
  it ('Allows the import of blank files.', function(done) {
    parse('scenarios/blank', function(err, data) {
      assert.match(data, /^\s+/);
      done();
    });
  });

  it ('errors upon encountering recursive imports.', function(done) {
    fileImporter.parse({
        cwd: path.resolve(__dirname, 'lib'),
        file: 'scenarios/recursive-a'
      })
      .on('end', function() {
        assert.fail('No error encountered.');
        done();
      })
      .on('error', function(err) {
        assert(/Recursive/.test(err.message));
        done();
      });
  });

  it.skip ('ignores url() imports.', function(done) {
    done();
  });

  it.skip ('ignores absolute imports.', function(done) {
    done();
  });
});