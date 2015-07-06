var assert = require('assert');
var overrides = require('../index');

describe('directive reducer', function() {
  var linefeed;

  before(function(done) {
    overrides.render({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/directive.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops loops without override variables.', function() {
    assert.equal(linefeed(4, 1), '// loop');
  });

  it ('keeps loops that contain rulesets with override variables.', function() {
    assert.equal(linefeed(6, 5), '@for $i from 1 through 5 { .keep-#{$i} { color: $keep-color; } }');
  });

  it ('drops loops that inflect and implement unnecessary variables.', function() {
    assert.equal(linefeed(12, 1), '// loop');
  });

  it ('keeps loops that inflect and implement override variables.', function() {
    assert.equal(linefeed(14, 5), '@each $c in $keep-color { .keep { color: $c; } }');
  });
});