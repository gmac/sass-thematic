var assert = require('assert');
var sassThematic = require('../index');

describe('@extend reducer', function() {
  var linefeed;

  before(function(done) {
    sassThematic.parseThemeSass({
      varsFile: 'style/reduce/_vars.scss',
      file: 'style/reduce/extend.scss',
      cwd: __dirname,
    }, function(err, src) {
      var lines = src.split('\n');
      linefeed = function(s, len) {
        return lines.slice(s, s+len).map(function(s) { return s.trim() }).join(' ');
      };
      done();
    });
  });

  it ('drops rulesets without keepable @extend rules or override variables.', function() {
    assert.equal(linefeed(11, 1), '// ruleset');
  });

  it ('keeps rulesets with override variables, but drops unnecessary @extend rules.', function() {
    assert.equal(linefeed(13, 4), '.keep { // extend; color: $keep-color; }');
  });

  it ('keeps rulesets with relevant @extend rules, but drops unnecessary declarations.', function() {
    assert.equal(linefeed(18, 4), '.keep { @extend .extend-keep; // declaration; }');
  });

  it ('drops rulesets that chain @extend rules onto omitted rulesets.', function() {
    assert.equal(linefeed(23, 1), '// ruleset');
  });

  it ('keeps rulesets that chain @extend rules onto preserved rulesets.', function() {
    assert.equal(linefeed(25, 3), '.chain-keep { @extend .keep; }');
  });

  it ('drops nested rulesets without relevant @extend rules or override variables.', function() {
    assert.equal(linefeed(30, 1), '// ruleset');
  });

  it ('keeps nested rulesets with relevant @extend rules, but drops other declarations.', function() {
    assert.equal(linefeed(32, 4), '.keep { @extend .extend-keep; // declaration; }');
  });
});