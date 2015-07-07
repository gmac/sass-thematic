var assert = require('assert');
var sassThematic = require('../index');

describe('@mixin reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.parseThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/mixin.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops @mixin blocks without override variables.', function() {
    assert.equal(linefeed(4, 1), '// mixin');
  });

  it ('keeps @mixin blocks with override variables, but drops other declarations.', function() {
    assert.equal(linefeed(6, 4), '@mixin mixin-keep() { color: $keep-color; // declaration; }');
  });

  it ('keeps nested ruleset heirarchies.', function() {
    assert.equal(linefeed(11, 1), '.nested {');
  });

  it ('drops rulesets without keepable mixin @include rules or override variables.', function() {
    assert.equal(linefeed(12, 1), '// ruleset');
  });

  it ('keeps rulesets with override variables, but drops omitted mixin @includes.', function() {
    assert.equal(linefeed(14, 4), '.keep { // include; color: $keep-color; }');
  });

  it ('keeps rulesets with a keepable mixin @includes, but drops other declarations.', function() {
    assert.equal(linefeed(19, 4), '.keep { @include mixin-keep; // declaration; }');
  });
});