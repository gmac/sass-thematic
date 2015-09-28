var assert = require('assert');
var sassThematic = require('../index');

describe('keyframes reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.parseThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/keyframes.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops keyframe blocks without override variables.', function() {
    assert.equal(linefeed(4, 1), '// atruler');
  });

  it ('drops keyframe rulesets without override variables.', function() {
    assert.equal(linefeed(7, 1), '// ruleset');
  });

  it ('keeps keyframe blocks that contain frames with override variables.', function() {
    assert.equal(linefeed(6, 6), '@keyframes anim-keep { // ruleset 100% { width: $keep-size; } }');
  });
});
