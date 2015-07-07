var assert = require('assert');
var sassThematic = require('../index');

describe('interpolation reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.renderThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/interpolation.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops rulesets that interpolate unnecessary variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset');
  });

  it ('keeps rulesets that interpolate override variables.', function() {
    assert.equal(linefeed(6, 3), '.keep { color: #{$keep-color}; }');
  });
});