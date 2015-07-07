var assert = require('assert');
var sassThematic = require('../index');

describe('@extend placeholder reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.parseThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/placeholder.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops placeholders without keepable override variables.', function() {
    assert.equal(linefeed(4, 1), '// ruleset');
  });

  it ('keeps placeholders with override variables, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(6, 4), '%placeholder-keep { color: $keep-color; // declaration; }');
  });

  it ('drops rulesets without keepable @extend rules or override variables.', function() {
    assert.equal(linefeed(11, 1), '// ruleset');
  });

  it ('keeps placeholders with keepable @extend rules, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(13, 4), '.keep { @extend %placeholder-keep; // declaration; }');
  });

  it ('keeps rulesets with keepable child rulesets.', function() {
    assert.equal(linefeed(18, 1), '.nested {');
  });

  it ('drops nested rulesets without relevant @extend rules or override variables.', function() {
    assert.equal(linefeed(19, 1), '// ruleset');
  });

  it ('keeps nested rulesets with relevant @extend rules, but drops other declarations.', function() {
    assert.equal(linefeed(21, 4), '.keep { @extend %placeholder-keep; // declaration; }');
  });
});